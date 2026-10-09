/**
 * MockPayProvider —— 开发/演示用支付实现（§4.7：仅演示用，禁止上生产）
 *
 * - createPayment：立即返回成功（不调任何外部接口），paymentId = 'mock_' + ULID，
 *   payParams = { mock: '1', orderId, scenario }；前端随后调 POST /api/pay/mock-callback
 *   完成演示闭环（见 routes/payCallback.ts）。
 * - 批次 6 补缺大批：通道四态模拟——payParams 带 scenario 位
 *   （success/fail/timeout/drop，默认 success；setMockScenarioForTest 全局覆盖 +
 *   env MOCK_SCENARIO 双通道可控）；通道侧状态落内存账本（mockChannelLedger），
 *   queryOrder 回读供 reconcile「付了没开」自助补开（drop=通道已付回调丢失场景）。
 * - verifyCallback：模拟平台回调的本地 HMAC-SHA256 验签——
 *   签名头 x-mock-signature = HMAC_SHA256(rawBody, MOCK_PAY_SECRET) hex，
 *   与真实微信回调走同一「验签 → 解析 → 业务处理」路径，便于联调与测试篡改场景。
 * - refund：v1 占位，直接成功。
 *
 * 生产隔离由 provider.ts 的 assertPaymentConfig() 强制（生产禁 mock，启动报错）。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';
import type { PaymentProvider } from './types'; // 契约件（循环依赖开环：原指 provider 工厂件）

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

/* ------------------------------------------------------------------ */
/* 批次 6 补缺大批：Mock 通道四态模拟（success / fail / timeout / drop）     */
/* ------------------------------------------------------------------ */

/** Mock 演示场景：success 通道支付成功（回调送达）| fail 通道支付失败 | timeout 用户不付（留 paying 待 sweeper 关单）| drop 通道已付但回调丢失（掉单，reconcile 自助补开） */
export type MockScenario = 'success' | 'fail' | 'timeout' | 'drop';

/** 通道侧状态：created 已下单未付 | paid 通道已扣款 | failed 通道支付失败 */
export type MockChannelStatus = 'created' | 'paid' | 'failed';

interface MockChannelEntry {
  orderId: string;
  totalFen: number;
  scenario: MockScenario;
  channelStatus: MockChannelStatus;
}

/** 环境变量 MOCK_SCENARIO（演示全局可控）；优先级：createPayment 入参 > setMockScenarioForTest > env > 'success' */
const ENV_SCENARIO = ((): MockScenario | null => {
  const raw = (process.env.MOCK_SCENARIO ?? '').trim();
  return raw === 'success' || raw === 'fail' || raw === 'timeout' || raw === 'drop' ? raw : null;
})();

let scenarioOverride: MockScenario | null = null;

/** 仅供测试/演示：设置 mock 场景全局覆盖（null=清除，回退 env MOCK_SCENARIO / 默认 success） */
export function setMockScenarioForTest(s: MockScenario | null): void {
  scenarioOverride = s;
}

/** 当前生效场景（createPayment 未显式指定时） */
export function currentMockScenario(): MockScenario {
  return scenarioOverride ?? ENV_SCENARIO ?? 'success';
}

/**
 * mock 通道侧账本（内存，单进程）：createPayment 登记，mock-callback 演示端点按场景
 * 推进通道状态，queryOrder 回读（reconcile 掉单补偿的依据）。
 * 边界：进程重启丢失 → queryOrder 一律 unpaid（开发骨架可接受；真通道接微信查单 API）。
 */
const mockChannelLedger = new Map<string, MockChannelEntry>();

/** 读 mock 通道侧账本行（演示端点判场景/状态用；未登记 → undefined） */
export function getMockChannelEntry(paymentId: string): MockChannelEntry | undefined {
  return mockChannelLedger.get(paymentId);
}

/** 推进 mock 通道侧状态（演示端点用：success/drop → paid；fail → failed） */
export function setMockChannelStatus(paymentId: string, status: MockChannelStatus): void {
  const entry = mockChannelLedger.get(paymentId);
  if (entry) entry.channelStatus = status;
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
    // mock 立即返回成功：无外部调用；payParams 标记 mock=1 供前端识别走演示回调，
    // scenario 位透出当前演示场景（四态：success/fail/timeout/drop，批次 6 补缺大批）
    const paymentId = `mock_${ulid()}`;
    const scenario = currentMockScenario();
    mockChannelLedger.set(paymentId, {
      orderId: order.orderId,
      totalFen: order.totalFen,
      scenario,
      channelStatus: 'created',
    });
    return {
      paymentId,
      payParams: { mock: '1', orderId: order.orderId, scenario },
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

  /** 查单：回本地通道侧账本（reconcile 掉单补偿依据；进程重启丢失 → unpaid） */
  async queryOrder(
    paymentId: string,
  ): Promise<{ paymentId: string; status: 'paid' | 'unpaid'; paidFen?: number }> {
    const entry = mockChannelLedger.get(paymentId);
    if (entry?.channelStatus === 'paid') {
      return { paymentId, status: 'paid', paidFen: entry.totalFen };
    }
    return { paymentId, status: 'unpaid' };
  }

  /** v1 占位：mock 退款直接成功（真实退款留待微信支付接入后实现） */
  async refund(_paymentId: string, _amountFen: number): Promise<void> {
    return;
  }
}
