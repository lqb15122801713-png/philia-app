/**
 * D3 冒烟：boarding.overdue 每日幂等发射
 * 独立临时库（PHILIA_DB_URL 已在命令行注入），迁移+种子后直接造过期寄养单验证。
 * 用法：PHILIA_DB_URL=file:<tmp>.db node node_modules/tsx/dist/cli.mjs scripts/overdue.smoke.mts
 */
import { eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db, schema } from '../src/db/index.js';
import { emitBoardingOverdue } from '../src/realtime/outboxSweeper.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`断言失败: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const store = (await db.select().from(schema.stores).all())[0]!;
const customer = (await db.select().from(schema.users).all()).find((u) => u.nickname.includes('客户'))!;
const pet = (await db.select().from(schema.pets).all())[0]!;
const service = (await db.select().from(schema.services).all()).find((s) => s.type === 'boarding')!;

// 造一个过期寄养单（scheduled_end = 昨天，状态 in_boarding）
const past = new Date(Date.now() - 24 * 3600 * 1000);
const start = new Date(Date.now() - 3 * 24 * 3600 * 1000);
const aid = `appt_overdue_${ulid()}`;
await db.insert(schema.appointments).values({
  id: aid,
  code: 'OVD123',
  customerId: customer.id,
  storeId: store.id,
  petId: pet.id,
  serviceId: service.id,
  type: 'boarding',
  scheduledStart: start,
  scheduledEnd: past,
  status: 'in_boarding',
  priceFen: 19900,
  paymentMode: 'pay_at_store',
});
await db.insert(schema.boardingStays).values({ appointmentId: aid, roomNo: 'B-201' });

// 第一次扫描：应发射 1 条
const n1 = await emitBoardingOverdue(db);
assert(n1 === 1, `首次扫描发射 1 条超期事件（实际 ${n1}）`);

const events = await db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.eventType, 'boarding.overdue')).all();
assert(events.length === 1, 'outbox 恰有 1 条 boarding.overdue');
assert(events[0]!.channel === `store:${store.id}`, '频道为 store:{storeId}');
assert((events[0]!.payload as any).appointmentId === aid, 'payload 含 appointmentId');

const notif = await db.select().from(schema.notifications).all();
assert(notif.some((n) => n.type === 'boarding.overdue'), '商家收到站内通知');

// 第二次扫描（同日）：幂等跳过
const n2 = await emitBoardingOverdue(db);
assert(n2 === 0, `同日二次扫描幂等跳过（实际 ${n2}）`);

// 模拟"明天"再扫：应再发 1 条（每日一条）
const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
const n3 = await emitBoardingOverdue(db, tomorrow);
assert(n3 === 1, `次日扫描再次发射（实际 ${n3}）`);

console.log('D3 冒烟全部通过 ✅');
process.exit(0);
