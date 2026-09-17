/**
 * 在店监控 Hub /monitor（U3 任务 F · 规格书 §5 · 母本 §5 屏 371-426 行）
 *
 * 结构：MainScaffold（title「在店监控」+ sub 真值计数 + actions 两枚 u3-chipf
 * 过滤服务中/寄养）→ 三列 mon-card 卡墙（纸面 ring 20 圆角 overflow hidden）：
 * - 照片头 16:10（该单最新过程照 thumbUrl；无照片=浅木色块 #D4B896）+ 纸面 badge
 *   （「服务中 · 实时」/「寄养 · 房型名」）；
 * - 洗护卡：名+服务 + 6 段步进条（薄荷 done/柠檬 now/墨灰未到）+ 员工·最新动态行；
 * - 寄养卡：第 N 晚（日界差+1）· 今日打卡态（lastLogDate===今天→已打卡 ✓）
 *   · 退房日；超期红字「超期」+「应退未退 N 天」。
 * 点击卡 → /monitor/:id（单约监控别名深链，同组件）。
 *
 * 数据（全现成，零新接口）：listForStore(in_service/in_boarding) + 每卡
 * serviceStep.list + boarding.stayBoard（含 stay/appointment/pet/customer
 * /lastLogDate/overdue）；寄养卡的房型名/员工名按 appointmentId 与
 * listForStore(in_boarding) 行拼合。
 *
 * SSE（全局单连接 context，见 dashboard/MerchantEventsProvider，不自建第二连接）：
 * step_updated/step_flagged → 对应卡 invalidate serviceStep.list；
 * boarding.daily_update/overdue/completed → invalidate stayBoard；
 * checkin/completed/cancelled/reopened → 全量对齐；onReconnect 全量对齐。
 * ⚠️ 取舍（已上报）：step_updated 服务端仅发 appointment 频道（serviceStep.ts
 * B2-8 注释「维持仅 appointment 频道（防刷屏），不改」），store 频道收不到——
 * 洗护卡步进另挂 15s 慢轮询兜底（仅步骤列表，接口照旧），保证 confirmStep 后
 * 监控页不手动刷新也能翻步；其余事件仍由 SSE 即时驱动。
 */

import { EventType, getStepDef, usePhiliaClient } from '@philia/shared';
import { useQueries, useQuery, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dayStart,
  fmtTime,
  localDayKey,
  type ListForStoreItem,
  type StayBoardEntry,
  type StepListItem,
} from '../components/appointments/appt-utils';
import {
  useMerchantEvents,
  type MerchantEventsValue,
} from '../components/dashboard/MerchantEventsProvider';
import MainScaffold, { QuietButton } from '../components/MainScaffold';

/** 洗护卡步进兜底轮询（step_updated 仅 appointment 频道，store 频道盲区的安全网） */
const STEP_POLL_MS = 15_000;

type FilterKey = 'all' | 'service' | 'boarding';

/* ---- 晚数口径（与 BoardingPage / 服务端 boardingNightDates 同：本地日历日差） ---- */
const DAY_MS = 24 * 3600 * 1000;
const dayDiff = (a: Date, b: Date) =>
  Math.round((dayStart(a).getTime() - dayStart(b).getTime()) / DAY_MS);
/** 第 N 晚 = 今天 − scheduledStart 日界差 + 1（夹 ≥1） */
const nightIndex = (start: Date) => Math.max(1, dayDiff(new Date(), start) + 1);
/** 超期天数（展示夹 ≥1；超期真值以 entry.overdue 为准） */
const overdueDays = (end: Date) => Math.max(1, dayDiff(new Date(), end));
/** 退房日 M/D（母本 9/19 式样） */
const fmtCheckout = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** 该单最新过程照（steps 按 stepOrder 升序、photos 按 takenAt 升序，倒序取末张） */
function latestPhoto(steps: StepListItem[] | undefined) {
  if (!steps) return null;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const photos = steps[i]!.photos;
    if (photos.length > 0) return photos[photos.length - 1]!;
  }
  return null;
}

/** 员工·最新动态行：{staffName} · {当前步名中 / 最近完成时间 / 等待开工} */
function activityLine(staffName: string | null | undefined, steps: StepListItem[] | undefined): string {
  const who = staffName ?? '待指派';
  if (!steps || steps.length === 0) return `${who} · 等待开工`;
  const active = steps.find((s) => s.status === 'active');
  if (active) return `${who} · ${getStepDef(active.stepKey)?.name ?? active.stepKey}中`;
  const dones = steps.filter((s) => s.status === 'done' && s.doneAt);
  const last = dones[dones.length - 1];
  if (last?.doneAt) return `${who} · 最近完成 ${fmtTime(last.doneAt)}`;
  return `${who} · 等待开工`;
}

/** 卡面公共工艺：纸面 ring 20 圆角 overflow hidden + 按下 120ms scale */
const cardCls =
  'block w-full overflow-hidden rounded-panel bg-[#FFFDF6] text-left shadow-[0_0_0_1px_rgba(74,59,46,.09)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]';

/** 照片头 16:10 + 纸面 badge pill */
function CardPhotoHead({
  thumbUrl,
  badge,
  dotCls,
}: {
  thumbUrl: string | null;
  badge: string;
  dotCls: string;
}) {
  return (
    <div
      className="relative aspect-[16/10] w-full bg-[#D4B896] bg-cover [background-position:center_60%]"
      style={thumbUrl ? { backgroundImage: `url(${thumbUrl})` } : undefined}
    >
      <span className="absolute left-2.5 top-2.5 flex items-center gap-[5px] rounded-full bg-[#FFFDF6] px-2.5 py-1 text-caption-xs font-extrabold">
        <i className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
        {badge}
      </span>
    </div>
  );
}

/** 6 段步进条：薄荷 done / 柠檬 now / 墨灰未到 */
function StepBars({ steps }: { steps: StepListItem[] | undefined }) {
  return (
    <div className="mt-2.5 flex gap-1">
      {Array.from({ length: 6 }).map((_, i) => {
        const st = steps?.[i]?.status;
        const cls =
          st === 'done'
            ? 'bg-[#7FD8BE]'
            : st === 'active'
              ? 'bg-[#FDC830]'
              : 'bg-[rgba(74,59,46,.06)]';
        return <i key={i} className={`h-1 flex-1 rounded-full ${cls}`} />;
      })}
    </div>
  );
}

/** 卡片骨架（禁转圈：opacity 脉冲） */
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-panel bg-[#FFFDF6] shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
      <div className="aspect-[16/10] w-full animate-pulse bg-[rgba(74,59,46,.06)]" />
      <div className="p-[12px_14px]">
        <div className="h-3.5 w-32 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
        <div className="mt-2 h-3 w-44 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
        <div className="mt-2.5 flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-1 flex-1 animate-pulse rounded-full bg-[rgba(74,59,46,.06)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Hub 事件接线：在 effect 中注册/注销（context 的 onEvent/onReconnect 返回取消函数） */
function useHubEvents(
  events: MerchantEventsValue,
  queryClient: QueryClient,
  alignAll: () => void,
) {
  useEffect(
    () =>
      events.onEvent((envelope) => {
        const data = (envelope.data ?? {}) as Record<string, unknown>;
        const aid = typeof data.appointmentId === 'string' ? data.appointmentId : null;
        switch (envelope.type) {
          // store 频道今日收不到 step_updated（仅 appointment 频道），订阅保留作
          // 前向兼容；生效中的兜底是洗护卡 15s 慢轮询（见文头说明）
          case EventType.StepUpdated:
          case EventType.StepFlagged:
            if (aid) void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
            break;
          case EventType.BoardingDailyUpdate:
            void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
            break;
          case EventType.BoardingOverdue:
          case EventType.BoardingCompleted:
          case EventType.AppointmentCheckedIn:
          case EventType.AppointmentCompleted:
          case EventType.AppointmentCancelled:
          case EventType.AppointmentReopened:
            alignAll();
            break;
          default:
            break;
        }
      }),
    [events, queryClient, alignAll],
  );
  useEffect(() => events.onReconnect(alignAll), [events, alignAll]);
}

export default function MonitorHubPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const events = useMerchantEvents();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('all');

  /* ---------------- 数据 ---------------- */

  const inServiceQ = useQuery({
    queryKey: ['appointment', 'listForStore', 'monitor', 'in_service'],
    queryFn: () => trpc.appointment.listForStore.query({ status: 'in_service' }),
  });
  const inBoardingQ = useQuery({
    queryKey: ['appointment', 'listForStore', 'monitor', 'in_boarding'],
    queryFn: () => trpc.appointment.listForStore.query({ status: 'in_boarding' }),
  });
  const boardQ = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
  });

  const serviceItems = useMemo(
    () => (inServiceQ.data ?? []) as ListForStoreItem[],
    [inServiceQ.data],
  );
  const boardingItems = useMemo(
    () => (inBoardingQ.data ?? []) as ListForStoreItem[],
    [inBoardingQ.data],
  );
  const board = useMemo(() => (boardQ.data?.board ?? []) as StayBoardEntry[], [boardQ.data]);

  // 洗护卡六步：一卡一查（键与单约页共享缓存；15s 兜底轮询，见文头取舍说明）
  const stepsQueries = useQueries({
    queries: serviceItems.map((it) => ({
      queryKey: ['serviceStep', 'list', it.id],
      queryFn: () => trpc.serviceStep.list.query({ appointmentId: it.id }),
      refetchInterval: STEP_POLL_MS,
    })),
  });
  const stepsByAid = new Map<string, StepListItem[]>();
  serviceItems.forEach((it, i) => {
    const d = stepsQueries[i]?.data;
    if (d) stepsByAid.set(it.id, d as StepListItem[]);
  });

  // 寄养卡：stayBoard 为主（lastLogDate/overdue），房型名/员工名按 appointmentId 拼 listForStore
  const boardingMetaByAid = useMemo(
    () => new Map(boardingItems.map((it) => [it.id, it] as const)),
    [boardingItems],
  );

  /* ---------------- SSE（全局单连接） ---------------- */

  const alignAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore', 'monitor'] });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
  }, [queryClient]);

  useHubEvents(events, queryClient, alignAll);

  /* ---------------- 渲染 ---------------- */

  const pending = inServiceQ.isPending || inBoardingQ.isPending || boardQ.isPending;
  const failed = inServiceQ.isError || inBoardingQ.isError || boardQ.isError;

  const today = localDayKey(new Date());
  const visibleService = filter === 'boarding' ? [] : serviceItems;
  const visibleBoarding = filter === 'service' ? [] : board;
  const totalVisible = visibleService.length + visibleBoarding.length;

  const chip = (key: FilterKey, label: string) => (
    <button
      type="button"
      aria-pressed={filter === key}
      onClick={() => setFilter((f) => (f === key ? 'all' : key))}
      className={`u3-chipf ${filter === key ? 'on' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <MainScaffold
      title="在店监控"
      sub={`服务中 ${serviceItems.length} 单 · 寄养 ${board.length} 只 · 实时同步`}
      actions={
        <>
          {chip('service', `服务中 ${serviceItems.length}`)}
          {chip('boarding', `寄养 ${board.length}`)}
        </>
      }
      testid="monitor-hub-page"
    >
      {pending ? (
        <div
          className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3"
          aria-label="加载中"
        >
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : failed ? (
        <div className="u3-panel px-[17px] py-14 text-center">
          <div className="text-body-sm font-semibold text-[rgba(74,59,46,.62)]">
            监控列表加载失败
          </div>
          <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">请检查网络后重试</div>
          <div className="mt-4 flex justify-center">
            <QuietButton
              onClick={() => {
                void inServiceQ.refetch();
                void inBoardingQ.refetch();
                void boardQ.refetch();
              }}
            >
              重新加载
            </QuietButton>
          </div>
        </div>
      ) : totalVisible === 0 ? (
        <div className="u3-panel px-[17px] py-16 text-center">
          <div className="text-body-sm font-semibold text-[rgba(74,59,46,.62)]">
            现在店里很安静——有单开工时这里会实时动起来
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {/* 洗护卡（listForStore 已按预约开始时间升序） */}
          {visibleService.map((it) => {
            const steps = stepsByAid.get(it.id);
            const photo = latestPhoto(steps);
            const doneCount = steps?.filter((s) => s.status === 'done').length ?? 0;
            return (
              <button
                key={it.id}
                type="button"
                className={cardCls}
                onClick={() => navigate(`/monitor/${it.id}`)}
                data-testid={`monitor-card-${it.id}`}
              >
                <CardPhotoHead
                  thumbUrl={photo?.thumbUrl ?? photo?.url ?? null}
                  badge="服务中 · 实时"
                  dotCls="bg-[#7FD8BE]"
                />
                <div className="p-[12px_14px]">
                  <div className="flex items-baseline justify-between text-body-sm font-extrabold">
                    <span>
                      {it.petName} · {it.serviceName}
                    </span>
                    <span className="font-number text-caption font-extrabold tabular-nums">
                      {doneCount}/{steps?.length ?? 6}
                    </span>
                  </div>
                  <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                    {activityLine(it.staffName, steps)}
                  </div>
                  <StepBars steps={steps} />
                </div>
              </button>
            );
          })}

          {/* 寄养卡（按退房日升序，超期/今日退房自然排前） */}
          {[...visibleBoarding]
            .sort(
              (a, b) => a.appointment.scheduledEnd.getTime() - b.appointment.scheduledEnd.getTime(),
            )
            .map((entry) => {
              const meta = boardingMetaByAid.get(entry.appointment.id);
              const n = nightIndex(entry.appointment.scheduledStart);
              const checkedToday = entry.lastLogDate === today;
              return (
                <button
                  key={entry.appointment.id}
                  type="button"
                  className={cardCls}
                  onClick={() => navigate(`/monitor/${entry.appointment.id}`)}
                  data-testid={`monitor-card-${entry.appointment.id}`}
                >
                  <CardPhotoHead
                    thumbUrl={null}
                    badge={`寄养 · ${meta?.serviceName ?? '寄养'}`}
                    dotCls="bg-[#D4B896]"
                  />
                  <div className="p-[12px_14px]">
                    <div className="flex items-baseline justify-between text-body-sm font-extrabold">
                      <span>{entry.pet.name}</span>
                      {entry.overdue ? (
                        <span className="font-number text-caption font-extrabold tabular-nums text-[#D92D20]">
                          超期
                        </span>
                      ) : (
                        <span className="font-number text-caption font-extrabold tabular-nums">
                          D{n}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                      {entry.overdue
                        ? `应退未退 ${overdueDays(entry.appointment.scheduledEnd)} 天 · 联系主人或续住`
                        : `第 ${n} 晚 · ${checkedToday ? '今日已打卡 ✓' : '今日未打卡'} · ${fmtCheckout(entry.appointment.scheduledEnd)} 退房`}
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </MainScaffold>
  );
}
