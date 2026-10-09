/**
 * 支付适配层 · 契约类型件（闸门两件批：payments 域循环依赖开环）
 *
 * 来历：mockPay/wechatPay 以 `import type { PaymentProvider } from './provider'` 引契约，
 * 而 provider.ts 又引两实现（工厂注入）——形成「类型级循环依赖」（dependency-cruiser
 * no-circular 闸抓在案）。契约抽本件后：实现件/provider 工厂同引 types.ts，环开。
 * 运行时零变化（纯 type 搬迁，接口逐字不动）。
 */

/* ------------------------------------------------------------------ */
/* §4.7 契约接口（逐字，自 provider.ts 迁入）                              */
/* ------------------------------------------------------------------ */

export interface PaymentProvider {
  /** 创建支付单，返回前端调起支付所需参数 */
  createPayment(order: {
    orderId: string;
    totalFen: number;
    subject: string;
  }): Promise<{ paymentId: string; payParams: Record<string, string> }>;
  /** 验签 + 解析回调（验签失败必须抛错，不允许返回半成品） */
  verifyCallback(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<{ paymentId: string; orderId: string; paidFen: number }>;
  /**
   * 查单（批次 6 补缺大批 · reconcile 自助补开用）：
   * 按通道侧支付单号查询支付结果；mock=回本地通道状态，wechat/alipay=TODO 规格骨架。
   * status='paid' 时必须带 paidFen（业务侧据此做金额核对红线，不符拒兑付）。
   */
  queryOrder(paymentId: string): Promise<{ paymentId: string; status: 'paid' | 'unpaid'; paidFen?: number }>;
  /** 退款（v1 仅接口占位） */
  refund(paymentId: string, amountFen: number): Promise<void>;
}

export type PaymentProviderName = 'mock' | 'wechat';

/** 带 name 的 provider，便于路由/流水落库时识别渠道 */
export type ResolvedPaymentProvider = PaymentProvider & { readonly name: PaymentProviderName };
