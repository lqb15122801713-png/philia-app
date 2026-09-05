/**
 * mock 收银台弹层（T5.3 · 开发方案 §4.7 mock 支付演示）
 *
 * 三步演示流（与 T5.1 服务端约定严格一致）：
 * 1. 弹层打开即 trpc.mall.createPayment({ orderId }) → { paymentId, payParams }
 *    （payParams.mock === '1' 即演示模式，仅 mock provider 下可用）；
 * 2. 用户点「模拟支付成功」→ fetch POST {apiBase}/api/pay/mock-callback
 *    （带 cookie，JSON { orderId, paymentId }）→ { code: 'SUCCESS' } → 订单置 paid；
 * 3. onPaid 由调用方接管（清购物车 / 跳成功页 / 刷新订单列表）。
 *
 * 「放弃支付」不触碰订单——订单保持 pending，可在订单列表「继续支付」重开本弹层。
 * 真实回调链路（验签/金额核对/幂等）由服务端 payCallback.ts 完成，本层不绕过任何校验。
 */

import { getApiBase, usePhiliaClient } from '@philia/shared';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fenToYuan } from './format';
import { friendlyError } from './MallToast';

export interface CashierOrder {
  id: string;
  orderNo: string;
  totalFen: number;
}

type Phase = 'preparing' | 'ready' | 'paying' | 'error';

export default function CashierModal({
  order,
  onPaid,
  onGiveUp,
  showToast,
}: {
  order: CashierOrder;
  /** 支付成功（code === 'SUCCESS'） */
  onPaid: () => void;
  /** 放弃支付（订单留 pending） */
  onGiveUp: () => void;
  showToast: (text: string, kind?: 'error' | 'info') => void;
}) {
  const { trpc } = usePhiliaClient();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(true);
  // StrictMode 双跑防护：createPayment 只发一次
  const preparedRef = useRef(false);

  useEffect(() => {
    if (preparedRef.current) return;
    preparedRef.current = true;
    trpc.mall.createPayment
      .mutate({ orderId: order.id })
      .then((r) => {
        setPaymentId(r.paymentId);
        setIsMock(r.payParams?.mock === '1');
        setPhase('ready');
      })
      .catch((err) => {
        showToast(friendlyError(err, '发起支付失败'));
        setPhase('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const handleMockPay = async () => {
    if (phase !== 'ready' || !paymentId) return;
    setPhase('paying');
    try {
      const res = await fetch(`${getApiBase()}/api/pay/mock-callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, paymentId }),
      });
      const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      if (res.ok && body?.code === 'SUCCESS') {
        onPaid();
        return;
      }
      showToast(body?.message ?? `支付失败（HTTP ${res.status}）`);
      setPhase('ready');
    } catch {
      showToast('网络异常，支付未完成');
      setPhase('ready');
    }
  };

  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-label="收银台">
      <div className="absolute inset-0 bg-ink/45" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-sheet bg-card px-5 pb-8 pt-6 shadow-elevated">
        {/* 演示模式标识 */}
        <div className="flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-brand-secondary-light px-3 py-1 text-caption text-ink">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-primary" strokeWidth={1.5} />
            演示收银台 · 不会产生真实扣款
          </span>
        </div>

        <p className="mt-4 text-center text-body text-ink-secondary">订单 {order.orderNo}</p>
        <p className="mt-1 text-center font-number text-4xl font-semibold text-ink">
          {fenToYuan(order.totalFen)}
        </p>

        <div className="mt-6">
          {phase === 'preparing' ? (
            <p className="flex h-12 items-center justify-center gap-2 text-body text-ink-secondary">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              收银台准备中…
            </p>
          ) : phase === 'error' ? (
            <div className="space-y-3">
              <p className="text-center text-body text-danger-deep">支付单创建失败，可稍后在订单列表重试</p>
              <button
                type="button"
                onClick={onGiveUp}
                className="h-12 w-full rounded-full bg-sunken text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                返回
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                disabled={phase === 'paying' || !isMock}
                onClick={() => void handleMockPay()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-philia-gradient text-body font-medium text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
              >
                {phase === 'paying' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    支付中…
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-5 w-5" strokeWidth={1.5} />
                    模拟支付成功
                  </>
                )}
              </button>
              {!isMock ? (
                <p className="text-center text-caption text-ink-secondary">
                  当前非 mock 支付环境，演示支付不可用
                </p>
              ) : null}
              <button
                type="button"
                disabled={phase === 'paying'}
                onClick={onGiveUp}
                className="h-12 w-full rounded-full bg-sunken text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
              >
                放弃支付
              </button>
              <p className="text-center text-caption text-ink-placeholder">
                放弃后订单将保留在「待支付」，可随时继续支付
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
