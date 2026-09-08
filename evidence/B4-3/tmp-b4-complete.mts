/**
 * 【批次 4 证据辅助 · 用完移到 evidence/】把一单过去时段的洗护预约置为 completed，
 * 供「完成单再次预约落点」运行时验证（demo-*.ts 同类夹具思路）。
 * 运行：cd server && npx tsx scripts/tmp-b4-complete.mts
 */
import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

async function main() {
  // 取种子客户最早一单过去时段的非取消洗护预约
  const customer = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.kimiId, 'seed_kimi_customer'))
    .then((r) => r[0]);
  if (!customer) throw new Error('无种子客户');
  const rows = await db
    .select()
    .from(schema.appointments)
    .where(and(eq(schema.appointments.customerId, customer.id), eq(schema.appointments.type, 'grooming')))
    .orderBy(asc(schema.appointments.scheduledStart));
  const target = rows.find((a) => a.status !== 'cancelled' && a.scheduledStart.getTime() < Date.now());
  if (!target) throw new Error('无可置完成的洗护单');
  await db
    .update(schema.appointments)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(schema.appointments.id, target.id));
  console.log(JSON.stringify({ flipped: target.id, scheduledStart: target.scheduledStart }));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
