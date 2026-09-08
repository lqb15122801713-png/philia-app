/**
 * B4-5 验收造数：completed 洗护单（完成时间 N 天前）
 *
 * 用法：cd philia-app/server && npx tsx ../../evidence/B4-5/seed-completed-grooming.mts <daysAgo>
 *   daysAgo 默认 20（≥14 触发提醒）；传 5 则构造「完成 <14 天不渲染」对照态。
 *
 * 说明：脚本留在 evidence 目录（验收要求），故不 bare-import 'drizzle-orm'
 * （evidence 下无 node_modules）——查询用 db.select 全量后 JS 过滤（种子库小表），
 * 更新用 client.execute 原生 SQL（timestamp 列为 Unix 秒）。
 *
 * 幂等：以 note='B4-5-EVIDENCE' 为标记行——存在则更新时间字段（completedAt/scheduledStart/End），
 * 不存在则插入。造数对象：种子客户（kimiId=seed_kimi_customer）的宠物「旺财」× 首个在架洗护服务。
 *
 * 仅写 appointments 表一行；不影响 seed 其他数据；reseed 后标记行消失自动回到「无单」初始态。
 */
import { client, db, schema } from '../../philia-app/server/src/db/index.ts';

const MARK = 'B4-5-EVIDENCE';
const daysAgo = Number(process.argv[2] ?? '20');
if (!Number.isFinite(daysAgo) || daysAgo < 0) throw new Error('daysAgo 需为非负数字');

const now = Date.now();
const completedAt = new Date(now - daysAgo * 86_400_000);
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

const customer = (await db.select().from(schema.users)).find((u) => u.kimiId === 'seed_kimi_customer');
if (!customer) throw new Error('未找到种子客户 seed_kimi_customer（请先 reseed）');

const pet = (await db.select().from(schema.pets).all()).filter((p) => p.ownerId === customer.id).sort(
  (a, b) => (a.name === '旺财' ? -1 : 0) - (b.name === '旺财' ? -1 : 0),
)[0];
if (!pet) throw new Error('种子客户名下无宠物');

const service = (await db.select().from(schema.services)).find((s) => s.type === 'grooming' && s.active);
if (!service) throw new Error('无在架洗护服务');

const durationMin = service.durationMin ?? 60;
const scheduledEnd = completedAt;
const scheduledStart = new Date(completedAt.getTime() - durationMin * 60_000);

const marker = (await db.select().from(schema.appointments)).find((a) => a.note === MARK);
if (marker) {
  await client.execute({
    sql: "UPDATE appointments SET scheduled_start = ?, scheduled_end = ?, completed_at = ?, status = 'completed', updated_at = ? WHERE id = ?",
    args: [sec(scheduledStart), sec(scheduledEnd), sec(completedAt), sec(new Date()), marker.id],
  });
  console.log(
    JSON.stringify(
      {
        action: 'updated',
        id: marker.id,
        daysAgo,
        completedAt: completedAt.toISOString(),
        petName: pet.name,
        serviceName: service.name,
      },
      null,
      2,
    ),
  );
} else {
  const rows = await db
    .insert(schema.appointments)
    .values({
      code: 'B45EV1',
      customerId: customer.id,
      storeId: service.storeId,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart,
      scheduledEnd,
      status: 'completed',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
      paidAt: completedAt,
      paidFen: service.priceFen,
      note: MARK,
      completedAt,
    })
    .returning();
  console.log(
    JSON.stringify(
      {
        action: 'inserted',
        id: rows[0]?.id,
        daysAgo,
        completedAt: completedAt.toISOString(),
        petName: pet.name,
        serviceName: service.name,
      },
      null,
      2,
    ),
  );
}
process.exit(0);
