/**
 * 寄养入住登记 + 每日打卡页 /boarding/:id/checkin（P3 T3.4 · 开发方案 §2.3/§3.1 寄养差异点）
 *
 * 一页两段式：
 * 1. 入住登记段：stay 未登记 → CheckinForm（房间/称重/随身物品动态行+拍照）；
 *    登记成功 → StayInfoCard 只读信息卡（可点「修改」回到编辑表单，checkinStay 幂等更新）。
 * 2. 每日打卡段：stay 已登记 → DailyLogForm（喂食多顿/遛弯步进/备注≤300/照片≤6）
 *    + DailyLogList 历史倒序卡片。dailyLog 是 UPSERT by (stay_id, log_date)，
 *    当日重复提交为更新，表单顶部明示。
 *
 * 数据：
 * - appointment.get（publicProcedure，员工本店可见）→ 顶部宠物信息条
 *   （宠物名/品种/性格标签/疫苗有效期/客户备注）。
 * - boarding.stayForStaff（T3.4 新增 staffProcedure）→ stay + logs（log_date 升序）。
 *
 * SSE：push.subscribe（clientId 复用 localStorage philia.sseClientId，appType='staff'）
 * → /api/events?client_id=…&watch=<aid>。事件按 envelope.id 去重：
 * - boarding.daily_update（他人代打卡）→ invalidate stayForStaff + toast
 *   ⚠️ v1 通道限制：daily_update 发往 user:{customer} + store:{store} 频道，
 *   员工连接只订 user/staff/appointment 频道，实际上收不到该事件——故 stayForStaff
 *   挂 60s 慢轮询兜底（SSE 断线 30s），onReconnect / 回前台全量对齐。
 * - boarding.overdue → toast；超期横幅按本地计算展示
 *   （stay 未退房 && in_boarding && scheduledEnd < now；v1 无任务发该事件，本地计算为主）。
 * - boarding.completed（商家端退房）→ 全量失效 + 完成态。
 *
 * 退房：开发方案 §6.2 中 boarding.checkout 权限为 staff/merchant 双权限，
 * 但员工端页面树（§2.3）没有退房入口——按页面树执行：员工端不提供退房按钮，
 * 仅显示「退房请到商家端操作」引导（P4 商家端实现退房结算）。
 */

import {
  EventType,
  getApiBase,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
  type PhotoWallPhoto,
} from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, ChevronLeft, DoorOpen, QrCode } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CheckinForm, {
  type BelongingDraft,
  type CheckinFormInitial,
  type CheckinFormSubmit,
} from '../components/boarding/CheckinForm';
import DailyLogForm, { type DailyLogSubmit } from '../components/boarding/DailyLogForm';
import DailyLogList from '../components/boarding/DailyLogList';
import PetHeader from '../components/boarding/PetHeader';
import PhotoViewer, { type PhotoViewerState } from '../components/boarding/PhotoViewer';
import StayInfoCard from '../components/boarding/StayInfoCard';
import Toast from '../components/boarding/Toast';
import type { BelongingItem, BoardingLogRow, BoardingStayRow } from '../components/boarding/types';

/* ------------------------------------------------------------------ */
/* 工具                                                                 */
/* ------------------------------------------------------------------ */

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：localStorage 持久化（STAFF-CONTRACTS 通用约定） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** 已登记 stay → 编辑表单初值 */
function stayToInitial(stay: BoardingStayRow): CheckinFormInitial {
  return {
    roomNo: stay.roomNo ?? '',
    weightText: stay.checkinWeightKg != null ? stay.checkinWeightKg.toFixed(1) : '',
    belongings: (stay.belongings ?? []).map(
      (b: BelongingItem): BelongingDraft => ({
        key: crypto.randomUUID(),
        name: b.name,
        photoUrl: b.photoUrl,
      }),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* 页面                                                                  */
/* ------------------------------------------------------------------ */

export default function BoardingCheckinPage() {
  const { id: aid } = useParams<{ id: string }>();
  const { trpc, queryClient } = usePhiliaClient();
  const { user } = useMe();
  const [clientId] = useState(getClientId);

  // 今日 ISO 日期（每次渲染重算：页面跨零点保持打开时 logDate 仍正确）
  const today = format(new Date(), 'yyyy-MM-dd');

  /* ---------------- toast / 查看器 / 编辑态 ---------------- */

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const [viewer, setViewer] = useState<PhotoViewerState | null>(null);
  const openViewer = useCallback((photos: PhotoWallPhoto[], index: number) => {
    if (photos.length > 0) setViewer({ photos, index });
  }, []);

  const [editingStay, setEditingStay] = useState(false);

  /* ---------------- 查询 ---------------- */

  const [sseDown, setSseDown] = useState(false);

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
    refetchInterval: sseDown ? 30_000 : false,
  });
  const appt = detailQuery.data?.appointment;
  const pet = detailQuery.data?.pet;

  const isBoarding = appt?.type === 'boarding';

  const stayQuery = useQuery({
    queryKey: ['boarding', 'stayForStaff', aid],
    queryFn: () => trpc.boarding.stayForStaff.query({ appointmentId: aid! }),
    enabled: !!aid && isBoarding === true,
    // 见文件头「SSE 通道限制」：他人代打卡事件员工端收不到，60s 慢轮询兜底
    refetchInterval: sseDown ? 30_000 : 60_000,
  });
  const stay = (stayQuery.data?.stay ?? null) as BoardingStayRow | null;
  const logs = useMemo(
    () => ((stayQuery.data?.logs ?? []) as BoardingLogRow[]),
    [stayQuery.data],
  );
  const todayLog = useMemo(() => logs.find((l) => l.logDate === today), [logs, today]);

  /* ---------------- 全量对齐 ---------------- */

  const alignAll = useCallback(() => {
    if (!aid) return;
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayForStaff', aid] });
  }, [queryClient, aid]);

  /* ---------------- SSE ---------------- */

  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'staff' })
        .then(() => {
          if (!cancelled) setSubscribed(true);
        })
        .catch(() => {
          // 登记失败（弱网等）：5s 后重试，直到成功或离开页面
          if (!cancelled) timer = window.setTimeout(attempt, 5000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trpc, clientId, user]);

  const sseUrl =
    subscribed && aid
      ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}&watch=${encodeURIComponent(aid)}`
      : null;

  // 事件去重（重连补发/多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(id)) return false;
    s.set.add(id);
    s.queue.push(id);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return;
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      // 只处理本预约相关事件
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return;

      switch (envelope.type) {
        case EventType.BoardingDailyUpdate: {
          // 他人代打卡 → 失效重取 + toast（v1 通道限制下实际靠 60s 轮询兜底）
          const logDate = typeof data.logDate === 'string' ? data.logDate : '';
          showToast(`${logDate ? `${logDate} ` : ''}打卡已更新（可能是同事提交）`);
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayForStaff', aid] });
          break;
        }
        case EventType.BoardingOverdue:
          // 醒目横幅本地常驻（见下 overdue 计算），事件到达时再 toast 强提醒一次
          showToast('寄养已超期，请提醒商家安排退房');
          void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
          break;
        case EventType.BoardingCompleted:
          showToast('本单已退房结算');
          alignAll();
          break;
        case EventType.AppointmentCheckedIn:
        case EventType.AppointmentAssigned:
        case EventType.AppointmentRescheduled:
        case EventType.AppointmentCancelled:
          void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
          break;
        default:
          break;
      }
    },
    [aid, markSeen, queryClient, showToast, alignAll],
  );

  const { connected } = useEventSource({ url: sseUrl, onEvent, onReconnect: alignAll });

  // connected=false 超 5s → 断线态（主查询挂 30s 轮询）
  useEffect(() => {
    if (connected || !sseUrl) {
      setSseDown(false);
      return;
    }
    const t = window.setTimeout(() => setSseDown(true), 5000);
    return () => window.clearTimeout(t);
  }, [connected, sseUrl]);

  // 页面回前台：静默全量对齐一次（锁屏断 SSE 的补偿）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') alignAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [alignAll]);

  /* ---------------- mutation ---------------- */

  const checkinMutation = useMutation({
    mutationFn: (input: CheckinFormSubmit) => trpc.boarding.checkinStay.mutate(input),
    onSuccess: (r) => {
      showToast(r.created ? '入住登记完成，开始每日打卡吧' : '登记信息已更新');
      setEditingStay(false);
      void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayForStaff', aid] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '提交失败，请稍后再试'),
  });

  const dailyLogMutation = useMutation({
    mutationFn: (input: DailyLogSubmit) => trpc.boarding.dailyLog.mutate(input),
    onSuccess: () => {
      showToast(todayLog ? '今日打卡已更新' : '今日打卡已提交');
      void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayForStaff', aid] });
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '提交失败，请稍后再试'),
  });

  /* ---------------- 派生态 ---------------- */

  // 超期：在住未退房 && in_boarding && 预约结束时间已过（与 stayBoard 判定一致）
  const overdue =
    !!stay &&
    !stay.checkoutAt &&
    appt?.status === 'in_boarding' &&
    appt.scheduledEnd instanceof Date &&
    appt.scheduledEnd.getTime() < Date.now();

  /* ---------------- 渲染 ---------------- */

  if (detailQuery.isPending) {
    return (
      <div className="px-4 py-6">
        <p className="text-body-lg text-ink-secondary">加载寄养单信息…</p>
      </div>
    );
  }

  if (detailQuery.isError || !appt) {
    return (
      <div className="px-4 py-6">
        <section className="rounded-card bg-card p-4 shadow-card">
          <p className="text-body-lg text-ink">无法查看该寄养单</p>
          <p className="mt-1 text-body text-ink-secondary">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '预约不存在或无权查看'}
          </p>
          <Link
            to="/today"
            className="mt-4 flex h-staff-btn items-center justify-center rounded-full bg-sunken text-body-lg text-ink"
          >
            返回今日任务
          </Link>
        </section>
      </div>
    );
  }

  if (!isBoarding) {
    return (
      <div className="px-4 py-6">
        <section className="rounded-card bg-card p-4 shadow-card">
          <p className="text-body-lg text-ink">该预约不是寄养单</p>
          <Link
            to="/today"
            className="mt-4 flex h-staff-btn items-center justify-center rounded-full bg-sunken text-body-lg text-ink"
          >
            返回今日任务
          </Link>
        </section>
      </div>
    );
  }

  // 尚未核销入店：入住登记前置（checkinStay 服务端也强制 in_boarding）
  if (appt.status === 'pending' || appt.status === 'confirmed') {
    return (
      <div className="px-4 py-6">
        <PetHeader
          pet={pet}
          note={appt.note}
          scheduledStart={appt.scheduledStart}
          scheduledEnd={appt.scheduledEnd}
        />
        <section className="mt-3 rounded-card bg-card p-4 shadow-card">
          <p className="flex items-center gap-2 text-body-lg text-ink">
            <QrCode className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
            客户还未到店核销
          </p>
          <p className="mt-1 text-body text-ink-secondary">
            请先在「今日」扫码或手动核销该预约，核销后才能办理入住登记。
          </p>
          <Link
            to="/today"
            className="mt-4 flex h-staff-btn items-center justify-center rounded-full bg-brand-primary text-body-lg font-semibold text-white"
          >
            去今日任务核销
          </Link>
        </section>
      </div>
    );
  }

  // 已取消 / 取消审核中：不可入住登记（服务端 checkinStay 同样强制 in_boarding）
  if (appt.status === 'cancelled' || appt.status === 'cancel_requested') {
    return (
      <div className="px-4 py-6">
        <PetHeader
          pet={pet}
          note={appt.note}
          scheduledStart={appt.scheduledStart}
          scheduledEnd={appt.scheduledEnd}
        />
        <section className="mt-3 rounded-card bg-card p-4 shadow-card">
          <p className="text-body-lg text-ink">
            {appt.status === 'cancelled' ? '该预约已取消' : '该预约正在取消审核中'}
          </p>
          <p className="mt-1 text-body text-ink-secondary">如有疑问请到商家端查看处理。</p>
          <Link
            to="/today"
            className="mt-4 flex h-staff-btn items-center justify-center rounded-full bg-sunken text-body-lg text-ink"
          >
            返回今日任务
          </Link>
        </section>
      </div>
    );
  }

  const completed = appt.status === 'completed';

  return (
    <div className="pb-6">
      {/* 返回条 */}
      <div className="flex items-center px-2 pt-2">
        <Link
          to="/today"
          className="flex h-12 items-center gap-0.5 rounded-full px-3 text-body-lg text-ink-secondary"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
          今日任务
        </Link>
      </div>

      {/* 顶部常显宠物信息条 */}
      <PetHeader
        pet={pet}
        note={appt.note}
        scheduledStart={appt.scheduledStart}
        scheduledEnd={appt.scheduledEnd}
      />

      <div className="mt-3 space-y-3 px-4">
        {/* 超期横幅（boarding.overdue；本地计算常驻 + SSE 事件 toast 强提醒） */}
        {overdue ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-card border border-danger bg-danger-light px-4 py-3 text-body-lg font-semibold text-danger-deep"
          >
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={1.5} />
            <span>
              已超期，请提醒商家安排退房
              <span className="mt-0.5 block text-body font-normal">
                应于 {format(appt.scheduledEnd, 'M月d日 HH:mm')} 退房
              </span>
            </span>
          </p>
        ) : null}

        {completed ? (
          <p className="flex items-center gap-2 rounded-card bg-success-light px-4 py-3 text-body-lg font-semibold text-success-deep">
            <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={1.5} />
            本单已完成退房结算
          </p>
        ) : null}

        {/* 入住登记段 */}
        {stayQuery.isPending ? (
          <section className="rounded-card bg-card p-4 shadow-card">
            <p className="text-body-lg text-ink-secondary">加载入住信息…</p>
          </section>
        ) : stay === null ? (
          <CheckinForm
            appointmentId={aid!}
            submitting={checkinMutation.isPending}
            onSubmit={(input) => checkinMutation.mutate(input)}
            onError={showToast}
          />
        ) : editingStay && !completed ? (
          <CheckinForm
            key={`edit-${stay.id}`}
            appointmentId={aid!}
            initial={stayToInitial(stay)}
            submitting={checkinMutation.isPending}
            onSubmit={(input) => checkinMutation.mutate(input)}
            onCancel={() => setEditingStay(false)}
            onError={showToast}
          />
        ) : (
          <StayInfoCard
            stay={stay}
            onEdit={completed ? undefined : () => setEditingStay(true)}
            onPhotoClick={openViewer}
          />
        )}

        {/* 每日打卡段（stay 已登记后显示；已完成为只读历史） */}
        {stay !== null ? (
          <>
            {!completed && !editingStay ? (
              <DailyLogForm
                appointmentId={aid!}
                stayId={stay.id}
                today={today}
                todayLog={todayLog}
                submitting={dailyLogMutation.isPending}
                onSubmit={(input) => dailyLogMutation.mutate(input)}
                onError={showToast}
              />
            ) : null}
            <DailyLogList logs={logs} today={today} onPhotoClick={openViewer} />
          </>
        ) : null}

        {/* 退房引导：§6.2 checkout 权限 staff/merchant，但员工端页面树无退房入口，
            按页面树执行——员工端不提供退房按钮（P4 商家端退房结算） */}
        {!completed && stay !== null ? (
          <p className="flex items-center gap-2 rounded-card bg-sunken px-4 py-3 text-body text-ink-secondary">
            <DoorOpen className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            退房请到商家端操作
          </p>
        ) : null}
      </div>

      <Toast message={toast} />
      {viewer ? (
        <PhotoViewer
          state={viewer}
          onClose={() => setViewer(null)}
          onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        />
      ) : null}
    </div>
  );
}
