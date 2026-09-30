/**
 * 确认订单 /mall/checkout（T5.3；换皮批片 2 落 M-03/§4.7 定稿：表单件 f-field
 * mono 9.5 签 + 纸白底细线输入框；清单=费用明细 folio 白卡 18（行 12.5 值 mono，
 * 合计行 14/800 + 值 mono 16 深棕）；吸底 ctabar 渐出底 + 合计 mono 19/700 +
 * 深棕主钮 16/700 + 回馈金返显 sub（APP-18））
 *
 * 商品来源（二选一）：
 * - 立即购买：location.state.buyNow（详情页带入的单品 AddInput）；
 * - 购物车结算：cart.checkedItems（localStorage 还原，跨页一致）。
 *
 * 流程：地址表单（姓名/手机号正则/详细地址，localStorage 'philia.address' 记忆）
 * → 清单确认 + 合计 →「提交订单」trpc.mall.createOrder
 *   （CONFLICT 库存不足 / BAD_REQUEST 下架·跨店 → 服务端 message toast）
 * → 自动打开 CashierModal（内部 createPayment → mock-callback 三步演示流）
 * → 成功：清空已结算勾选项 + 支付成功页（订单号 + 查看订单）；
 * → 放弃：订单留 pending，跳 /mall/orders「待支付」可继续支付。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import PageHeader from '../components/PageHeader';
import { EmptyState } from '../components/home/common';
import { CartProvider, useCart, type AddInput } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import { friendlyError, useToast } from '@philia/shared';
import ProductImage from '../components/mall/ProductImage';
import { mlc } from '../copy/mall';
import { mc } from '../components/member/copy';

const ADDRESS_KEY = 'philia.address';
const PHONE_RE = /^1[3-9]\d{9}$/;

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
  name: string;
  priceFen: number;
  image: string | null;
  qty: number;
  storeName: string;
}

function CheckoutInner() {
  const { trpc } = usePhiliaClient();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });

  // 立即购买单品（详情页 navigate state 带入）
  const buyNow = (location.state as { buyNow?: AddInput } | null)?.buyNow;
  const fromCart = !buyNow;

  const lines: CheckoutLine[] = useMemo(() => {
    if (buyNow && typeof buyNow.productId === 'string') {
      return [
        {
          productId: buyNow.productId,
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
      name: it.name,
      priceFen: it.priceFen,
      image: it.image,
      qty: it.qty,
      storeName: it.storeName,
    }));
  }, [buyNow, cart.checkedItems]);

  const totalFen = lines.reduce((sum, l) => sum + l.priceFen * l.qty, 0);

  /* 回馈金返显（CTA sub「本单返 ¥x 回馈金」；口径 APP-18：membership.my 的
     plan.rebateBp 万分比，返 Fen=round(totalFen*rebateBp/10000)；非会员/免费档=0
     不渲染假数——MallPage 同款） */
  const myQ = useQuery({
    queryKey: ['membership', 'my'],
    queryFn: () => trpc.membership.my.query(),
    staleTime: 60_000,
    retry: false,
  });
  const rebateBp = (myQ.data?.plan as { rebateBp?: number } | null | undefined)?.rebateBp ?? 0;
  const rebateFen = rebateBp > 0 ? Math.round((totalFen * rebateBp) / 10000) : 0;

  const [form, setForm] = useState<AddressForm>(loadAddress);
  const [errors, setErrors] = useState<Partial<AddressForm>>({});
  const [cashierOrder, setCashierOrder] = useState<CashierOrder | null>(null);
  const [paidOrder, setPaidOrder] = useState<CashierOrder | null>(null);

  const createOrderM = useMutation({
    mutationFn: (input: {
      items: Array<{ productId: string; qty: number }>;
      address: { name: string; phone: string; detail: string };
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
      setCashierOrder({ id: order.id, orderNo: order.orderNo, totalFen: order.totalFen });
    },
    onError: (err) => {
      // CONFLICT「库存不足（剩余 N 件）」/ BAD_REQUEST「已下架 / 仅支持同一门店」等服务端原文
      showToast(friendlyError(err, '下单失败，请稍后再试', 80), 'error');
    },
  });

  const validate = (): boolean => {
    const next: Partial<AddressForm> = {};
    if (!form.name.trim()) next.name = '请填写收货人姓名';
    if (!PHONE_RE.test(form.phone.trim())) next.phone = '请填写正确的 11 位手机号';
    if (!form.detail.trim()) next.detail = '请填写详细收货地址';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (lines.length === 0) return;
    if (!validate()) return;
    createOrderM.mutate({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      address: { name: form.name.trim(), phone: form.phone.trim(), detail: form.detail.trim() },
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
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#2E2318] text-body font-semibold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92"
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
    <div className="px-4 pb-32 pt-6">
      {toastEl}
      {/* U1-A：统一返回条（←圆钮+标题） */}
      <PageHeader title={mlc('mall.checkoutTitle')} />

      {/* 收货地址（§4.7 f-field 工艺：mono 9.5 签 + 纸白底细线输入框，:focus 深棕边；
          单地址能力保留，多地址簿无 UI 雏形不画假簿——PD-15 V1.1 槽位 3 不适用） */}
      <section className="u1-card mt-4 p-4">
        <p className="flex items-center gap-1.5 text-title">
          <MapPin className="h-4 w-4 text-ink" strokeWidth={1.5} />
          收货地址
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block font-number text-v2-trace text-ink-secondary" htmlFor="ck-name">
              收货人
            </label>
            <input
              id="ck-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="收货人姓名"
              maxLength={64}
              className="h-11 w-full rounded-input border border-line bg-canvas px-3.5 text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink"
            />
            {errors.name ? <p className="mt-1 text-caption text-danger-deep">{errors.name}</p> : null}
          </div>
          <div>
            <label className="mb-1 block font-number text-v2-trace text-ink-secondary" htmlFor="ck-phone">
              手机号
            </label>
            <input
              id="ck-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              placeholder="手机号"
              inputMode="numeric"
              maxLength={11}
              className="h-11 w-full rounded-input border border-line bg-canvas px-3.5 font-number text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink"
            />
            {errors.phone ? <p className="mt-1 text-caption text-danger-deep">{errors.phone}</p> : null}
          </div>
          <div>
            <label className="mb-1 block font-number text-v2-trace text-ink-secondary" htmlFor="ck-detail">
              详细地址
            </label>
            <textarea
              id="ck-detail"
              value={form.detail}
              onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="小区 / 楼栋 / 门牌号"
              maxLength={255}
              rows={2}
              className="w-full resize-none rounded-input border border-line bg-canvas px-3.5 py-2.5 text-body outline-none transition placeholder:text-ink-placeholder focus:border-ink"
            />
            {errors.detail ? <p className="mt-1 text-caption text-danger-deep">{errors.detail}</p> : null}
          </div>
        </div>
      </section>

      {/* 商品清单（§4.7 folio 费用明细：白卡 18；行 12.5 值 mono；合计行 14/800 + 值 mono 16 深棕） */}
      <section className="u1-ring mt-3 rounded-[18px] bg-card px-4 py-1.5">
        <div className="flex items-baseline justify-between py-2.5">
          <p className="text-title">商品清单</p>
          <p className="font-number text-v2-trace text-ink-secondary">{mlc('mall.listShip', { store: lines[0]?.storeName ?? '' })}</p>
        </div>
        <div className="divide-y divide-line-divider">
          {lines.map((l) => (
            <div key={l.productId} className="flex items-center gap-3 py-2.5">
              <ProductImage src={l.image} alt={l.name} className="h-14 w-14 shrink-0 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[12.5px] font-semibold">{l.name}</p>
                <p className="mt-0.5 font-number text-[12.5px] tabular-nums text-ink-secondary">
                  {fenToYuan(l.priceFen)} × {l.qty}
                </p>
              </div>
              <p className="font-number text-[12.5px] font-bold tabular-nums">{fenToYuan(l.priceFen * l.qty)}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line-divider py-3">
          <span className="text-body-sm font-extrabold">合计（{lines.reduce((n, l) => n + l.qty, 0)} 件）</span>
          <span className="font-number text-body-lg font-bold tabular-nums text-[#2E2318]">{fenToYuan(totalFen)}</span>
        </div>
        <p className="pb-2.5 text-right text-caption text-ink-placeholder">{mlc('mall.priceNote')}</p>
      </section>

      {/* 吸底提交栏（片 2 M-03 定稿 ctabar：渐出底 + 合计 mono 19/700 + 深棕主钮 16/700；
          详情级无 dock（App.tsx 白名单），落底 safe-area——修 bottom-14 悬空） */}
      <div
        className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
        style={{ background: 'linear-gradient(transparent, #FAF8F2 40%)' }}
      >
        <div className="mx-auto max-w-lg px-4 pb-4 pt-3">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-caption-xs text-ink-secondary">合计</span>
            <span className="u1-num text-[19px] font-bold text-ink">{fenToYuan(totalFen)}</span>
          </div>
          <button
            type="button"
            disabled={createOrderM.isPending}
            onClick={handleSubmit}
            className="flex w-full flex-col items-center justify-center rounded-[18px] bg-[#2E2318] py-3 text-body-lg font-bold text-[#F6EFDD] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            <span>{createOrderM.isPending ? '提交中…' : mlc('mall.submitOrder')}</span>
            {rebateFen > 0 && !createOrderM.isPending ? (
              <span className="mt-0.5 font-number text-[10.5px] font-normal text-[#C9BBA0]">
                {mc('mall.rebateEarnCta', { amt: fenToYuan(rebateFen) })}
              </span>
            ) : null}
          </button>
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
