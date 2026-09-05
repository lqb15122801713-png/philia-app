/**
 * 确认订单 /mall/checkout（T5.3）
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
import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, ChevronLeft, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import CashierModal, { type CashierOrder } from '../components/mall/CashierModal';
import { CartProvider, useCart, type AddInput } from '../components/mall/cartStore';
import { fenToYuan } from '../components/mall/format';
import { friendlyError, useMallToast } from '../components/mall/MallToast';
import ProductImage from '../components/mall/ProductImage';

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
  const { toastEl, showToast } = useMallToast();

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
      showToast(friendlyError(err, '下单失败，请稍后再试'));
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
  if (paidOrder) {
    return (
      <div className="flex flex-col items-center px-4 py-16">
        {toastEl}
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-success-light">
          <BadgeCheck className="h-10 w-10 text-success-deep" strokeWidth={1.5} />
        </span>
        <p className="mt-5 text-title-lg">支付成功</p>
        <p className="mt-2 text-body text-ink-secondary">
          订单号 <span className="font-number text-ink">{paidOrder.orderNo}</span>
        </p>
        <p className="mt-1 font-number text-body text-ink-secondary">{fenToYuan(paidOrder.totalFen)}</p>
        <p className="mt-3 text-caption text-ink-placeholder">门店会尽快为你发货，进度可在订单列表查看</p>
        <div className="mt-8 flex gap-3">
          <Link
            to="/mall/orders"
            className="flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            查看订单
          </Link>
          <Link
            to="/mall"
            className="flex h-11 items-center rounded-full bg-sunken px-8 text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            返回商城
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- 无商品来源 ---------------- */
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-16">
        <img src="/brand/empty-appointments-800.png" alt="没有待结算商品" className="w-48 max-w-full rounded-card" />
        <p className="mt-4 text-title">没有待结算的商品</p>
        <p className="mt-1 text-body text-ink-secondary">去商城挑点好物，或回购物车勾选商品</p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/mall"
            className="flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            去逛逛
          </Link>
          <Link
            to="/mall/cart"
            className="flex h-11 items-center rounded-full bg-sunken px-8 text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            回购物车
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- 表单 + 清单 ---------------- */
  return (
    <div className="px-4 pb-32 pt-6">
      {toastEl}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="返回"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={1.5} />
        </button>
        <h1 className="text-title-lg">确认订单</h1>
      </div>

      {/* 收货地址 */}
      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <p className="flex items-center gap-1.5 text-title">
          <MapPin className="h-4 w-4 text-brand-primary" strokeWidth={1.5} />
          收货地址
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="收货人姓名"
              maxLength={64}
              className="h-11 w-full rounded-input bg-sunken px-3.5 text-body outline-none placeholder:text-ink-placeholder focus:ring-1 focus:ring-brand-primary"
            />
            {errors.name ? <p className="mt-1 text-caption text-danger-deep">{errors.name}</p> : null}
          </div>
          <div>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              placeholder="手机号"
              inputMode="numeric"
              maxLength={11}
              className="h-11 w-full rounded-input bg-sunken px-3.5 font-number text-body outline-none placeholder:text-ink-placeholder focus:ring-1 focus:ring-brand-primary"
            />
            {errors.phone ? <p className="mt-1 text-caption text-danger-deep">{errors.phone}</p> : null}
          </div>
          <div>
            <textarea
              value={form.detail}
              onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              placeholder="详细地址：小区 / 楼栋 / 门牌号"
              maxLength={255}
              rows={2}
              className="w-full resize-none rounded-input bg-sunken px-3.5 py-2.5 text-body outline-none placeholder:text-ink-placeholder focus:ring-1 focus:ring-brand-primary"
            />
            {errors.detail ? <p className="mt-1 text-caption text-danger-deep">{errors.detail}</p> : null}
          </div>
        </div>
      </section>

      {/* 商品清单 */}
      <section className="mt-3 rounded-card bg-card p-4 shadow-card">
        <p className="text-title">商品清单</p>
        <p className="mt-0.5 text-caption text-ink-secondary">{lines[0]?.storeName} · 门店发货</p>
        <div className="mt-3 space-y-3">
          {lines.map((l) => (
            <div key={l.productId} className="flex items-center gap-3">
              <ProductImage src={l.image} alt={l.name} className="h-14 w-14 shrink-0 rounded-tag" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-body">{l.name}</p>
                <p className="mt-0.5 font-number text-caption text-ink-secondary">
                  {fenToYuan(l.priceFen)} × {l.qty}
                </p>
              </div>
              <p className="font-number text-body font-semibold">{fenToYuan(l.priceFen * l.qty)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line-divider pt-3">
          <span className="text-body text-ink-secondary">合计（{lines.reduce((n, l) => n + l.qty, 0)} 件）</span>
          <span className="font-number text-price text-brand-primary">{fenToYuan(totalFen)}</span>
        </div>
        <p className="mt-1 text-right text-caption text-ink-placeholder">金额以提交时门店现价为准</p>
      </section>

      {/* 底部提交栏（TabBar 之上） */}
      <div className="fixed inset-x-0 bottom-14 z-sticky border-t border-line-divider bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <p className="text-caption text-ink-secondary">合计</p>
            <p className="font-number text-title text-brand-primary">{fenToYuan(totalFen)}</p>
          </div>
          <button
            type="button"
            disabled={createOrderM.isPending}
            onClick={handleSubmit}
            className="h-11 rounded-full bg-philia-gradient px-8 text-body font-medium text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
          >
            {createOrderM.isPending ? '提交中…' : '提交订单'}
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
