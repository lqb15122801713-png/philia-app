/**
 * 预约详情（T2.2）：
 * - 全字段详情 + 门店地址导航外链（高德 / 腾讯地图 URI）；
 * - 预约码大图（pending/confirmed，逻辑同成功页 BookingCode）；
 * - 取消规则：>4h confirm 后直接 cancel（outcome=cancelled）；≤4h 提示「需商家审核」，
 *   提交后转 cancel_requested 展示；in_service/in_boarding 禁用自助取消
 *   （「服务中，如需取消请联系门店」+ tel: 联系门店）；
 * - 改期（v1.1-b2 B2-6 / v1.1-b3 B3-4）：pending/confirmed 且距开始 >4h 的单显示「改期」按钮
 *   （B3-4 起对寄养开放；寄养以入住日首晚计 4h 阈值）。
 *   洗护：展开复用预约向导的 SlotPicker 选新时段；寄养：复用 B2-5 两阶段日期组件
 *   （BoardingDateRangePicker）重选入住/退房（预填当前区间）→ appointment.reschedule
 *   （寄养必传 scheduledStart+scheduledEnd）→ toast「改期已提交，等待商家重新确认」
 *   （状态回退 pending，重新走商家确认流）；
 * - completed：评价入口（星级 + 文字 → appointment.review；已评价则展示）；
 * - in_service/in_boarding：显著入口跳 /appointments/:id/live。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EventType, getApiBase, safeUuid, Skeleton, useEventSource, useMe, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import BookingCode from '@/components/booking/BookingCode';
import PageHeader from '@/components/PageHeader';
import ReviewPanel from '@/components/live/ReviewPanel';
import BoardingDateRangePicker, { checkinAt } from '@/components/booking/BoardingDateRangePicker';
import SlotPicker from '@/components/booking/SlotPicker';
import { ErrorState } from '@/components/home/common';
import { friendlyError, useToast } from '@philia/shared';
import { apc } from '@/copy/appointments';
import { rc } from '@/copy/refund';
import { sl } from '@/copy/serviceloop';
import {
  APPT_STATUS_META,
  APPT_TYPE_LABEL,
  fenToYuan,
  fmtDateTime,
  fmtHM,
  fmtMD,
  fmtRange,
  paymentModeLabel,
  weekCN,
} from '@/components/booking/format';

/** 客户免费取消阈值（秒）：开始前 4 小时（与 server CANCEL_FREE_BEFORE_SEC 同步） */
const CANCEL_FREE_BEFORE_SEC = 4 * 3600;

/** v1.1-b3 B3-5（W-14）：取消原因快捷选项（选填，可再补充自由文本） */
const CANCEL_REASON_CHIPS = ['行程有变', '时间不合适', '价格因素', '其他'] as const;

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：localStorage 持久化（契约 · push.subscribe 与 /api/events 共用，同 live 页口径） */
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

/** 门店导航外链（高德 / 腾讯 URI；有坐标用坐标，无坐标按地址关键词） */
function navLinks(store: { name: string; address: string | null; lat: number | null; lng: number | null }) {
  const hasGeo = store.lat !== null && store.lng !== null;
  const label = encodeURIComponent(store.name);
  const addr = encodeURIComponent(store.address ?? store.name);
  return {
    amap: hasGeo
      ? `https://uri.amap.com/marker?position=${store.lng},${store.lat}&name=${label}&src=philia`
      : `https://uri.amap.com/search?keyword=${addr}&src=philia`,
    tencent: hasGeo
      ? `https://apis.map.qq.com/uri/v1/marker?marker=coord:${store.lat},${store.lng};title:${label}&referer=philia`
      : `https://apis.map.qq.com/uri/v1/search?keyword=${addr}&referer=philia`,
  };
}

/* 评价星级件=ReviewPanel 内聚（PR-2 A1：本文件私有 StarRating 已随内联表单一并删除） */

export default function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  const detailQ = useQuery({
    queryKey: ['appointment', 'get', id],
    queryFn: () => trpc.appointment.get.query({ appointmentId: id }),
    enabled: id.length > 0,
  });
  const d = detailQ.data;
  const appt = d?.appointment;

  // 服务相册（v1.1-b2 B2-4）：洗护单 completed / in_service 时加载，按步骤分组展示
  const albumEnabled =
    !!appt && appt.type === 'grooming' && (appt.status === 'completed' || appt.status === 'in_service');
  const albumQ = useQuery({
    queryKey: ['appointment', 'serviceAlbum', id],
    queryFn: () => trpc.appointment.serviceAlbum.query({ appointmentId: id }),
    enabled: albumEnabled,
  });

  /* 补缺大批片 1：服务单退款/售后入口数据源——appointment.get 附 cashierBillId
     （已结账即非空）；已结账=appt.paidAt 且 paidFen>0；服务中不挂入口 */
  const refundBase =
    !!d?.cashierBillId &&
    !!appt?.paidAt &&
    (appt?.paidFen ?? 0) > 0 &&
    appt?.status !== 'in_service' &&
    appt?.status !== 'in_boarding';
  const refundConfigQ = useQuery({
    queryKey: ['refundRequest', 'configView'],
    queryFn: () => trpc.refundRequest.configView.query(),
    enabled: refundBase,
  });
  const refundsQ = useQuery({
    queryKey: ['refundRequest', 'listMine'],
    queryFn: () => trpc.refundRequest.listMine.query(),
    enabled: refundBase,
  });
  /* 补缺大批片 4：已完成单的安心证书/美容报告入口（myCertificates/myReports 匹配，
     有才显——R10 无数据不渲染入口）；实付单的发票入口（invoiceListMine 匹配 billId，
     在途/已开具=「发票进度 ›」，无申请=「申请发票 ›」） */
  const completedAppt = !!appt && appt.status === 'completed';
  const certsQ = useQuery({
    queryKey: ['serviceLoop', 'myCertificates'],
    queryFn: () => trpc.serviceLoop.myCertificates.query(),
    enabled: completedAppt,
  });
  const reportsQ = useQuery({
    queryKey: ['serviceLoop', 'myReports'],
    queryFn: () => trpc.serviceLoop.myReports.query(),
    enabled: completedAppt,
  });
  const invoicesQ = useQuery({
    queryKey: ['serviceLoop', 'invoiceListMine'],
    queryFn: () => trpc.serviceLoop.invoiceListMine.query(),
    enabled: !!appt && (appt.paidFen ?? 0) > 0,
  });
  const hasCert = (certsQ.data ?? []).some((c) => c.appointmentId === id);
  const hasReport = (reportsQ.data ?? []).some((r) => r.appointmentId === id);
  const myInvoice = (invoicesQ.data ?? []).find(
    (r) => r.orderKind === 'appointment' && r.billId === id,
  );

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // B3-5（W-14）：取消原因——chips 单选（选填）+ 自由文本；合成后随 cancel 提交
  const [cancelChip, setCancelChip] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  // v1.1-b2 B2-6：改期面板状态 + 新选时段
  const [rescheduling, setRescheduling] = useState(false);
  const [newSlot, setNewSlot] = useState<Date | null>(null);
  // v1.1-b3 B3-4：寄养改期——重选入住/退房日（打开面板时预填当前区间）
  const [newCheckin, setNewCheckin] = useState<Date | null>(null);
  const [newCheckout, setNewCheckout] = useState<Date | null>(null);

  // 改期槽位数据源（仅洗护）：与预约向导同源（store.getWithServices 带当前 serviceId，
  // 槽位按该服务时长过滤连续槽），展开改期面板时才拉取；寄养改期走两阶段日期重选，无需槽位
  const rescheduleSlotsQ = useQuery({
    queryKey: ['store', 'getWithServices', appt?.storeId ?? '', appt?.serviceId ?? '', 'reschedule'],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: appt!.storeId,
        serviceId: appt!.serviceId,
      }),
    enabled: rescheduling && !!appt && appt.type === 'grooming',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointment'] });
  };

  const cancelM = useMutation({
    // B3-5（W-14）：原因合成「chip：自由文本」，均为空则不传（选填）；服务端上限 100 字
    mutationFn: () => {
      const reason = [cancelChip, cancelNote.trim()].filter(Boolean).join('：');
      return trpc.appointment.cancel.mutate({ appointmentId: id, ...(reason ? { reason } : {}) });
    },
    onSuccess: (r) => {
      invalidate();
      setConfirmingCancel(false);
      setCancelChip(null);
      setCancelNote('');
      showToast(
        r.outcome === 'cancelled' ? '预约已取消' : '已提交取消申请，待门店审核',
        'info',
      );
    },
    onError: (err) => showToast(friendlyError(err, '取消失败，请稍后再试'), 'error'),
  });

  /* 评价（completed 态）：review 走 ReviewPanel 合规件（PR-2 A1）——评分 state 由组件自持 */
  const reviewM = useMutation({
    mutationFn: (input: { rating: number; review?: string; anonymous?: boolean }) =>
      trpc.appointment.review.mutate({ appointmentId: id, ...input }),
    onSuccess: () => {
      invalidate();
      showToast('感谢评价！', 'info');
    },
    onError: (err) => showToast(friendlyError(err, '评价提交失败'), 'error'),
  });

  /** 分享到服务相册（同 live 页工艺：Web Share 优先，降级复制链接） */
  const shareReview = async () => {
    const url = `${window.location.origin}/appointments/${id}/live`;
    const text = '宝贝在菲丽亚完成了服务，全程照片可见～';
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '菲丽亚服务相册', text, url });
      } catch {
        // 用户取消分享，无需提示
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制，快发给家人朋友吧', 'info');
    } catch {
      showToast('复制失败，请手动复制地址栏链接', 'info');
    }
  };

  // v1.1-b2 B2-6 / v1.1-b3 B3-4：客户自助改期（服务端校验：本人 + pending/confirmed +
  // 距原开始 >4h，寄养以入住日首晚计）。寄养必传 scheduledStart+scheduledEnd
  // （入住/退房日按门店开店时刻对齐，与寄养向导 checkinAt 同口径）；洗护传 scheduledStart。
  const rescheduleM = useMutation({
    mutationFn: () => {
      if (appt?.type === 'boarding') {
        if (!d?.store || !newCheckin || !newCheckout) throw new Error('请选择新的入住/退房日期');
        return trpc.appointment.reschedule.mutate({
          appointmentId: id,
          scheduledStart: checkinAt(d.store, newCheckin),
          scheduledEnd: checkinAt(d.store, newCheckout),
        });
      }
      return trpc.appointment.reschedule.mutate({ appointmentId: id, scheduledStart: newSlot! });
    },
    onSuccess: () => {
      invalidate();
      setRescheduling(false);
      setNewSlot(null);
      setNewCheckin(null);
      setNewCheckout(null);
      showToast('改期已提交，等待商家重新确认', 'info');
    },
    onError: (err) => showToast(friendlyError(err, '改期失败，请稍后再试'), 'error'),
  });

  /* ---------------- SSE（v1.1-b3 B3-3）：user 频道收 appointment.rejected → 刷新详情 ---------------- */
  // 现有订阅模式（同 live 页）：先 push.subscribe 登记，再连 /api/events；
  // rejected 走 user:{customerId} 频道（基础频道，无需 watch 参数）。
  const { user } = useMe();
  const [clientId] = useState(getClientId);
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'customer' })
        .then(() => {
          if (!cancelled) setSubscribed(true);
        })
        .catch(() => {
          if (!cancelled) timer = window.setTimeout(attempt, 5000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trpc, clientId, user]);

  // 事件去重（重连补发/多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((eid: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(eid)) return false;
    s.set.add(eid);
    s.queue.push(eid);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return;
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      // user 频道会混进其他预约的事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== id) return;
      if (envelope.type === EventType.AppointmentRejected) {
        invalidateRef.current();
        showToastRef.current(
          `商家已婉拒${typeof data.reason === 'string' && data.reason ? `：${data.reason}` : ''}`,
          'info',
        );
      }
    },
    [id, markSeen],
  );

  const sseUrl =
    subscribed && id ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}` : null;
  useEventSource({
    url: sseUrl,
    onEvent,
    onReconnect: () => invalidateRef.current(), // 断线重连全量对齐
  });

  if (detailQ.isPending) {
    return (
      <div className="space-y-3 px-4 py-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
    );
  }
  if (detailQ.isError) {
    return (
      <div className="px-4 py-6">
        {/* W1 退回修：错误态补第四件出口（重试=柠檬主，出口=细线白底次钮回列表） */}
        <ErrorState
          message={apc('appointments.detailLoadFail')}
          onRetry={() => void detailQ.refetch()}
          action={
            <Link
              to="/appointments"
              className="u1-ring flex min-h-[44px] items-center rounded-full bg-card px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {apc('appointments.backToList')}
            </Link>
          }
        />
      </div>
    );
  }
  if (!d || !appt) {
    return (
      <div className="px-4 py-6">
        {/* W1 退回修：无效 id 死胡同——规范 E 三件套 + 第四件出口；批片 5 P2：唯一出口钮
            归 §4.11 空态/异常态件色（深棕墨底淡字），不再占淡金点睛预算 */}
        <ErrorState
          message={apc('appointments.notFound')}
          action={
            <Link
              to="/appointments"
              className="flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {apc('appointments.backToList')}
            </Link>
          }
        />
      </div>
    );
  }

  const status = APPT_STATUS_META[appt.status] ?? { label: appt.status, pill: 'bg-sunken text-ink-secondary' };
  const serving = appt.status === 'in_service' || appt.status === 'in_boarding';
  const cancellable = appt.status === 'pending' || appt.status === 'confirmed';
  const secondsToStart = Math.floor((appt.scheduledStart.getTime() - Date.now()) / 1000);
  const freeCancel = secondsToStart > CANCEL_FREE_BEFORE_SEC;
  // v1.1-b2 B2-6 / v1.1-b3 B3-4：自助改期入口——与取消同 >4h 阈值（寄养以入住日首晚
  // 即 scheduledStart 计）；B3-4 起对寄养开放（两阶段日期组件重选入住/退房）
  const reschedulable = cancellable && freeCancel;
  /* 补缺大批片 1：在途申请（幂等闸同口径 submitted/approved/refunded，同商城单判定）→ 入口变进度 */
  const refundOpen = refundBase
    ? (refundsQ.data ?? []).find(
        (r) => r.billId === d.cashierBillId && ['submitted', 'approved', 'refunded'].includes(r.status),
      )
    : undefined;
  // stores 表暂无 phone 字段：有则渲染 tel:，无则提示到店/商家端联系
  const storePhone = (d.store as { phone?: string | null } | null)?.phone ?? null;

  // 服务相册分组：completed 展示全部六步；进行中订单只显示已确认（done）步骤的照片
  const albumRawSteps = albumQ.data?.steps ?? [];
  const albumSteps =
    appt.status === 'completed' ? albumRawSteps : albumRawSteps.filter((s) => s.status === 'done');
  const albumPhotoCount = albumSteps.reduce((n, s) => n + s.photos.length, 0);

  return (
    <div className="px-4 py-6">
      {toastEl}

      {/* U1-A：统一返回条（←圆钮+标题），右侧保留状态 pill */}
      <PageHeader
        title={apc('appointments.detailTitle')}
        right={<span className={`rounded-full px-2.5 py-1 text-caption ${status.pill}`}>{status.label}</span>}
      />

      {/* 服务中：显著 live 入口 */}
      {serving ? (
        <Link
          to={`/appointments/${id}/live`}
          className="mt-4 flex items-center justify-between rounded-card bg-philia-gradient p-4 text-ink shadow-philia"
        >
          <span>
            <span className="flex items-center gap-2 text-title">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card/25 animate-halo">●</span>
              {appt.type === 'boarding' ? apc('appointments.liveBoarding') : apc('appointments.liveGrooming')}
            </span>
            <span className="mt-0.5 block text-caption text-ink/85">{apc('appointments.liveSub')}</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ) : null}

      {/* 预约码（pending/confirmed 可出示；滚动时间窗二维码 + 人工码） */}
      {cancellable ? (
        <section className="mt-4 rounded-card bg-card p-5 shadow-card">
          <h2 className="text-center text-title">{apc('appointments.codeTitle')}</h2>
          <div className="mt-3">
            <BookingCode appointmentId={id} />
          </div>
        </section>
      ) : null}

      {appt.status === 'cancel_requested' ? (
        <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
          {apc('appointments.cancelReviewing')}
        </p>
      ) : null}

      {/* 商家婉拒（v1.1-b3 B3-3）：已取消 + 来源 merchant_reject 时展示拒单原因 */}
      {appt.status === 'cancelled' && appt.cancelSource === 'merchant_reject' ? (
        <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
          {apc('appointments.rejectedPrefix')}{appt.cancelReason ? `：${appt.cancelReason}` : ''}
        </p>
      ) : null}

      {/* 预约信息（全字段） */}
      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <h2 className="text-title">预约信息</h2>
        <dl className="mt-2 space-y-1.5 text-body">
          <div className="flex justify-between">
            <dt className="text-ink-secondary">类型</dt>
            <dd>{APPT_TYPE_LABEL[appt.type] ?? appt.type}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-secondary">服务</dt>
            <dd className="font-medium">{d.service?.name ?? '—'}</dd>
          </div>
          {appt.type === 'boarding' && d.service?.boardingRoomType ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">房型</dt>
              <dd>{d.service.boardingRoomType}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-secondary">宠物</dt>
            <dd>{d.pet?.name ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-secondary">时间</dt>
            <dd className="font-number">
              {appt.type === 'boarding'
                ? fmtRange(appt.scheduledStart, appt.scheduledEnd)
                : `${fmtDateTime(appt.scheduledStart)} - ${fmtHM(appt.scheduledEnd)}`}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-secondary">金额</dt>
            <dd className="font-number font-semibold text-ink">{fenToYuan(appt.priceFen)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-secondary">收款方式</dt>
            <dd>{paymentModeLabel(appt.paymentMode)}</dd>
          </div>
          {appt.paidAt ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">实付</dt>
              <dd className="font-number">{fenToYuan(appt.paidFen ?? appt.priceFen)}（已付）</dd>
            </div>
          ) : null}
          {appt.checkedInAt ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">到店核销</dt>
              <dd className="font-number">{fmtDateTime(appt.checkedInAt)}</dd>
            </div>
          ) : null}
          {appt.completedAt ? (
            <div className="flex justify-between">
              <dt className="text-ink-secondary">完成时间</dt>
              <dd className="font-number">{fmtDateTime(appt.completedAt)}</dd>
            </div>
          ) : null}
          {appt.note ? (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-secondary">备注</dt>
              <dd className="text-right">{appt.note}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-secondary">预约编号</dt>
            <dd className="font-number text-caption text-ink-placeholder">{appt.id}</dd>
          </div>
        </dl>
        {/* 补缺大批片 4：实付行后发票入口（paidFen>0 才显；在途/已开具=进度入口） */}
        {(appt.paidFen ?? 0) > 0 ? (
          <div className="mt-3 border-t border-line-divider pt-3">
            <Link
              to={myInvoice ? `/invoices/${myInvoice.id}` : `/invoice/apply/appointment/${id}`}
              data-testid="appt-invoice-entry"
              className="flex items-center justify-between text-body-sm font-semibold text-ink"
            >
              {myInvoice ? sl('inv.progressEntry') : sl('inv.applyEntry')}
            </Link>
          </div>
        ) : null}
        {d.boardingStay?.roomNo ? (
          <p className="mt-2 rounded-tag bg-sunken px-3 py-2 text-caption text-ink-secondary">
            已入住房间：{d.boardingStay.roomNo}
          </p>
        ) : null}
      </section>

      {/* 服务相册（v1.1-b2 B2-4）：按六步分组网格展示，before/after 打标；
          completed 展示全部六步分组，进行中订单只显示已确认步骤的照片 */}
      {albumEnabled && albumSteps.length > 0 ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title">{apc('appointments.albumTitle')}</h2>
          <p className="mt-0.5 text-caption text-ink-secondary">
            {apc('appointments.albumSub', { count: albumPhotoCount })}
          </p>
          <div className="mt-3 space-y-4">
            {albumSteps.map((step) => (
              <div key={step.stepKey}>
                <h3 className="flex items-baseline gap-1.5 text-body font-medium">
                  {step.stepName}
                  <span className="text-caption text-ink-placeholder">
                    {step.photos.length > 0 ? `${step.photos.length} 张` : '无需照片'}
                  </span>
                </h3>
                {step.photos.length > 0 ? (
                  <div className="mt-1.5 grid grid-cols-3 gap-1">
                    {step.photos.map((p, i) => (
                      <div
                        key={`${step.stepKey}-${i}`}
                        className="relative aspect-square overflow-hidden rounded-tag bg-sunken"
                      >
                        <img
                          src={p.url}
                          alt={`${step.stepName}照片 ${i + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {p.tag === 'before' || p.tag === 'after' ? (
                          <span
                            className={`absolute left-1 top-1 rounded-tag px-1.5 py-0.5 text-caption ${
                              p.tag === 'before'
                                ? 'bg-brand-secondary-light text-ink'
                                : 'bg-brand-primary text-ink'
                            }`}
                          >
                            {p.tag === 'before' ? '服务前' : '服务后'}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 再次预约（completed 主按钮）：跳对应向导并预填 serviceId/storeId/petId（v1.1-b2 B2-3） */}
      {appt.status === 'completed' ? (
        <button
          type="button"
          onClick={() =>
            navigate(
              `${appt.type === 'boarding' ? '/booking/boarding' : '/booking/grooming'}?serviceId=${encodeURIComponent(appt.serviceId)}&storeId=${encodeURIComponent(appt.storeId)}&petId=${encodeURIComponent(appt.petId)}`,
            )
          }
          className="mt-4 h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {apc('appointments.rebook')}
        </button>
      ) : null}

      {/* 补缺大批片 4：已完成单操作区——安心证书/美容报告入口（有才显，R10 无数据不渲染） */}
      {completedAppt && (hasCert || hasReport) ? (
        <div className="mt-3 flex gap-2" data-testid="appt-artifacts">
          {hasCert ? (
            <Link
              to={`/philia/certs/${id}`}
              data-testid="appt-cert-entry"
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-card text-body font-medium text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {sl('cert.detailEntry')}
            </Link>
          ) : null}
          {hasReport ? (
            <Link
              to={`/philia/reports/${id}`}
              data-testid="appt-report-entry"
              className="flex h-11 flex-1 items-center justify-center rounded-full bg-card text-body font-medium text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {sl('report.detailEntry')}
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* 门店与导航 */}
      {d.store ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title">门店</h2>
          <p className="mt-1 text-body font-medium">{d.store.name}</p>
          {d.store.address ? (
            <p className="mt-0.5 text-caption text-ink-secondary">{d.store.address}</p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <a
              href={navLinks(d.store).amap}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-brand-primary-light text-body font-medium text-brand-primary-pressed"
            >
              高德导航
            </a>
            <a
              href={navLinks(d.store).tencent}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-brand-primary-light text-body font-medium text-brand-primary-pressed"
            >
              腾讯地图
            </a>
            {storePhone ? (
              <a
                href={`tel:${storePhone}`}
                className="flex h-10 flex-1 items-center justify-center rounded-full bg-success-light text-body font-medium text-success-deep"
              >
                联系门店
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 改期 / 取消规则 */}
      {cancellable ? (
        <section className="mt-4">
          {rescheduling ? (
            <div className="rounded-card bg-card p-4 shadow-card">
              <p className="text-body font-semibold">
                {appt.type === 'boarding' ? apc('appointments.rescheduleTitleBoarding') : apc('appointments.rescheduleTitleGrooming')}
              </p>
              <p className="mt-1 text-caption text-ink-secondary">
                {apc('appointments.rescheduleNote', { service: d.service?.name ?? '服务', pet: d.pet?.name ?? '宠物' })}
              </p>
              <div className="mt-3">
                {appt.type === 'boarding' ? (
                  // B3-4：寄养改期复用 B2-5 两阶段日期组件（打开时已预填当前区间），
                  // 任一新晚满员由服务端 CONFLICT 拦截并原文 toast
                  <BoardingDateRangePicker
                    store={d.store ?? null}
                    checkin={newCheckin}
                    checkout={newCheckout}
                    onCheckinChange={setNewCheckin}
                    onCheckoutChange={setNewCheckout}
                  />
                ) : rescheduleSlotsQ.data?.store ? (
                  <SlotPicker
                    store={rescheduleSlotsQ.data.store}
                    slots={rescheduleSlotsQ.data.slots ?? []}
                    selected={newSlot}
                    onSelect={setNewSlot}
                    loading={rescheduleSlotsQ.isPending || rescheduleSlotsQ.isFetching}
                  />
                ) : (
                  <p className="rounded-card bg-sunken px-4 py-6 text-center text-caption text-ink-secondary">
                    {rescheduleSlotsQ.isError ? apc('appointments.slotsLoadFail') : apc('appointments.slotsLoading')}
                  </p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduling(false);
                    setNewSlot(null);
                    setNewCheckin(null);
                    setNewCheckout(null);
                  }}
                  className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                >
                  {apc('appointments.thinkMore')}
                </button>
                <button
                  type="button"
                  disabled={
                    (appt.type === 'boarding' ? !newCheckin || !newCheckout : !newSlot) ||
                    rescheduleM.isPending
                  }
                  onClick={() => rescheduleM.mutate()}
                  className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-ink disabled:opacity-60"
                >
                  {rescheduleM.isPending ? '提交中…' : apc('appointments.rescheduleSubmit')}
                </button>
              </div>
            </div>
          ) : confirmingCancel ? (
            <div className="rounded-card bg-card p-4 shadow-card">
              <p className="text-body font-semibold">
                {freeCancel ? apc('appointments.cancelAskFree') : apc('appointments.cancelAskLate')}
              </p>
              <p className="mt-1 text-caption text-ink-secondary">
                {freeCancel
                  ? apc('appointments.cancelRuleFree')
                  : apc('appointments.cancelRuleLate')}
              </p>
              {/* B3-5（W-14）：取消原因收集（选填 chips + 自由文本，商家端透出） */}
              <div className="mt-3">
                <p className="text-caption text-ink-secondary">{apc('appointments.cancelReasonTitle')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CANCEL_REASON_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCancelChip((cur) => (cur === c ? null : c))}
                      className={`h-9 rounded-full px-3.5 text-caption transition ${
                        cancelChip === c
                          ? 'bg-brand-primary font-semibold text-ink'
                          : 'bg-sunken text-ink-secondary'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <textarea
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  maxLength={100}
                  rows={2}
                  placeholder="补充说明（选填，100 字以内）"
                  className="mt-2 w-full rounded-input border border-line bg-card px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                >
                  {apc('appointments.thinkMore')}
                </button>
                <button
                  type="button"
                  disabled={cancelM.isPending}
                  onClick={() => cancelM.mutate()}
                  className="h-11 flex-1 rounded-full bg-danger text-body font-medium text-white disabled:opacity-60"
                >
                  {cancelM.isPending ? '提交中…' : freeCancel ? apc('appointments.cancelSubmitFree') : apc('appointments.cancelSubmitLate')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {reschedulable ? (
                <button
                  type="button"
                  onClick={() => {
                    // B3-4：寄养改期面板预填当前住宿区间（按本地日界取入住/退房日）
                    if (appt.type === 'boarding') {
                      setNewCheckin(
                        new Date(
                          appt.scheduledStart.getFullYear(),
                          appt.scheduledStart.getMonth(),
                          appt.scheduledStart.getDate(),
                        ),
                      );
                      setNewCheckout(
                        new Date(
                          appt.scheduledEnd.getFullYear(),
                          appt.scheduledEnd.getMonth(),
                          appt.scheduledEnd.getDate(),
                        ),
                      );
                    }
                    setRescheduling(true);
                  }}
                  className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-ink shadow-card"
                >
                  {apc('appointments.rescheduleCta')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className={`h-11 rounded-full bg-card text-body font-medium text-danger-deep shadow-card ${reschedulable ? 'flex-1' : 'w-full'}`}
              >
                {freeCancel ? apc('appointments.cancelCtaFree') : apc('appointments.cancelCtaLate')}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {/* 补缺大批片 1：退款/售后入口（已结账=有 cashierBillId 且已付，非服务中；
          已结账且不可取消的服务完成单主入口。开关关=维护态明文；在途=进度入口） */}
      {refundBase ? (
        <section className="mt-4 flex items-center justify-between rounded-card bg-card p-4 shadow-card">
          {refundConfigQ.data?.enabled === false ? (
            <p className="text-caption text-ink-secondary">{rc('refund.maintainNotice')}</p>
          ) : (
            <>
              <span className="text-body text-ink-secondary">{rc('refund.entryHint')}</span>
              <Link
                to={refundOpen ? `/refunds/${refundOpen.id}` : `/appointments/${id}/refund`}
                data-testid={`refund-entry-appt-${id}`}
                className="text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {refundOpen ? rc('refund.progressCta') : rc('refund.entryCta')}
              </Link>
            </>
          )}
        </section>
      ) : null}

      {/* 服务中：禁自助取消 */}
      {serving ? (
        <section className="mt-4 rounded-card bg-sunken p-4">
          <p className="text-body text-ink">{apc('appointments.servingTitle')}</p>
          {storePhone ? (
            <a
              href={`tel:${storePhone}`}
              className="mt-2 inline-flex h-10 items-center rounded-full bg-success px-5 text-body font-medium text-white"
            >
              {apc('appointments.servingCall')}
            </a>
          ) : (
            <p className="mt-1 text-caption text-ink-secondary">{apc('appointments.servingNote')}</p>
          )}
        </section>
      ) : null}

      {/* 评价（completed）——修复包 PR-2 A1/A2：删内联表单（默认 5 星/28px 星钮/未选可提交
          三处踩线），复用 live 页 ReviewPanel 合规件（默认 0 星/44px/未选禁提交） */}
      {appt.status === 'completed' ? (
        <div className="mt-4">
          <ReviewPanel
            existingRating={appt.rating}
            existingReview={appt.review}
            submitting={reviewM.isPending}
            onSubmit={(rating, text, anonymous) =>
              reviewM.mutate({ rating, review: text.length > 0 ? text : undefined, anonymous })
            }
            onShare={() => void shareReview()}
          />
        </div>
      ) : null}

      <p className="mt-6 text-center text-caption text-ink-placeholder">
        预约于 {fmtMD(appt.createdAt)} {weekCN(appt.createdAt)} 创建
      </p>
    </div>
  );
}
