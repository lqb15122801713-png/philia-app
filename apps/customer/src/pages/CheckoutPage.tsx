/**
 * 确认订单 /mall/checkout · U4 定稿面：默认到店自提、门店卡、商品汇总、
 * 商品金额／运费／回馈金抵扣／应付明细、回馈金开关与单一确认支付闸口。
 * 「配送到家」保留原有快递／同城与地址表单；回馈金抵扣仅为表面并在开启时拦住线上提交，
 * 不改 createOrder 金额或服务端结算契约。支付成功、券登记与既有收银台流程保留。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import PageHeader from '../components/PageHeader';
import { EmptyState } from '../components/home/common';
import { CartProvider, readRebatePreference, useCart, writeRebatePreference, type AddInput } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import { friendlyError, useToast } from '@philia/shared';
import ProductImage from '../components/mall/ProductImage';
import { mlc } from '../copy/mall';
import { cpc } from '../copy/coupons';

const ADDRESS_KEY = 'philia.address';
const PHONE_RE = /^1[3-9]\d{9}$/;

/* 客户端体验大批 片 3：配送方式三态（createOrder 入参 deliveryMethod） */
type DeliveryMethod = 'express' | 'same_city' | 'pickup';
type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];
type AvailableCoupon = Awaited<ReturnType<Trpc['mall']['availableCoupons']['query']>>['items'][number];
const DELIVERY_METHODS: Array<{ key: DeliveryMethod; label: string }> = [
  { key: 'express', label: mlc('mall.deliveryExpress') },
  { key: 'same_city', label: mlc('mall.deliverySameCity') },
  { key: 'pickup', label: mlc('mall.deliveryPickup') },
];

interface AddressForm {
  name: string;
  phone: string;
  detail: string;
}

function loadAddress(): AddressForm {
  try {
    const raw = window.localStorage.getItem(ADDRESS_KEY);
    if (!raw) return { name: '', phone: '', detail: '' };
    const o = JSON.parse(raw) as Partial<AddressForm>;
    return {
      name: typeof o.name === 'string' ? o.name : '',
      phone: typeof o.phone === 'string' ? o.phone : '',
      detail: typeof o.detail === 'string' ? o.detail : '',
    };
  } catch {
    return { name: '', phone: '', detail: '' };
  }
}

interface CheckoutLine {
  productId: string;
  storeId: string;
  name: string;
  priceFen: number;
  image: string | null;
  qty: number;
  storeName: string;
}

function CheckoutInner() {
  const { trpc } = usePhiliaClient();
  const queryClient = useQueryClient();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  const buyNow = (location.state as { buyNow?: AddInput } | null)?.buyNow;
  const fromCart = !buyNow;

  const lines: CheckoutLine[] = useMemo(() => {
    if (buyNow && typeof buyNow.productId === 'string') {
      return [
        {
          productId: buyNow.productId,
          storeId: buyNow.storeId,
          name: buyNow.name,
          priceFen: buyNow.priceFen,
          image: buyNow.image,
          qty: buyNow.qty ?? 1,
          storeName: buyNow.storeName,
        },
      ];
    }
    return cart.checkedItems.map((it) => ({
      productId: it.productId,
      storeId: it.storeId,
      name: it.name,
      priceFen: it.priceFen,
      image: it.image,
      qty: it.qty,
      storeName: it.storeName,
    }));
  }, [buyNow, cart.checkedItems]);

  const totalFen = lines.reduce((sum, l) => sum + l.priceFen * l.qty, 0);
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const rebateFen = rebateBp > 0 ? Math.round((totalFen * rebateBp) / 10000) : 0;
  const balanceFen = myQ.data?.rebate?.balanceFen ?? 0;

  const [form, setForm] = useState<AddressForm>(loadAddress);
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [cashierOrder, setCashierOrder] = useState<CashierOrder | null>(null);
  const [paidOrder, setPaidOrder] = useState<CashierOrder | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [pickedCoupon, setPickedCoupon] = useState<AvailableCoupon | null>(null);
  const [useRebate, setUseRebate] = useState(() => readRebatePreference());
  const addressRequired = deliveryMethod === 'express';
  const deductionFen = useRebate ? Math.min(balanceFen, totalFen) : 0;
  const payableFen = Math.max(0, totalFen - deductionFen);
  const storesQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query(),
    staleTime: 5 * 60_000,
  });
  const pickupStore = storesQ.data?.stores.find((s) => s.id === lines[0]?.storeId) ?? storesQ.data?.stores[0] ?? null;

  /* 片 3：可用券推荐（availableCoupons 按本单合计门槛过滤；核销=登记抵扣口径） */
  const couponsQ = useQuery({
    queryKey: ['mall', 'availableCoupons', totalFen],
    queryFn: () => trpc.mall.availableCoupons.query({ totalFen }),
    enabled: totalFen > 0,
    staleTime: 30_000,
    retry: false,
  });
  const availableCoupons = couponsQ.data?.items ?? [];
  /* 片 3：结算成功回把 grantId 登记 couponUse（登记口径，不碰订单金额） */
  const couponUseM = useMutation({
    mutationFn: (input: { grantId: string; orderId: string }) => trpc.mall.couponUse.mutate(input),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['mall', 'myCoupons'] }),
  });

  const createOrderM = useMutation({
    mutationFn: (input: {
      items: Array<{ productId: string; qty: number }>;
      address?: { name: string; phone: string; detail: string };
      deliveryMethod: DeliveryMethod;
    }) => trpc.mall.createOrder.mutate(input),
    onSuccess: (order) => {
      // 地址记忆（下单成功即记，与是否支付解耦）
      try {
        window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(form));
      } catch {
        /* 隐私模式忽略 */
      }
      // 购物车结算：移除已下单的勾选项（订单留 pending 时走订单列表继续支付）
      if (fromCart) cart.clearChecked();
      /* 片 3：选中券登记核销（couponUse 登记口径；失败不阻收银台，台账可后补） */
      if (pickedCoupon) {
        couponUseM.mutate(
          { grantId: pickedCoupon.id, orderId: order.id },
          { onError: (err) => showToast(friendlyError(err, '券登记失败，请到店出示券码核销', 80), 'error') },
        );
      }
      setCashierOrder({ id: order.id, orderNo: order.orderNo, totalFen: order.totalFen });
    },
    onError: (err) => {
      // CONFLICT「库存不足（剩余 N 件）」/ BAD_REQUEST「已下架 / 仅支持同一门店」等服务端原文
      showToast(friendlyError(err, '下单失败，请稍后再试', 80), 'error');
    },
  });

  const validate = (): boolean => {
    if (deliveryMethod === 'pickup') {
      setErrors({});
      return true;
    }
    const next: Partial<AddressForm> = {};
    if (!form.name.trim()) next.name = '请填写收货人姓名';
    if (!PHONE_RE.test(form.phone.trim())) next.phone = '请填写正确的 11 位手机号';
    if (addressRequired && !form.detail.trim()) next.detail = '请填写详细收货地址';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (lines.length === 0) return;
    if (deductionFen > 0) {
      showToast(mlc('mall.rebatePendingGate'), 'info');
      return;
    }
    if (!validate()) return;
    const addr = { name: form.name.trim(), phone: form.phone.trim(), detail: form.detail.trim() };
    const withAddress = addressRequired || !!addr.detail;
    createOrderM.mutate({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      ...(withAddress ? { address: addr } : {}),
      deliveryMethod,
    });
  };

  /* ---------------- 支付成功页 ---------------- */
  /* W1-D1 同构（补丁③规格）：单据摘要卡（订单号/实付/收货信息）+ 双出口
     （查看订单=深棕主 / 返回首页=细线白底次）+ PageHeader 返回键（固定落点 /home，
     交易成功页不回已消耗的结算表单；直访兜底同 W1-D3）。 */
  if (paidOrder) {
    return (
      <div className="px-4 py-6">
        {toastEl}
        <PageHeader title={mlc('mall.paySuccessTitle')} to="/home" />
        <div className="flex flex-col items-center pt-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
            <BadgeCheck className="h-7 w-7 text-success-deep" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-title-lg">{mlc('mall.paySuccessTitle')}</p>
          <p className="mt-1 text-body text-ink-secondary">{mlc('mall.paySuccessSub')}</p>
        </div>

        {/* 单据摘要卡（订单号 / 实付金额 / 收货信息快照）；金额 mono 深棕（成功不设绿不设金） */}
        <section className="mt-5 rounded-card bg-card p-4 shadow-card">
          <dl className="space-y-1.5 text-body">
            <div className="flex justify-between">
              <dt className="text-ink-secondary">订单号</dt>
              <dd className="font-number font-medium">{paidOrder.orderNo}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">实付金额</dt>
              <dd className="font-number font-semibold text-ink">{fenToYuan(paidOrder.totalFen)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-ink-secondary">收货信息</dt>
              <dd className="text-right">
                {form.name} <span className="font-number">{form.phone}</span>
                <span className="mt-0.5 block text-caption text-ink-secondary">{form.detail}</span>
              </dd>
            </div>
          </dl>
        </section>

        {/* 双出口：主=查看订单（深棕唯一主动作）；次=返回首页（细线白底） */}
        <div className="mt-5 space-y-2.5">
          <Link
            to="/mall/orders"
            className="flex h-12 w-full items-center justify-center rounded-full bg-brand-cta text-body font-semibold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {mlc('mall.viewOrders')}
          </Link>
          <Link
            to="/home"
            className="u1-ring flex h-12 w-full items-center justify-center rounded-full bg-card text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {mlc('mall.backHome')}
          </Link>
          <Link
            to="/mall"
            className="flex w-full items-center justify-center py-2 text-caption font-medium text-ink-secondary underline-offset-2 hover:underline"
          >
            {mlc('mall.keepShopping')}
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- 无商品来源 ---------------- */
  // B8-B3：收银台打开期间不清空态分支——购物车结算成功时 onSuccess 已 clearChecked
  // （lines 随之变空），若此处不看 cashierOrder，页面会切到空态分支、CashierModal
  // 随表单分支一起卸载，用户看到「提交后零反馈原地变空态」（走查红标）。
  if (lines.length === 0 && !cashierOrder) {
    /* U1-J 一致性修正：空态分支补统一返回条 + 统一空态组件 */
    return (
      <div className="px-4 pb-10 pt-6">
        <PageHeader title={mlc('mall.checkoutTitle')} />
        <div className="mt-6">
          <EmptyState
            title={mlc('mall.checkoutEmptyTitle')}
            desc={mlc('mall.checkoutEmptyBody')}
            action={
              <div className="flex gap-3">
                <Link
                  to="/mall"
                  className="inline-flex items-center rounded-control bg-ink px-[30px] py-[13px] text-body-sm font-semibold text-canvas transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  {mlc('mall.checkoutGoMall')}
                </Link>
                <Link
                  to="/mall/cart"
                  className="inline-flex items-center rounded-control bg-card px-[30px] py-[13px] text-body-sm font-semibold text-ink ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  {mlc('mall.checkoutGoCart')}
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  /* ---------------- 表单 + 清单 ---------------- */
  return (
    <div className="checkout-page px-4 pb-32 pt-6">
      {toastEl}
      {/* U1-A：统一返回条（←圆钮+标题） */}
      <PageHeader title={mlc('mall.checkoutTitle')} />

      <section className="u1-card mt-4 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-brand-secondary-light p-1">
          <button
            type="button"
            aria-pressed={deliveryMethod === 'pickup'}
            data-testid="checkout-delivery-pickup"
            onClick={() => setDeliveryMethod('pickup')}
            className={`rounded-full px-3 py-2 text-[12px] font-semibold transition ${deliveryMethod === 'pickup' ? 'bg-brand-cta text-brand-cta-on' : 'text-ink-secondary'}`}
          >
            {mlc('mall.deliveryPickupU4')}
          </button>
          <button
            type="button"
            aria-pressed={deliveryMethod !== 'pickup'}
            data-testid="checkout-delivery-home"
            onClick={() => setDeliveryMethod('express')}
            className={`rounded-full px-3 py-2 text-[12px] font-semibold transition ${deliveryMethod !== 'pickup' ? 'bg-brand-cta text-brand-cta-on' : 'text-ink-secondary'}`}
          >
            {mlc('mall.deliveryHomeU4')}
          </button>
        </div>
        {deliveryMethod === 'pickup' ? (
          <div className="mt-3 px-1 pb-1" data-testid="checkout-pickup-store">
            <p className="text-body-sm font-bold">{pickupStore?.name ?? lines[0]?.storeName}</p>
            <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>{pickupStore?.address ?? mlc('mall.pickupReady')}</p>
            <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>{pickupStore?.phone ?? mlc('mall.pickupContactFallback')}</p>
          </div>
        ) : (
          <div className="checkout-address-fields mt-3 flex flex-col gap-3">
            <div className="checkout-delivery" data-testid="delivery-method">
              <div className="flex gap-2">
                {DELIVERY_METHODS.filter((d) => d.key !== 'pickup').map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDeliveryMethod(d.key)}
                    data-testid={`delivery-${d.key}`}
                    className={`flex-1 rounded-full px-3 py-2 text-[12px] transition ${deliveryMethod === d.key ? 'bg-ink font-semibold text-canvas' : 'bg-card font-medium text-ink-secondary ring-1 ring-line-ring'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-number text-[12px] text-ink-placeholder" data-u4-secondary>
                {mlc('mall.deliveryFreeNote')}{!addressRequired ? ` · ${mlc('mall.addrOptionalNote')}` : ''}
              </p>
            </div>
            <div>
              <label className="mb-1 block font-number text-[12px] text-ink-secondary" htmlFor="ck-name">收货人</label>
              <input id="ck-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="收货人姓名" maxLength={64} className="checkout-input h-11 w-full rounded-input border border-line bg-canvas px-3.5 text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink" />
              {errors.name ? <p className="mt-1 text-[12px] text-danger-deep">{errors.name}</p> : null}
            </div>
            <div>
              <label className="mb-1 block font-number text-[12px] text-ink-secondary" htmlFor="ck-phone">手机号</label>
              <input id="ck-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="手机号" inputMode="numeric" maxLength={11} className="checkout-input h-11 w-full rounded-input border border-line bg-canvas px-3.5 font-number text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink" />
              {errors.phone ? <p className="mt-1 text-[12px] text-danger-deep">{errors.phone}</p> : null}
            </div>
            <div>
              <label className="mb-1 block font-number text-[12px] text-ink-secondary" htmlFor="ck-detail">详细地址{!addressRequired ? '（选填）' : ''}</label>
              <textarea id="ck-detail" value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="小区 / 楼栋 / 门牌号" maxLength={255} rows={2} className="w-full resize-none rounded-input border border-line bg-canvas px-3.5 py-2.5 text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink" />
              {errors.detail ? <p className="mt-1 text-[12px] text-danger-deep">{errors.detail}</p> : null}
            </div>
          </div>
        )}
      </section>

      <section className="u1-card mt-3 p-3" data-testid="checkout-items-summary">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 -space-x-2">
            {lines.slice(0, 2).map((l) => <ProductImage key={l.productId} src={l.image} alt={l.name} className="h-12 w-12 rounded-control ring-2 ring-card" />)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-bold">{mlc('mall.checkoutItems', { count: lines.reduce((n, l) => n + l.qty, 0) })}</p>
            <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-secondary" data-u4-secondary>{lines.map((l) => l.name).join(' · ')}</p>
          </div>
        </div>
      </section>

      <section className="u1-card mt-3 px-4 py-2" data-testid="checkout-fees">
        <div className="flex items-center justify-between py-2 text-[12px] text-ink-secondary" data-u4-secondary>
          <span>{mlc('mall.feeSubtotal')}</span>
          <span className="font-number tabular-nums">{fenToYuan(totalFen)}</span>
        </div>
        <div className="flex items-center justify-between py-2 text-[12px] text-ink-secondary" data-u4-secondary>
          <span>{mlc('mall.feeShipping')}</span>
          <span className="font-number tabular-nums">{fenToYuan(0)}</span>
        </div>
        <div className="flex items-center justify-between py-2 text-[12px] text-ink-secondary" data-u4-secondary>
          <span>{mlc('mall.feeRebate')}</span>
          <span data-testid="checkout-deduction" className="font-number tabular-nums">-{fenToYuan(deductionFen)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-line-divider py-3">
          <span className="text-body-sm font-extrabold">{mlc('mall.feePayable')}</span>
          <span data-testid="checkout-payable" className="font-number text-[19px] font-bold tabular-nums text-ink">{fenToYuan(payableFen)}</span>
        </div>
      </section>

      <section className="u1-card mt-3 p-4" data-testid="checkout-rebate-card">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-body-sm font-bold">{mlc('mall.rebateUse')}</p>
            <p className="mt-1 text-[12px] text-ink-secondary" data-u4-secondary>
              {mlc('mall.rebateBalanceLimit', { balance: fenToYuan(balanceFen), amt: fenToYuan(deductionFen) })}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={useRebate} aria-label={mlc('mall.rebateUse')} data-testid="checkout-rebate-switch" onClick={() => {
              const next = !useRebate;
              writeRebatePreference(next);
              setUseRebate(next);
            }} className={`relative h-8 w-14 shrink-0 rounded-full transition ${useRebate ? 'bg-brand-cta' : 'bg-brand-secondary-light'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-card transition ${useRebate ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </section>

      {/* 片 3：可用券推荐区（availableCoupons 按门槛过滤；选中=登记抵扣口径注记，
          核销=couponUse 登记、线下结算出示——不接真抵扣结算） */}
      {!couponsQ.isPending && availableCoupons.length > 0 ? (
        <section className="u1-card mt-3 p-4" data-testid="checkout-coupons">
          <p className="flex items-center gap-1.5 text-title">
            <Ticket className="h-4 w-4 text-ink" strokeWidth={1.5} />
            {mlc('mall.couponTitle')}
          </p>
          <div className="mt-3 space-y-2">
            {availableCoupons.map((c) => {
              const picked = pickedCoupon?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPickedCoupon(picked ? null : c)}
                  data-testid={`checkout-coupon-${c.id}`}
                  className={`flex w-full items-center gap-3 rounded-control px-3.5 py-2.5 text-left transition ${
                    picked ? 'bg-brand-secondary-light ring-1 ring-ink' : 'bg-canvas ring-1 ring-line-ring'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-semibold text-ink">
                      {c.coupon.title} <span className="u1-num">{mlc('mall.couponOff', { amt: fenToYuan(c.coupon.amountFen) })}</span>
                    </span>
                    <span className="mt-0.5 block font-number text-[9.5px] text-ink-placeholder">
                      {c.coupon.thresholdFen > 0
                        ? cpc('cpn.threshold', { amt: fenToYuan(c.coupon.thresholdFen) })
                        : cpc('cpn.thresholdNone')}
                    </span>
                  </span>
                  <span className={`shrink-0 text-caption font-semibold ${picked ? 'text-ink' : 'text-ink-secondary'}`}>
                    {picked ? mlc('mall.couponPicked') : mlc('mall.couponPick')}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 font-number text-[9.5px] text-ink-placeholder" data-testid="checkout-coupon-note">
            {mlc('mall.couponUseNote')}
          </p>
        </section>
      ) : null}

      <div
        className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
        style={{ background: 'linear-gradient(transparent, #FAF7F0 40%)' }}
      >
        <div className="mx-auto max-w-lg px-4 pb-4 pt-3">
          <button
            type="button"
            disabled={createOrderM.isPending}
            onClick={handleSubmit}
            data-testid="checkout-submit"
            className="w-full rounded-full bg-brand-cta py-3.5 text-body-lg font-bold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {createOrderM.isPending ? '提交中…' : mlc('mall.confirmPay', { amt: fenToYuan(payableFen) })}
          </button>
          {rebateFen > 0 && !createOrderM.isPending ? (
            <p className="mt-1.5 text-center text-[12px] text-ink-secondary" data-u4-secondary>
              {mlc('mall.cartEarnAfter', { amt: fenToYuan(rebateFen) })}
            </p>
          ) : null}
        </div>
      </div>

      {/* mock 收银台 */}
      {cashierOrder ? (
        <CashierModal
          order={cashierOrder}
          showToast={showToast}
          onPaid={() => {
            setPaidOrder(cashierOrder);
            setCashierOrder(null);
          }}
          onGiveUp={() => {
            setCashierOrder(null);
            showToast('订单已保留在「待支付」', 'info');
            navigate('/mall/orders', { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <CartProvider>
      <CheckoutInner />
    </CartProvider>
  );
}
