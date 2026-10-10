/**
 * 线上支付单回调原生端点（批次 6 补缺大批 · server 侧收单骨架）
 *
 * 两个端点（工艺逐字照 routes/payCallback.ts mall 同款）：
 * - POST /api/pay/orders/callback      支付平台回调入口（生产微信 / 内测 mock 同一路径，
 *   无登录态依赖，验签即鉴权）：provider.verifyCallback 验签（Mock 也走 HMAC 验签流程）
 *   → 支付单存在性 → 金额核对 → 事务（条件推进 created/paying→paid + callbackJson 存档
 *   + 同事务兑付 membership_open/membership_upgrade → memberships 写行/换档 +
 *   SSE user 频道 membership.opened/membership.upgraded）。
 * - POST /api/pay/orders/mock-callback mock 客户端驱动端点（仅 PAYMENT_PROVIDER=mock 时暴露，
 *   生产 404）：需登录且仅本人支付单；scenario 四态可选——
 *   success=服务端按平台口径构造并签名回调，走与真实回调完全相同的验签/业务处理路径；
 *   fail=通道支付失败 → status='failed' 留痕；timeout=用户不付，留 paying 待 sweeper 关单；
 *   drop=通道已扣款但回调丢弃不发（掉单场景，reconcile 自助补开坐实）。
 *
 * 资金安全口径（§4.7 同 mall 回调）：
 * - 验签失败 / 金额不符 → 明确拒绝（4xx）+ console.error 告警日志，绝不进业务写库；
 * - 幂等：事务内 UPDATE ... WHERE status IN ('created','paying') 条件更新，影响行数=0：
 *   已 paid=重复投递零副作用（不重复兑付/不发事件）；closed/failed=状态机非法迁移 400 硬拒。
 */

import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import {
  getMockChannelEntry,
  MOCK_SIGNATURE_HEADER,
  setMockChannelStatus,
  signMockCallback,
  type MockScenario,
} from '../payments/mockPay';
import { resolvePaymentProvider, type PaymentProvider } from '../payments/provider';
import { settlePayOrderPaid } from '../routers/pay';
import { withOrderWriteLock } from '../routers/mall';

/** 会话用户（结构对齐契约 1 SessionUser；仅 mock 演示端点做归属校验用） */
export interface SessionUserLike {
  id: string;
  nickname?: string | null;
  roles?: string[];
  staffId?: string;
  storeId?: string;
}

type PayEnv = { Variables: { sessionUser?: SessionUserLike | null } };

type Db = typeof db;
type NamedProvider = PaymentProvider & { readonly name: string };

/** 回调处理统一错误：携带 HTTP 状态与机器可读 code */
export class PayOrderCallbackError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface PayOrderCallbackResult {
  orderId: string;
  payNo: string;
  /** true = 重复投递幂等命中（未产生新兑付/新事件） */
  idempotent: boolean;
}

/**
 * 回调处理核心（平台回调端点与 mock 演示端点共用；冒烟/e2e 亦可直接调用）：
 * 验签（Mock 也走 HMAC 流程，绝不绕过）→ settlePayOrderPaid（存在性/金额核对/
 * 状态机条件推进 + 同事务兑付，内核在 routers/pay.ts）。
 */
export async function processPayOrderCallback(
  d: Db,
  provider: NamedProvider,
  headers: Record<string, string>,
  rawBody: string,
): Promise<PayOrderCallbackResult> {
  /* ---- 1. 验签 + 解析（失败 = 拒绝 + 告警，绝不进业务写库） ---- */
  let verified: { paymentId: string; orderId: string; paidFen: number };
  try {
    verified = await provider.verifyCallback(headers, rawBody);
  } catch (err) {
    console.error(`[pay] ALERT 支付单回调验签失败 provider=${provider.name}:`, err);
    throw new PayOrderCallbackError(400, 'INVALID_SIGNATURE', '回调验签失败');
  }

  /* ---- 2. 回调原文存档（同事务随状态推进落 callbackJson） ---- */
  let rawJson: unknown = null;
  try {
    rawJson = JSON.parse(rawBody);
  } catch {
    /* 原文非 JSON：以 { raw } 形式留档 */
  }
  const callbackJson =
    rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)
      ? (rawJson as Record<string, unknown>)
      : { raw: rawBody };

  /* ---- 3. 存在性/金额核对/状态机推进 + 同事务兑付（内核共用） ---- */
  try {
    const r = await settlePayOrderPaid(d, {
      orderId: verified.orderId,
      paymentId: verified.paymentId,
      paidFen: verified.paidFen,
      callbackJson,
      via: 'callback',
    });
    return { orderId: r.order.id, payNo: r.order.payNo, idempotent: r.idempotent };
  } catch (err) {
    /* TRPCError → 回调 4xx 语义映射（NOT_FOUND=404，其余=400 硬拒） */
    if (err instanceof TRPCError) {
      const httpStatus = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      const code =
        err.code === 'NOT_FOUND'
          ? 'ORDER_NOT_FOUND'
          : err.message.includes('AMOUNT_MISMATCH')
            ? 'AMOUNT_MISMATCH'
            : err.message.includes('STATE_CONFLICT')
              ? 'STATE_CONFLICT'
              : 'BAD_REQUEST';
      throw new PayOrderCallbackError(httpStatus, code, err.message);
    }
    throw err;
  }
}

/** 统一错误映射（PayOrderCallbackError → 对应 4xx；未知异常 → 500 + 日志） */
function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof PayOrderCallbackError) {
    return c.json({ code: err.code, message: err.message }, err.httpStatus as ContentfulStatusCode);
  }
  console.error('[pay] 支付单回调处理异常:', err);
  return c.json({ code: 'INTERNAL', message: '回调处理失败' }, 500);
}

const MOCK_SCENARIOS: ReadonlyArray<MockScenario> = ['success', 'fail', 'timeout', 'drop'];

export const payOrdersCallbackRoute = new Hono<PayEnv>()
  /**
   * 支付平台回调（无登录态）：验签即鉴权。
   * 成功应答对齐微信 v3 口径 { code: 'SUCCESS' }（幂等命中同构，附 idempotent 标记）。
   */
  .post('/api/pay/orders/callback', async (c) => {
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    try {
      const provider = await resolvePaymentProvider(db); // 平台回调=当前切换通道验签（片 1 切换闸）
      const result = await processPayOrderCallback(db, provider, headers, rawBody);
      return c.json({ code: 'SUCCESS', ...result }, 200);
    } catch (err) {
      return errorResponse(c, err);
    }
  })
  /**
   * mock 客户端驱动端点：前端 createOrder 拿到 { paymentId, payParams:{mock:'1',scenario} } 后调用，
   * 按场景模拟通道行为完成演示闭环。仅 mock 模式暴露；需登录且仅本人在途支付单。
   * 入参 JSON：{ orderId: string, scenario?: 'success'|'fail'|'timeout'|'drop' }
   * （scenario 缺省=createPayment 时 payParams 快照的场景，再缺省 'success'）。
   */
  .post('/api/pay/orders/mock-callback', async (c) => {
    const provider = await resolvePaymentProvider(db);
    if (provider.name !== 'mock') {
      // 真通道模式绝不暴露演示入口（片 1 切换闸口径）
      return c.json({ code: 'NOT_FOUND', message: 'Not Found' }, 404);
    }
    const user = c.get('sessionUser');
    if (!user?.id) {
      return c.json({ code: 'UNAUTHORIZED', message: '请先登录' }, 401);
    }
    let body: { orderId?: unknown; scenario?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: 'BAD_REQUEST', message: '请求体须为 JSON' }, 400);
    }
    if (typeof body.orderId !== 'string' || !body.orderId) {
      return c.json({ code: 'BAD_REQUEST', message: 'orderId 缺失' }, 400);
    }
    const scenario =
      typeof body.scenario === 'string' && (MOCK_SCENARIOS as readonly string[]).includes(body.scenario)
        ? (body.scenario as MockScenario)
        : null;

    const order = await db
      .select()
      .from(schema.payOrders)
      .where(eq(schema.payOrders.id, body.orderId))
      .get();
    if (!order) return c.json({ code: 'NOT_FOUND', message: '支付单不存在' }, 404);
    // 归属：会员域（membership_open/membership_upgrade）biz_id=users.id（与 routers/pay.ts assertPayOrderOwnership 同口径）
    if (
      !((order.bizDomain === 'membership_open' || order.bizDomain === 'membership_upgrade') && order.bizId === user.id)
    ) {
      return c.json({ code: 'FORBIDDEN', message: '只能支付本人支付单' }, 403);
    }
    if (order.status === 'paid') {
      // 幂等友好：已支付重复演示直接返回成功（与真实回调幂等口径一致）
      return c.json({ code: 'SUCCESS', orderId: order.id, payNo: order.payNo, idempotent: true }, 200);
    }
    if (order.status !== 'created' && order.status !== 'paying') {
      // 状态机非法迁移硬拒：closed/failed 再支付一律拒
      return c.json(
        { code: 'STATE_CONFLICT', message: `当前状态（${order.status}）不可支付（状态机非法迁移硬拒）` },
        400,
      );
    }
    if (!order.paymentId) {
      return c.json({ code: 'BAD_REQUEST', message: '通道未下单（created），无 paymentId 可演示' }, 400);
    }

    const entry = getMockChannelEntry(order.paymentId);
    const effectiveScenario: MockScenario = scenario ?? entry?.scenario ?? 'success';

    /* ---- 四态通道行为 ---- */
    if (effectiveScenario === 'timeout') {
      // 用户不付：通道状态不动，留 paying 待 sweeper（pay_timeout_minutes 端口）关单
      return c.json({ code: 'SUCCESS', orderId: order.id, payNo: order.payNo, scenario: 'timeout', idempotent: false }, 200);
    }
    if (effectiveScenario === 'drop') {
      // 掉单：通道已扣款（账本置 paid）但回调丢弃不发 → reconcile 自助补开坐实
      setMockChannelStatus(order.paymentId, 'paid');
      return c.json({ code: 'SUCCESS', orderId: order.id, payNo: order.payNo, scenario: 'drop', idempotent: false }, 200);
    }
    if (effectiveScenario === 'fail') {
      // 通道支付失败：账本置 failed + 支付单条件推进 failed（留痕；幂等零副作用）
      setMockChannelStatus(order.paymentId, 'failed');
      await withOrderWriteLock(() =>
        db.transaction(async (tx) => {
          await tx
            .update(schema.payOrders)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(
              and(
                eq(schema.payOrders.id, order.id),
                inArray(schema.payOrders.status, ['created', 'paying']),
              ),
            );
        }),
      );
      const current = await db
        .select()
        .from(schema.payOrders)
        .where(eq(schema.payOrders.id, order.id))
        .get();
      return c.json(
        { code: 'SUCCESS', orderId: order.id, payNo: order.payNo, scenario: 'fail', status: current?.status ?? 'failed', idempotent: false },
        200,
      );
    }

    /* success：通道置 paid + 服务端按平台口径构造回调并签名，再走与真实回调完全相同的处理路径 */
    setMockChannelStatus(order.paymentId, 'paid');
    const rawBody = JSON.stringify({
      paymentId: order.paymentId,
      orderId: order.id,
      paidFen: order.amountFen,
    });
    const headers = { [MOCK_SIGNATURE_HEADER]: signMockCallback(rawBody) };
    try {
      const result = await processPayOrderCallback(db, provider, headers, rawBody);
      return c.json({ code: 'SUCCESS', scenario: 'success', ...result }, 200);
    } catch (err) {
      return errorResponse(c, err);
    }
  });
