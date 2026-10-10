/**
 * MockPayProvider —— 开发/演示用支付实现（§4.7：仅演示用，禁止上生产）
 *
 * - createOrder：立即返回成功（不调任何外部接口），paymentId = 'mock_' + ULID，
 *   payParams = { mock: '1', orderId, scenario }；前端随后调 POST /api/pay/mock-callback
 *   完成演示闭环（见 routes/payCallback.ts）。
 * - 批次 6 补缺大批：通道四态模拟——payParams 带 scenario 位
 *   （success/fail/timeout/drop，默认 success；setMockScenarioForTest 全局覆盖 +
 *   env MOCK_SCENARIO 双通道可控）；通道侧状态落内存账本（mockChannelLedger），
 *   queryOrder 回读供 reconcile「付了没开」自助补开（drop=通道已付回调丢失场景）。
 * - verifyCallback：模拟平台回调的本地 HMAC-SHA256 验签——
 *   签名头 x-mock-signature = HMAC_SHA256(rawBody, MOCK_PAY_SECRET) hex，
 *   与真实微信回调走同一「验签 → 解析 → 业务处理」路径，便于联调与测试篡改场景。
 * - refund（产品-1010 片 1 接口族收敛）：记通道账本退款行（refundNo 幂等键留痕），
 *   返回 { refundId, status:'success' }；超原单金额/未支付单=拒（同真通道口径）。
 * - close（产品-1010 片 1 接口族新增）：通道账本置 'closed'——仅 created（未支付）可关，
 *   paid/failed=拒（微信/支付宝同口径：仅未支付单可关）；重复关=幂等放行。
 *
 * 生产隔离由 provider.ts 的 assertPaymentConfig() 强制（生产禁 mock，启动报错）。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';
import type {
  CreateOrderInput,
  CreateOrderResult,
  PaymentProvider,
  QueryOrderResult,
  RefundInput,
  RefundResult,
  VerifiedPayment,
} from './provider';

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

/** 通道侧状态：created 已下单未付 | paid 通道已扣款 | failed 通道支付失败 | closed 通道已关单（片 1 接口族⑤） */
export type MockChannelStatus = 'created' | 'paid' | 'failed' | 'closed';

/** mock 通道退款行（refundNo=幂等键留痕；同号重试只记一行——微信 out_refund_no/支付宝 out_request_no 同口径） */
export interface MockChannelRefund {
  refundNo: string;
  refundId: string;
  amountFen: number;
  at: Date;
}

interface MockChannelEntry {
  orderId: string;
  totalFen: number;
  scenario: MockScenario;
  channelStatus: MockChannelStatus;
  refunds: MockChannelRefund[];
}

/** 环境变量 MOCK_SCENARIO（演示全局可控）；优先级：createOrder 入参 > setMockScenarioForTest > env > 'success' */
const ENV_SCENARIO = ((): MockScenario | null => {
  const raw = (process.env.MOCK_SCENARIO ?? '').trim();
  return raw === 'success' || raw === 'fail' || raw === 'timeout' || raw === 'drop' ? raw : null;
})();

let scenarioOverride: MockScenario | null = null;

/** 仅供测试/演示：设置 mock 场景全局覆盖（null=清除，回退 env MOCK_SCENARIO / 默认 success） */
export function setMockScenarioForTest(s: MockScenario | null): void {
  scenarioOverride = s;
}

/** 当前生效场景（createOrder 未显式指定时） */
export function currentMockScenario(): MockScenario {
  return scenarioOverride ?? ENV_SCENARIO ?? 'success';
}

/**
 * mock 通道侧账本（内存，单进程）：createOrder 登记，mock-callback 演示端点按场景
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
  async createOrder(order: CreateOrderInput): Promise<CreateOrderResult> {
    // mock 立即返回成功：无外部调用；payParams 标记 mock=1 供前端识别走演示回调，
    // scenario 位透出当前演示场景（四态：success/fail/timeout/drop，批次 6 补缺大批）
    const paymentId = `mock_${ulid()}`;
    const scenario = currentMockScenario();
    mockChannelLedger.set(paymentId, {
      orderId: order.orderId,
      totalFen: order.totalFen,
      scenario,
      channelStatus: 'created',
      refunds: [],
    });
    return {
      paymentId,
      payParams: { mock: '1', orderId: order.orderId, scenario },
    };
  }

  async verifyCallback(
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<VerifiedPayment> {
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
  async queryOrder(paymentId: string): Promise<QueryOrderResult> {
    const entry = mockChannelLedger.get(paymentId);
    if (entry?.channelStatus === 'paid') {
      return { paymentId, status: 'paid', paidFen: entry.totalFen };
    }
    if (entry?.channelStatus === 'closed') {
      return { paymentId, status: 'closed' };
    }
    return { paymentId, status: 'unpaid' };
  }

  /**
   * 退款（片 1 接口族收敛）：记通道账本退款行并返回 refundId。
   * 同真通道口径：通道侧未支付/无此单 → 拒；单笔金额 ≤0 或累计退款超原单总额 → 拒；
   * refundNo 幂等键——同号重试直接返回原 refundId（重试同号只退一笔）。
   */
  async refund(refund: RefundInput): Promise<RefundResult> {
    const entry = mockChannelLedger.get(refund.paymentId);
    if (!entry) throw new Error('mock 通道退款失败：通道侧无此支付单（未下单）');
    if (entry.channelStatus !== 'paid') {
      throw new Error(`mock 通道退款失败：通道侧未支付（当前 ${entry.channelStatus}，同真通道口径拒）`);
    }
    const dup = entry.refunds.find((r) => r.refundNo === refund.refundNo);
    if (dup) return { refundId: dup.refundId, status: 'success' };
    if (!Number.isInteger(refund.amountFen) || refund.amountFen <= 0) {
      throw new Error('mock 通道退款失败：退款金额非法（须为正整数分）');
    }
    const refundedFen = entry.refunds.reduce((s, r) => s + r.amountFen, 0);
    if (refund.amountFen + refundedFen > entry.totalFen) {
      throw new Error('mock 通道退款失败：累计退款超原单总额（同真通道口径拒）');
    }
    const refundId = `mock_rf_${ulid()}`;
    entry.refunds.push({ refundNo: refund.refundNo, refundId, amountFen: refund.amountFen, at: new Date() });
    return { refundId, status: 'success' };
  }

  /**
   * 关单（片 1 接口族⑤新增）：通道账本置 'closed'。
   * 同真通道口径：仅 created（未支付）可关；paid/failed=拒；重复关已闭单=幂等放行；
   * 按 orderId 反查（业务侧关单只持业务单号；通道侧映射在账本行内）。
   */
  async close(order: { orderId: string }): Promise<void> {
    const entry = [...mockChannelLedger.values()].find((e) => e.orderId === order.orderId);
    if (!entry) throw new Error('mock 通道关单失败：通道侧无此单（未下单）');
    if (entry.channelStatus === 'closed') return; // 重复关单幂等
    if (entry.channelStatus !== 'created') {
      throw new Error(`mock 通道关单失败：通道侧为 ${entry.channelStatus}（仅未支付单可关，同真通道口径）`);
    }
    entry.channelStatus = 'closed';
  }
}
