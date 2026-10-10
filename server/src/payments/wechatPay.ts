/**
 * WechatPayProvider —— 微信支付（JSAPI / H5 双通道）生产骨架（§4.7：生产实现）
 *
 * 当前状态：结构完整、配置强校验；真实微信 API 调用点=留口——五接口实现一律抛
 * 「通道未开通」明文（本批不接真钱；资质三件到位+老板另令后按官方文档接入），
 * 绝不允许半成品静默返回。
 *
 * 构造口径（产品-1010 片 1 通道配置端口）：
 * - new WechatPayProvider(config, channel)：config 来自通道配置端口高危件
 *   （pay_rules pay_channel_credentials.wechat 四件：appid/mchid/serial/apiV3Key）；
 *   channel='wechat_jsapi' | 'wechat_h5'（两通道同凭证集，官方支持各绑不同 appid——
 *   多实例留口：接入时按通道各读配置位）。
 * - WechatPayProvider.fromEnv(channel)：env 四件（WECHAT_MCHID/WECHAT_APPID/WECHAT_KEY/
 *   WECHAT_SERIAL）缺一即抛——assertPaymentConfig 启动红线专用（原工艺逐字不动）。
 * 另需（接入时补齐，见各方法 TODO）：商户 API 私钥（请求签名）、WECHAT_NOTIFY_URL
 * 类回调地址（端口配置项）、微信平台证书/微信支付公钥（回调验签，按 Wechatpay-Serial 索引）。
 *
 * 接入清单（官方文档字段摘录=evidence/pay-channel/official-api-fields.md §一，签名冻结依据）：
 * 1. createOrder → JSAPI=POST /v3/pay/transactions/jsapi（payer.openid 必填），
 *    H5=POST /v3/pay/transactions/h5（scene_info{payer_client_ip,h5_info} 必填、无 payer）；
 *    请求体 { appid, mchid, description: subject, out_trade_no: orderId,
 *    notify_url, amount: { total: totalFen, currency: 'CNY' } }，商户私钥签请求；
 *    JSAPI 响应 prepay_id（2h 有效）→ 二次签名六元组 payParams={ channel:'wechat_jsapi',
 *    appId, timeStamp(秒级), nonceStr, package:'prepay_id=***', signType:'RSA', paySign }；
 *    H5 响应 h5_url（5min 有效，禁篡改仅可拼 redirect_url）→ payParams={ channel:'wechat_h5', h5Url }。
 * 2. verifyCallback → Wechatpay-Signature/Timestamp/Nonce/Serial 四头，按 Serial 选平台证书/
 *    微信支付公钥验签 SHA256-RSA(`${ts}\n${nonce}\n${rawBody}\n`)；再 APIv3 密钥
 *    AEAD_AES_256_GCM 解密 resource → out_trade_no(=orderId)/transaction_id(=paymentId)/
 *    amount.total(=paidFen)；trade_state==='SUCCESS' 才认支付成功；应答 200/204，失败 4xx/5xx+FAIL。
 * 3. queryOrder → GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid=xx；
 *    trade_state SUCCESS → paid(+paidFen=amount.total)、CLOSED → closed、其余 → unpaid。
 * 4. refund → POST /v3/refund/domestic/refunds { out_trade_no, out_refund_no: refundNo（幂等键，
 *    重试同号）, amount:{ refund: amountFen, total: totalFen, currency:'CNY' }, reason }；
 *    返回 refund_id+status（SUCCESS/PROCESSING/CLOSED/ABNORMAL）；受理≠终态（退款通知/查退款闭环）。
 * 5. close → POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close（body mchid）；
 *    成功=204 无包体（无异常即成功）；仅未支付单可关。
 */

import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  QueryOrderResult,
  RefundInput,
  RefundResult,
  VerifiedPayment,
} from './provider';

/** 必需的微信支付环境变量（缺一即拒启动；fromEnv 启动红线口径） */
const REQUIRED_ENVS = ['WECHAT_MCHID', 'WECHAT_APPID', 'WECHAT_KEY', 'WECHAT_SERIAL'] as const;

export interface WechatPayConfig {
  mchid: string;
  appid: string;
  /** API v3 密钥（AEAD_AES_256_GCM 解密回调资源用） */
  key: string;
  /** 商户 API 证书序列号 */
  serial: string;
}

/** 真通道留口统一抛错（「通道未开通」明文，绝不含糊返回） */
function notImplemented(step: string): never {
  throw new Error(
    `[payments] 通道未开通：WechatPayProvider.${step} 真通道实现留口（本批不接真钱；` +
      '资质三件到位+老板另令后按官方文档接入——字段依据 evidence/pay-channel/official-api-fields.md）。',
  );
}

export class WechatPayProvider implements PaymentProvider {
  readonly config: WechatPayConfig;
  readonly channel: 'wechat_jsapi' | 'wechat_h5';

  constructor(config: WechatPayConfig, channel: 'wechat_jsapi' | 'wechat_h5' = 'wechat_jsapi') {
    this.config = config;
    this.channel = channel;
  }

  /**
   * env 注入（assertPaymentConfig 启动红线专用；缺一即抛列出缺失项）：
   * 生产构建缺失真实微信配置 → 启动报错而非静默降级（§4.7 资金安全红线）。
   */
  static fromEnv(channel: 'wechat_jsapi' | 'wechat_h5' = 'wechat_jsapi'): WechatPayProvider {
    const missing = REQUIRED_ENVS.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
      throw new Error(
        `[payments] PAYMENT_PROVIDER=wechat 但缺少必需环境变量：${missing.join(', ')}。` +
          '请补齐微信支付商户配置后重启；绝不允许静默降级（资金链路）。',
      );
    }
    return new WechatPayProvider(
      {
        mchid: process.env.WECHAT_MCHID!.trim(),
        appid: process.env.WECHAT_APPID!.trim(),
        key: process.env.WECHAT_KEY!.trim(),
        serial: process.env.WECHAT_SERIAL!.trim(),
      },
      channel,
    );
  }

  async createOrder(_order: CreateOrderInput): Promise<CreateOrderResult> {
    // TODO(微信接入)：JSAPI/H5 下单+调起凭据（见文件头接入清单 1）
    notImplemented('createOrder');
  }

  async verifyCallback(
    _headers: Record<string, string>,
    _rawBody: string,
  ): Promise<VerifiedPayment> {
    // TODO(微信接入)：平台证书/微信支付公钥验签 + AEAD_AES_256_GCM 资源解密（接入清单 2）
    notImplemented('verifyCallback');
  }

  async queryOrder(_paymentId: string): Promise<QueryOrderResult> {
    // TODO(微信接入)：GET /v3/pay/transactions/out-trade-no/{out_trade_no}（接入清单 3）
    notImplemented('queryOrder');
  }

  async refund(_refund: RefundInput): Promise<RefundResult> {
    // TODO(微信接入)：POST /v3/refund/domestic/refunds（接入清单 4；refundNo=幂等键重试同号）
    notImplemented('refund');
  }

  async close(_order: { orderId: string }): Promise<void> {
    // TODO(微信接入)：POST /v3/pay/transactions/out-trade-no/{out_trade_no}/close（接入清单 5）
    notImplemented('close');
  }
}
