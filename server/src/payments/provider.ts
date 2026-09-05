/**
 * 支付适配层 · PaymentProvider 接口与环境注入（开发方案 §4.7 逐字契约）
 *
 * v1 两个实现，按环境变量 PAYMENT_PROVIDER 注入：
 * - mock   ：MockPayProvider，开发/演示（缺省开发值），本地 HMAC 验签跑通全链路；
 * - wechat ：WechatPayProvider，生产骨架（JSAPI），构造时校验 WECHAT_* 配置齐全。
 *
 * 资金安全红线（§4.7）：支付是资金链路，静默降级即资损风险——
 * 生产构建（NODE_ENV=production）缺失真实微信配置 / 仍指向 mock 时，
 * assertPaymentConfig() 直接启动报错，绝不静默降级到 mock。
 */

import { MockPayProvider } from './mockPay';
import { WechatPayProvider } from './wechatPay';

/* ------------------------------------------------------------------ */
/* §4.7 契约接口（逐字）                                                  */
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
  /** 退款（v1 仅接口占位） */
  refund(paymentId: string, amountFen: number): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* 环境注入                                                              */
/* ------------------------------------------------------------------ */

export type PaymentProviderName = 'mock' | 'wechat';

/** 带 name 的 provider，便于路由/流水落库时识别渠道 */
export type ResolvedPaymentProvider = PaymentProvider & { readonly name: PaymentProviderName };

/** 读取 PAYMENT_PROVIDER；未设置时缺省 'mock'（开发值） */
export function paymentProviderName(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER ?? 'mock').trim().toLowerCase();
  if (raw === 'mock' || raw === 'wechat') return raw;
  throw new Error(
    `[payments] 未知 PAYMENT_PROVIDER="${raw}"（仅支持 mock | wechat），拒绝启动/调用`,
  );
}

let cached: ResolvedPaymentProvider | null = null;

/**
 * 取当前 provider（懒加载单例）。构造 WechatPayProvider 时若 WECHAT_* 缺失会同步抛错。
 * 仅供运行时业务路径使用；启动校验请走 assertPaymentConfig()。
 */
export function getPaymentProvider(): ResolvedPaymentProvider {
  if (cached) return cached;
  const name = paymentProviderName();
  const impl: PaymentProvider = name === 'wechat' ? new WechatPayProvider() : new MockPayProvider();
  cached = Object.assign(impl, { name } as const);
  return cached;
}

/**
 * 启动校验（集成时在服务入口调用一次；冒烟/测试可直接调用验证语义）：
 * - PAYMENT_PROVIDER 非法取值 → 抛错；
 * - 生产环境（NODE_ENV=production）仍为 mock → 抛错（禁止 mock 上生产，§4.7）；
 * - provider=wechat 时 WECHAT_MCHID / WECHAT_APPID / WECHAT_KEY / WECHAT_SERIAL
 *   任一缺失 → WechatPayProvider 构造函数抛错（列出缺失项）。
 * 任何失败都以明确 Error 暴露，绝不静默降级。
 */
export function assertPaymentConfig(): void {
  const name = paymentProviderName(); // 非法取值直接抛
  if (name === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[payments] 生产构建检测到 PAYMENT_PROVIDER=mock：mock 仅用于开发/演示，' +
          '禁止上生产（静默降级即资损风险）。请配置 PAYMENT_PROVIDER=wechat 及完整 WECHAT_* 环境变量。',
      );
    }
    return;
  }
  // wechat：构造即校验全部 WECHAT_* 配置，缺失抛错
  new WechatPayProvider();
}

/** 仅供测试：重置 provider 单例（冒烟脚本切环境后用） */
export function resetPaymentProviderForTest(): void {
  cached = null;
}
