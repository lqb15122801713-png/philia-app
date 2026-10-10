/**
 * mock 收银台弹层（T5.3 · 开发方案 §4.7 mock 支付演示；产品-1010 片 2 改走统一支付轨）
 *
 * 片 2 改线（商城订单线上支付=pay_orders 统一轨）：
 * 1. 弹层打开即 trpc.pay.createOrder({ bizDomain:'mall', orderId }) → { order: 支付单, paymentId, payParams }
 *    （金额=订单实算 server 重算不信入参；同人同单在途=幂等返回现状；通道=切换闸解析）；
 * 2. 四态演示（照 PayStatePage 工艺）：成功/失败/超时/掉单 → POST {apiBase}/api/pay/orders/mock-callback
 *    { orderId: 支付单 id, scenario }（带 cookie）——服务端按平台口径走验签/业务路径，本层不绕过任何校验；
 * 3. 动作后回读 trpc.pay.status({ payNo }) 取真相（成功 → onPaid 由调用方接管：清购物车/跳成功页/刷新订单列表）；
 *    掉单提示走「付了没开」自助补开（/pay/reconcile 既有件）；失败/超时单留痕（failed/超时关单）。
 *
 * 「放弃支付」不触碰订单——商城订单保持 pending，支付单留在途待超时关单（端口时长），
 * 可在订单列表「继续支付」重开本弹层（幂等返回在途单）。
 */

import { friendlyError, getApiBase, usePhiliaClient } from '@philia/shared';
import { BadgeCheck, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fenToYuan } from './format';

/* ------------------------------------------------------------------ */
/* 换皮批片 2 弹层三件套核查（§4.5）：本层补抓握手柄 grab 42×4 + 滚动锁 + 可点遮罩   */
/* （点遮罩=放弃支付，与既有「放弃支付」钮同动作，不新增交互步数）；顶角 26。          */
/* ------------------------------------------------------------------ */

export interface CashierOrder {
  id: string;
  orderNo: string;
  totalFen: number;
}

type Phase = 'preparing' | 'ready' | 'failed' | 'error';
/** mock 演示四态（通道场景）：success 成交 / fail 通道失败 / timeout 用户不付 / drop 掉单（通道已付回调丢失） */
type MockScenario = 'success' | 'fail' | 'timeout' | 'drop';

export default function CashierModal({
  order,
  onPaid,
  onGiveUp,
  showToast,
}: {
  order: CashierOrder;
  /** 支付成功（支付单 paid） */
  onPaid: () => void;
  /** 放弃支付（订单留 pending） */
  onGiveUp: () => void;
  showToast: (text: string, kind?: 'error' | 'info') => void;
}) {
  const { trpc } = usePhiliaClient();
  const [phase, setPhase] = useState<Phase>('preparing');
  const [payNo, setPayNo] = useState<string | null>(null);
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(true);
  const [mockBusy, setMockBusy] = useState<MockScenario | null>(null);
  // StrictMode 双跑防护：createOrder 只发一次
  const preparedRef = useRef(false);

  /* 滚动锁：弹层挂载期间锁底层 body（§4.5 三件套；本组件由调用方条件挂载） */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (preparedRef.current) return;
    preparedRef.current = true;
    trpc.pay.createOrder
      .mutate({ bizDomain: 'mall', orderId: order.id })
      .then((r) => {
        setPayNo(r.order.payNo);
        setPayOrderId(r.order.id);
        setIsMock(r.payParams?.mock === '1');
        setPhase('ready');
      })
      .catch((err) => {
        showToast(friendlyError(err, '发起支付失败', 80), 'error');
        setPhase('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  /* 动作后回读支付单真相（server 状态机为准） */
  const refreshStatus = async (): Promise<string | null> => {
    if (!payNo) return null;
    try {
      const r = await trpc.pay.status.query({ payNo });
      return r.order.status;
    } catch {
      return null;
    }
  };

  const handleMock = async (scenario: MockScenario) => {
    if (phase !== 'ready' || !payOrderId || mockBusy) return;
    setMockBusy(scenario);
    try {
      const res = await fetch(`${getApiBase()}/api/pay/orders/mock-callback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: payOrderId, scenario }),
      });
      const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      if (!res.ok || body?.code !== 'SUCCESS') {
        showToast(body?.message ?? `支付失败（HTTP ${res.status}）`, 'error');
        return;
      }
      const status = await refreshStatus();
      if (scenario === 'success') {
        if (status === 'paid') {
          onPaid();
          return;
        }
        showToast('支付结果确认中，请稍候', 'info');
        return;
      }
      if (scenario === 'fail') {
        setPhase('failed');
        return;
      }
      if (scenario === 'drop') {
        /* 掉单=通道已扣款回调丢失：提示自助补开（/pay/reconcile 既有件），弹层留在 ready 可重查 */
        showToast('已模拟掉单：通道已扣款但回调丢失——可到「付了没开」自助补开', 'info');
        await refreshStatus();
        return;
      }
      /* timeout=用户不付：留在途待超时关单（端口时长） */
      showToast('已模拟超时未付：订单保留在「待支付」，超时将自动关单', 'info');
    } catch {
      showToast('网络异常，支付未完成', 'error');
    } finally {
      setMockBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-label="收银台">
      {/* 可点遮罩（§4.5 三件套）：点遮罩=放弃支付，与下方「放弃支付」钮同动作 */}
      <button type="button" aria-label="放弃支付" className="absolute inset-0 bg-ink/45" onClick={onGiveUp} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[26px] bg-card px-5 pb-8 pt-3 shadow-elevated">
        {/* 抓握手柄 grab 42×4（§4.5） */}
        <div className="mx-auto mb-3 h-1 w-[42px] rounded-full bg-line" aria-hidden="true" />
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
          ) : phase === 'failed' ? (
            <div className="space-y-3">
              <p className="text-center text-body text-danger-deep" data-testid="cashier-failed-note">
                通道支付失败（已留痕），可重新发起支付
              </p>
              <button
                type="button"
                onClick={() => setPhase('ready')}
                className="h-12 w-full rounded-full bg-philia-gradient text-body font-medium text-[#F6EFDD] shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                重新支付
              </button>
              <button
                type="button"
                onClick={onGiveUp}
                className="h-12 w-full rounded-full bg-sunken text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                放弃支付
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                disabled={mockBusy !== null || !isMock}
                onClick={() => void handleMock('success')}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-philia-gradient text-body font-medium text-[#F6EFDD] shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-60"
                data-testid="cashier-mock-success"
              >
                {mockBusy === 'success' ? (
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
              {isMock ? (
                <div className="flex justify-center gap-5 text-caption">
                  <button
                    type="button"
                    className="text-ink-secondary underline underline-offset-2 disabled:opacity-50"
                    data-testid="cashier-mock-fail"
                    disabled={mockBusy !== null}
                    onClick={() => void handleMock('fail')}
                  >
                    模拟失败
                  </button>
                  <button
                    type="button"
                    className="text-ink-secondary underline underline-offset-2 disabled:opacity-50"
                    data-testid="cashier-mock-timeout"
                    disabled={mockBusy !== null}
                    onClick={() => void handleMock('timeout')}
                  >
                    模拟超时
                  </button>
                  <button
                    type="button"
                    className="text-ink-secondary underline underline-offset-2 disabled:opacity-50"
                    data-testid="cashier-mock-drop"
                    disabled={mockBusy !== null}
                    onClick={() => void handleMock('drop')}
                  >
                    模拟掉单
                  </button>
                </div>
              ) : (
                <p className="text-center text-caption text-ink-secondary">
                  当前非 mock 支付环境，演示支付不可用
                </p>
              )}
              <button
                type="button"
                disabled={mockBusy !== null}
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
