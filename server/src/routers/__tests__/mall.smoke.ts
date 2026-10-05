/**
 * T5.1 冒烟脚本：mall router + 支付适配层（商城全链路，无任何 mock 中间态残留）
 *
 * 运行：npx tsx src/routers/__tests__/mall.smoke.ts
 *
 * 隔离策略：独立临时库（PHILIA_DB_URL → %TMP% 临时目录，启动时跑迁移 + 自建夹具），
 * 全程不触碰 server/data/philia.db；PAYMENT_PROVIDER=mock + 固定 MOCK_PAY_SECRET
 * （冒烟可自算回调签名）；结束后删除临时目录清场。
 *
 * 覆盖：
 * 1. 商品目录：keyword/category/分页/仅上架；upsertProduct 新增/编辑/上下架；越店编辑 FORBIDDEN
 * 2. createOrder：合并同商品行、库存正确扣减、服务端金额口径、订单号格式、快照含
 *    name/priceFen/image；下架商品/超量/跨店拒绝；order.created 事件
 * 3. 防超卖：库存 1 件两人并发 createOrder → 仅一单成功（另一单 CONFLICT），stock=0
 * 4. 支付闭环（mock）：createPayment → 篡改签名被拒 / 金额不符被拒（订单仍 pending、
 *    无流水）→ mock-callback → 订单 paid + payments 流水 + order.paid 事件/通知齐
 * 5. 幂等：回调重复投递（演示端点 + 原始回调端点各一次）→ 成功且无重复流水/事件
 * 6. 状态机：shipOrder（paid→shipped + tracking_no + order.shipped）→
 *    receiveOrder（shipped→received + order.received）；错态拒绝
 * 7. 越权：他人订单 createPayment / mock-callback、越店 shipOrder → FORBIDDEN
 * 8. 支付配置启动校验：生产 + mock 报错；wechat 缺 env 报错
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：独立临时库 + mock 支付（固定密钥便于自算签名）
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-mall-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;
process.env.PAYMENT_PROVIDER = 'mock';
process.env.MOCK_PAY_SECRET = 'smoke-mock-pay-secret';

/* ------------------------------ 小工具 ------------------------------ */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

/** 断言 Promise 以指定 TRPCError code 拒绝（可选消息正则） */
async function rejects(p: Promise<unknown>, code: string, msgRe?: RegExp): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return err.code === code && (!msgRe || msgRe.test(err.message ?? ''));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ 主流程 ------------------------------ */

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  const { and, eq } = await import('drizzle-orm');
  type Context = import('../../trpc').Context;
  type OrderItemSnapshot = import('../mall').OrderItemSnapshot;
  type SessionUserLike = import('../../routes/payCallback').SessionUserLike;
  const { mallRouter } = await import('../mall');
  const { payCallbackRoute } = await import('../../routes/payCallback');
  const { signMockCallback, MOCK_SIGNATURE_HEADER } = await import('../../payments/mockPay');
  const { assertPaymentConfig, resetPaymentProviderForTest } = await import('../../payments/provider');
  const { EventType } = await import('../../realtime/events');
  const { Hono } = await import('hono');

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具数据 ---------- */
  await db.insert(schema.users).values([
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号' },
    { id: 'u-c2', kimiId: 'k-c2', nickname: '客户二号' },
    { id: 'u-m', kimiId: 'k-m', nickname: '一号店主' },
    { id: 'u-m2', kimiId: 'k-m2', nickname: '二号店主' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-c2', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-m2', role: 'merchant_owner' },
  ]);
  await db.insert(schema.stores).values([
    { id: 's-1', ownerId: 'u-m', name: '冒烟一号店', status: 'active' },
    { id: 's-2', ownerId: 'u-m2', name: '冒烟二号店', status: 'active' },
  ]);
  await db.insert(schema.products).values([
    { id: 'pd-a', storeId: 's-1', category: '主粮', name: '鸡肉配方主粮', description: '全期犬猫适用', images: ['a.jpg'], priceFen: 10000, stock: 5, status: 'on' },
    { id: 'pd-b', storeId: 's-1', category: '零食', name: '冻干零食', description: '高蛋白', images: ['b.jpg'], priceFen: 2500, stock: 1, status: 'on' },
    { id: 'pd-off', storeId: 's-1', category: '玩具', name: '下架玩具', description: null, images: [], priceFen: 500, stock: 10, status: 'off' },
    { id: 'pd-x', storeId: 's-2', category: '主粮', name: '他店主粮', description: '别店的', images: ['x.jpg'], priceFen: 3000, stock: 3, status: 'on' },
  ]);

  /* ---------- Context 直注 ---------- */
  const ctxCustomer = (id: string): Context => ({ db, user: { id, nickname: null, roles: ['customer'] } });
  const ctxMerchant = (id: string, storeId: string): Context => ({
    db,
    user: { id, nickname: null, roles: ['merchant_owner'], storeId },
  });
  const c1 = mallRouter.createCaller(ctxCustomer('u-c1'));
  const c2 = mallRouter.createCaller(ctxCustomer('u-c2'));
  const m1 = mallRouter.createCaller(ctxMerchant('u-m', 's-1'));
  const m2 = mallRouter.createCaller(ctxMerchant('u-m2', 's-2'));

  /* ---------- 原生回调端点测试应用（注入 x-test-user 模拟会话） ---------- */
  const app = new Hono<{ Variables: { sessionUser?: SessionUserLike | null } }>();
  app.use('*', async (c, next) => {
    const uid = c.req.header('x-test-user');
    if (uid) c.set('sessionUser', { id: uid, nickname: null, roles: ['customer'] });
    await next();
  });
  app.route('/', payCallbackRoute);

  const ADDR = { name: '张三', phone: '13800000000', detail: '幸福小区 1 栋 101' };

  /* ---------- 事件/流水/库存查询工具 ---------- */
  const countOutbox = async (channel: string, eventType: string): Promise<number> =>
    (
      await db
        .select()
        .from(schema.eventOutbox)
        .where(and(eq(schema.eventOutbox.channel, channel), eq(schema.eventOutbox.eventType, eventType)))
    ).length;
  const paymentsOf = async (orderId: string) =>
    db.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  const stockOf = async (productId: string): Promise<number> =>
    (await db.select().from(schema.products).where(eq(schema.products.id, productId)).get())!.stock;
  const orderOf = async (orderId: string) =>
    (await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get())!;

  /* ==================== 1. 商品目录与编辑 ==================== */
  console.log('\n[1] 商品目录：过滤/搜索/分页/上下架 + 商家编辑归属');
  const byKeyword = await c1.listProducts({ keyword: '鸡肉' });
  check('keyword 搜索命中 pd-a', byKeyword.items.length === 1 && byKeyword.items[0]!.id === 'pd-a');
  const byCat = await c1.listProducts({ category: '零食' });
  check('category 过滤命中 pd-b', byCat.items.length === 1 && byCat.items[0]!.id === 'pd-b');
  const allOn = await c1.listProducts({});
  check(
    '仅上架可见（pd-off 不出现，共 3 件）',
    allOn.total === 3 && allOn.items.every((p) => p.status === 'on' && p.id !== 'pd-off'),
    allOn.items.map((p) => p.id),
  );
  const page1 = await c1.listProducts({ page: 1, pageSize: 2 });
  const page2 = await c1.listProducts({ page: 2, pageSize: 2 });
  check(
    '分页：pageSize=2 → 2+1，total=3',
    page1.items.length === 2 && page2.items.length === 1 && page1.total === 3,
  );
  const byStore = await c1.listProducts({ storeId: 's-2' });
  check('storeId 过滤仅他店商品', byStore.items.length === 1 && byStore.items[0]!.id === 'pd-x');

  const detail = await c1.getProduct({ productId: 'pd-a' });
  check('getProduct 详情（含门店名）', detail.product.id === 'pd-a' && detail.storeName === '冒烟一号店');
  check(
    '下架商品 getProduct → NOT_FOUND',
    await rejects(c1.getProduct({ productId: 'pd-off' }), 'NOT_FOUND'),
  );

  const created = await m1.upsertProduct({
    category: '清洁',
    name: '宠物湿巾',
    description: '无酒精',
    images: ['w.jpg'],
    priceFen: 1999,
    stock: 50,
    status: 'on',
  });
  check('upsertProduct 新增（本店 storeId）', created.storeId === 's-1' && created.status === 'on');
  const edited = await m1.upsertProduct({ productId: created.id, category: '清洁', name: '宠物湿巾·加厚', priceFen: 2199, stock: 0, status: 'off' });
  check(
    'upsertProduct 编辑/下架/库存编辑',
    edited.name === '宠物湿巾·加厚' && edited.priceFen === 2199 && edited.stock === 0 && edited.status === 'off',
  );
  check(
    '越店编辑商品 → FORBIDDEN',
    await rejects(
      m2.upsertProduct({ productId: 'pd-a', category: '主粮', name: '篡改', priceFen: 1, stock: 1, status: 'on' }),
      'FORBIDDEN',
      /非本店/,
    ),
  );

  /* ==================== 2. 下单与库存 ==================== */
  console.log('\n[2] createOrder：合并行/扣库存/服务端金额/快照/事件');
  const order1 = await c1.createOrder({
    items: [
      { productId: 'pd-a', qty: 2 },
      { productId: 'pd-a', qty: 1 }, // 同商品两行 → 合并 qty=3
    ],
    address: ADDR,
  });
  check(
    '下单成功：pending + 订单号 P+日期+随机（人类可读）',
    order1.status === 'pending' && /^P\d{6}[2-9A-HJKMNP-Z]{6}$/.test(order1.orderNo),
    order1.orderNo,
  );
  check('total_fen 服务端口径（3×10000=30000，不信任前端金额）', order1.totalFen === 30000, order1.totalFen);
  const snap = order1.items[0] as OrderItemSnapshot;
  check(
    'items 快照合并（qty=3）且含 name/priceFen/image',
    order1.items.length === 1 &&
      snap.quantity === 3 &&
      snap.name === '鸡肉配方主粮' &&
      snap.price_fen === 10000 &&
      snap.image === 'a.jpg',
    order1.items,
  );
  check('地址快照（receiver/phone/detail）', order1.address?.receiver === '张三' && order1.address?.detail.includes('幸福小区'));
  check('pd-a 库存 5 → 2 正确扣减', (await stockOf('pd-a')) === 2);
  check('order.created 事件落 store:s-1', (await countOutbox('store:s-1', EventType.OrderCreated)) === 1);

  check(
    '含下架商品下单 → BAD_REQUEST',
    await rejects(c1.createOrder({ items: [{ productId: 'pd-off', qty: 1 }], address: ADDR }), 'BAD_REQUEST', /已下架|不存在/),
  );
  check(
    '超库存下单（pd-a 剩 2 买 3）→ CONFLICT 库存不足',
    await rejects(c1.createOrder({ items: [{ productId: 'pd-a', qty: 3 }], address: ADDR }), 'CONFLICT', /库存不足/),
  );
  check(
    '跨店商品一单 → BAD_REQUEST',
    await rejects(
      c1.createOrder({ items: [{ productId: 'pd-a', qty: 1 }, { productId: 'pd-x', qty: 1 }], address: ADDR }),
      'BAD_REQUEST',
      /同一门店/,
    ),
  );
  check('校验失败后 pd-a 库存未被误扣（仍 2）', (await stockOf('pd-a')) === 2);

  /* ==================== 3. 并发防超卖 ==================== */
  console.log('\n[3] 防超卖：库存 1 件，两人并发 createOrder → 仅一单成功');
  const [r1, r2] = await Promise.allSettled([
    c1.createOrder({ items: [{ productId: 'pd-b', qty: 1 }], address: ADDR }),
    c2.createOrder({ items: [{ productId: 'pd-b', qty: 1 }], address: ADDR }),
  ]);
  const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
  const rejected = [r1, r2].filter((r) => r.status === 'rejected');
  const conflictOk = rejected.every((r) => {
    const err = (r as PromiseRejectedResult).reason as { code?: string; message?: string };
    return err.code === 'CONFLICT' && /库存不足/.test(err.message ?? '');
  });
  check('恰好一单成功、一单 CONFLICT「库存不足」（不超卖）', fulfilled.length === 1 && rejected.length === 1 && conflictOk, {
    ok: fulfilled.length,
    rejected: rejected.map((r) => String((r as PromiseRejectedResult).reason)),
  });
  check('pd-b 库存扣到 0（不为负）', (await stockOf('pd-b')) === 0);
  const orderB = (fulfilled[0] as PromiseFulfilledResult<{ id: string; customerId: string }>).value;
  const loser = orderB.customerId === 'u-c1' ? c2 : c1;

  /* ==================== 4. 支付闭环（mock）与拒签/拒额 ==================== */
  console.log('\n[4] createPayment → 篡改签名/金额不符被拒 → mock-callback → paid + 流水 + 事件');
  check(
    '他人订单 createPayment → FORBIDDEN',
    await rejects(c2.createPayment({ orderId: order1.id }), 'FORBIDDEN', /本人/),
  );
  check(
    '越权 mock-callback（他人订单）→ 403',
    await (async () => {
      const res = await app.request('/api/pay/mock-callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-test-user': 'u-c2' },
        body: JSON.stringify({ orderId: order1.id }),
      });
      return res.status === 403;
    })(),
  );
  check(
    '未登录 mock-callback → 401',
    await (async () => {
      const res = await app.request('/api/pay/mock-callback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order1.id }),
      });
      return res.status === 401;
    })(),
  );

  const pay1 = await c1.createPayment({ orderId: order1.id });
  check(
    'createPayment（mock）：mock_ 支付单号 + payParams 标记',
    pay1.provider === 'mock' && pay1.paymentId.startsWith('mock_') && pay1.payParams.mock === '1' && pay1.totalFen === 30000,
    pay1,
  );

  // 篡改签名：伪造 hex 签名 → 400，订单仍 pending，无流水
  const tamperedBody = JSON.stringify({ paymentId: pay1.paymentId, orderId: order1.id, paidFen: 30000 });
  const tamperRes = await app.request('/api/pay/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: '0'.repeat(64) },
    body: tamperedBody,
  });
  check('篡改签名回调被拒（400 INVALID_SIGNATURE）', tamperRes.status === 400 && ((await tamperRes.json()) as { code?: string }).code === 'INVALID_SIGNATURE');
  check('拒签后订单仍 pending 且无流水', (await orderOf(order1.id)).status === 'pending' && (await paymentsOf(order1.id)).length === 0);

  // 金额不符：签名合法但 paidFen 篡改 → 400，订单仍 pending，无流水
  const wrongAmtBody = JSON.stringify({ paymentId: pay1.paymentId, orderId: order1.id, paidFen: 999 });
  const wrongAmtRes = await app.request('/api/pay/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: signMockCallback(wrongAmtBody) },
    body: wrongAmtBody,
  });
  check('金额不符回调被拒（400 AMOUNT_MISMATCH）', wrongAmtRes.status === 400 && ((await wrongAmtRes.json()) as { code?: string }).code === 'AMOUNT_MISMATCH');
  check('拒额后订单仍 pending 且无流水', (await orderOf(order1.id)).status === 'pending' && (await paymentsOf(order1.id)).length === 0);

  // 正常演示闭环：mock-callback → paid + 流水 + order.paid 事件/通知
  const cbRes = await app.request('/api/pay/mock-callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'u-c1' },
    body: JSON.stringify({ orderId: order1.id, paymentId: pay1.paymentId }),
  });
  const cbJson = (await cbRes.json()) as { code?: string; idempotent?: boolean };
  check('mock-callback 成功（code=SUCCESS）', cbRes.status === 200 && cbJson.code === 'SUCCESS' && cbJson.idempotent === false, cbJson);
  const paid1 = await orderOf(order1.id);
  check('订单 pending → paid', paid1.status === 'paid');
  const flows1 = await paymentsOf(order1.id);
  check(
    'payments 流水 1 条（mock/30000/paid/paymentId 对齐/含回调原文）',
    flows1.length === 1 &&
      flows1[0]!.provider === 'mock' &&
      flows1[0]!.amountFen === 30000 &&
      flows1[0]!.status === 'paid' &&
      flows1[0]!.paymentId === pay1.paymentId &&
      (flows1[0]!.rawCallback as { orderId?: string })?.orderId === order1.id,
    flows1,
  );
  check('order.paid 事件落 user:u-c1', (await countOutbox('user:u-c1', EventType.OrderPaid)) === 1);
  const notices = await db
    .select()
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, 'u-c1'), eq(schema.notifications.type, EventType.OrderPaid)));
  check('u-c1 收到 order.paid 站内通知（支付成功文案）', notices.length === 1 && notices[0]!.title === '订单支付成功');

  /* ==================== 5. 回调重复投递幂等 ==================== */
  console.log('\n[5] 幂等：回调重复投递 → 成功且无重复流水/事件');
  const dup1 = await app.request('/api/pay/mock-callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'u-c1' },
    body: JSON.stringify({ orderId: order1.id, paymentId: pay1.paymentId }),
  });
  check('演示端点重复投递 → 200 且 idempotent=true', dup1.status === 200 && ((await dup1.json()) as { idempotent?: boolean }).idempotent === true);
  // 原始回调端点再投一次（模拟平台重试，paymentId 相同）
  const dupRaw = JSON.stringify({ paymentId: pay1.paymentId, orderId: order1.id, paidFen: 30000 });
  const dup2 = await app.request('/api/pay/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: signMockCallback(dupRaw) },
    body: dupRaw,
  });
  check('原始回调端点重复投递 → 200 且 idempotent=true', dup2.status === 200 && ((await dup2.json()) as { idempotent?: boolean }).idempotent === true);
  check('无重复流水（仍 1 条）', (await paymentsOf(order1.id)).length === 1);
  check('无重复 order.paid 事件（仍 1 条）', (await countOutbox('user:u-c1', EventType.OrderPaid)) === 1);
  check('已支付订单 createPayment → BAD_REQUEST', await rejects(c1.createPayment({ orderId: order1.id }), 'BAD_REQUEST', /pending/));

  /* ==================== 6. 发货 → 收货 状态机 ==================== */
  console.log('\n[6] shipOrder → receiveOrder 状态机与事件');
  check(
    '越店发货（u-m2 发 s-1 订单）→ FORBIDDEN',
    await rejects(m2.shipOrder({ orderId: order1.id, trackingNo: 'SF123456' }), 'FORBIDDEN', /非本店/),
  );
  check(
    'pending 订单不可发货（orderB 未支付）→ BAD_REQUEST',
    await rejects(m1.shipOrder({ orderId: orderB.id, trackingNo: 'SF000' }), 'BAD_REQUEST', /paid/),
  );
  const shipped = await m1.shipOrder({ orderId: order1.id, trackingNo: 'SF123456789' });
  check('发货成功：shipped + tracking_no', shipped.status === 'shipped' && shipped.trackingNo === 'SF123456789');
  check('order.shipped 事件落 user:u-c1', (await countOutbox('user:u-c1', EventType.OrderShipped)) === 1);
  check('重复发货 → BAD_REQUEST', await rejects(m1.shipOrder({ orderId: order1.id, trackingNo: 'SF999' }), 'BAD_REQUEST'));
  check('他人收货 → FORBIDDEN', await rejects(c2.receiveOrder({ orderId: order1.id }), 'FORBIDDEN', /本人/));
  const received = await c1.receiveOrder({ orderId: order1.id });
  check('确认收货：shipped → received', received.status === 'received');
  check('order.received 事件落 store:s-1', (await countOutbox('store:s-1', EventType.OrderReceived)) === 1);
  check('重复收货 → BAD_REQUEST', await rejects(c1.receiveOrder({ orderId: order1.id }), 'BAD_REQUEST'));

  /* ==================== 7. 列表分组 ==================== */
  console.log('\n[7] listMyOrders 分组 / listStoreOrders 队列');
  const mine = await c1.listMyOrders();
  check(
    'listMyOrders：六态分组齐全，received 含 order1（带门店名）',
    Object.keys(mine.groups).length === 6 &&
      mine.groups.received?.some((o) => o.id === order1.id && o.storeName === '冒烟一号店') === true,
  );
  const loserMine = await loser.listMyOrders();
  check('未抢到库存者无 pd-b 订单（groups 全空）', Object.values(loserMine.groups).every((arr) => arr.length === 0));

  // 再造一单并完成支付，验证商家端队列数据源（paid 待发货队列）
  const orderQ = await c2.createOrder({ items: [{ productId: 'pd-a', qty: 1 }], address: ADDR });
  const payQ = await c2.createPayment({ orderId: orderQ.id });
  const cbQ = await app.request('/api/pay/mock-callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-test-user': 'u-c2' },
    body: JSON.stringify({ orderId: orderQ.id, paymentId: payQ.paymentId }),
  });
  check('队列夹具：c2 下单并 mock 支付成功', cbQ.status === 200);
  const queues = await m1.listStoreOrders();
  check(
    'listStoreOrders：paid/shipped/refunding 三队列；新支付单在 paid 队列（待发货，含客户昵称）',
    Object.keys(queues.groups).sort().join(',') === 'paid,refunding,shipped' &&
      queues.groups.paid?.some((o) => o.id === orderQ.id && o.customerNickname === '客户二号') === true &&
      queues.groups.shipped?.length === 0 &&
      queues.groups.refunding?.length === 0,
    { paid: queues.groups.paid?.map((o) => o.id), shipped: queues.groups.shipped?.length },
  );
  check(
    '越店商家看不到他店队列（m2 的 s-2 队列为空）',
    await m2.listStoreOrders().then((q) => Object.values(q.groups).every((arr) => arr.length === 0)),
  );

  /* ==================== 8. 支付配置启动校验 ==================== */
  console.log('\n[8] assertPaymentConfig：生产禁 mock / wechat 缺配置报错（不静默降级）');
  const prevEnv = { NODE_ENV: process.env.NODE_ENV, PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER };
  process.env.NODE_ENV = 'production'; // 生产 + mock → 必须报错
  let prodMockThrew = false;
  try {
    assertPaymentConfig();
  } catch (e) {
    prodMockThrew = /禁止|mock/.test((e as Error).message);
  }
  process.env.NODE_ENV = prevEnv.NODE_ENV;
  check('生产构建 + PAYMENT_PROVIDER=mock → 启动报错', prodMockThrew);

  process.env.PAYMENT_PROVIDER = 'wechat'; // 缺 WECHAT_* → 构造抛错
  resetPaymentProviderForTest();
  let wechatThrew = false;
  try {
    assertPaymentConfig();
  } catch (e) {
    wechatThrew = /WECHAT_MCHID/.test((e as Error).message);
  }
  process.env.PAYMENT_PROVIDER = prevEnv.PAYMENT_PROVIDER;
  resetPaymentProviderForTest();
  check('PAYMENT_PROVIDER=wechat 缺 WECHAT_* → 启动报错（列出缺失项）', wechatThrew);
  check('开发态 mock 配置 → 校验通过', (() => { try { assertPaymentConfig(); return true; } catch { return false; } })());

  /* ==================== 清场 ==================== */
  await sleep(150); // 让 fire-and-forget 的 broadcastNow 读完落库行，避免关闭后噪音
  client.close();
  await sleep(400); // Windows 下 libsql 文件句柄释放略滞后，给删除留出余量
} catch (err) {
  failures++;
  console.error('\n[smoke] 未捕获异常：', err);
} finally {
  // 删除临时库目录（种子库从未被触碰，天然保持原样）
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (e) {
    console.warn(`[smoke] 临时目录清理失败（不影响验证结果，系统临时目录会自行回收）: ${tmpDir}`, e);
  }
}

console.log(failures === 0 ? '\n全部冒烟验证通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
