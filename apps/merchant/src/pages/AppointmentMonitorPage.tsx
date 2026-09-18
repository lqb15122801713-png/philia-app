/**
 * 单约监控 /monitor/:id（= /appointments/:id/monitor 别名同组件）
 * （U3 任务 N · 规格书 §13 · 母本 754-814 行）
 *
 * 结构：MainScaffold（title `{宠物} · {服务} · 实时监控`；sub `{员工} · HH:MM–HH:MM
 * · SSE 实时同步`；actions=实时签 u3-st live「● 实时连接中」/断线换 wait「重连中…」）
 * → 两栏（1.6fr:1fr gap 14）：
 * - 左：过程照片墙（128×96 最新在前，点击放大=PhotoViewer 现成）+ 家长端视角说明卡
 *   （文案冻结原文，B3-1 在案）；
 * - 右：六步进度卡（MonitorTimeline=u3-stepv 本地档 + 时间戳 + 张数）+ 快捷操作
 *   （QuietButton「打标重拍」→ 现有 flagForRedo 弹层链路（可填原因）保留；
 *   QuietButton「联系员工」→ 就地展开员工信息小卡：姓名/角色/今日排班段，
 *   staffList 真值，staff 表无电话字段不编造）。
 * - 寄养单：BoardingMonitorPanel 现有（视觉已对齐 u3 工艺）。
 *
 * SSE：watch=aid 订阅 step_updated/step_flagged/reopened/completed/boarding.daily_update
 * （appointments/useMerchantEvents.ts 局部 hook 逻辑保留——appointment 频道只能靠
 * watch 挂入，全局 store 连接收不到，故本页保留局部连接）；onReconnect 全量对齐。
 */

import {
  EventType,
  usePhiliaClient,
  type EventEnvelope,
  type ServiceStepKey,
} from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import MainScaffold, { QuietButton } from '../components/MainScaffold';
import {
  dayKeyOf,
  fmtTime,
  stepDisplayName,
  type StaffListItem,
  type StepListItem,
} from '../components/appointments/appt-utils';
import {
  BoardingMonitorPanel,
  type LiveLogItem,
} from '../components/appointments/BoardingMonitorPanel';
import { ConfirmDialog } from '../components/appointments/ConfirmDialog';
import { MonitorTimeline, pickFlaggableStep } from '../components/appointments/MonitorTimeline';
import { PhotoViewer, type ViewPhoto } from '../components/appointments/PhotoViewer';
import { useMerchantEvents } from '../components/appointments/useMerchantEvents';

/** 员工角色 → 中文（staff.role 枚举：frontdesk=前台 / groomer=美容师，批次 S1） */
const ROLE_LABEL: Record<string, string> = { frontdesk: '前台', groomer: '美容师' };
const roleLabel = (role: string): string => ROLE_LABEL[role] ?? role;

/** 今日排班段：schedule[今日] →「HH:MM–HH:MM」多段「 · 」相连；无排班 →「今日未排班」 */
function todayScheduleLabel(staff: StaffListItem | null): string {
  const ranges = staff?.schedule?.[dayKeyOf(new Date())] ?? [];
  if (!ranges || ranges.length === 0) return '今日未排班';
  return ranges.map((r) => `${r.start}–${r.end}`).join(' · ');
}

/** 墙照片：全步聚合，最新在前（takenAt 降序，空时间排末） */
function wallPhotosOf(steps: StepListItem[]): ViewPhoto[] {
  return steps
    .flatMap((s) => s.photos)
    .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0))
    .map((p) => ({
      id: p.id,
      url: p.url,
      thumbUrl: p.thumbUrl ?? undefined,
      takenAt: p.takenAt,
      tag: p.tag,
    }));
}

/** 家长端视角说明卡（文案冻结原文） */
function ParentViewNote() {
  return (
    <>
      <div className="u3-panel-head border-t border-[rgba(74,59,46,.06)]">
        <h3>家长端视角</h3>
        <span className="aside">与客户端「服务中全程页」同源</span>
      </div>
      <p className="px-[17px] pb-4 text-caption leading-[1.7] text-[rgba(74,59,46,.62)]">
        家长看到的内容与这屏一致（六步进度+过程照）。照片一经上传即双频道推送，不可删除，仅可被商家「打标重拍」作废旧照（B3-1
        在案）。
      </p>
    </>
  );
}

export default function AppointmentMonitorPage() {
  const { id: aid } = useParams<{ id: string }>();
  const { trpc, queryClient } = usePhiliaClient();

  /* ---------------- 查询 ---------------- */

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
  });
  const appt = detailQuery.data?.appointment;
  const pet = detailQuery.data?.pet;
  const service = detailQuery.data?.service;

  const isBoarding = appt?.type === 'boarding';
  const inLiveFlow =
    appt?.status === 'in_service' || appt?.status === 'in_boarding' || appt?.status === 'completed';

  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && !isBoarding && !!inLiveFlow,
  });
  const steps = useMemo(() => (stepsQuery.data ?? []) as StepListItem[], [stepsQuery.data]);

  const boardQuery = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
    enabled: !!aid && !!appt && isBoarding && !!inLiveFlow,
  });
  const boardEntry = useMemo(
    () => boardQuery.data?.board.find((b) => b.appointment.id === aid) ?? null,
    [boardQuery.data, aid],
  );

  // 员工小卡 + 副行员工名：store.staffList 真值（姓名/角色/排班；无电话字段）
  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
    enabled: !!appt,
  });
  const staff = useMemo(
    () => staffQuery.data?.staff.find((s) => s.id === appt?.staffId) ?? null,
    [staffQuery.data, appt?.staffId],
  );

  /* ---------------- 全量对齐 / SSE ---------------- */

  const alignAll = useCallback(() => {
    if (!aid) return;
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
  }, [queryClient, aid]);

  const [liveLogs, setLiveLogs] = useState<LiveLogItem[]>([]);
  const [viewer, setViewer] = useState<{ photos: ViewPhoto[]; index: number } | null>(null);
  const [staffOpen, setStaffOpen] = useState(false);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      // store 频道会混入其他预约的事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return;

      switch (envelope.type) {
        case EventType.StepUpdated:
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
          break;
        case EventType.StepFlagged:
          // 打标后旧照片服务端已作废，必须全量重取
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
          break;
        case EventType.AppointmentCompleted:
          toast.success('服务已完成');
          alignAll();
          break;
        case EventType.AppointmentReopened:
          // v1.1-b3 B3-1：completed 单打标重开 → 预约回 in_service，全量对齐
          toast.warning('该预约已重新开启（打回服务中），等待员工重拍');
          alignAll();
          break;
        case EventType.BoardingDailyUpdate: {
          const logDate = typeof data.logDate === 'string' ? data.logDate : '';
          toast(`${logDate ? `${logDate} ` : ''}寄养打卡已更新`);
          setLiveLogs((prev) =>
            [{ logDate: logDate || '今日', ts: envelope.ts }, ...prev].slice(0, 20),
          );
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
          break;
        }
        case EventType.BoardingCompleted:
        case EventType.AppointmentCheckedIn:
        case EventType.AppointmentCancelled:
          alignAll();
          break;
        default:
          break;
      }
    },
    [aid, alignAll, queryClient],
  );

  const { connected } = useMerchantEvents({ watch: aid ?? null, onEvent, onReconnect: alignAll });

  /* ---------------- 打标重拍（现有 flagForRedo 弹层链路保留） ---------------- */

  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const flagTarget = useMemo(() => pickFlaggableStep(steps), [steps]);

  const flagMut = useMutation({
    mutationFn: (input: { stepKey: ServiceStepKey; reason?: string }) =>
      trpc.serviceStep.flagForRedo.mutate({ appointmentId: aid!, ...input }),
    onSuccess: (r, vars) => {
      const label = stepDisplayName(vars.stepKey);
      toast.success(
        r.reopened
          ? `已打标「${label}」：预约已重新开启（打回服务中），等待员工重拍`
          : r.reactivated
            ? `已打标「${label}」：步骤已回退为进行中，旧照片作废，等待员工重拍`
            : `已打标「${label}」，等待员工重拍`,
      );
      setFlagOpen(false);
      setFlagReason('');
      void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
      // v1.1-b3 B3-1：completed→in_service 重开，头部状态需同步对齐
      if (r.reopened) {
        void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '打标失败，请稍后再试'),
  });

  /* ---------------- 渲染 ---------------- */

  const title = `${pet?.name ?? '宠物'} · ${service?.name ?? (isBoarding ? '寄养服务' : '洗护服务')} · 实时监控`;
  const sub = appt
    ? `${staff?.name ?? (appt.staffId ? '员工' : '待指派')} · ${fmtTime(appt.scheduledStart)}–${fmtTime(appt.scheduledEnd)} · SSE 实时同步`
    : 'SSE 实时同步';
  const liveBadge = (
    <span className={connected ? 'u3-st live' : 'u3-st wait'} data-testid="monitor-live-badge">
      {connected ? '● 实时连接中' : '重连中…'}
    </span>
  );

  const wallPhotos = useMemo(() => wallPhotosOf(steps), [steps]);
  const doneCount = steps.filter((s) => s.status === 'done').length;

  return (
    <MainScaffold title={title} sub={sub} actions={liveBadge} testid="appointment-monitor-page">
      {viewer ? (
        <PhotoViewer
          photos={viewer.photos}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        />
      ) : null}

      {detailQuery.isPending ? (
        /* 加载骨架（禁转圈） */
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]" aria-label="加载中">
          <div className="u3-panel p-[14px_17px]">
            <div className="h-3.5 w-28 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
            <div className="mt-3 flex flex-wrap gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 w-32 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]"
                />
              ))}
            </div>
          </div>
          <div className="u3-panel p-[14px_17px]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="mt-2.5 h-3.5 w-40 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]" />
            ))}
          </div>
        </div>
      ) : detailQuery.isError || !appt ? (
        <div className="u3-panel px-[17px] py-14 text-center">
          <div className="text-body-sm font-semibold text-[rgba(74,59,46,.62)]">
            打不开这个监视页
          </div>
          <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '预约不存在或无权限'}
          </div>
        </div>
      ) : !inLiveFlow ? (
        /* 尚未开始 / 已取消 */
        <div className="u3-panel px-[17px] py-14 text-center">
          <div className="text-body-sm font-semibold text-[rgba(74,59,46,.62)]">
            {appt.status === 'cancelled' ? '预约已取消' : '服务尚未开始'}
          </div>
          <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
            {appt.status === 'cancelled'
              ? '该预约已取消，无服务过程可监视。'
              : '客户到店核销后，这里会实时展示服务进度与照片。'}
          </div>
        </div>
      ) : isBoarding ? (
        <BoardingMonitorPanel
          boardingStay={detailQuery.data?.boardingStay ?? null}
          boardEntry={boardEntry}
          liveLogs={liveLogs}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
          {/* 左：过程照片墙 + 家长端视角 */}
          <div className="u3-panel" data-testid="monitor-wall">
            <div className="u3-panel-head">
              <h3>过程照片墙</h3>
              <span className="aside">最新在前 · 点击放大</span>
            </div>
            {stepsQuery.isPending ? (
              <div className="flex flex-wrap gap-2 px-[17px] pb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 w-32 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]"
                  />
                ))}
              </div>
            ) : steps.length === 0 ? (
              <p className="px-[17px] pb-4 text-caption text-[rgba(74,59,46,.62)]">
                六步流尚未初始化（等待员工核销）。
              </p>
            ) : wallPhotos.length === 0 ? (
              <p className="px-[17px] pb-4 text-caption text-[rgba(74,59,46,.62)]">
                员工上传过程照后会实时出现在这里。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 px-[17px] pb-4 pt-1">
                {wallPhotos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setViewer({ photos: wallPhotos, index: i })}
                    className="block h-24 w-32 overflow-hidden rounded-chip bg-[#F6F1E3] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                    aria-label={`照片 ${i + 1}`}
                  >
                    <img
                      src={p.thumbUrl ?? p.url}
                      alt={p.tag ?? `照片 ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            <ParentViewNote />
          </div>

          {/* 右：六步进度 + 快捷操作 */}
          <div className="u3-panel self-start">
            <div className="u3-panel-head">
              <h3>六步进度</h3>
              <span className="aside font-number tabular-nums">
                {doneCount}/{steps.length || 6}
              </span>
            </div>
            {stepsQuery.isPending ? (
              <div className="px-[17px] pb-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="mt-2.5 h-3.5 w-40 animate-pulse rounded-chip bg-[rgba(74,59,46,.06)]"
                  />
                ))}
              </div>
            ) : steps.length === 0 ? (
              <p className="px-[17px] pb-4 text-caption text-[rgba(74,59,46,.62)]">
                六步流尚未初始化（等待员工核销）。
              </p>
            ) : (
              <MonitorTimeline steps={steps} />
            )}

            <div className="u3-panel-head border-t border-[rgba(74,59,46,.06)]">
              <h3>快捷操作</h3>
            </div>
            <div className="flex gap-2.5 px-[17px] pb-4">
              <div className="flex-1 [&>button]:w-full">
                <QuietButton
                  testid="monitor-flag-entry"
                  disabled={!flagTarget || flagMut.isPending}
                  onClick={() => {
                    setFlagReason('');
                    setFlagOpen(true);
                  }}
                >
                  {flagMut.isPending ? '打标中…' : '打标重拍'}
                </QuietButton>
              </div>
              <div className="flex-1 [&>button]:w-full">
                <QuietButton testid="monitor-staff-entry" onClick={() => setStaffOpen((v) => !v)}>
                  联系员工
                </QuietButton>
              </div>
            </div>

            {/* 联系员工：就地展开员工信息小卡（staffList 真值，无电话字段不编造） */}
            {staffOpen ? (
              <div className="mx-[17px] mb-4 rounded-[14px] bg-[#F6F1E3] px-3.5 py-2.5">
                {staff ? (
                  <>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-caption-xs text-[rgba(74,59,46,.42)]">姓名</span>
                      <span className="text-caption font-semibold">{staff.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-caption-xs text-[rgba(74,59,46,.42)]">角色</span>
                      <span className="text-caption font-semibold">{roleLabel(staff.role)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-caption-xs text-[rgba(74,59,46,.42)]">今日排班</span>
                      <span className="font-number text-caption font-semibold tabular-nums">
                        {todayScheduleLabel(staff)}
                      </span>
                    </div>
                    <p className="pt-1.5 text-caption-xs text-[rgba(74,59,46,.42)]">
                      店内对讲或到工位找TA；联系方式请走门店内部渠道。
                    </p>
                  </>
                ) : (
                  <p className="py-1.5 text-caption text-[rgba(74,59,46,.62)]">
                    该单尚未指派员工，可在预约详情页改派。
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 打标重拍确认弹层（现有链路：填原因 → flagForRedo） */}
      <ConfirmDialog
        open={flagOpen && flagTarget !== null}
        title={`打标重拍「${flagTarget ? (stepDisplayName(flagTarget.stepKey)) : ''}」？`}
        body={
          appt?.status === 'completed'
            ? '该预约已完成：打标将重新开启本预约（打回「服务中」），该步骤回退为「进行中」，员工重拍后需重新确认完成。'
            : flagTarget?.status === 'done'
              ? '该步骤将回退为「进行中」，已有照片全部作废，员工需重新拍摄上传。'
              : '该步骤当前进行中，打标后员工会收到重拍提醒。'
        }
        confirmText="确认打标"
        danger
        loading={flagMut.isPending}
        onConfirm={() => {
          if (!flagTarget) return;
          const reason = flagReason.trim();
          flagMut.mutate({
            stepKey: flagTarget.stepKey as ServiceStepKey,
            ...(reason ? { reason } : {}),
          });
        }}
        onCancel={() => setFlagOpen(false)}
      >
        <textarea
          value={flagReason}
          onChange={(e) => setFlagReason(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="重拍原因（可选，200 字内），会随通知发给员工"
          className="mt-3 w-full rounded-control border border-line bg-sunken px-3 py-2 text-body text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
        />
      </ConfirmDialog>
    </MainScaffold>
  );
}
