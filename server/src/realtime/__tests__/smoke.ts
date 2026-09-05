/**
 * T1.4 SSE 实时推送系统 · 冒烟验证
 *
 * 运行：npx tsx src/realtime/__tests__/smoke.ts
 *
 * 覆盖：
 * 1. emitEvent(store 频道) → event_outbox 1 行 + 该店商家 notifications 落库
 * 2. 两个内存假连接订阅同频道 → broadcastNow 后两者都收到信封
 * 3. 断线续传：replayMissed(lastEventId) → 漏掉的事件按序补发
 * 4. delivered 清扫：离线保持 0；在线后 sweepOnce 重投并置 1
 * 5. push router 四过程函数级调用（subscribe→listNotifications→markRead→unsubscribe）
 *
 * 使用独立临时库（PHILIA_DB_URL 指向 %TMP%），不污染 server/data/philia.db。
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-realtime-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return true;
    await sleep(10);
  }
  return cond();
}

/* ------------------------------ 主流程 ------------------------------ */

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  const { eq } = await import('drizzle-orm');
  const { EventType } = await import('../events');
  type EventEnvelope = import('../events').EventEnvelope;
  const bus = await import('../bus');
  const hub = await import('../hub');
  type HubConnection = import('../hub').HubConnection;
  const sweeper = await import('../outboxSweeper');
  const eventsApi = await import('../../routes/events');

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 种子数据：店主 / 店长 / 员工 / 客户 + 门店 + 预约 ---------- */
  const OWNER = 'u-owner-001';
  const MANAGER = 'u-manager-01';
  const STAFF_USER = 'u-staff-0001';
  const CUSTOMER = 'u-customer-01';
  const STORE = 'store-00001';
  const STAFF = 'staff-00001';
  const PET = 'pet-000001';
  const SERVICE = 'svc-000001';
  const APPT = 'appt-000001';

  await db.insert(schema.users).values([
    { id: OWNER, kimiId: 'k-owner', nickname: '店主' },
    { id: MANAGER, kimiId: 'k-manager', nickname: '店长' },
    { id: STAFF_USER, kimiId: 'k-staff', nickname: '店员小洗' },
    { id: CUSTOMER, kimiId: 'k-customer', nickname: '豆豆家长' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: OWNER, role: 'merchant_owner' },
    { userId: MANAGER, role: 'merchant_manager' },
    { userId: STAFF_USER, role: 'staff' },
    { userId: CUSTOMER, role: 'customer' },
  ]);
  await db.insert(schema.stores).values({ id: STORE, ownerId: OWNER, name: '菲丽亚望京店' });
  await db.insert(schema.staff).values([
    { id: STAFF, storeId: STORE, userId: STAFF_USER, name: '小洗' },
    // 店长同时是店内员工（merchant_manager 与门店的关联载体）
    { id: 'staff-mgr-01', storeId: STORE, userId: MANAGER, name: '店长' },
  ]);
  await db
    .insert(schema.pets)
    .values({ id: PET, ownerId: CUSTOMER, name: '豆豆', species: 'dog' });
  await db.insert(schema.services).values({
    id: SERVICE,
    storeId: STORE,
    type: 'grooming',
    name: '精致洗护',
    priceFen: 12800,
  });
  const start = new Date(Date.now() + 3600_000);
  await db.insert(schema.appointments).values({
    id: APPT,
    code: '483920',
    customerId: CUSTOMER,
    storeId: STORE,
    staffId: STAFF,
    petId: PET,
    serviceId: SERVICE,
    type: 'grooming',
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + 3600_000),
    priceFen: 12800,
  });

  /* ---------- 验证 1：emitEvent → outbox + notifications ---------- */
  console.log('\n[1] emitEvent(store 频道) → event_outbox + 商家 notifications');
  const outboxId1 = await bus.emitEvent(db, `store:${STORE}`, EventType.AppointmentCreated, {
    appointmentId: APPT,
    storeId: STORE,
    petName: '豆豆',
  });
  check('返回非空 outbox id', typeof outboxId1 === 'string' && outboxId1.length > 0);

  const outboxRows = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, outboxId1));
  check('event_outbox 落库 1 行', outboxRows.length === 1, outboxRows.length);
  check(
    'outbox 行内容正确（channel/type/payload/delivered=0）',
    outboxRows[0]?.channel === `store:${STORE}` &&
      outboxRows[0]?.eventType === EventType.AppointmentCreated &&
      outboxRows[0]?.payload?.appointmentId === APPT &&
      outboxRows[0]?.delivered === false,
    outboxRows[0],
  );

  const notifs1 = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.type, EventType.AppointmentCreated));
  const notifUserIds = new Set(notifs1.map((n) => n.userId));
  check(
    'notifications 发给店主+店长（不含员工/客户）',
    notifs1.length === 2 && notifUserIds.has(OWNER) && notifUserIds.has(MANAGER),
    [...notifUserIds],
  );
  check(
    '通知文案与 link 生成正确',
    notifs1.every(
      (n) => n.title.length > 0 && (n.body?.length ?? 0) > 0 && n.link === `/appointments/${APPT}/live`,
    ),
    notifs1,
  );

  // 附验：appointment 频道解析 = 客户 + 店主 + 店长 + 被指员工
  const apptTargets = await bus.resolveChannelTargets(db, `appointment:${APPT}`);
  check(
    'resolveChannelTargets(appointment:) = 客户+店主+店长+员工',
    apptTargets.length === 4 &&
      [CUSTOMER, OWNER, MANAGER, STAFF_USER].every((u) => apptTargets.includes(u)),
    apptTargets,
  );

  /* ---------- 验证 2：broadcastNow → 两个在线假连接都收到信封 ---------- */
  console.log('\n[2] broadcastNow → 同频道两个 SSE 假连接均收到');
  const recvA: EventEnvelope[] = [];
  const recvB: EventEnvelope[] = [];
  const connA: HubConnection = {
    clientId: 'cli-a',
    userId: OWNER,
    appType: 'merchant',
    send: (e: EventEnvelope) => recvA.push(e),
  };
  const connB: HubConnection = {
    clientId: 'cli-b',
    userId: MANAGER,
    appType: 'merchant',
    send: (e: EventEnvelope) => recvB.push(e),
  };
  hub.subscribe(connA, [`store:${STORE}`]);
  hub.subscribe(connB, [`store:${STORE}`]);

  bus.broadcastNow(outboxId1);
  const both = await waitFor(() => recvA.length === 1 && recvB.length === 1);
  check('两个连接都收到 1 条信封', both, { a: recvA.length, b: recvB.length });
  check(
    '信封结构 {id,type,channel,data,ts} 正确',
    recvA[0]?.id === outboxId1 &&
      recvA[0]?.type === EventType.AppointmentCreated &&
      recvA[0]?.channel === `store:${STORE}` &&
      recvA[0]?.data?.appointmentId === APPT &&
      typeof recvA[0]?.ts === 'number' &&
      recvB[0]?.id === outboxId1,
    recvA[0],
  );
  const row1After = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, outboxId1))
    .get();
  check('在线送达后 delivered 置 1', row1After?.delivered === true);

  /* ---------- 验证 3：断线续传 replayMissed 按序补发 ---------- */
  console.log('\n[3] 断线续传：漏掉的事件按序补发');
  hub.resetHub(); // 全部离线
  const idConfirmed = await bus.emitEvent(db, `user:${CUSTOMER}`, EventType.AppointmentConfirmed, {
    appointmentId: APPT,
    petName: '豆豆',
  });
  const idCancelled = await bus.emitEvent(db, `user:${CUSTOMER}`, EventType.AppointmentCancelled, {
    appointmentId: APPT,
    petName: '豆豆',
  });
  bus.broadcastNow(idConfirmed);
  bus.broadcastNow(idCancelled);
  await sleep(50); // fire-and-forget 广播落库 delivered 需要一拍

  const before3 = await db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.delivered, false));
  const offlineIds = new Set(before3.map((r) => r.id));
  check(
    '离线期间事件 delivered 保持 0（验证 4 前半）',
    offlineIds.has(idConfirmed) && offlineIds.has(idCancelled),
    [...offlineIds],
  );

  // 客户端带 lastEventId=outboxId1 重连 → 应补发 confirmed、cancelled 两条（按序）
  const missed = await eventsApi.replayMissed(db, [`user:${CUSTOMER}`], outboxId1);
  check(
    '补发 2 条且按 id 升序',
    missed.length === 2 && missed[0]?.id === idConfirmed && missed[1]?.id === idCancelled,
    missed.map((m) => [m.id, m.type]),
  );
  check(
    '补发内容与类型正确',
    missed[0]?.type === EventType.AppointmentConfirmed &&
      missed[1]?.type === EventType.AppointmentCancelled &&
      missed[0]?.data?.appointmentId === APPT,
  );
  const afterReplay = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, idConfirmed))
    .get();
  check('续传补发后 delivered 置 1', afterReplay?.delivered === true);

  /* ---------- 验证 4：sweeper 在线重投 ---------- */
  console.log('\n[4] delivered 清扫：离线保持 0，在线重投置 1');
  const idOrder = await bus.emitEvent(db, `store:${STORE}`, EventType.OrderCreated, {
    orderId: 'order-001',
  });
  bus.broadcastNow(idOrder);
  await sleep(50);
  const orderBefore = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, idOrder))
    .get();
  check('无在线订阅者：sweep 前 delivered=0', orderBefore?.delivered === false);
  const swept0 = await sweeper.sweepOnce(db);
  check('无在线连接时 sweepOnce 不投（返回 0）', swept0 === 0, swept0);

  const recvC: EventEnvelope[] = [];
  const connC: HubConnection = {
    clientId: 'cli-c',
    userId: OWNER,
    appType: 'merchant',
    send: (e: EventEnvelope) => recvC.push(e),
  };
  hub.subscribe(connC, [`store:${STORE}`]);
  const swept1 = await sweeper.sweepOnce(db);
  check('上线后 sweepOnce 重投 1 条', swept1 === 1, swept1);
  check('重投信封送达连接', recvC.length === 1 && recvC[0]?.id === idOrder, recvC);
  const orderAfter = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, idOrder))
    .get();
  check('重投后 delivered 置 1', orderAfter?.delivered === true);
  hub.resetHub();

  /* ---------- 附验：归档（delivered=1 且 >7 天 → JSONL 导出后删除） ---------- */
  console.log('\n[4b] outbox 归档：超期已投递事件导出 JSONL 后删除');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
  await db
    .update(schema.eventOutbox)
    .set({ createdAt: eightDaysAgo, updatedAt: eightDaysAgo })
    .where(eq(schema.eventOutbox.id, idOrder));
  const archiveFile = join(tmpDir, 'outbox-archive.jsonl');
  const archived = await sweeper.archiveOutbox(db, archiveFile);
  check('归档导出 1 条', archived === 1, archived);
  const archivedLine = readFileSync(archiveFile, 'utf8').trim();
  const archivedObj = JSON.parse(archivedLine) as Record<string, unknown>;
  check(
    '归档 JSONL 内容正确（id/channel/payload/archived_at）',
    archivedObj.id === idOrder &&
      archivedObj.channel === `store:${STORE}` &&
      typeof archivedObj.archived_at === 'number',
    archivedLine,
  );
  const rowArchived = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, idOrder))
    .get();
  check('归档后源行已删除', rowArchived === undefined);
  // 未超期事件不受影响
  const recent = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.id, idConfirmed))
    .get();
  check('未超期（<7 天）事件保留', recent?.id === idConfirmed);

  /* ---------- 验证 5：push router 四过程 ---------- */
  console.log('\n[5] push router：subscribe→listNotifications→markRead→unsubscribe');
  const trpcFile = fileURLToPath(new URL('../../trpc.ts', import.meta.url));
  if (!existsSync(trpcFile)) {
    failures++;
    console.error('  ✗ src/trpc.ts 未就绪（契约 1，T1.2 名下），push router 无法加载');
  } else {
    const { pushRouter } = await import('../../routers/push');
    const caller = pushRouter.createCaller({
      db,
      user: { id: CUSTOMER, nickname: '豆豆家长', roles: ['customer'] },
    });

    const subRes = await caller.subscribe({ clientId: 'cli-smoke', appType: 'customer' });
    check('push.subscribe 登记成功', typeof subRes.subscriptionId === 'string', subRes);
    const subRow = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.id, subRes.subscriptionId))
      .get();
    check(
      'push_subscriptions 落库且归属本人',
      subRow?.userId === CUSTOMER && subRow?.clientId === 'cli-smoke' && subRow?.disconnectedAt === null,
      subRow,
    );

    const page1 = await caller.listNotifications({ limit: 10 });
    check(
      'listNotifications 返回客户的通知（≥2 条：confirmed/cancelled）',
      page1.items.length >= 2 && page1.items.every((n) => n.title.length > 0),
      page1.items.map((n) => n.type),
    );

    const target = page1.items[0]!;
    const markRes = await caller.markRead({ ids: [target.id] });
    check('markRead 已读 1 条', markRes.marked === 1, markRes);
    const unread = await caller.listNotifications({ limit: 10, unreadOnly: true });
    check(
      '已读后 unreadOnly 不再返回该条',
      !unread.items.some((n) => n.id === target.id),
    );

    const unsubRes = await caller.unsubscribe({ clientId: 'cli-smoke' });
    check('push.unsubscribe 断开成功', unsubRes.disconnected === true, unsubRes);
    const subRowAfter = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.id, subRes.subscriptionId))
      .get();
    check('disconnected_at 已置位', subRowAfter?.disconnectedAt instanceof Date);
  }

  client.close();
} catch (err) {
  failures++;
  console.error('\n[smoke] 未捕获异常：', err);
} finally {
  // Windows 下 libsql 句柄释放略滞后：带重试删除，失败仅告警（临时目录系统会回收）
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[smoke] 临时目录清理失败（不影响验证结果）: ${tmpDir}`, e);
  }
}

console.log(failures === 0 ? '\n全部冒烟验证通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
