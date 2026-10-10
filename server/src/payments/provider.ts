/**
 * 支付适配层 · PaymentProvider 五接口契约（产品-1010 线上支付批片 1 冻结）与通道解析
 *
 * 五接口签名冻结（官方文档字段归一，逐项可溯 evidence/pay-channel/official-api-fields.md）：
 *   createOrder 下单 / verifyCallback 回调验签 / queryOrder 查询 / refund 退款 / close 关单。
 * 实现四通道：mock（开发/演示，本地 HMAC 验签跑通全链路）、wechat_jsapi / wechat_h5 /
 * alipay_wap（真通道骨架：配置强校验，五方法全抛「通道未开通」明文留口——本批不接真钱，
 * 资质三件到位+老板另令后按官方文档接入）。
 *
 * 通道切换闸（片 1 ③）：mock↔真通道=端口参数（pay_rules pay_channel_provider，默认无行=env
 * 现状兜底）；kill switch 开=瞬时回落 mock 安全值（configRules.isKillSwitchOn 读方内联工艺）。
 * 在途单按下单时快照通道解析（providerForChannel）——切通道后在途 mock 单不受影响（任务书旅程 3）。
 *
 * 资金安全红线（§4.7）：支付是资金链路，静默降级即资损风险——
 * 生产构建（NODE_ENV=production）缺失真实微信配置 / 仍指向 mock 时，
 * assertPaymentConfig() 直接启动报错，绝不静默降级到 mock（env 层红线，端口切换闸不动它）；
 * 端口选定真通道但凭据未配齐时，resolvePaymentProvider 抛「通道配置缺失」明文，同样绝不静默回落。
 */

import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { PayChannel } from '../db/schema';
import { isKillSwitchOn } from '../routers/configRules';
import {
  PAY_CHANNEL_CREDENTIALS_RULE_KEY,
  PAY_CHANNEL_PROVIDER_RULE_KEY,
  type PayChannelCredentials,
} from './channelKeys';
import { MockPayProvider } from './mockPay';
import { WechatPayProvider, type WechatPayConfig } from './wechatPay';
import { AlipayPayProvider, type AlipayPayConfig } from './alipayPay';

/* ------------------------------------------------------------------ */
/* 五接口契约（冻结 · 官方字段归一）                                      */
/* ------------------------------------------------------------------ */

/**
 * 下单入参：微信 description/out_trade_no/amount.total(分) ⇄ 支付宝 subject/out_trade_no/
 * total_amount(元，实现层换算)。notify_url/return_url=通道配置项（端口件），不进下单入参。
 */
export interface CreateOrderInput {
  /** 商户订单号（本仓=业务单 ULID 26 位；微信 6-32 / 支付宝 ≤64 均容纳） */
  orderId: string;
  /** 金额（分，整数；支付宝实现层负责 ÷100 转元两位小数） */
  totalFen: number;
  /** 商品描述（微信 description ≤127 / 支付宝 subject ≤256） */
  subject: string;
}

/**
 * 下单出参：paymentId=通道侧支付单号（mock=mock_ulid；微信=prepay 会话映射，支付单号以回调
 * transaction_id 为准；支付宝=下单 out_trade_no 映射，以异步通知 trade_no 为准）。
 * payParams=前端调起凭据全集，按通道约定键（前端按 mock 位/ channel 键分派）：
 * - mock：{ mock:'1', orderId, scenario }（现状不动）
 * - wechat_jsapi：{ channel:'wechat_jsapi', appId, timeStamp, nonceStr, package, signType:'RSA', paySign }
 * - wechat_h5：{ channel:'wechat_h5', h5Url }（官方 h5_url，禁篡改，仅可拼 redirect_url）
 * - alipay_wap：{ channel:'alipay_wap', form }（官方 pageRedirectionData 自动提交表单串）
 */
export interface CreateOrderResult {
  paymentId: string;
  payParams: Record<string, string>;
}

/** 回调验签出参：paymentId=通道交易号（微信 transaction_id/支付宝 trade_no）；orderId=商户订单号；paidFen=实付分 */
export interface VerifiedPayment {
  paymentId: string;
  orderId: string;
  paidFen: number;
}

/**
 * 查单出参：status 归一——paid=微信 SUCCESS ⇄ 支付宝 TRADE_SUCCESS/TRADE_FINISHED；
 * unpaid=微信 NOTPAY 等 ⇄ 支付宝 WAIT_BUYER_PAY；closed=微信 CLOSED ⇄ 支付宝 TRADE_CLOSED。
 * status='paid' 时必须带 paidFen（业务侧据此做金额核对红线，不符拒兑付）。
 */
export interface QueryOrderResult {
  paymentId: string;
  status: 'paid' | 'unpaid' | 'closed';
  paidFen?: number;
}

/**
 * 退款入参：refundNo=幂等键（微信 out_refund_no ⇄ 支付宝 out_request_no；重试必须同号，
 * 业务侧=退款单号 RB-*）；totalFen=原单总额（微信 amount.total 必填校验位）；reason ⇄ reason/refund_reason。
 */
export interface RefundInput {
  paymentId: string;
  refundNo: string;
  amountFen: number;
  totalFen: number;
  reason?: string;
}

/**
 * 退款出参：refundId=通道退款单号；status 归一（微信 SUCCESS/PROCESSING/CLOSED/ABNORMAL
 * ⇄ 支付宝 fund_change=Y+refund_status）。受理成功≠终态——终态以退款回调/查询退款闭环（接入时实现）。
 */
export interface RefundResult {
  refundId: string;
  status: 'success' | 'processing' | 'closed' | 'abnormal';
}

export interface PaymentProvider {
  /** ①下单：创建支付单，返回前端调起支付所需参数 */
  createOrder(order: CreateOrderInput): Promise<CreateOrderResult>;
  /** ②回调验签 + 解析（验签失败必须抛错，不允许返回半成品） */
  verifyCallback(headers: Record<string, string>, rawBody: string): Promise<VerifiedPayment>;
  /** ③查单（reconcile 自助补开用）：按通道侧支付单号查询支付结果 */
  queryOrder(paymentId: string): Promise<QueryOrderResult>;
  /** ④退款（线上原路联动用；refundNo 幂等键重试同号） */
  refund(refund: RefundInput): Promise<RefundResult>;
  /** ⑤关单：仅通道侧未支付单可关（微信/支付宝同口径）；已付/不存在=通道拒（抛错） */
  close(order: { orderId: string }): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* env 注入（启动红线用；运行时解析走 §下 切换闸）                          */
/* ------------------------------------------------------------------ */

/** env PAYMENT_PROVIDER 口径（不动）：mock | wechat（=wechat_jsapi 映射） */
export type PaymentProviderName = 'mock' | 'wechat';

/** 带通道名的 provider，便于路由/流水落库时识别渠道（pay_orders.channel 取值=PayChannel） */
export type ResolvedPaymentProvider = PaymentProvider & { readonly name: PayChannel };

/** 读取 PAYMENT_PROVIDER；未设置时缺省 'mock'（开发值） */
export function paymentProviderName(): PaymentProviderName {
  const raw = (process.env.PAYMENT_PROVIDER ?? 'mock').trim().toLowerCase();
  if (raw === 'mock' || raw === 'wechat') return raw;
  throw new Error(
    `[payments] 未知 PAYMENT_PROVIDER="${raw}"（仅支持 mock | wechat），拒绝启动/调用`,
  );
}

let cached: ResolvedPaymentProvider | null = null;
/** mock 单例（通道账本在模块级 Map，实例共享；切换闸回落/端口选定 mock 同用） */
const mockSingleton: ResolvedPaymentProvider = Object.assign(new MockPayProvider(), { name: 'mock' as const });

/**
 * 取 env 口径 provider（懒加载单例）。env 'wechat' 映射通道名 'wechat_jsapi'；
 * 构造 WechatPayProvider.fromEnv 时若 WECHAT_* 缺失会同步抛错。
 * 仅供 env 兜底路径与测试使用；业务运行时请走 resolvePaymentProvider（切换闸）。
 */
export function getPaymentProvider(): ResolvedPaymentProvider {
  if (cached) return cached;
  const name = paymentProviderName();
  const impl: PaymentProvider =
    name === 'wechat' ? WechatPayProvider.fromEnv('wechat_jsapi') : new MockPayProvider();
  cached = Object.assign(impl, { name: (name === 'wechat' ? 'wechat_jsapi' : 'mock') as PayChannel });
  return cached;
}

/**
 * 启动校验（集成时在服务入口调用一次；冒烟/测试可直接调用验证语义）：
 * - PAYMENT_PROVIDER 非法取值 → 抛错；
 * - 生产环境（NODE_ENV=production）仍为 mock → 抛错（禁止 mock 上生产，§4.7）；
 * - 内测环境（NODE_ENV=staging）使用 mock → 合法放行（批次 6 产品侧裁定书 #1 ②：
 *   内测走 MockPayProvider 不接真钱；production + mock 红线一行不动）；
 * - provider=wechat 时 WECHAT_MCHID / WECHAT_APPID / WECHAT_KEY / WECHAT_SERIAL
 *   任一缺失 → WechatPayProvider.fromEnv 抛错（列出缺失项）。
 * 任何失败都以明确 Error 暴露，绝不静默降级。
 */
export function assertPaymentConfig(): void {
  const name = paymentProviderName(); // 非法取值直接抛
  if (name === 'mock') {
    // 批次 6 裁定书 #1 ②：staging（VPS 内测）放行 MockPayProvider；
    // production + mock 维持 §4.7 红线，启动报错（下行逻辑一字不动）
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[payments] 生产构建检测到 PAYMENT_PROVIDER=mock：mock 仅用于开发/演示，' +
          '禁止上生产（静默降级即资损风险）。请配置 PAYMENT_PROVIDER=wechat 及完整 WECHAT_* 环境变量。',
      );
    }
    return;
  }
  // wechat：构造即校验全部 WECHAT_* 配置，缺失抛错
  WechatPayProvider.fromEnv('wechat_jsapi');
}

/** 仅供测试：重置 provider 单例（冒烟脚本切环境后用） */
export function resetPaymentProviderForTest(): void {
  cached = null;
}

/* ------------------------------------------------------------------ */
/* 通道切换闸（片 1 ③）：端口参数 + kill switch 瞬时回落                   */
/* ------------------------------------------------------------------ */

type DbHandle = typeof db;

/** 读切换闸端口值：pay_rules active 行 pay_channel_provider（全局单份）；无行= null（env 兜底） */
async function loadPortProvider(d: DbHandle): Promise<PayChannel | null> {
  const row = await d
    .select({ valueJson: schema.payRules.valueJson })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, PAY_CHANNEL_PROVIDER_RULE_KEY), eq(schema.payRules.active, true)))
    .get();
  const v = (row?.valueJson as Record<string, unknown> | undefined)?.provider;
  return v === 'mock' || v === 'wechat_jsapi' || v === 'wechat_h5' || v === 'alipay_wap' ? v : null;
}

/** 读通道凭据（server-only；active 行真值，永不外传——读口掩码在 routers/payChannel.ts） */
export async function loadPayChannelCredentials(d: DbHandle): Promise<PayChannelCredentials | null> {
  const row = await d
    .select({ valueJson: schema.payRules.valueJson })
    .from(schema.payRules)
    .where(and(eq(schema.payRules.ruleKey, PAY_CHANNEL_CREDENTIALS_RULE_KEY), eq(schema.payRules.active, true)))
    .get();
  return (row?.valueJson as PayChannelCredentials | undefined) ?? null;
}

/** 真通道凭据缺件即抛（资金红线：绝不静默回落 mock） */
function missingCredentials(channel: PayChannel, missing: string[]): never {
  throw new Error(
    `[payments] 通道配置缺失：${channel} 凭据 ${missing.join('/')} 未配齐` +
      '（端口「支付通道」补录后再切换；绝不静默回落 mock——资金链路红线）',
  );
}

/** 凭据缺件扫描：返回缺件键名表（空=齐） */
function missingFields(entries: Array<[string, string | undefined]>): string[] {
  return entries.filter(([, v]) => !v?.trim()).map(([k]) => k);
}

/** 按通道名构造 provider：mock=单例；真通道=凭据构造（缺件抛明文） */
function providerOf(name: PayChannel, credentials: PayChannelCredentials | null): ResolvedPaymentProvider {
  if (name === 'mock') return mockSingleton;
  if (name === 'wechat_jsapi' || name === 'wechat_h5') {
    const w = credentials?.wechat;
    const missing = missingFields([
      ['appid', w?.appid],
      ['mchid', w?.mchid],
      ['serial', w?.serial],
      ['apiV3Key', w?.apiV3Key],
    ]);
    if (missing.length > 0) return missingCredentials(name, missing);
    const config: WechatPayConfig = {
      appid: w!.appid!.trim(),
      mchid: w!.mchid!.trim(),
      serial: w!.serial!.trim(),
      key: w!.apiV3Key!.trim(),
    };
    return Object.assign(new WechatPayProvider(config, name), { name });
  }
  const a = credentials?.alipay;
  const missing = missingFields([
    ['appid', a?.appid],
    ['privateKey', a?.privateKey],
    ['publicKey', a?.publicKey],
  ]);
  if (missing.length > 0) return missingCredentials(name, missing);
  const config: AlipayPayConfig = {
    appid: a!.appid!.trim(),
    privateKey: a!.privateKey!.trim(),
    publicKey: a!.publicKey!.trim(),
  };
  return Object.assign(new AlipayPayProvider(config), { name });
}

/**
 * 切换闸解析（下单/平台回调入口）。解析序：
 * ① kill switch 开 → mock（瞬时回落安全值）；
 * ② 端口行 pay_channel_provider → 选定通道（真通道凭据缺件=抛明文，不静默回落）；
 * ③ 无端口行 → env PAYMENT_PROVIDER 现状兜底（零回退）。
 */
export async function resolvePaymentProvider(d: DbHandle): Promise<ResolvedPaymentProvider> {
  if (await isKillSwitchOn(d)) return mockSingleton;
  const port = await loadPortProvider(d);
  if (port === null) return getPaymentProvider();
  return providerOf(port, await loadPayChannelCredentials(d));
}

/**
 * 在途单按快照通道解析（reconcile/退款联动/关单用）：pay_orders.channel=下单时通道快照，
 * 切通道后在途单仍走原通道（任务书旅程 3「在途 mock 单不受影响」）。
 */
export async function providerForChannel(d: DbHandle, channel: string): Promise<ResolvedPaymentProvider> {
  const name: PayChannel =
    channel === 'wechat_jsapi' || channel === 'wechat_h5' || channel === 'alipay_wap' ? channel : 'mock';
  return providerOf(name, await loadPayChannelCredentials(d));
}
