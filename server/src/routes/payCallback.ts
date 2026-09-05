/**
 * 支付回调原生端点（P5 T5.1 · coder-mall-server 名下文件）
 *
 * 两个端点（均无登录态依赖，验签即鉴权；T1.6 集成时 app.route('/', payCallbackRoute) 挂载）：
 * - POST /api/pay/callback      支付平台回调入口（生产微信 / 开发 mock 同一路径）：
 *   provider.verifyCallback 验签 → 订单存在性 → 金额核对 → 幂等 → 事务
 *   （订单 pending→paid + payments 流水 + order.paid 事件落 outbox）。
 * - POST /api/pay/mock-callback mock 演示端点（仅 PAYMENT_PROVIDER=mock 时暴露，
 *   生产 404）：需登录且仅本人订单；服务端按平台口径构造并签名一份回调，再走与
 *   真实回调完全相同的验签/业务处理路径——演示链路不绕过任何校验。
 *
 * 资金安全口径（§4.7 / §6.2 mall.payCallback）：
 * - 验签失败 / 金额不符 → 明确拒绝（4xx）+ console.error 告警日志，绝不进业务写库；
 * - 幂等：事务内 UPDATE ... WHERE status='pending' 条件更新，影响行数=0（已 paid 的
 *   重复投递）→ 直接返回成功，不产生重复流水/重复事件。
 */

import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { getPaymentProvider, type PaymentProvider } from '../payments/provider';
import { MOCK_SIGNATURE_HEADER, signMockCallback } from '../payments/mockPay';
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
export class PayCallbackError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface PayCallbackResult {
  orderId: string;
  orderNo: string;
  /** true = 重复投递幂等命中（未产生新流水/新事件） */
  idempotent: boolean;
}

/**
 * 回调处理核心（两个端点共用；冒烟脚本亦直接调用）：
 * 验签 → 订单存在 → 金额核对 → 事务（条件更新置 paid + payments 流水 + order.paid 事件）。
 */
export async function processPayCallback(
  d: Db,
  provider: NamedProvider,
  headers: Record<string, string>,
  rawBody: string,
): Promise<PayCallbackResult> {
  /* ---- 1. 验签 + 解析（失败 = 拒绝 + 告警，绝不进业务写库） ---- */
  let verified: { paymentId: string; orderId: string; paidFen: number };
  try {
    verified = await provider.verifyCallback(headers, rawBody);
  } catch (err) {
    console.error(`[pay] ALERT 回调验签失败 provider=${provider.name}:`, err);
    throw new PayCallbackError(400, 'INVALID_SIGNATURE', '回调验签失败');
  }

  /* ---- 2. 订单存在性 ---- */
  const order = await d
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, verified.orderId))
    .get();
  if (!order) {
    console.error(
      `[pay] ALERT 回调指向不存在订单 orderId=${verified.orderId} paymentId=${verified.paymentId}`,
    );
    throw new PayCallbackError(404, 'ORDER_NOT_FOUND', '回调订单不存在');
  }

  /* ---- 3. 金额核对（防篡改/对账红线）：不符即拒绝 + 告警，订单不动 ---- */
  if (verified.paidFen !== order.totalFen) {
    console.error(
      `[pay] ALERT 回调金额不符：order=${order.id} 应付=${order.totalFen}fen 实报=${verified.paidFen}fen paymentId=${verified.paymentId}`,
    );
    throw new PayCallbackError(400, 'AMOUNT_MISMATCH', '回调金额与订单金额不符');
  }

  /* ---- 4. 事务：pending→paid（幂等闸）+ 支付流水 + 事件 ---- */
  let rawJson: unknown = null;
  try {
    rawJson = JSON.parse(rawBody);
  } catch {
    /* 原文非 JSON：流水 raw_callback 以 { raw } 形式留档 */
  }
  const rawCallback =
    rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)
      ? (rawJson as Record<string, unknown>)
      : { raw: rawBody };

  const now = new Date();
  let outboxId = '';
  let outboxId2 = '';
  // 与 createOrder 同锁串行进入写事务（libsql 单连接并发事务会中毒连接，见 mall.ts 注释）
  const txResult = await withOrderWriteLock(() =>
    d.transaction(async (tx) => {
    // SQLite 单写者（叠加应用层串行锁）：事务即行锁。条件更新影响行数=0 ⇒ 已非 pending（含重复投递）
    const updated = await tx
      .update(schema.orders)
      .set({ status: 'paid', updatedAt: now })
      .where(and(eq(schema.orders.id, order.id), eq(schema.orders.status, 'pending')))
      .returning();
    if (updated.length === 0) {
      // 幂等：订单已 paid（重复回调）→ 直接成功，不写流水、不发事件
      const current = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, order.id))
        .get();
      return { order: current!, idempotent: true };
    }
    await tx.insert(schema.payments).values({
      orderId: order.id,
      provider: provider.name,
      paymentId: verified.paymentId,
      amountFen: verified.paidFen,
      status: 'paid',
      rawCallback,
    });
    outboxId = await emitEvent(
      tx as unknown as Parameters<typeof emitEvent>[0],
      `user:${order.customerId}`,
      EventType.OrderPaid,
      {
        orderId: order.id,
        orderNo: order.orderNo,
        totalFen: order.totalFen,
        paymentId: verified.paymentId,
        provider: provider.name,
      },
    );
    // 同投商家频道：商家端待发货红点/新单 toast 实时可达（T5.4 集成补）
    outboxId2 = await emitEvent(
      tx as unknown as Parameters<typeof emitEvent>[0],
      `store:${order.storeId}`,
      EventType.OrderPaid,
      {
        orderId: order.id,
        orderNo: order.orderNo,
        totalFen: order.totalFen,
        paymentId: verified.paymentId,
        provider: provider.name,
      },
    );
    return { order: updated[0]!, idempotent: false };
    }),
  );
  if (outboxId) broadcastNow(outboxId);
  if (outboxId2) broadcastNow(outboxId2);
  return { orderId: txResult.order.id, orderNo: txResult.order.orderNo, idempotent: txResult.idempotent };
}

/** 统一错误映射（PayCallbackError → 对应 4xx；未知异常 → 500 + 日志） */
function errorResponse(c: Context, err: unknown): Response {
  if (err instanceof PayCallbackError) {
    return c.json({ code: err.code, message: err.message }, err.httpStatus as ContentfulStatusCode);
  }
  console.error('[pay] 回调处理异常:', err);
  return c.json({ code: 'INTERNAL', message: '回调处理失败' }, 500);
}

export const payCallbackRoute = new Hono<PayEnv>()
  /**
   * 支付平台回调（无登录态）：验签即鉴权。
   * 成功应答对齐微信 v3 口径 { code: 'SUCCESS' }（幂等命中同构，附 idempotent 标记）。
   */
  .post('/api/pay/callback', async (c) => {
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });
    try {
      const provider = getPaymentProvider();
      const result = await processPayCallback(db, provider, headers, rawBody);
      return c.json({ code: 'SUCCESS', ...result }, 200);
    } catch (err) {
      return errorResponse(c, err);
    }
  })
  /**
   * mock 演示端点：前端 createPayment 拿到 { paymentId, payParams:{mock:'1'} } 后调用，
   * 模拟「平台回调」完成支付闭环。仅 mock 模式暴露；需登录且仅本人 pending 订单。
   * 入参 JSON：{ orderId: string, paymentId?: string }（缺省自动生成 mock_ 单号）。
   */
  .post('/api/pay/mock-callback', async (c) => {
    const provider = getPaymentProvider();
    if (provider.name !== 'mock') {
      // 生产（微信）模式绝不暴露演示入口
      return c.json({ code: 'NOT_FOUND', message: 'Not Found' }, 404);
    }
    const user = c.get('sessionUser');
    if (!user?.id) {
      return c.json({ code: 'UNAUTHORIZED', message: '请先登录' }, 401);
    }
    let body: { orderId?: unknown; paymentId?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ code: 'BAD_REQUEST', message: '请求体须为 JSON' }, 400);
    }
    if (typeof body.orderId !== 'string' || !body.orderId) {
      return c.json({ code: 'BAD_REQUEST', message: 'orderId 缺失' }, 400);
    }
    const order = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, body.orderId))
      .get();
    if (!order) return c.json({ code: 'NOT_FOUND', message: '订单不存在' }, 404);
    if (order.customerId !== user.id) {
      return c.json({ code: 'FORBIDDEN', message: '只能支付本人订单' }, 403);
    }
    if (order.status === 'paid') {
      // 幂等友好：已支付订单重复演示直接返回成功（与真实回调幂等口径一致）
      return c.json({ code: 'SUCCESS', orderId: order.id, orderNo: order.orderNo, idempotent: true }, 200);
    }
    if (order.status !== 'pending') {
      return c.json({ code: 'BAD_REQUEST', message: `当前状态（${order.status}）不可支付` }, 400);
    }
    const paymentId =
      typeof body.paymentId === 'string' && body.paymentId ? body.paymentId : `mock_${ulid()}`;
    // 服务端按平台口径构造回调并签名，再走与真实回调完全相同的处理路径
    const rawBody = JSON.stringify({ paymentId, orderId: order.id, paidFen: order.totalFen });
    const headers = { [MOCK_SIGNATURE_HEADER]: signMockCallback(rawBody) };
    try {
      const result = await processPayCallback(db, provider, headers, rawBody);
      return c.json({ code: 'SUCCESS', ...result }, 200);
    } catch (err) {
      return errorResponse(c, err);
    }
  });
