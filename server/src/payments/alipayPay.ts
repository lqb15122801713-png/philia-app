/**
 * AlipayPayProvider —— 支付宝（手机网站支付 alipay_wap）生产骨架（批次 6 补缺大批）
 *
 * 当前状态：结构完整、配置强校验；真实支付宝 API 调用点为显式 TODO ——
 * 未实现的调用一律抛出带 TODO 标记的明确错误，绝不允许半成品静默返回
 * （工艺逐字同 WechatPayProvider）。
 *
 * 注入预留：本批只落骨架文件，provider.ts 的 PAYMENT_PROVIDER 环境注入暂不开放
 * alipay（mock | wechat 不变）；接入时在 paymentProviderName() 增 'alipay' 分支并
 * 于 assertPaymentConfig() 同步强校验（生产缺配启动报错，绝不静默降级）。
 *
 * 配置（缺一不可，构造函数强制校验）：
 * - ALIPAY_APPID        开放平台应用 AppID
 * - ALIPAY_PRIVATE_KEY  应用私钥（RSA2，请求签名用）
 * - ALIPAY_PUBLIC_KEY   支付宝公钥（异步通知验签用）
 * 另需（接入时补齐，见 TODO）：
 * - ALIPAY_NOTIFY_URL   异步通知地址（须与 /api/pay/orders/callback 对齐）
 * - ALIPAY_RETURN_URL   同步回跳地址（前端展示用，不作支付结果依据）
 * - ALIPAY_GATEWAY      网关（生产 https://openapi.alipay.com/gateway.do）
 *
 * 接入清单（开放平台文档：alipay.trade.wap.pay）：
 * 1. createPayment → alipay.trade.wap.pay（页面执行类：服务端拼 form 直跳，不先调网关）：
 *    - biz_content 字段：out_trade_no(=orderId) / total_amount(=amountFen÷100，元，两位小数) /
 *      subject / product_code='QUICK_WAP_PAY'；
 *    - 公共参数：app_id / method / charset='utf-8' / sign_type='RSA2' / timestamp /
 *      version='1.0' / notify_url=ALIPAY_NOTIFY_URL / return_url=ALIPAY_RETURN_URL；
 *    - 签名：全部参数按 ASCII 升序拼 k=v&k=v，应用私钥 RSA2(SHA256withRSA) 签名得 sign；
 *    - payParams = form 字段全集（前端表单 POST/跳转），paymentId 落 out_trade_no 映射
 *      （支付单号以异步通知 trade_no 为准）。
 * 2. verifyCallback → 异步通知验签：对通知全部参数（sign/sign_type 除外）按同序拼接，
 *    用支付宝公钥 RSA2 验签；验过再解析 out_trade_no(=orderId) / trade_no(=paymentId) /
 *    total_amount（元→分= paidFen）；trade_status ∈ (TRADE_SUCCESS, TRADE_FINISHED) 才算支付成功。
 * 3. queryOrder → alipay.trade.query（biz_content: out_trade_no）：trade_status=TRADE_SUCCESS →
 *    { status:'paid', paidFen: total_amount×100 }。
 * 4. refund → alipay.trade.refund（biz_content: out_trade_no / refund_amount）。
 */

import type { PaymentProvider } from './types'; // 契约件（循环依赖开环：原指 provider 工厂件）

/** 必需的支付宝环境变量（缺一即拒启动） */
const REQUIRED_ENVS = ['ALIPAY_APPID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'] as const;

export interface AlipayPayConfig {
  appid: string;
  /** 应用私钥（RSA2，请求签名用） */
  privateKey: string;
  /** 支付宝公钥（异步通知验签用） */
  publicKey: string;
}

/** 未实现的支付宝 API 调用统一抛错（带 TODO 标记，绝不含糊返回） */
function notImplemented(step: string): never {
  throw new Error(
    `[payments] AlipayPayProvider.${step} 尚未接入支付宝开放平台 API（TODO: 应用/密钥就绪后实现）。` +
      '当前为生产骨架：配置校验已通过，但不会发起任何真实扣款。',
  );
}

export class AlipayPayProvider implements PaymentProvider {
  readonly config: AlipayPayConfig;

  constructor() {
    const missing = REQUIRED_ENVS.filter((k) => !process.env[k]?.trim());
    if (missing.length > 0) {
      // 生产构建缺失真实支付宝配置 → 启动报错而非静默降级（§4.7 资金安全红线，同 wechatPay 工艺）
      throw new Error(
        `[payments] PAYMENT_PROVIDER=alipay 但缺少必需环境变量：${missing.join(', ')}。` +
          '请补齐支付宝开放平台配置后重启；绝不允许静默降级（资金链路）。',
      );
    }
    this.config = {
      appid: process.env.ALIPAY_APPID!.trim(),
      privateKey: process.env.ALIPAY_PRIVATE_KEY!.trim(),
      publicKey: process.env.ALIPAY_PUBLIC_KEY!.trim(),
    };
  }

  async createPayment(_order: {
    orderId: string;
    totalFen: number;
    subject: string;
  }): Promise<{ paymentId: string; payParams: Record<string, string> }> {
    // TODO(支付宝接入)：alipay.trade.wap.pay 表单规格（见文件头接入清单 1）
    //   biz_content: { out_trade_no: orderId, total_amount: (totalFen/100).toFixed(2),
    //                  subject, product_code: 'QUICK_WAP_PAY' }
    //   公共参数 + RSA2 签名 → payParams=form 字段全集（前端表单直跳网关）
    notImplemented('createPayment');
  }

  async verifyCallback(
    _headers: Record<string, string>,
    _rawBody: string,
  ): Promise<{ paymentId: string; orderId: string; paidFen: number }> {
    // TODO(支付宝接入)：异步通知验签（见文件头接入清单 2）
    //   1. 验签：通知全部参数（sign/sign_type 除外）ASCII 升序拼接，支付宝公钥 RSA2 验
    //   2. 解析：trade_status ∈ (TRADE_SUCCESS, TRADE_FINISHED) 才返回 {
    //        paymentId: trade_no, orderId: out_trade_no, paidFen: round(total_amount×100) }
    notImplemented('verifyCallback');
  }

  async queryOrder(
    _paymentId: string,
  ): Promise<{ paymentId: string; status: 'paid' | 'unpaid'; paidFen?: number }> {
    // TODO(支付宝接入)：alipay.trade.query（biz_content: { out_trade_no }）；
    //   trade_status==='TRADE_SUCCESS' → { status:'paid', paidFen: round(total_amount×100) }
    notImplemented('queryOrder');
  }

  async refund(_paymentId: string, _amountFen: number): Promise<void> {
    // TODO(支付宝接入)：alipay.trade.refund（biz_content: { out_trade_no, refund_amount }）
    notImplemented('refund');
  }
}
