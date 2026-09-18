/**
 * 寄养入住登记 + 每日打卡页 /boarding/:id/checkin（P3 T3.4 · 开发方案 §2.3/§3.1 寄养差异点）
 *
 * 一页两段式（U2 任务 E 重做版式，真链路不动）：
 * 1. 入住登记段：stay 未登记 → CheckinForm（房间/称重/随身物品动态行+拍照）；
 *    登记成功 → StayInfoCard 只读信息卡（可点「修改」回到编辑表单，checkinStay 幂等更新）。
 * 2. 每日打卡段：stay 已登记 → DailyLogForm（喂食 segment/遛狗步进/照片≥1/备注选填，
 *    吸底柠檬主钮）+ DailyLogList 历史倒序行。dailyLog 是 UPSERT by (stay_id, log_date)。
 * U2 版式：PageHeader 返回条（‹ 寄养打卡 + 右「第 N 晚·共 M 晚」）+ BoardingPetCard
 * （16:10 照片头+「在店寄养·房型」签+状态签）。.
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
 * 退房（v1.1-b3 B3-5 A-P2-14）：boarding.checkout 基类由 publicProcedure 修正为
 * staffProcedure（仅员工可退房，商家/客户在中间件层即被拒）；员工端相应补上
 * 退房入口——stay 已登记且未完成时显示「办理退房」按钮（二次确认内联展开），
 * 成功后预约转 completed；商家端收款仍走财务页 markPaid。
 */

import {
  EventType,
  getApiBase,
  safeUuid,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
  type PhotoWallPhoto,
} from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, DoorOpen, QrCode } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import CheckinForm, {
  type BelongingDraft,
  type CheckinFormInitial,
  type CheckinFormSubmit,
} from '../components/boarding/CheckinForm';
import DailyLogForm, { type DailyLogSubmit } from '../components/boarding/DailyLogForm';
import DailyLogList from '../components/boarding/DailyLogList';
import BoardingPetCard from '../components/boarding/BoardingPetCard';
import PageHeader from '../components/PageHeader';
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
      id = safeUuid();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return safeUuid();
  }
}

/** 已登记 stay → 编辑表单初值 */
function stayToInitial(stay: BoardingStayRow): CheckinFormInitial {
  return {
    roomNo: stay.roomNo ?? '',
    weightText: stay.checkinWeightKg != null ? stay.checkinWeightKg.toFixed(1) : '',
    belongings: (stay.belongings ?? []).map(
      (b: BelongingItem): BelongingDraft => ({
        key: safeUuid(),
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
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500); // 动效纲领 §四.1：toast 2.5s 自消
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

  // B3-5（A-P2-14）：退房核销入口（checkout 已修正为 staffProcedure，员工办理）
  const [confirmingCheckout, setConfirmingCheckout] = useState(false);
  const checkoutMutation = useMutation({
    mutationFn: () => trpc.boarding.checkout.mutate({ appointmentId: aid! }),
    onSuccess: (r) => {
      setConfirmingCheckout(false);
      showToast(r.alreadyCompleted ? '本单此前已完成退房' : '退房完成，本单转入「已完成」');
      alignAll();
    },
    onError: (err) => showToast(err instanceof Error ? err.message : '退房失败，请稍后再试'),
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
    // 加载 >300ms 骨架（禁转圈，动效纲领 §四.2）
    return (
      <div className="px-[22px] pt-3">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 animate-pulse rounded-full bg-sunken" />
          <span className="h-6 w-24 animate-pulse rounded-chip bg-sunken" />
        </div>
        <div className="u1-card mt-2 overflow-hidden">
          <div className="aspect-[16/10] animate-pulse bg-sunken" />
          <div className="p-4">
            <div className="h-5 w-24 animate-pulse rounded-chip bg-sunken" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded-chip bg-sunken" />
          </div>
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !appt) {
    return (
      <div className="px-[22px] py-6">
        <section className="u1-card p-4">
          <p className="text-body-sm text-ink">无法查看该寄养单</p>
          <p className="mt-1 text-caption text-ink-secondary">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '预约不存在或无权查看'}
          </p>
          <Link
            to="/today"
            className="mt-4 flex h-12 items-center justify-center rounded-control bg-sunken text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            返回任务台
          </Link>
        </section>
      </div>
    );
  }

  if (!isBoarding) {
    return (
      <div className="px-[22px] py-6">
        <section className="u1-card p-4">
          <p className="text-body-sm text-ink">该预约不是寄养单</p>
          <Link
            to="/today"
            className="mt-4 flex h-12 items-center justify-center rounded-control bg-sunken text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            返回任务台
          </Link>
        </section>
      </div>
    );
  }

  // 第 N 晚 · 共 M 晚（PageHeader 右侧摘要，规格书 §5）
  const nightsTotal = Math.max(1, Math.round((appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / 86_400_000));
  const nightNow = Math.min(
    nightsTotal,
    Math.max(1, Math.floor((Date.now() - appt.scheduledStart.getTime()) / 86_400_000) + 1),
  );
  const roomLabel = detailQuery.data?.service?.name ?? '寄养';


  // 尚未核销入店：入住登记前置（checkinStay 服务端也强制 in_boarding）
  if (appt.status === 'pending' || appt.status === 'confirmed') {
    return (
      <div className="pb-6">
        <PageHeader title="寄养打卡" aside={`第 ${nightNow} 晚 · 共 ${nightsTotal} 晚`} backTo="/today" />
        <BoardingPetCard pet={pet} roomLabel={roomLabel} scheduledStart={appt.scheduledStart} scheduledEnd={appt.scheduledEnd} overdue={false} />
        <section className="u1-card mx-[22px] mt-3.5 p-4">
          <p className="flex items-center gap-2 text-body-sm font-semibold text-ink">
            <QrCode className="h-5 w-5 text-ink" strokeWidth={1.5} />
            客户还未到店核销
          </p>
          <p className="mt-1 text-caption text-ink-secondary">
            请先在任务台扫码或手动核销该预约，核销后才能办理入住登记。
          </p>
          <Link
            to="/today"
            className="mt-4 flex h-12 items-center justify-center rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            去任务台核销
          </Link>
        </section>
      </div>
    );
  }

  // 已取消 / 取消审核中：不可入住登记
  if (appt.status === 'cancelled' || appt.status === 'cancel_requested') {
    return (
      <div className="pb-6">
        <PageHeader title="寄养打卡" aside={`第 ${nightNow} 晚 · 共 ${nightsTotal} 晚`} backTo="/today" />
        <BoardingPetCard pet={pet} roomLabel={roomLabel} scheduledStart={appt.scheduledStart} scheduledEnd={appt.scheduledEnd} overdue={false} />
        <section className="u1-card mx-[22px] mt-3.5 p-4">
          <p className="text-body-sm text-ink">
            {appt.status === 'cancelled' ? '该预约已取消' : '该预约正在取消审核中'}
          </p>
          <p className="mt-1 text-caption text-ink-secondary">如有疑问请到商家端查看处理。</p>
          <Link
            to="/today"
            className="mt-4 flex h-12 items-center justify-center rounded-control bg-sunken text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            返回任务台
          </Link>
        </section>
      </div>
    );
  }

  const completed = appt.status === 'completed';

  return (
    <div className="pb-6">
      {/* 返回条（‹ 寄养打卡 + 右「第 N 晚·共 M 晚」） */}
      <PageHeader title="寄养打卡" aside={`第 ${nightNow} 晚 · 共 ${nightsTotal} 晚`} backTo="/today" />

      {/* 宠物卡（16:10 照片 + 在店寄养·房型签 + 状态签） */}
      <BoardingPetCard
        pet={pet}
        roomLabel={roomLabel}
        scheduledStart={appt.scheduledStart}
        scheduledEnd={appt.scheduledEnd}
        overdue={overdue}
      />

      {/* 超期横幅（本地计算常驻 + SSE 事件 toast 强提醒） */}
      {overdue ? (
        <p
          role="alert"
          className="mx-[22px] mt-3 flex items-start gap-2 rounded-control border border-danger bg-danger-light px-4 py-3 text-body-sm font-semibold text-danger-deep"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} />
          <span>
            已超期，请提醒商家安排退房
            <span className="mt-0.5 block text-caption font-normal">
              应于 {format(appt.scheduledEnd, 'M月d日 HH:mm')} 退房
            </span>
          </span>
        </p>
      ) : null}

      {completed ? (
        <p className="mx-[22px] mt-3 flex items-center gap-2 rounded-control bg-success-light px-4 py-3 text-body-sm font-semibold text-success-deep">
          <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} />
          本单已完成退房结算
        </p>
      ) : null}

      {/* 入住登记段 */}
      {stayQuery.isPending ? (
        <section className="u1-card mx-[22px] mt-3.5 p-4">
          <div className="h-5 w-28 animate-pulse rounded-chip bg-sunken" />
          <div className="mt-2 h-4 w-44 animate-pulse rounded-chip bg-sunken" />
        </section>
      ) : stay === null ? (
        <div className="px-[22px]">
          <CheckinForm
            appointmentId={aid!}
            submitting={checkinMutation.isPending}
            onSubmit={(input) => checkinMutation.mutate(input)}
            onError={showToast}
          />
        </div>
      ) : editingStay && !completed ? (
        <div className="px-[22px]">
          <CheckinForm
            key={`edit-${stay.id}`}
            appointmentId={aid!}
            initial={stayToInitial(stay)}
            submitting={checkinMutation.isPending}
            onSubmit={(input) => checkinMutation.mutate(input)}
            onCancel={() => setEditingStay(false)}
            onError={showToast}
          />
        </div>
      ) : (
        <div className="px-[22px]">
          <StayInfoCard
            stay={stay}
            onEdit={completed ? undefined : () => setEditingStay(true)}
            onPhotoClick={openViewer}
          />
        </div>
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
          <DailyLogList logs={logs} today={today} stayStart={appt.scheduledStart} onPhotoClick={openViewer} />
        </>
      ) : null}

      {/* 退房（员工权限，内联二次确认，幂等） */}
      {!completed && stay !== null && appt.status === 'in_boarding' ? (
        confirmingCheckout ? (
          <div className="u1-card mx-[22px] mt-3 p-4">
            <p className="text-body-sm font-semibold text-ink">确认办理退房？</p>
            <p className="mt-1 text-caption text-ink-secondary">
              退房后预约转入「已完成」；到店付订单请提醒商家在财务页确认收款。
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingCheckout(false)}
                className="h-11 flex-1 rounded-control bg-sunken text-body-sm font-medium text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                再想想
              </button>
              <button
                type="button"
                disabled={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate()}
                className="h-11 flex-1 rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
              >
                {checkoutMutation.isPending ? '办理中…' : '确认退房'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingCheckout(true)}
            className="u1-ring mx-[22px] mt-3 flex h-12 w-[calc(100%-44px)] items-center justify-center gap-2 rounded-control bg-card text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <DoorOpen className="h-4 w-4" strokeWidth={1.5} />
            办理退房
          </button>
        )
      ) : null}

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
