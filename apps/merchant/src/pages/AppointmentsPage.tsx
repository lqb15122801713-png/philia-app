/**
 * U3 任务 D · 预约列表 /appointments（规格书 §3 · 母本 246–290 行，整页重写）
 *
 * - MainScaffold：title「预约」+ sub「M月d日 · 共 N 单 · 自动接单已启用」；
 *   actions = SearchInput「搜索宠物 / 客户 / 单号…」（纯前端按 petName/customerName/code
 *   过滤当前列表，零新接口）+ LemonButton「＋ 新增预约」（商家端无新建表单 → toast
 *   引导：客户端预约 / 前台手动核销登记）。
 * - 筛选 chips（u3-chipf，当前墨底）：今天 N / 待到店 N / 服务中 N / 已完成 N /
 *   取消申请 N / 寄养 N / 日期 ›。计数真值 = 今日 listForStore 全量在前端按口径聚合
 *   （待到店 = confirmed+pending 且未核销、服务中 = in_service、已完成 = completed、
 *   取消申请 = cancel_requested、寄养 = type boarding）。状态档点击 = 前端过滤
 *   （查询参数不变）；「日期 ›」就地展开原生 input[type=date]，选日才改 from/to
 *   （当日 0 点区间）。选中非今天时「今天」chip 不再 on。
 * - 表（u3-panel + u3-tbl）：时间(Montserrat)｜宠物+客户(昵称·尾号)｜服务｜员工+来源
 *   小签｜金额(tabular)｜状态胶囊(u3-st)｜›；tr.rowlink 点击进 /appointments/:id。
 *   列表纯读——S4 起确认/婉拒链路在详情页，行内按钮与 month 日历查询随批删除
 *   （CalendarView 已 git rm，日历视图=明确不做）。空态=「这一天没有预约」。
 * - 深链：?status=cancel_requested|pending|… 初始化状态档（总览待办行会跳）；
 *   ?from=todo 兼容 = 不锁当天（from/to 省略查全量），防待办「去处理」被「今天」吞单。
 * - SSE（store 频道）：appointment.created / cancel_requested → 红点 toast + invalidate；
 *   其余预约状态事件静默 invalidate；断线重连 onReconnect 全量对齐。
 * - 计数跨日真值：主列表已是今日时直接复用；选了其他日期（或 from=todo 全量档）时
 *   补一档同接口的今日查询（enabled 条件触发），chips 计数恒为今日口径。
 */

import { EventType, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MainScaffold, { LemonButton, QuietButton, SearchInput } from '../components/MainScaffold';
import { AppointmentRow } from '../components/appointments/AppointmentRow';
import {
  StatusChips,
  type CategoryKey,
  type ChipCounts,
} from '../components/appointments/StatusChips';
import { showToast, ToastHost } from '../components/appointments/Toast';
import { useMerchantEvents } from '../components/appointments/useMerchantEvents';
import { useStepProgress } from '../components/appointments/useStepProgress';
import {
  addDays,
  fmtDate,
  localDayKey,
  type ListForStoreItem,
} from '../components/appointments/appt-utils';

/* ------------------------------------------------------------------ */
/* 状态档口径（规格书 §3；appt-utils.ts 只读不改，故聚合逻辑就地）          */
/* ------------------------------------------------------------------ */

const CATEGORY_MATCH: Record<CategoryKey, (i: ListForStoreItem) => boolean> = {
  /** 待到店 = confirmed + pending 且未核销 */
  arriving: (i) => (i.status === 'confirmed' || i.status === 'pending') && !i.checkedInAt,
  /** 服务中 = in_service */
  serving: (i) => i.status === 'in_service',
  /** 已完成 = completed */
  done: (i) => i.status === 'completed',
  /** 取消申请 = cancel_requested */
  cancel: (i) => i.status === 'cancel_requested',
  /** 寄养 = type boarding */
  boarding: (i) => i.type === 'boarding',
};

/** ?status= 深链 → 状态档（总览待办行：cancel_requested / pending；非法值忽略） */
function initCategory(raw: string | null): CategoryKey | null {
  switch (raw) {
    case 'pending':
    case 'confirmed':
      return 'arriving';
    case 'in_service':
      return 'serving';
    case 'completed':
      return 'done';
    case 'cancel_requested':
      return 'cancel';
    case 'in_boarding':
      return 'boarding';
    default:
      return null;
  }
}

/** 需要列表静默 invalidate 的预约状态事件（store 频道可达） */
const QUIET_INVALIDATE = new Set<string>([
  EventType.AppointmentConfirmed,
  EventType.AppointmentAssigned,
  EventType.AppointmentCheckedIn,
  EventType.AppointmentCompleted,
  EventType.AppointmentCancelled,
  EventType.AppointmentRejected, // v1.1-b3 B3-3：他端拒单后本端列表静默对齐
  EventType.AppointmentRescheduled,
  EventType.AppointmentPaid,
  EventType.AppointmentReviewed,
]);

/** 当日 0 点区间（服务端 from=gte / to=lte，to 取次日 -1ms） */
const dayRange = (dayKey: string): { from: Date; to: Date } => {
  const from = new Date(`${dayKey}T00:00:00`);
  return { from, to: new Date(addDays(from, 1).getTime() - 1) };
};

export default function AppointmentsPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const todayKey = localDayKey(new Date());

  /** 日期档：yyyy-MM-dd 本地键；null = 全部（?from=todo 兼容档，不锁当天防吞单） */
  const [day, setDay] = useState<string | null>(() =>
    searchParams.get('from') === 'todo' ? null : todayKey,
  );
  const [category, setCategory] = useState<CategoryKey | null>(() =>
    initCategory(searchParams.get('status')),
  );
  const [search, setSearch] = useState('');

  const isToday = day === todayKey;

  /* ---------------- 列表查询（当日区间 / from=todo 全量） ---------------- */

  const listQuery = useQuery({
    queryKey: [
      'appointment',
      'listForStore',
      day === null
        ? { all: true }
        : { from: dayRange(day).from.toISOString(), to: dayRange(day).to.toISOString() },
    ],
    queryFn: () =>
      day === null
        ? trpc.appointment.listForStore.query({})
        : trpc.appointment.listForStore.query(dayRange(day)),
  });

  /**
   * chips 计数真值 = 今日 listForStore 全量。主列表已是今日时复用；选了其他日期
   * （或全量档）时补一档同接口今日查询（enabled 条件触发，零新接口）。
   */
  const todayQuery = useQuery({
    queryKey: ['appointment', 'listForStore', { day: todayKey }],
    queryFn: () => trpc.appointment.listForStore.query(dayRange(todayKey)),
    enabled: !isToday,
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const todayItems = isToday ? items : (todayQuery.data ?? []);

  const counts: ChipCounts = useMemo(
    () => ({
      today: todayItems.length,
      arriving: todayItems.filter(CATEGORY_MATCH.arriving).length,
      serving: todayItems.filter(CATEGORY_MATCH.serving).length,
      done: todayItems.filter(CATEGORY_MATCH.done).length,
      cancel: todayItems.filter(CATEGORY_MATCH.cancel).length,
      boarding: todayItems.filter(CATEGORY_MATCH.boarding).length,
    }),
    [todayItems],
  );

  /* ---------------- 前端过滤：状态档 + 搜索（petName/customerName/code） ---------------- */

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      items
        .filter((i) => (category ? CATEGORY_MATCH[category](i) : true))
        .filter(
          (i) =>
            q.length === 0 ||
            [i.petName, i.customerName, i.code].some(
              (s) => typeof s === 'string' && s.toLowerCase().includes(q),
            ),
        ),
    [items, category, q],
  );

  /* 服务中行六步进度（胶囊「服务中 N/6」；现成接口一单一查，跨页共享缓存） */
  const stepProgress = useStepProgress(visible);

  /* ---------------- SSE：store 频道 ---------------- */

  const invalidateLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore'] });
    // 仪表盘待办聚合同步刷新（T4.1 的 dashboardStats；未挂载时无副作用）
    void queryClient.invalidateQueries({ queryKey: ['store', 'dashboardStats'] });
  }, [queryClient]);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      switch (envelope.type) {
        case EventType.AppointmentCreated:
          invalidateLists();
          showToast(
            `新预约到店：${typeof data.petName === 'string' ? data.petName : '宠物'} · ${
              typeof data.serviceName === 'string' ? data.serviceName : '服务'
            }，待确认`,
            'alert',
          );
          break;
        case EventType.AppointmentCancelRequested:
          invalidateLists();
          showToast(
            `${typeof data.petName === 'string' ? data.petName : '客户'} 申请取消预约，待审核`,
            'alert',
          );
          break;
        default:
          if (QUIET_INVALIDATE.has(envelope.type)) invalidateLists();
          break;
      }
    },
    [invalidateLists],
  );

  useMerchantEvents({ onEvent, onReconnect: invalidateLists });

  /* ---------------- 交互 ---------------- */

  const sub = `${
    day === null ? '全部日期' : fmtDate(new Date(`${day}T00:00:00`))
  } · 共 ${items.length} 单 · 自动接单已启用`;

  const openNewAppointmentHint = () =>
    showToast('新客户预约请引导至客户端预约页；到店客可由前台手动核销登记', 'info');

  /* ---------------- 渲染 ---------------- */

  const tableHead = (
    <thead>
      <tr>
        <th>时间</th>
        <th>宠物 / 客户</th>
        <th>服务</th>
        <th>员工</th>
        <th>金额</th>
        <th>状态</th>
        <th aria-label="详情" />
      </tr>
    </thead>
  );

  return (
    <MainScaffold
      title="预约"
      sub={sub}
      testid="appointments-page"
      actions={
        <>
          <SearchInput
            placeholder="搜索宠物 / 客户 / 单号…"
            value={search}
            onChange={setSearch}
            testid="appointments-search"
          />
          <LemonButton testid="appointment-create" onClick={openNewAppointmentHint}>
            ＋ 新增预约
          </LemonButton>
        </>
      }
    >
      <ToastHost />

      <StatusChips
        counts={counts}
        isToday={isToday}
        category={category}
        pickedDate={day ?? todayKey}
        onToday={() => {
          setDay(todayKey);
          setCategory(null);
        }}
        onCategory={(c) => setCategory((cur) => (cur === c ? null : c))}
        onPickDate={(d) => setDay(d)}
      />

      <div className="mt-3.5">
        {listQuery.isPending ? (
          /* 加载：骨架行（禁转圈） */
          <div className="u3-panel" aria-busy="true" aria-label="加载中">
            <table className="u3-tbl">
              {tableHead}
              <tbody>
                {[0, 1, 2, 3, 4].map((r) => (
                  <tr key={r}>
                    {[38, 120, 72, 88, 52, 76, 12].map((w, c) => (
                      <td key={c}>
                        <div
                          className="h-3 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.08)]"
                          style={{ width: w }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : listQuery.isError ? (
          /* 错误：文案 + 重试 */
          <div className="u3-panel px-[17px] py-16 text-center">
            <p className="text-[12px] text-danger-deep">
              {listQuery.error instanceof Error ? listQuery.error.message : '加载失败，请稍后再试'}
            </p>
            <div className="mt-4 flex justify-center">
              <QuietButton testid="appointments-retry" onClick={() => void listQuery.refetch()}>
                重试
              </QuietButton>
            </div>
          </div>
        ) : (
          /* 数据 / 空态 */
          <div className="u3-panel">
            <table className="u3-tbl">
              {tableHead}
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[rgba(74,59,46,.42)]">
                      这一天没有预约
                    </td>
                  </tr>
                ) : (
                  visible.map((item) => (
                    <AppointmentRow
                      key={item.id}
                      item={item}
                      progress={stepProgress.get(item.id) ?? null}
                      onOpen={() => navigate(`/appointments/${item.id}`)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainScaffold>
  );
}
