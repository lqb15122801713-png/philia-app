/**
 * AlipayPayProvider —— 支付宝（手机网站支付 alipay_wap）生产骨架（批次 6 补缺大批立件，
 * 产品-1010 片 1 收敛进五接口族）
 *
 * 当前状态：结构完整、配置强校验；真实支付宝 API 调用点=留口——五接口实现一律抛
 * 「通道未开通」明文（本批不接真钱；资质三件到位+老板另令后按官方文档接入），
 * 绝不允许半成品静默返回（工艺同 WechatPayProvider）。
 *
 * 构造口径（片 1 通道配置端口）：new AlipayPayProvider(config)——config 来自通道配置端口
 * 高危件（pay_rules pay_channel_credentials.alipay 三件：appid/privateKey/publicKey）。
 * （env 注入从未开放——批次 6 立件时即「暂不开放 alipay」；配置统一走端口凭据。）
 * 另需（接入时补齐）：ALIPAY_NOTIFY_URL 类异步通知地址、ALIPAY_RETURN_URL 同步回跳地址、
 * 网关（生产 https://openapi.alipay.com/gateway.do）——均为端口配置项。
 *
 * 接入清单（官方文档字段摘录=evidence/pay-channel/official-api-fields.md §二，签名冻结依据）：
 * 1. createOrder → alipay.trade.wap.pay（页面执行类：服务端拼 form 直跳，不先调网关）：
 *    - biz_content：out_trade_no(=orderId) / total_amount(=totalFen÷100 元两位小数) /
 *      subject / product_code='QUICK_WAP_WAY'（⚠️勘误：官方文档产品码=QUICK_WAP_WAY，
 *      本件旧注释 QUICK_WAP_PAY 有误，片 1 修正）；
 *    - 公共参数：app_id / method / charset='utf-8' / sign_type='RSA2' / timestamp
 *      'yyyy-MM-dd HH:mm:ss' / version='1.0' / notify_url / return_url；
 *    - 签名：全部参数 ASCII 升序拼 k=v&k=v，应用私钥 RSA2(SHA256withRSA) 签名得 sign；
 *    - 响应 pageRedirectionData（POST=自动提交 HTML form）→ payParams={ channel:'alipay_wap', form }；
 *    - paymentId 落 out_trade_no 映射（支付单号以异步通知 trade_no 为准）。
 * 2. verifyCallback → 异步通知（form 表单）：除 sign/sign_type 外全量参数 url_decode 后
 *    字典序拼接，支付宝公钥 RSA2 验签；再四项一致性校验（out_trade_no 本系统单/total_amount
 *    等额/seller_id/app_id）；trade_status ∈ (TRADE_SUCCESS, TRADE_FINISHED) 才认支付成功 →
 *    { paymentId: trade_no, orderId: out_trade_no, paidFen: round(total_amount×100) }；
 *    业务处理成功后必须明文应答 success（重试 4m/10m/10m/1h/2h/6h/15h 直至 success）。
 * 3. queryOrder → alipay.trade.query（biz_content: out_trade_no）：TRADE_SUCCESS/TRADE_FINISHED
 *    → paid(+paidFen=round(total_amount×100))、TRADE_CLOSED → closed、WAIT_BUYER_PAY → unpaid；
 *    ACQ.TRADE_NOT_EXIST → unpaid（未创建口径）。
 * 4. refund → alipay.trade.refund（biz_content: out_trade_no / refund_amount=amountFen÷100 /
 *    out_request_no=refundNo（幂等键，重试同号）/ refund_reason=reason）：code=10000≠成功，
 *    fund_change=Y 才算资金变化；refund_fee=累计已退。终态以 alipay.trade.fastpay.refund.query
 *    （refund_status=REFUND_SUCCESS）闭环。
 * 5. close → alipay.trade.close（biz_content: out_trade_no）：仅 WAIT_BUYER_PAY 可关；
 *    ACQ.TRADE_STATUS_ERROR=非待支付拒。
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

export interface AlipayPayConfig {
  appid: string;
  /** 应用私钥（RSA2，请求签名用） */
  privateKey: string;
  /** 支付宝公钥（异步通知验签用） */
  publicKey: string;
}

/** 真通道留口统一抛错（「通道未开通」明文，绝不含糊返回） */
function notImplemented(step: string): never {
  throw new Error(
    `[payments] 通道未开通：AlipayPayProvider.${step} 真通道实现留口（本批不接真钱；` +
      '资质三件到位+老板另令后按官方文档接入——字段依据 evidence/pay-channel/official-api-fields.md）。',
  );
}

export class AlipayPayProvider implements PaymentProvider {
  readonly config: AlipayPayConfig;

  constructor(config: AlipayPayConfig) {
    this.config = config;
  }

  async createOrder(_order: CreateOrderInput): Promise<CreateOrderResult> {
    // TODO(支付宝接入)：alipay.trade.wap.pay 表单规格（见文件头接入清单 1）
    notImplemented('createOrder');
  }

  async verifyCallback(
    _headers: Record<string, string>,
    _rawBody: string,
  ): Promise<VerifiedPayment> {
    // TODO(支付宝接入)：异步通知验签+四项一致性校验（见文件头接入清单 2）
    notImplemented('verifyCallback');
  }

  async queryOrder(_paymentId: string): Promise<QueryOrderResult> {
    // TODO(支付宝接入)：alipay.trade.query（见文件头接入清单 3）
    notImplemented('queryOrder');
  }

  async refund(_refund: RefundInput): Promise<RefundResult> {
    // TODO(支付宝接入)：alipay.trade.refund（见文件头接入清单 4；refundNo=幂等键重试同号）
    notImplemented('refund');
  }

  async close(_order: { orderId: string }): Promise<void> {
    // TODO(支付宝接入)：alipay.trade.close（见文件头接入清单 5；仅待支付可关）
    notImplemented('close');
  }
}
