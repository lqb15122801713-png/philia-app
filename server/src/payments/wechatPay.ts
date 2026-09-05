/**
 * WechatPayProvider —— 微信支付（JSAPI）生产骨架（§4.7：生产实现）
 *
 * 当前状态：结构完整、配置强校验；真实微信 API 调用点为显式 TODO ——
 * 未实现的调用一律抛出带 TODO 标记的明确错误，绝不允许半成品静默返回。
 *
 * 配置（缺一不可，构造函数强制校验）：
 * - WECHAT_MCHID   商户号
 * - WECHAT_APPID   公众号/小程序 AppID
 * - WECHAT_KEY     API v3 密钥（AEAD_AES_256_GCM 解密回调资源用）
 * - WECHAT_SERIAL  商户 API 证书序列号
 * 另需（接入时补齐，见 TODO）：
 * - WECHAT_PRIVATE_KEY(_PATH) 商户 API 私钥（PEM），请求签名用
 * - WECHAT_NOTIFY_URL         支付结果回调地址（须与 /api/pay/callback 对齐）
 * - 微信平台证书（自动下载或预置），回调验签用
 *
 * 接入清单（商户号就绪后，按微信支付 v3 文档实现）：
 * 1. createPayment → POST /v3/pay/transactions/jsapi 下单（商户私钥签名请求），
 *    拿到 prepay_id 后按 JSAPI 二次签名生成 payParams
 *    （appId/timeStamp/nonceStr/package/signType/paySign）。
 * 2. verifyCallback → 用「微信平台证书」验签
 *    （Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce / serial），
 *    再用 API v3 密钥 AEAD_AES_256_GCM 解密 resource 得到
 *    out_trade_no(=orderId) / transaction_id(=paymentId) / amount.total(=paidFen)。
 * 3. refund → POST /v3/refund/domestic/refunds。
 */

import type { PaymentProvider } from './provider';

/** 必需的微信支付环境变量（缺一即拒启动） */
const REQUIRED_ENVS = ['WECHAT_MCHID', 'WECHAT_APPID', 'WECHAT_KEY', 'WECHAT_SERIAL'] as const;

export interface WechatPayConfig {
  mchid: string;
  appid: string;
  /** API v3 密钥 */
  key: string;
  /** 商户 API 证书序列号 */
  serial: string;
}

/** 未实现的微信 API 调用统一抛错（带 TODO 标记，绝不含糊返回） */
function notImplemented(step: string): never {
  throw new Error(
    `[payments] WechatPayProvider.${step} 尚未接入微信 v3 API（TODO: 商户号/证书就绪后实现）。` +
      '当前为生产骨架：配置校验已通过，但不会发起任何真实扣款。',
  );
}

export class WechatPayProvider implements PaymentProvider {
  readonly config: WechatPayConfig;

  constructor() {
    const missing = REQUIRED_ENVS.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
      // 生产构建缺失真实微信配置 → 启动报错而非静默降级（§4.7 资金安全红线）
      throw new Error(
        `[payments] PAYMENT_PROVIDER=wechat 但缺少必需环境变量：${missing.join(', ')}。` +
          '请补齐微信支付商户配置后重启；绝不允许静默降级（资金链路）。',
      );
    }
    this.config = {
      mchid: process.env.WECHAT_MCHID!.trim(),
      appid: process.env.WECHAT_APPID!.trim(),
      key: process.env.WECHAT_KEY!.trim(),
      serial: process.env.WECHAT_SERIAL!.trim(),
    };
  }

  async createPayment(_order: {
    orderId: string;
    totalFen: number;
    subject: string;
  }): Promise<{ paymentId: string; payParams: Record<string, string> }> {
    // TODO(微信接入)：POST /v3/pay/transactions/jsapi
    //   - 请求体：{ appid, mchid, description: subject, out_trade_no: orderId,
    //              notify_url: WECHAT_NOTIFY_URL, amount: { total: totalFen, currency: 'CNY' } }
    //   - 请求签名：商户 API 私钥（WECHAT_PRIVATE_KEY）按 v3 规则签名
    //   - 响应 prepay_id → JSAPI 调起参数二次签名：
    //     payParams = { appId, timeStamp, nonceStr, package: `prepay_id=${prepay_id}`,
    //                   signType: 'RSA', paySign }
    //   - paymentId 建议落 out_trade_no 映射（支付单号以回调 transaction_id 为准）
    notImplemented('createPayment');
  }

  async verifyCallback(
    _headers: Record<string, string>,
    _rawBody: string,
  ): Promise<{ paymentId: string; orderId: string; paidFen: number }> {
    // TODO(微信接入)：平台证书验签 + 资源解密
    //   1. 验签：Wechatpay-Signature / Wechatpay-Timestamp / Wechatpay-Nonce /
    //      Wechatpay-Serial → 用「微信平台证书」公钥验
    //      SHA256-RSA(`${ts}\n${nonce}\n${rawBody}\n`)，并拒绝过久时间戳（防重放）
    //   2. 解密：body.resource（AEAD_AES_256_GCM，key=WECHAT_KEY，
    //      nonce=resource.nonce，aad=resource.associated_data）
    //   3. 解析明文：trade_state==='SUCCESS' 才返回 {
    //        paymentId: transaction_id, orderId: out_trade_no, paidFen: amount.total }
    notImplemented('verifyCallback');
  }

  async refund(_paymentId: string, _amountFen: number): Promise<void> {
    // TODO(微信接入)：POST /v3/refund/domestic/refunds（v1 接口占位，暂不实现）
    notImplemented('refund');
  }
}
