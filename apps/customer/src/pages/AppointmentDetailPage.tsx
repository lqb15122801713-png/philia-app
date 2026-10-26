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
 *
 * 画布化（产品-1010 画布全屏批片 3 · 预约域三重屏之二）：九块入册
 * （apptDetail.header/liveEntry/code/info/rescheduleHistory/detailSheet/album/store/actions），
 * 块序/显隐=useCanvasLayout('apptDetail')（published→注册表默认序尾补，空=APPT_DETAIL_DEFAULT_ORDER
 * 兜底）；文案键挂 CK 点选反查锚；?canvasPreview=1 探针=页首水印注记。
 * 店锚=?canvasStore= 预览店锚 > 本单门店（appointment.get 既有查询透出，零新增查询）。
 * 带参路由预览特例（片 0 §五.2）：canvasPreview=1 且 id='preview' 时用本屏预约列表既有查询
 * （appointment.listMine）首条顶替（零新增查询）；查不到=候裁清零批件 6 屏内合成示例单
 * 顶替渲染块流（预览专属，零真数据零写库，水印注记已有），不再落空态。
 * 块内逻辑/查询/状态机/级联/提交链路逐字搬进渲染器，一行不改；data-testid 原值全保留。
 * 弹层/半屏件（改期面板/取消面板=页内展开件）随 actions 块入册；SSE 订阅逻辑一行不动。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CanvasLayoutLoader, CK, EventType, getApiBase, safeUuid, Skeleton, useCanvasLayout, useEventSource, useMe, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import BookingCode from '@/components/booking/BookingCode';
import PageHeader from '@/components/PageHeader';
import ReviewPanel from '@/components/live/ReviewPanel';
import BoardingDateRangePicker, { checkinAt } from '@/components/booking/BoardingDateRangePicker';
import SlotPicker from '@/components/booking/SlotPicker';
import { ErrorState } from '@/components/home/common';
import { friendlyError, useToast } from '@philia/shared';
import { mc } from '@/components/member/copy';
import { apc, type AppointmentsCopyKey } from '@/copy/appointments';
import { rc } from '@/copy/refund';
import { sl } from '@/copy/serviceloop';
import { queryCancelFeeTiers, queryPrepaidOf, readDetailExtras } from '@/lib/exp2Api';
import { customerPetName } from '@/lib/customerPresentation';
import type { AppointmentDetail } from '@/components/booking/types';
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

/* D-38（走查P2修复批）：改约历史去重复拼接箭头——同日单侧=时刻点（fmtDateTime），
   跨日寄养侧=区间（fmtRange 内含区间箭）；两侧之间：同日点单用单箭「→」，涉区间用「改至」，不再箭链套箭链 */
const sameDaySide = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtRescheduleSide = (s: Date, e: Date) => (sameDaySide(s, e) ? fmtDateTime(s) : fmtRange(s, e));

/** 客户免费取消阈值（秒）：开始前 4 小时（与 server CANCEL_FREE_BEFORE_SEC 同步） */
const CANCEL_FREE_BEFORE_SEC = 4 * 3600;

/** v1.1-b3 B3-5（W-14）：取消原因快捷选项（选填，可再补充自由文本）；
    画布批片 3 抽键：chip 键入 copy（提交时解析为端口文案合成原因，所见即所交） */
const CANCEL_REASON_CHIPS = [
  'appointments.cancelChipSchedule',
  'appointments.cancelChipTime',
  'appointments.cancelChipPrice',
  'appointments.cancelChipOther',
] as const satisfies readonly AppointmentsCopyKey[];

/** 服务明细分项状态徽（done=沉底 / active=淡金 / locked=占位灰） */
const STEP_STATUS_META: Record<string, { key: 'appointments.stepDone' | 'appointments.stepDoing' | 'appointments.stepPending'; pill: string }> = {
  done: { key: 'appointments.stepDone', pill: 'bg-sunken text-ink-secondary' },
  active: { key: 'appointments.stepDoing', pill: 'bg-brand-primary-light text-brand-primary-pressed' },
  locked: { key: 'appointments.stepPending', pill: 'bg-sunken text-ink-placeholder' },
};

const CLIENT_ID_KEY = 'philia.sseClientId';

/** 画布注册表默认序兜底（=改造前 JSX 块序；canvas.blocks 失败/空时用） */
const APPT_DETAIL_DEFAULT_ORDER = [
  'apptDetail.header',
  'apptDetail.liveEntry',
  'apptDetail.code',
  'apptDetail.info',
  'apptDetail.rescheduleHistory',
  'apptDetail.detailSheet',
  'apptDetail.album',
  'apptDetail.store',
  'apptDetail.actions',
] as const;

/* 候裁清零批 件 6（预览兜底示例·客户端合成件）：canvasPreview=1 且 'preview' 顶替查不到
   真预约时，用屏内合成示例单渲染块流（假名「示例单·画布预览」系，金额/时刻=固定示例值；
   零真数据零写库——状态定 completed，预约码/改期/取消/相册/退款等支路天然不激活，
   水印注记页首已有）。真用户页零改动（previewMiss 以外路径一行不动） */
function exampleApptDetailOf(): AppointmentDetail {
  const start = new Date('2026-10-01T14:00:00');
  const end = new Date('2026-10-01T15:30:00');
  return {
    appointment: {
      id: 'canvas-example-appt',
      code: 'EXAMPL',
      customerId: 'canvas-example-customer',
      storeId: 'canvas-example-store',
      staffId: null,
      assignSource: null,
      petId: 'canvas-example-pet',
      serviceId: 'canvas-example-service',
      type: 'grooming',
      scheduledStart: start,
      scheduledEnd: end,
      status: 'completed',
      priceFen: 12800,
      paymentMode: 'pay_at_store',
      paidAt: null,
      paidFen: null,
      note: '示例备注·画布预览',
      cancelReason: null,
      cancelSource: null,
      emergencyContactJson: null,
      medicalAuthJson: null,
      walkTimesPerDay: null,
      checkedInAt: start,
      completedAt: end,
      rating: 5,
      review: '示例评价·画布预览',
      receptionistId: null,
      createdAt: new Date('2026-09-28T10:00:00'),
      updatedAt: end,
    },
    pet: { id: 'canvas-example-pet', name: '示例宠物·画布预览', avatarUrl: null },
    service: { id: 'canvas-example-service', name: '示例洗护·画布预览' },
    store: {
      id: 'canvas-example-store',
      name: '示例门店·画布预览',
      address: '示例路 1 号·画布预览',
      lat: null,
      lng: null,
      phone: null,
    },
    steps: [],
    boardingStay: null,
    customer: { nickname: '示例客户·画布预览', phoneTail: null },
    cashierBillId: null,
    addons: [],
    rescheduleLogs: [],
  } as unknown as AppointmentDetail;
}

/** 体验大批片 2：预付台账四态徽文案（prepaidOf.status → copy 键；未知态回退登记中） */
function prepaidStatusLabel(status: string): string {
  switch (status) {
    case 'prepaid_registered':
      return apc('appointments.prepaidRegistered');
    case 'checked_deducted':
      return apc('appointments.prepaidDeducted');
    case 'refunded':
      return apc('appointments.prepaidRefunded');
    default:
      return apc('appointments.prepaidPending');
  }
}

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
  const { id: routeId = '' } = useParams();
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  /* 画布预览探针参识别（?canvasPreview=1；微光正名批工艺三件套之一）+ 预览店锚（?canvasStore=） */
  const isCanvasPreview = useMemo(
    () => new URLSearchParams(window.location.search).get('canvasPreview') === '1',
    [],
  );
  const previewStoreId = useMemo(() => new URLSearchParams(window.location.search).get('canvasStore'), []);

  /* 带参路由预览特例（片 0 §五.2）：canvasPreview=1 且 id='preview' 时用本屏预约列表既有查询
     （appointment.listMine，与我的预约列表同 queryKey 缓存共享，零新增查询）首条顶替；
     查不到=件 6 合成示例单顶替（exampleD），detailQ 不拉取 */
  const previewListQ = useQuery({
    queryKey: ['appointment', 'listMine'],
    queryFn: () => trpc.appointment.listMine.query(),
    enabled: isCanvasPreview && routeId === 'preview',
  });
  const previewFirstId = useMemo(() => {
    const g = previewListQ.data?.groups;
    return g ? (Object.values(g).flat()[0]?.id ?? null) : null;
  }, [previewListQ.data]);
  const id = isCanvasPreview && routeId === 'preview' ? (previewFirstId ?? '') : routeId;
  /** 预览顶替未命中（列表查询已完成但首条为空）：跳过加载骨架，直走件 6 合成示例单 */
  const previewMiss = isCanvasPreview && routeId === 'preview' && !previewListQ.isPending && id === '';
  /* 件 6：previewMiss 不再落空态——改用屏内合成示例单渲染块流（零真数据零写库） */
  const exampleD = useMemo(() => (previewMiss ? exampleApptDetailOf() : null), [previewMiss]);

  const detailQ = useQuery({
    queryKey: ['appointment', 'get', id],
    queryFn: () => trpc.appointment.get.query({ appointmentId: id }),
    enabled: id.length > 0,
  });
  const d = exampleD ?? detailQ.data;
  const appt = d?.appointment;

  // 服务相册（v1.1-b2 B2-4）：洗护单 completed / in_service 时加载，按步骤分组展示
  const albumEnabled =
    !!appt && appt.type === 'grooming' && (appt.status === 'completed' || appt.status === 'in_service');
  /* 件 6：id.length>0 闸——合成示例单（id=''）不拉相册/明细真查询（零增发） */
  const albumQ = useQuery({
    queryKey: ['appointment', 'serviceAlbum', id],
    queryFn: () => trpc.appointment.serviceAlbum.query({ appointmentId: id }),
    enabled: albumEnabled && id.length > 0,
  });

  // 服务明细（体验批片 4 B15）：洗护单 in_service/completed 透出分项时长+耗材扣减
  const detailSheetQ = useQuery({
    queryKey: ['serviceStep', 'detailSheet', id],
    queryFn: () => trpc.serviceStep.detailSheet.query({ appointmentId: id }),
    enabled: albumEnabled && id.length > 0,
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
     在途/已开具=「发票进度 ›」，无申请=「申请发票 ›」）。
     件 6：合成示例单（previewMiss）不拉证书/报告真查询（零增发，入口恒隐） */
  const completedAppt = !!appt && appt.status === 'completed';
  const certsQ = useQuery({
    queryKey: ['serviceLoop', 'myCertificates'],
    queryFn: () => trpc.serviceLoop.myCertificates.query(),
    enabled: completedAppt && !previewMiss,
  });
  const reportsQ = useQuery({
    queryKey: ['serviceLoop', 'myReports'],
    queryFn: () => trpc.serviceLoop.myReports.query(),
    enabled: completedAppt && !previewMiss,
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
  const [cancelChip, setCancelChip] = useState<(typeof CANCEL_REASON_CHIPS)[number] | null>(null);
  const [cancelNote, setCancelNote] = useState('');

  /* 体验大批片 2：契约边界查询（端点等 coder O 落；失败静默，不阻断既有渲染） */
  // 预付台账（四态徽；null=无台账行不渲染）
  const prepaidQ = useQuery({
    queryKey: ['appointment', 'prepaidOf', id],
    queryFn: () => queryPrepaidOf(trpc, id),
    enabled: id.length > 0,
    retry: 0,
  });
  // 取消阶梯收费公示（端口值；取消面板展开时才拉取）
  const cancelTiersQ = useQuery({
    queryKey: ['appointment', 'cancelFeeTiers'],
    queryFn: () => queryCancelFeeTiers(trpc),
    enabled: confirmingCancel,
    retry: 0,
  });
  // appointment.get 响应扩展（addons / rescheduleLogs；缺省空数组）
  const detailExtras = readDetailExtras(d);
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
      const reason = [cancelChip ? apc(cancelChip) : '', cancelNote.trim()].filter(Boolean).join('：');
      return trpc.appointment.cancel.mutate({ appointmentId: id, ...(reason ? { reason } : {}) });
    },
    onSuccess: (r) => {
      invalidate();
      setConfirmingCancel(false);
      setCancelChip(null);
      setCancelNote('');
      showToast(
        r.outcome === 'cancelled' ? apc('appointments.toastCancelled') : apc('appointments.toastCancelRequested'),
        'info',
      );
    },
    onError: (err) => showToast(friendlyError(err, apc('appointments.cancelFailFallback')), 'error'),
  });

  /* 评价（completed 态）：review 走 ReviewPanel 合规件（PR-2 A1）——评分 state 由组件自持 */
  const reviewM = useMutation({
    mutationFn: (input: { rating: number; review?: string; anonymous?: boolean }) =>
      trpc.appointment.review.mutate({ appointmentId: id, ...input }),
    onSuccess: () => {
      invalidate();
      showToast(apc('appointments.reviewThanks'), 'info');
    },
    onError: (err) => showToast(friendlyError(err, apc('appointments.reviewFail')), 'error'),
  });

  /** 分享到服务相册（同 live 页工艺：Web Share 优先，降级复制链接） */
  const shareReview = async () => {
    const url = `${window.location.origin}/appointments/${id}/live`;
    const text = apc('appointments.shareText');
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: apc('appointments.shareTitle'), text, url });
      } catch {
        // 用户取消分享，无需提示
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(apc('appointments.shareCopied'), 'info');
    } catch {
      showToast(apc('appointments.shareCopyFail'), 'info');
    }
  };

  // v1.1-b2 B2-6 / v1.1-b3 B3-4：客户自助改期（服务端校验：本人 + pending/confirmed +
  // 距原开始 >4h，寄养以入住日首晚计）。寄养必传 scheduledStart+scheduledEnd
  // （入住/退房日按门店开店时刻对齐，与寄养向导 checkinAt 同口径）；洗护传 scheduledStart。
  const rescheduleM = useMutation({
    mutationFn: () => {
      if (appt?.type === 'boarding') {
        if (!d?.store || !newCheckin || !newCheckout) throw new Error(apc('appointments.rescheduleNeedDates'));
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
      showToast(apc('appointments.rescheduleToast'), 'info');
    },
    onError: (err) => showToast(friendlyError(err, apc('appointments.rescheduleFail')), 'error'),
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
          `${apc('appointments.rejectedPrefix')}${typeof data.reason === 'string' && data.reason ? `：${data.reason}` : ''}`,
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

  /* ---- 画布端口：注册表块序 + 有效布局（published→默认序尾补；空=默认序兜底常量） ---- */
  /* 店锚=?canvasStore= 预览店锚 > 本单门店（appointment.get 透出 store.id，零新增查询）；
     件 6：合成示例单的假店 id 不进布局锚（预览店锚缺省= null 走全局布局） */
  const detailStoreId = previewStoreId ?? (previewMiss ? null : d?.store?.id) ?? null;
  const blocksQ = useQuery({
    queryKey: ['canvas', 'blocks'],
    queryFn: () => trpc.canvas.blocks.query(),
    staleTime: 300_000,
    retry: 1,
  });
  const registryBlocks = useMemo(() => {
    const items = (blocksQ.data?.items ?? [])
      .filter((b) => b.pageKey === 'apptDetail')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return items.length > 0 ? items : APPT_DETAIL_DEFAULT_ORDER.map((blockKey) => ({ blockKey }));
  }, [blocksQ.data]);
  const layout = useCanvasLayout('apptDetail', detailStoreId, registryBlocks);

  if (detailQ.isPending && !previewMiss) {
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
  // 门店电话：stores.phone 已在仓（0042 迁移），无值提示到店/商家端联系
  const storePhone = d.store?.phone ?? null;

  // 服务相册分组：completed 展示全部六步；进行中订单只显示已确认（done）步骤的照片
  const albumRawSteps = albumQ.data?.steps ?? [];
  const albumSteps =
    appt.status === 'completed' ? albumRawSteps : albumRawSteps.filter((s) => s.status === 'done');
  const albumPhotoCount = albumSteps.reduce((n, s) => n + s.photos.length, 0);

  /* 块渲染器（块内逻辑/条件与改造前逐字一致；文案走 copy 键 + CK 反查锚） */
  const renderers: Record<string, () => ReactNode> = {
    /* 1. apptDetail.header：统一返回条（U1-A：←圆钮+标题），右侧保留状态 pill
          （pill 文案=APPT_STATUS_META 共享表，组件外键挂不上——见 NOTES） */
    'apptDetail.header': () => (
      <PageHeader
        title={<CK k="appointments.detailTitle">{apc('appointments.detailTitle')}</CK>}
        right={<span className={`rounded-full px-2.5 py-1 text-caption ${status.pill}`}>{status.label}</span>}
      />
    ),

    /* 2. apptDetail.liveEntry：服务中显著 live 入口（→/appointments/:id/live） */
    'apptDetail.liveEntry': () =>
      serving ? (
        <Link
          to={`/appointments/${id}/live`}
          className="mt-4 flex items-center justify-between rounded-card bg-philia-gradient p-4 text-ink shadow-philia"
        >
          <span>
            <span className="flex items-center gap-2 text-title">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-card/25 animate-halo">●</span>
              <CK k={appt.type === 'boarding' ? 'appointments.liveBoarding' : 'appointments.liveGrooming'}>
                {appt.type === 'boarding' ? apc('appointments.liveBoarding') : apc('appointments.liveGrooming')}
              </CK>
            </span>
            <span className="mt-0.5 block text-caption text-ink/85"><CK k="appointments.liveSub">{apc('appointments.liveSub')}</CK></span>
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      ) : null,

    /* 3. apptDetail.code：预约码（pending/confirmed 可出示；滚动时间窗二维码 + 人工码；
          BookingCode 组件内文案=共享件内渲，组件内无 CK 锚——见 NOTES） */
    'apptDetail.code': () =>
      cancellable ? (
        <section className="mt-4 rounded-card bg-card p-5 shadow-card">
          <h2 className="text-center text-title"><CK k="appointments.codeTitle">{apc('appointments.codeTitle')}</CK></h2>
          <div className="mt-3">
            <BookingCode appointmentId={id} />
          </div>
        </section>
      ) : null,

    /* 4. apptDetail.info：状态横条（取消审核中/商家婉拒）+ 预约信息卡（全字段）
          + 附加项 + 发票入口 + 已入住房间行（横条原位置在 code 与信息卡之间，并入本块首段） */
    'apptDetail.info': () => (
      <>
        {appt.status === 'cancel_requested' ? (
          <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
            <CK k="appointments.cancelReviewing">{apc('appointments.cancelReviewing')}</CK>
          </p>
        ) : null}

        {/* 商家婉拒（v1.1-b3 B3-3）：已取消 + 来源 merchant_reject 时展示拒单原因 */}
        {appt.status === 'cancelled' && appt.cancelSource === 'merchant_reject' ? (
          <p className="mt-4 rounded-card bg-danger-light px-4 py-3 text-body text-danger-deep">
            <CK k="appointments.rejectedPrefix">{apc('appointments.rejectedPrefix')}</CK>{appt.cancelReason ? `：${appt.cancelReason}` : ''}
          </p>
        ) : null}

        {/* 预约信息（全字段） */}
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title"><CK k="appointments.infoTitle">{apc('appointments.infoTitle')}</CK></h2>
          <dl className="mt-2 space-y-1.5 text-body">
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtType">{apc('appointments.dtType')}</CK></dt>
              <dd>{APPT_TYPE_LABEL[appt.type] ?? appt.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtService">{apc('appointments.dtService')}</CK></dt>
              <dd className="font-medium">{d.service?.name ?? '—'}</dd>
            </div>
            {appt.type === 'boarding' && d.service?.boardingRoomType ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.dtRoomType">{apc('appointments.dtRoomType')}</CK></dt>
                <dd>{d.service.boardingRoomType}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtPet">{apc('appointments.dtPet')}</CK></dt>
              <dd>{customerPetName(d.pet?.name, '—')}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtTime">{apc('appointments.dtTime')}</CK></dt>
              <dd className="font-number">
                {appt.type === 'boarding'
                  ? fmtRange(appt.scheduledStart, appt.scheduledEnd)
                  : `${fmtDateTime(appt.scheduledStart)} - ${fmtHM(appt.scheduledEnd)}`}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtAmount">{apc('appointments.dtAmount')}</CK></dt>
              <dd className="font-number font-semibold text-ink">{fenToYuan(appt.priceFen)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtPaymentMode">{apc('appointments.dtPaymentMode')}</CK></dt>
              <dd>{paymentModeLabel(appt.paymentMode)}</dd>
            </div>
            {appt.paidAt ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.dtPaid">{apc('appointments.dtPaid')}</CK></dt>
                <dd className="font-number">{fenToYuan(appt.paidFen ?? appt.priceFen)}<CK k="appointments.paidSuffix">{apc('appointments.paidSuffix')}</CK></dd>
              </div>
            ) : null}
            {/* 体验大批片 2：预付台账四态徽（prepaidOf；null=无台账行不渲染） */}
            {prepaidQ.data ? (
              <div className="flex items-center justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.prepaidLabel">{apc('appointments.prepaidLabel')}</CK></dt>
                <dd>
                  <span
                    data-testid="appt-prepaid-badge"
                    data-status={prepaidQ.data.status}
                    className="rounded-chip bg-sunken px-2 py-1 text-caption-xs text-ink"
                  >
                    {prepaidStatusLabel(prepaidQ.data.status)}
                  </span>
                </dd>
              </div>
            ) : null}
            {appt.checkedInAt ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.dtCheckedIn">{apc('appointments.dtCheckedIn')}</CK></dt>
                <dd className="font-number">{fmtDateTime(appt.checkedInAt)}</dd>
              </div>
            ) : null}
            {appt.completedAt ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.dtCompletedAt">{apc('appointments.dtCompletedAt')}</CK></dt>
                <dd className="font-number">{fmtDateTime(appt.completedAt)}</dd>
              </div>
            ) : null}
            {appt.note ? (
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-secondary"><CK k="appointments.dtNote">{apc('appointments.dtNote')}</CK></dt>
                <dd className="text-right">{appt.note}</dd>
              </div>
            ) : null}
            {/* 体验大批片 2：寄养快照透出（紧急联系人 / 医疗授权 / 遛弯次数；有才显示） */}
            {appt.emergencyContactJson ? (
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-ink-secondary"><CK k="appointments.emergencyContact">{apc('appointments.emergencyContact')}</CK></dt>
                <dd className="text-right">
                  {appt.emergencyContactJson.name} {appt.emergencyContactJson.phone}（{appt.emergencyContactJson.relation}）
                </dd>
              </div>
            ) : null}
            {appt.medicalAuthJson?.agreed ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.medicalAuthLabel">{apc('appointments.medicalAuthLabel')}</CK></dt>
                <dd><CK k="appointments.medicalAuthSigned">{apc('appointments.medicalAuthSigned', { version: appt.medicalAuthJson.contentVersion })}</CK></dd>
              </div>
            ) : null}
            {appt.walkTimesPerDay ? (
              <div className="flex justify-between">
                <dt className="text-ink-secondary"><CK k="appointments.dtWalkTimes">{apc('appointments.dtWalkTimes')}</CK></dt>
                <dd className="font-number"><CK k="appointments.walkTimes">{apc('appointments.walkTimes', { n: appt.walkTimesPerDay })}</CK></dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-secondary"><CK k="appointments.dtId">{apc('appointments.dtId')}</CK></dt>
              <dd className="font-number text-caption text-ink-placeholder">{appt.id}</dd>
            </div>
          </dl>
          {/* 体验大批片 2：附加项透出（名称 + 快照价；空数组不渲染） */}
          {detailExtras.addons.length > 0 ? (
            <div className="mt-3 border-t border-line-divider pt-3" data-testid="appt-addons">
              <p className="text-caption text-ink-secondary"><CK k="appointments.addonsTitle">{apc('appointments.addonsTitle')}</CK></p>
              <ul className="mt-1.5 space-y-1 text-body">
                {detailExtras.addons.map((a, i) => (
                  <li key={`${a.nameSnapshot}-${i}`} className="flex justify-between">
                    <span>{a.nameSnapshot}</span>
                    <span className="font-number">{fenToYuan(a.priceFen)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* 补缺大批片 4：实付行后发票入口（paidFen>0 才显；在途/已开具=进度入口） */}
          {(appt.paidFen ?? 0) > 0 ? (
            <div className="mt-3 border-t border-line-divider pt-3">
              <Link
                to={myInvoice ? `/invoices/${myInvoice.id}` : `/invoice/apply/appointment/${id}`}
                data-testid="appt-invoice-entry"
                className="flex items-center justify-between text-body-sm font-semibold text-ink"
              >
                <CK k={myInvoice ? 'inv.progressEntry' : 'inv.applyEntry'}>
                  {myInvoice ? sl('inv.progressEntry') : sl('inv.applyEntry')}
                </CK>
              </Link>
            </div>
          ) : null}
          {d.boardingStay?.roomNo ? (
            <p className="mt-2 rounded-tag bg-sunken px-3 py-2 text-caption text-ink-secondary">
              <CK k="appointments.checkedInRoom">{apc('appointments.checkedInRoom', { room: d.boardingStay.roomNo })}</CK>
            </p>
          ) : null}
        </section>
      </>
    ),

    /* 5. apptDetail.rescheduleHistory：改约历史（rescheduleLogs 按序渲染 before→after
          +操作人角色+时刻；空态不渲染） */
    'apptDetail.rescheduleHistory': () =>
      detailExtras.rescheduleLogs.length > 0 ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card" data-testid="appt-reschedule-history">
          <h2 className="text-title"><CK k="appointments.rescheduleHistory">{apc('appointments.rescheduleHistory')}</CK></h2>
          <ul className="mt-2 space-y-2.5">
            {detailExtras.rescheduleLogs.map((log, i) => {
              const beforeS = new Date(log.beforeStart);
              const beforeE = new Date(log.beforeEnd);
              const afterS = new Date(log.afterStart);
              const afterE = new Date(log.afterEnd);
              const hasRangeSide = !sameDaySide(beforeS, beforeE) || !sameDaySide(afterS, afterE);
              return (
                <li key={i} className="border-l-2 border-line pl-3">
                  <p className="font-number text-body-sm" data-testid={`reschedule-log-${i}`}>
                    {fmtRescheduleSide(beforeS, beforeE)}
                    <span className="mx-1 text-ink-placeholder">{hasRangeSide ? '改至' : '→'}</span>
                    {fmtRescheduleSide(afterS, afterE)}
                  </p>
                  <p className="mt-0.5 text-caption-xs text-ink-placeholder">
                    <CK k={log.byRole === 'customer' ? 'appointments.rescheduleRoleCustomer' : 'appointments.rescheduleRoleMerchant'}>
                      {log.byRole === 'customer'
                        ? apc('appointments.rescheduleRoleCustomer')
                        : apc('appointments.rescheduleRoleMerchant')}
                    </CK>
                    {' · '}
                    {fmtDateTime(new Date(log.createdAt))}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null,

    /* 6. apptDetail.detailSheet：服务明细（体验批片 4 B15）：洗护单 in_service/completed——
          分项时长（durationSec→X 分钟，进行中/待开始文签）+ 耗材扣减透出（空数组=诚实空态注记） */
    'apptDetail.detailSheet': () =>
      albumEnabled && detailSheetQ.data ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card" data-testid="service-detail-sheet">
          <h2 className="text-title"><CK k="appointments.detailSheetTitle">{apc('appointments.detailSheetTitle')}</CK></h2>
          <ul className="mt-3 space-y-2">
            {detailSheetQ.data.steps.map((s) => {
              const stepMeta = STEP_STATUS_META[s.status] ?? STEP_STATUS_META.locked!;
              return (
                <li key={s.stepKey} className="flex items-center justify-between gap-2 text-body">
                  <span className="flex items-center gap-2">
                    <span>{s.label}</span>
                    <span className={`rounded-tag px-1.5 py-0.5 text-caption ${stepMeta.pill}`}>
                      <CK k={stepMeta.key}>{apc(stepMeta.key)}</CK>
                    </span>
                  </span>
                  <span className="font-number shrink-0 text-caption text-ink-secondary">
                    {s.status === 'done' && s.durationSec != null
                      ? apc('appointments.stepDuration', { min: Math.max(1, Math.round(s.durationSec / 60)) })
                      : s.status === 'active'
                        ? apc('appointments.stepDoing')
                        : apc('appointments.stepPending')}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-line-divider pt-3" data-testid="service-materials">
            <p className="text-caption text-ink-secondary"><CK k="appointments.materialsTitle">{apc('appointments.materialsTitle')}</CK></p>
            {detailSheetQ.data.materials.length === 0 ? (
              <p className="mt-1 text-caption text-ink-secondary"><CK k="appointments.materialsEmpty">{apc('appointments.materialsEmpty')}</CK></p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {detailSheetQ.data.materials.map((m, i) => (
                  <li key={`${m.name}-${i}`} className="flex items-baseline justify-between gap-2 text-body-sm">
                    <span className="text-ink">{m.name}</span>
                    <span className="font-number shrink-0 text-ink-secondary">
                      {apc('appointments.materialQty', { n: m.quantity })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null,

    /* 7. apptDetail.album：服务相册（v1.1-b2 B2-4）：按六步分组网格展示，before/after 打标；
          completed 展示全部六步分组，进行中订单只显示已确认步骤的照片 */
    'apptDetail.album': () =>
      albumEnabled && albumSteps.length > 0 ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title"><CK k="appointments.albumTitle">{apc('appointments.albumTitle')}</CK></h2>
          <p className="mt-0.5 text-caption text-ink-secondary">
            <CK k="appointments.albumSub">{apc('appointments.albumSub', { count: albumPhotoCount })}</CK>
          </p>
          <div className="mt-3 space-y-4">
            {albumSteps.map((step) => (
              <div key={step.stepKey}>
                <h3 className="flex items-baseline gap-1.5 text-body font-medium">
                  {step.stepName}
                  <span className="text-caption text-ink-placeholder">
                    {step.photos.length > 0
                      ? apc('appointments.albumPhotoCount', { n: step.photos.length })
                      : apc('appointments.albumNoPhoto')}
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
                            <CK k={p.tag === 'before' ? 'appointments.albumBeforeTag' : 'appointments.albumAfterTag'}>
                              {p.tag === 'before' ? apc('appointments.albumBeforeTag') : apc('appointments.albumAfterTag')}
                            </CK>
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
      ) : null,

    /* 8. apptDetail.store：门店与导航（高德/腾讯 URI 外链 + tel 直拨；navLinks 逻辑逐字） */
    'apptDetail.store': () =>
      d.store ? (
        <section className="mt-4 rounded-card bg-card p-4 shadow-card">
          <h2 className="text-title"><CK k="appointments.storeTitle">{apc('appointments.storeTitle')}</CK></h2>
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
              <CK k="appointments.navAmap">{apc('appointments.navAmap')}</CK>
            </a>
            <a
              href={navLinks(d.store).tencent}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 flex-1 items-center justify-center rounded-full bg-brand-primary-light text-body font-medium text-brand-primary-pressed"
            >
              <CK k="appointments.navTencent">{apc('appointments.navTencent')}</CK>
            </a>
            {storePhone ? (
              <a
                href={`tel:${storePhone}`}
                className="flex h-10 flex-1 items-center justify-center rounded-full bg-success-light text-body font-medium text-success-deep"
              >
                <CK k="appointments.callStore">{apc('appointments.callStore')}</CK>
              </a>
            ) : null}
          </div>
        </section>
      ) : null,

    /* 9. apptDetail.actions：操作区（再次预约 / 证书报告入口 / 改期与取消规则面板 /
          退款售后入口 / 服务中禁自助取消 / 评价 ReviewPanel / 创建时刻尾行）。
          聚合口径：改造前散布在 store 块前后的操作件按块内原相对序收拢（见 NOTES）；
          改期/取消=页内展开件非弹层，随本块入册；ReviewPanel 组件内文案无 CK 锚 */
    'apptDetail.actions': () => (
      <>
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
            <CK k="appointments.rebook">{apc('appointments.rebook')}</CK>
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
                <CK k="cert.detailEntry">{sl('cert.detailEntry')}</CK>
              </Link>
            ) : null}
            {hasReport ? (
              <Link
                to={`/philia/reports/${id}`}
                data-testid="appt-report-entry"
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-card text-body font-medium text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                <CK k="report.detailEntry">{sl('report.detailEntry')}</CK>
              </Link>
            ) : null}
          </div>
        ) : null}

        {/* 改期 / 取消规则 */}
        {cancellable ? (
          <section className="mt-4">
            {rescheduling ? (
              <div className="rounded-card bg-card p-4 shadow-card">
                <p className="text-body font-semibold">
                  <CK k={appt.type === 'boarding' ? 'appointments.rescheduleTitleBoarding' : 'appointments.rescheduleTitleGrooming'}>
                    {appt.type === 'boarding' ? apc('appointments.rescheduleTitleBoarding') : apc('appointments.rescheduleTitleGrooming')}
                  </CK>
                </p>
                <p className="mt-1 text-caption text-ink-secondary">
                  <CK k="appointments.rescheduleNote">
                    {apc('appointments.rescheduleNote', { service: d.service?.name ?? apc('appointments.fallbackService'), pet: customerPetName(d.pet?.name, apc('appointments.fallbackPet')) })}
                  </CK>
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
                      {rescheduleSlotsQ.isError
                        ? <CK k="appointments.slotsLoadFail">{apc('appointments.slotsLoadFail')}</CK>
                        : <CK k="appointments.slotsLoading">{apc('appointments.slotsLoading')}</CK>}
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
                    <CK k="appointments.thinkMore">{apc('appointments.thinkMore')}</CK>
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
                    {rescheduleM.isPending ? apc('appointments.submitting') : <CK k="appointments.rescheduleSubmit">{apc('appointments.rescheduleSubmit')}</CK>}
                  </button>
                </div>
              </div>
            ) : confirmingCancel ? (
              <div className="rounded-card bg-card p-4 shadow-card">
                <p className="text-body font-semibold">
                  <CK k={freeCancel ? 'appointments.cancelAskFree' : 'appointments.cancelAskLate'}>
                    {freeCancel ? apc('appointments.cancelAskFree') : apc('appointments.cancelAskLate')}
                  </CK>
                </p>
                <p className="mt-1 text-caption text-ink-secondary">
                  <CK k={freeCancel ? 'appointments.cancelRuleFree' : 'appointments.cancelRuleLate'}>
                    {freeCancel
                      ? apc('appointments.cancelRuleFree')
                      : apc('appointments.cancelRuleLate')}
                  </CK>
                </p>
                {/* 体验大批片 2：取消阶梯收费公示卡（cancelFeeTiers 端口值；
                    公示口径暂不扣款注记明面；查询失败/空档不渲染，不阻断取消主流程） */}
                {cancelTiersQ.data && cancelTiersQ.data.tiers.length > 0 ? (
                  <div
                    className="mt-3 rounded-tag bg-sunken px-3.5 py-3"
                    data-testid="appt-cancel-tiers"
                  >
                    <p className="text-caption font-semibold text-ink"><CK k="appointments.cancelFeeTitle">{apc('appointments.cancelFeeTitle')}</CK></p>
                    <ul className="mt-1.5 space-y-1">
                      {cancelTiersQ.data.tiers.map((t, i) => (
                        <li key={i} className="flex items-center justify-between text-caption text-ink-secondary">
                          <span>{t.label}</span>
                          <span className="font-number">{t.feeBp / 100}%</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-caption-xs text-ink-placeholder"><CK k="appointments.cancelFeeNote">{apc('appointments.cancelFeeNote')}</CK></p>
                  </div>
                ) : null}
                {/* B3-5（W-14）：取消原因收集（选填 chips + 自由文本，商家端透出） */}
                <div className="mt-3">
                  <p className="text-caption text-ink-secondary"><CK k="appointments.cancelReasonTitle">{apc('appointments.cancelReasonTitle')}</CK></p>
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
                        <CK k={c}>{apc(c)}</CK>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={cancelNote}
                    onChange={(e) => setCancelNote(e.target.value)}
                    maxLength={100}
                    rows={2}
                    placeholder={apc('appointments.cancelNotePh')}
                    className="mt-2 w-full rounded-input border border-line bg-card px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="h-11 flex-1 rounded-full bg-sunken text-body font-medium text-ink"
                  >
                    <CK k="appointments.thinkMore">{apc('appointments.thinkMore')}</CK>
                  </button>
                  <button
                    type="button"
                    disabled={cancelM.isPending}
                    onClick={() => cancelM.mutate()}
                    className="h-11 flex-1 rounded-full bg-danger text-body font-medium text-white disabled:opacity-60"
                  >
                    {cancelM.isPending
                      ? apc('appointments.submitting')
                      : <CK k={freeCancel ? 'appointments.cancelSubmitFree' : 'appointments.cancelSubmitLate'}>{freeCancel ? apc('appointments.cancelSubmitFree') : apc('appointments.cancelSubmitLate')}</CK>}
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
                    <CK k="appointments.rescheduleCta">{apc('appointments.rescheduleCta')}</CK>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className={`h-11 rounded-full bg-card text-body font-medium text-danger-deep shadow-card ${reschedulable ? 'flex-1' : 'w-full'}`}
                >
                  <CK k={freeCancel ? 'appointments.cancelCtaFree' : 'appointments.cancelCtaLate'}>
                    {freeCancel ? apc('appointments.cancelCtaFree') : apc('appointments.cancelCtaLate')}
                  </CK>
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
              <p className="text-caption text-ink-secondary"><CK k="refund.maintainNotice">{rc('refund.maintainNotice')}</CK></p>
            ) : (
              <>
                <span className="text-body text-ink-secondary"><CK k="refund.entryHint">{rc('refund.entryHint')}</CK></span>
                <Link
                  to={refundOpen ? `/refunds/${refundOpen.id}` : `/appointments/${id}/refund`}
                  data-testid={`refund-entry-appt-${id}`}
                  className="text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  <CK k={refundOpen ? 'refund.progressCta' : 'refund.entryCta'}>
                    {refundOpen ? rc('refund.progressCta') : rc('refund.entryCta')}
                  </CK>
                </Link>
              </>
            )}
          </section>
        ) : null}

        {/* 服务中：禁自助取消 */}
        {serving ? (
          <section className="mt-4 rounded-card bg-sunken p-4">
            <p className="text-body text-ink"><CK k="appointments.servingTitle">{apc('appointments.servingTitle')}</CK></p>
            {storePhone ? (
              <a
                href={`tel:${storePhone}`}
                className="mt-2 inline-flex h-10 items-center rounded-full bg-success px-5 text-body font-medium text-white"
              >
                <CK k="appointments.servingCall">{apc('appointments.servingCall')}</CK>
              </a>
            ) : (
              <p className="mt-1 text-caption text-ink-secondary"><CK k="appointments.servingNote">{apc('appointments.servingNote')}</CK></p>
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
          <CK k="appointments.createdLine">{apc('appointments.createdLine', { date: fmtMD(appt.createdAt), week: weekCN(appt.createdAt) })}</CK>
        </p>
      </>
    ),
  };

  return (
    <CanvasLayoutLoader pageKey="apptDetail" storeId={detailStoreId}>
      <div className="px-4 py-6">
        {toastEl}

        {/* 画布预览水印（?canvasPreview=1 探针模式；零真会话零写库口径注记） */}
        {isCanvasPreview ? (
          <p className="mb-3 text-center text-caption-xs text-ink-secondary" data-testid="appt-detail-canvas-preview-note">{mc('mc.canvasExampleNote')}</p>
        ) : null}

        {/* 块流：九块按有效布局渲染（published 覆盖∪默认序尾补）；各块自带渲染闸
            （状态条件照改造前逐字搬），默认序下可见块集合与原三分支后主流程一致 */}
        {layout.map((b) =>
          b.visible ? (
            <section data-block-key={b.blockKey} key={b.blockKey}>
              {renderers[b.blockKey]?.() ?? null}
            </section>
          ) : null,
        )}
      </div>
    </CanvasLayoutLoader>
  );
}
