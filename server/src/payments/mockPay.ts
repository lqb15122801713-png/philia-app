/**
 * MockPayProvider —— 开发/演示用支付实现（§4.7：仅演示用，禁止上生产）
 *
 * - createPayment：立即返回成功（不调任何外部接口），paymentId = 'mock_' + ULID，
 *   payParams = { mock: '1', orderId }；前端随后调 POST /api/pay/mock-callback
 *   完成演示闭环（见 routes/payCallback.ts）。
 * - verifyCallback：模拟平台回调的本地 HMAC-SHA256 验签——
 *   签名头 x-mock-signature = HMAC_SHA256(rawBody, MOCK_PAY_SECRET) hex，
 *   与真实微信回调走同一「验签 → 解析 → 业务处理」路径，便于联调与测试篡改场景。
 * - refund：v1 占位，直接成功。
 *
 * 生产隔离由 provider.ts 的 assertPaymentConfig() 强制（生产禁 mock，启动报错）。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';
import type { PaymentProvider } from './provider';

/**
 * mock 回调签名密钥：生产环境必须经 MOCK_PAY_SECRET 注入；
 * 缺省值仅供本地开发/冒烟，绝不用于生产（生产禁 mock，见 assertPaymentConfig）。
 */
const MOCK_PAY_SECRET = process.env.MOCK_PAY_SECRET ?? 'philia-dev-mock-pay-secret';

/** mock 回调签名头名（小写，Hono/Node headers 均已归一化小写） */
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';

/** mock 回调体结构（模拟平台通知原文） */
export interface MockCallbackBody {
  paymentId: string;
  orderId: string;
  paidFen: number;
}

/** 计算 mock 回调签名（hex）。供 mock-callback 演示端点与冒烟脚本构造回调用。 */
export function signMockCallback(rawBody: string, secret: string = MOCK_PAY_SECRET): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export class MockPayProvider implements PaymentProvider {
  async createPayment(order: {
    orderId: string;
    totalFen: number;
    subject: string;
  }): Promise<{ paymentId: string; payParams: Record<string, string> }> {
    // mock 立即返回成功：无外部调用；payParams 标记 mock=1 供前端识别走演示回调
    return {
      paymentId: `mock_${ulid()}`,
      payParams: { mock: '1', orderId: order.orderId },
    };
  }

  async verifyCallback(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<{ paymentId: string; orderId: string; paidFen: number }> {
    // 1) 验签：x-mock-signature 必须等于 HMAC_SHA256(rawBody)，常量时间比对
    const sig = headers[MOCK_SIGNATURE_HEADER];
    if (!sig || !/^[0-9a-f]{64}$/.test(sig)) {
      throw new Error('mock 回调缺少合法签名头 x-mock-signature');
    }
    const expected = Buffer.from(signMockCallback(rawBody), 'utf8');
    const actual = Buffer.from(sig, 'utf8');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error('mock 回调验签失败（签名不符）');
    }
    // 2) 解析回调体
    let body: MockCallbackBody;
    try {
      body = JSON.parse(rawBody) as MockCallbackBody;
    } catch {
      throw new Error('mock 回调体不是合法 JSON');
    }
    if (
      typeof body.paymentId !== 'string' ||
      !body.paymentId ||
      typeof body.orderId !== 'string' ||
      !body.orderId ||
      typeof body.paidFen !== 'number' ||
      !Number.isInteger(body.paidFen) ||
      body.paidFen < 0
    ) {
      throw new Error('mock 回调体字段缺失或非法（paymentId/orderId/paidFen）');
    }
    return { paymentId: body.paymentId, orderId: body.orderId, paidFen: body.paidFen };
  }

  /** v1 占位：mock 退款直接成功（真实退款留待微信支付接入后实现） */
  async refund(_paymentId: string, _amountFen: number): Promise<void> {
    return;
  }
}
