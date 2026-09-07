/**
 * 预约详情（T2.2）：
 * - 全字段详情 + 门店地址导航外链（高德 / 腾讯地图 URI）；
 * - 预约码大图（pending/confirmed，逻辑同成功页 BookingCode）；
 * - 取消规则：>4h confirm 后直接 cancel（outcome=cancelled）；≤4h 提示「需商家审核」，
 *   提交后转 cancel_requested 展示；in_service/in_boarding 禁用自助取消
 *   （「服务中，如需取消请联系门店」+ tel: 联系门店）；
 * - 改期（v1.1-b2 B2-6）：pending/confirmed 且距开始 >4h 的洗护单显示「改期」按钮，
 *   展开复用预约向导的 SlotPicker 选新时段（服务/宠物沿用原单）→ appointment.reschedule
 *   → toast「改期已提交，等待商家重新确认」（状态回退 pending，重新走商家确认流）；
 * - completed：评价入口（星级 + 文字 → appointment.review；已评价则展示）；
 * - in_service/in_boarding：显著入口跳 /appointments/:id/live。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EventType, getApiBase, useEventSource, useMe, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import BookingCode from '@/components/booking/BookingCode';
import SlotPicker from '@/components/booking/SlotPicker';
import { ErrorState } from '@/components/home/common';
import { friendlyError, useToast } from '@/components/booking/Toast';
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

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：localStorage 持久化（契约 · push.subscribe 与 /api/events 共用，同 live 页口径） */
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

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} 星`}
          className={onChange ? 'transition active:scale-90' : 'cursor-default'}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill={n <= value ? '#D98E5F' : 'none'} stroke={n <= value ? '#D98E5F' : '#DDD0C6'} strokeWidth="1.5" strokeLinejoin="round">
            <path d="M12 2.5 15 9l7 .8-5.2 4.7 1.5 6.9L12 17.7 5.7 21.4l1.5-6.9L2 9.8 9 9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export default function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

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

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  // v1.1-b2 B2-6：改期面板状态 + 新选时段
  const [rescheduling, setRescheduling] = useState(false);
  const [newSlot, setNewSlot] = useState<Date | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // 改期槽位数据源：与预约向导同源（store.getWithServices 带当前 serviceId，
  // 槽位按该服务时长过滤连续槽），展开改期面板时才拉取
  const rescheduleSlotsQ = useQuery({
    queryKey: ['store', 'getWithServices', appt?.storeId ?? '', appt?.serviceId ?? '', 'reschedule'],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: appt!.storeId,
        serviceId: appt!.serviceId,
      }),
    enabled: rescheduling && !!appt,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointment'] });
  };

  const cancelM = useMutation({
    mutationFn: () => trpc.appointment.cancel.mutate({ appointmentId: id }),
    onSuccess: (r) => {
      invalidate();
      setConfirmingCancel(false);
      showToast(
        r.outcome === 'cancelled' ? '预约已取消' : '已提交取消申请，待门店审核',
        'info',
      );
    },
    onError: (err) => showToast(friendlyError(err, '取消失败，请稍后再试')),
  });

  const reviewM = useMutation({
    mutationFn: () =>
      trpc.appointment.review.mutate({
        appointmentId: id,
        rating,
        ...(reviewText.trim() ? { review: reviewText.trim() } : {}),
      }),
    onSuccess: () => {
      invalidate();
      showToast('感谢评价！', 'info');
    },
    onError: (err) => showToast(friendlyError(err, '评价提交失败')),
  });

  // v1.1-b2 B2-6：客户自助改期（服务端校验：本人 + pending/confirmed + 距原开始 >4h）
  const rescheduleM = useMutation({
    mutationFn: () =>
      trpc.appointment.reschedule.mutate({ appointmentId: id, scheduledStart: newSlot! }),
    onSuccess: () => {
      invalidate();
      setRescheduling(false);
      setNewSlot(null);
      showToast('改期已提交，等待商家重新确认', 'info');
    },
    onError: (err) => showToast(friendlyError(err, '改期失败，请稍后再试')),
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
          <div key={i} className="h-32 animate-pulse rounded-card bg-sunken" />
        ))}
      </div>
    );
  }
  if (detailQ.isError) {
    return (
      <div className="px-4 py-6">
        <ErrorState
          message="预约详情加载失败，请检查网络后重试"
          onRetry={() => void detailQ.refetch()}
        />
      </div>
    );
  }
  if (!d || !appt) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-body text-ink-secondary">预约不存在或无权查看</p>
        <Link to="/appointments" className="mt-4 inline-block text-brand-primary">返回我的预约</Link>
      </div>
    );
  }

  const status = APPT_STATUS_META[appt.status] ?? { label: appt.status, pill: 'bg-sunken text-ink-secondary' };
  const serving = appt.status === 'in_service' || appt.status === 'in_boarding';
  const cancellable = appt.status === 'pending' || appt.status === 'confirmed';
  const secondsToStart = Math.floor((appt.scheduledStart.getTime() - Date.now()) / 1000);
  const freeCancel = secondsToStart > CANCEL_FREE_BEFORE_SEC;
  // v1.1-b2 B2-6：自助改期入口——与取消同 >4h 阈值；洗护单复用向导 SlotPicker
  // （寄养改期涉及退房晚数重选，本批次由商家端代改，客户端入口仅洗护）
  const reschedulable = cancellable && freeCancel && appt.type === 'grooming';
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

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card active:scale-92"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A7A6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约详情</h1>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-caption ${status.pill}`}>{status.label}</span>
      </header>

      {/* 服务中：显著 live 入口 */}
      {serving ? (
        <Link
          to={`/appointments/${id}/live`}
          className="mt-4 flex items-center justify-between rounded-card bg-philia-gradient p-4 text-white shadow-philia"
        >
          <span>
            <span className="flex items-center gap-2 text-title">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/25 animate-halo">●</span>
              {appt.type === 'boarding' ? '寄养进行中' : '服务进行中'}
            </span>
            <span className="mt-0.5 block text-caption text-white/85">点击查看实时进度与照片</span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ) : null}

      {/* 预约码（pending/confirmed 可出示；滚动时间窗二维码 + 人工码） */}
      {cancellable ? (
        <section className="mt-4 rounded-card bg-card p-5 shadow-card">
          <h2 className="text-center text-title">到店核销码</h2>
          <div className="mt-3">
            <BookingCode appointmentId={id} />
          </div>
        </section>
      ) : null}

      {appt.status === 'cancel_requested' ? (
        <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
          取消申请审核中，门店处理后会通知你；审核通过前预约仍然有效。
        </p>
      ) : null}

      {/* 商家婉拒（v1.1-b3 B3-3）：已取消 + 来源 merchant_reject 时展示拒单原因 */}
      {appt.status === 'cancelled' && appt.cancelSource === 'merchant_reject' ? (
        <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
          商家已婉拒{appt.cancelReason ? `：${appt.cancelReason}` : ''}
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
            <dd className="font-number font-semibold text-brand-primary">{fenToYuan(appt.priceFen)}</dd>
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
          <h2 className="text-title">服务相册</h2>
          <p className="mt-0.5 text-caption text-ink-secondary">
            共 {albumPhotoCount} 张照片，服务全程透明可查
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
                                : 'bg-brand-primary text-white'
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
          className="mt-4 h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          再次预约
        </button>
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
              <p className="text-body font-semibold">选择新时间</p>
              <p className="mt-1 text-caption text-ink-secondary">
                {d.service?.name ?? '服务'} · {d.pet?.name ?? '宠物'}（改期后需商家重新确认）
              </p>
              <div className="mt-3">
                {rescheduleSlotsQ.data?.store ? (
                  <SlotPicker
                    store={rescheduleSlotsQ.data.store}
                    slots={rescheduleSlotsQ.data.slots ?? []}
                    selected={newSlot}
                    onSelect={setNewSlot}
                    loading={rescheduleSlotsQ.isPending || rescheduleSlotsQ.isFetching}
                  />
                ) : (
                  <p className="rounded-card bg-sunken px-4 py-6 text-center text-caption text-ink-secondary">
                    {rescheduleSlotsQ.isError ? '可约时段加载失败，请关闭后重试' : '正在加载可约时段…'}
                  </p>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRescheduling(false);
                    setNewSlot(null);
                  }}
                  className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                >
                  再想想
                </button>
                <button
                  type="button"
                  disabled={!newSlot || rescheduleM.isPending}
                  onClick={() => rescheduleM.mutate()}
                  className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-white disabled:opacity-60"
                >
                  {rescheduleM.isPending ? '提交中…' : '确认改期'}
                </button>
              </div>
            </div>
          ) : confirmingCancel ? (
            <div className="rounded-card bg-card p-4 shadow-card">
              <p className="text-body font-semibold">
                {freeCancel ? '确认取消这次预约吗？' : '距开始不足 4 小时，取消需商家审核'}
              </p>
              <p className="mt-1 text-caption text-ink-secondary">
                {freeCancel
                  ? '开始前 4 小时以上可免费取消，槽位将立即释放。'
                  : '提交后预约转为「取消审核中」，门店审核通过才会取消并释放槽位。'}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                >
                  再想想
                </button>
                <button
                  type="button"
                  disabled={cancelM.isPending}
                  onClick={() => cancelM.mutate()}
                  className="h-11 flex-1 rounded-full bg-danger text-body font-medium text-white disabled:opacity-60"
                >
                  {cancelM.isPending ? '提交中…' : freeCancel ? '确认取消' : '提交取消申请'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {reschedulable ? (
                <button
                  type="button"
                  onClick={() => setRescheduling(true)}
                  className="h-11 flex-1 rounded-full bg-brand-primary text-body font-medium text-white shadow-card"
                >
                  改期
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className={`h-11 rounded-full bg-card text-body font-medium text-danger-deep shadow-card ${reschedulable ? 'flex-1' : 'w-full'}`}
              >
                {freeCancel ? '取消预约' : '申请取消（4 小时内需商家审核）'}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {/* 服务中：禁自助取消 */}
      {serving ? (
        <section className="mt-4 rounded-card bg-sunken p-4">
          <p className="text-body text-ink">服务中，如需取消请联系门店</p>
          {storePhone ? (
            <a
              href={`tel:${storePhone}`}
              className="mt-2 inline-flex h-10 items-center rounded-full bg-success px-5 text-body font-medium text-white"
            >
              拨打门店电话
            </a>
          ) : (
            <p className="mt-1 text-caption text-ink-secondary">可到店或经商家端与门店协商处理</p>
          )}
        </section>
      ) : null}

      {/* 评价（completed） */}
      {appt.status === 'completed' ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title">服务评价</h2>
          {appt.rating !== null ? (
            <div className="mt-2">
              <StarRating value={appt.rating} />
              {appt.review ? (
                <p className="mt-2 rounded-tag bg-sunken px-3 py-2 text-body text-ink">{appt.review}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3">
              <StarRating value={rating} onChange={setRating} />
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="这次服务怎么样？说说毛孩子的体验…"
                className="mt-3 w-full rounded-input border border-line bg-card px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={reviewM.isPending}
                onClick={() => reviewM.mutate()}
                className="mt-2 h-11 w-full rounded-full bg-brand-primary text-body font-semibold text-white shadow-card disabled:opacity-60"
              >
                {reviewM.isPending ? '提交中…' : '提交评价'}
              </button>
            </div>
          )}
        </section>
      ) : null}

      <p className="mt-6 text-center text-caption text-ink-placeholder">
        预约于 {fmtMD(appt.createdAt)} {weekCN(appt.createdAt)} 创建
      </p>
    </div>
  );
}
