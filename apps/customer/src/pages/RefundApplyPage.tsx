/**
 * 退款申请表单（补缺批片 1）：/mall/orders/:id/refund（orderKind=order）与
 * /appointments/:id/refund（orderKind=appointment）同组件双 orderKind 参数化。
 *
 * - 组成：原单摘要卡（店名/单号/金额 mono）→ 类型选择（order 才显示双选；appointment
 *   强制仅退款）→ 原因下拉（select 禁手打，选项=configView.reasonOptions；other→说明
 *   必填）→ 凭证照片上传（≤3 张，uploadImage→/api/upload relDir='refund/apply'，缩略
 *   图可删）→ 说明文本域 → 申请金额算式明面（R15：行金额逐项 mono + 合计=申请金额，
 *   行数据取原单详情）→ 时效公示卡（数值=configView 端口）→ 提交钮（h≥56 主钮）→
 *   成功 replace 跳 /refunds/:id。
 * - billId 口径：order=orders.id（listMyOrders 取原单）；appointment=cashier_bills.id——
 *   补缺大批片 1 接通：appointment.get 附 cashierBillId（经 cashier_bill_items 预约行
 *   反查最新一笔已结账收银单），路由参数仍为 appointmentId，表单内解析为 billId。
 *   appointment.get 不透出收银单行明细 → 表单按全额单档渲染（申请金额=单已付金额 mono，
 *   不传 itemIds；金额/时限/幂等仍由 create 服务端校验，已报备）。
 * - 闸依赖：金额/时限/幂等由 create 服务端校验（客户无 preview 权限），客户端只传
 *   全额（不传 itemIds）；开关关=维护态明文（不隐藏不报错）；已有在途申请=提示+进度出口。
 * - 返回：PageHeader navigate(-1) 时间序回退 + 直访 fallback 原单来处（R1/R19）。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ListSkeleton,
  friendlyError,
  getApiBase,
  uploadImage,
  usePhiliaClient,
  useToast,
} from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import { ErrorState } from '@/components/home/common';
import { fenToYuan, fmtOrderTime } from '@/components/mall/format';
import { RefundTimingCard, refundTypeLabel } from '@/components/refund/common';
import { rc } from '@/copy/refund';

/** 凭证照片上限（任务书：≤3 张） */
const MAX_PHOTOS = 3;
/** 服务端 create.description 上限 500 字，说明文本域同口径 */
const MAX_DESC_LEN = 500;

interface OriginOrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price_fen: number;
}

interface OriginOrder {
  id: string;
  orderNo: string;
  totalFen: number;
  status: string;
  items: OriginOrderItem[];
  createdAt: Date | string;
  storeName: string | null;
}

export default function RefundApplyPage({ orderKind }: { orderKind: 'appointment' | 'order' }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { trpc } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });
  const apiBase = getApiBase();

  /** 直访兜底父页=原单来处（商城无订单详情页，回订单列表） */
  const fallbackPath = orderKind === 'order' ? '/mall/orders' : `/appointments/${id}`;

  const configQ = useQuery({
    queryKey: ['refundRequest', 'configView'],
    queryFn: () => trpc.refundRequest.configView.query(),
  });

  /* 商城原单：客户无单条 get 接口，listMyOrders 全组扁平后按 id 匹配（同 MallOrdersPage 数据源） */
  const ordersQ = useQuery({
    queryKey: ['mall', 'listMyOrders'],
    queryFn: () => trpc.mall.listMyOrders.query(),
    enabled: orderKind === 'order',
  });
  const origin: OriginOrder | null =
    orderKind === 'order'
      ? ((Object.values(ordersQ.data?.groups ?? {})
          .flat()
          .find((o) => o.id === id) as OriginOrder | undefined) ?? null)
      : null;

  /* 到店服务单原单（补缺大批片 1）：appointment.get 附 cashierBillId（最新已结账收银单） */
  const apptQ = useQuery({
    queryKey: ['appointment', 'get', id],
    queryFn: () => trpc.appointment.get.query({ appointmentId: id }),
    enabled: orderKind === 'appointment',
  });
  const apptOrigin = orderKind === 'appointment' ? (apptQ.data ?? null) : null;
  const appt = apptOrigin?.appointment ?? null;

  /** create 的 billId：order=路由 id（orders.id）；appointment=cashierBillId（cashier_bills.id） */
  const billId = orderKind === 'order' ? id : (apptOrigin?.cashierBillId ?? '');

  /* 在途申请（幂等闸前置提示：同 billId 有 submitted/approved/refunded → 引导去看进度） */
  const refundsQ = useQuery({
    queryKey: ['refundRequest', 'listMine'],
    queryFn: () => trpc.refundRequest.listMine.query(),
    enabled: orderKind === 'order' || billId.length > 0,
  });
  const inflight =
    billId.length > 0
      ? (refundsQ.data?.find(
          (r) => r.billId === billId && ['submitted', 'approved', 'refunded'].includes(r.status),
        ) ?? null)
      : null;

  /* ---- 表单状态 ---- */
  const [refundType, setRefundType] = useState<'refund_only' | 'return_refund'>('refund_only');
  const [reasonCode, setReasonCode] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Array<{ url: string; thumbUrl: string }>>([]);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    const picks = Array.from(files).slice(0, Math.max(0, room));
    for (const file of picks) {
      setUploading((n) => n + 1);
      try {
        const up = await uploadImage(apiBase, file, 'refund/apply');
        setPhotos((cur) => (cur.length >= MAX_PHOTOS ? cur : [...cur, up]));
      } catch (err) {
        showToast(friendlyError(err, '照片上传失败，请重试'), 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const createM = useMutation({
    mutationFn: () =>
      trpc.refundRequest.create.mutate({
        orderKind,
        billId,
        type: orderKind === 'appointment' ? 'refund_only' : refundType,
        reasonCode,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(photos.length > 0 ? { photoUrls: photos.map((p) => p.url) } : {}),
      }),
    onSuccess: (r) => {
      showToast(rc('refund.submitDone'), 'info');
      navigate(`/refunds/${r.request.id}`, { replace: true });
    },
    onError: (err) => showToast(friendlyError(err, '提交失败，请稍后再试'), 'error'),
  });

  const needDesc = reasonCode === 'other';
  const submittable =
    reasonCode.length > 0 && (!needDesc || description.trim().length > 0) && uploading === 0;

  /* R15 算式明面：行金额逐项 + 合计=申请金额（行数据取原单；全额申请，不传 itemIds）。
     order=订单行逐项；appointment=全额单档（appointment.get 不透出收银单行明细，
     申请金额=单已付金额 mono，服务端 create 按可退余额口径计算；已报备） */
  const lines =
    orderKind === 'order'
      ? (origin?.items ?? []).map((it) => ({
          label: it.name,
          amountFen: it.price_fen * it.quantity,
        }))
      : appt
        ? [
            {
              label: apptOrigin?.service?.name ?? '到店服务单',
              amountFen: appt.paidFen ?? appt.priceFen,
            },
          ]
        : [];
  const totalFen = lines.reduce((s, l) => s + l.amountFen, 0);

  const reasonOptions = configQ.data?.reasonOptions ?? [];

  /* ---- 渲染分派（双 orderKind 统一闸序）：加载 → 错误 → 原单缺失 → 原单不可退 →
     开关维护态 → 在途进度 → 真表单 ---- */
  const pagePending =
    configQ.isPending || (orderKind === 'order' ? ordersQ.isPending : apptQ.isPending);
  const pageError = orderKind === 'order' ? ordersQ.isError : apptQ.isError;
  const retryPage = () => void (orderKind === 'order' ? ordersQ.refetch() : apptQ.refetch());
  const originMissing = orderKind === 'order' ? !origin : !apptOrigin;
  const originNotRefundable =
    orderKind === 'order'
      ? !!origin && origin.status !== 'shipped' && origin.status !== 'received'
      : !apptOrigin?.cashierBillId;
  const originSummary =
    orderKind === 'order'
      ? {
          storeName: origin?.storeName ?? '菲丽亚门店',
          sub: origin ? `${origin.orderNo} · ${fmtOrderTime(origin.createdAt)}` : '',
        }
      : {
          storeName: apptOrigin?.store?.name ?? '菲丽亚门店',
          sub: appt
            ? `${apptOrigin?.service?.name ?? '到店服务'} · ${fmtOrderTime(appt.scheduledStart)}`
            : '',
        };

  return (
    <div className="px-4 py-6">
      {toastEl}
      {/* R1：返回=时间序 navigate(-1)，直访 fallback=原单来处 */}
      <PageHeader title={rc('refund.formTitle')} fallback={fallbackPath} />

      {pagePending ? (
        <div className="mt-4 rounded-card bg-card p-4 shadow-card">
          <ListSkeleton rows={4} />
        </div>
      ) : pageError ? (
        <div className="mt-4">
          <ErrorState message={rc('refund.loadFail')} onRetry={retryPage} />
        </div>
      ) : originMissing ? (
        <div className="mt-4">
          <ErrorState
            message={rc('refund.originNotFound')}
            action={
              <Link
                to={fallbackPath}
                className="flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {rc('refund.backToOrigin')}
              </Link>
            }
          />
        </div>
      ) : originNotRefundable ? (
        <div className="mt-4">
          <ErrorState
            message={
              orderKind === 'order' ? rc('refund.orderNotRefundable') : rc('refund.appointmentNoBill')
            }
            action={
              <Link
                to={fallbackPath}
                className="flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {rc('refund.backToOrigin')}
              </Link>
            }
          />
        </div>
      ) : configQ.data?.enabled === false ? (
        /* 开关关=维护态明文（不隐藏不报错） */
        <p className="mt-4 rounded-card bg-sunken px-4 py-3 text-body text-ink-secondary">
          {rc('refund.maintainNotice')}
        </p>
      ) : inflight ? (
        <div className="mt-4 rounded-card bg-card p-4 shadow-card">
          <p className="text-body text-ink">{rc('refund.inflightNotice')}</p>
          <Link
            to={`/refunds/${inflight.id}`}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2 text-caption font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {rc('refund.viewProgressCta')}
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-4" data-testid="refund-apply-form">
          {/* 原单摘要卡（店名/单号或服务·时间/金额 mono） */}
          <section className="rounded-card bg-card p-4 shadow-card" data-testid="refund-origin-card">
            <h2 className="text-title">{rc('refund.originTitle')}</h2>
            <p className="mt-2 text-body font-medium">{originSummary.storeName}</p>
            <p className="mt-0.5 font-number text-caption text-ink-placeholder">{originSummary.sub}</p>
            <p className="mt-1.5 font-number text-body font-semibold text-ink">
              {fenToYuan(totalFen)}
            </p>
          </section>

          {/* 类型选择（仅 order 双选；appointment 服务端强制仅退款，固定 refund_only 不渲染） */}
          {orderKind === 'order' ? (
            <section className="rounded-card bg-card p-4 shadow-card">
              <div className="flex gap-2">
                {(['refund_only', 'return_refund'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    data-testid={`refund-type-${t}`}
                    onClick={() => setRefundType(t)}
                    className={`h-11 flex-1 rounded-full text-body font-medium transition ${
                      refundType === t ? 'bg-brand-primary text-ink' : 'bg-sunken text-ink-secondary'
                    }`}
                  >
                    {refundTypeLabel(t)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* 原因下拉（select 禁手打；other→说明必填） */}
          <section className="rounded-card bg-card p-4 shadow-card">
            <label className="text-body font-medium" htmlFor="refund-reason">
              {rc('refund.reasonLabel')}
            </label>
            <select
              id="refund-reason"
              data-testid="refund-reason-select"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="mt-2 h-12 w-full rounded-input border border-line bg-card px-3.5 text-body focus:border-brand-primary focus:outline-none"
            >
              <option value="">{rc('refund.reasonPlaceholder')}</option>
              {reasonOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* 凭证照片（≤3 张；缩略图可删） */}
            <p className="mt-4 text-caption text-ink-secondary">{rc('refund.voucherHint')}</p>
            <div className="mt-2 grid grid-cols-3 gap-2" data-testid="refund-photo-wall">
              {photos.map((p, i) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-tag bg-sunken">
                  <img src={p.thumbUrl} alt={`凭证照片 ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`删除照片 ${i + 1}`}
                    data-testid={`refund-photo-del-${i}`}
                    onClick={() => setPhotos((cur) => cur.filter((x) => x.url !== p.url))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/60 text-canvas"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  data-testid="refund-photo-add"
                  disabled={uploading > 0}
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-tag border border-dashed border-line-strong text-caption text-ink-secondary disabled:opacity-60"
                >
                  <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
                  {uploading > 0 ? '上传中…' : rc('refund.photoCta')}
                </button>
              ) : null}
            </div>
            {/* 拍照/相册：accept 图片族，移动端由系统给拍照/相册两源 */}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              data-testid="refund-photo-input"
              onChange={(e) => {
                void onPickPhotos(e.target.files);
                e.target.value = '';
              }}
            />

            {/* 说明（选填；reason=other 必填） */}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={MAX_DESC_LEN}
              rows={3}
              data-testid="refund-desc"
              placeholder={rc('refund.descPlaceholder')}
              className="mt-3 w-full rounded-input border border-line bg-card px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
            />
          </section>

          {/* 申请金额算式明面（R15：行金额逐项 mono + 合计=申请金额，可自验） */}
          <section className="rounded-card bg-card p-4 shadow-card" data-testid="refund-amount-card">
            <h2 className="text-title">{rc('refund.amountLabel')}</h2>
            <dl className="mt-2 space-y-1.5 text-body">
              {lines.map((l, i) => (
                <div key={`${l.label}-${i}`} className="flex justify-between gap-4">
                  <dt className="min-w-0 flex-1 truncate text-ink-secondary">{l.label}</dt>
                  <dd className="font-number">{fenToYuan(l.amountFen)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line-divider pt-2">
                <dt className="font-medium">{rc('refund.amountLabel')}</dt>
                <dd className="font-number font-semibold text-ink">{fenToYuan(totalFen)}</dd>
              </div>
            </dl>
          </section>

          {/* 时效公示卡（数值=configView 端口） */}
          <RefundTimingCard config={configQ.data ?? null} />

          {/* 提交（h≥56 主钮；未填/上传中禁用） */}
          <button
            type="button"
            data-testid="refund-submit"
            disabled={!submittable || createM.isPending}
            onClick={() => createM.mutate()}
            className="h-14 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {createM.isPending ? '提交中…' : rc('refund.submitCta')}
          </button>
        </div>
      )}
    </div>
  );
}
