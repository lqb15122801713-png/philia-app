/** B3-5 收尾查库快照（读多写少：仅清理 A-P2-13 live 夹具单）。运行：./node_modules/.bin/tsx tmp-b35-after.mts */
import { db, schema, client } from './src/db';
import { eq, inArray } from 'drizzle-orm';

const fmt = (d: Date | null) => (d ? d.toLocaleString('zh-CN', { hour12: false }) : '-');
const ids = {
  orderD: '01M1Y81JWTS1KMAH4QRPW0G82P', // >4h 直消（UI chips：行程有变：临时要出差）
  orderE: '01M1Y81JX2GTH1HF9JA6H0HR23', // ≤4h 申请 → 商家批准（时间不合适：临时加班赶不过来）
  orderF: '01M1Y81JXJYY74555CTQ5VB1TR', // 寄养：员工退房
  liveFixture: '01M1Y840Y6HYYJ3H6JXZ24NA7W', // A-P2-13 文案夹具
};

console.log('== cancel_reason / cancel_source 快照 ==');
for (const [k, id] of Object.entries(ids)) {
  if (k === 'liveFixture') continue;
  const a = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id)).get();
  console.log(
    `${k} ${id}\n  status=${a?.status} source=${a?.cancelSource ?? '-'} reason=${a?.cancelReason ?? '-'}\n  staff=${a?.staffId ?? '-'} checkedInAt=${fmt(a?.checkedInAt ?? null)} completedAt=${fmt(a?.completedAt ?? null)}`,
  );
}
const stayF = await db
  .select()
  .from(schema.boardingStays)
  .where(eq(schema.boardingStays.appointmentId, ids.orderF))
  .get();
console.log(`orderF stay: room=${stayF?.roomNo} checkoutAt=${fmt(stayF?.checkoutAt ?? null)}`);

console.log('\n== 清理 A-P2-13 live 夹具（appointment + 六步，无 outbox 事件） ==');
await db.delete(schema.appointmentSteps).where(eq(schema.appointmentSteps.appointmentId, ids.liveFixture));
await db.delete(schema.appointments).where(eq(schema.appointments.id, ids.liveFixture));
const gone = await db.select().from(schema.appointments).where(eq(schema.appointments.id, ids.liveFixture)).get();
console.log('live fixture deleted:', gone === undefined);

// 终态清点（对照 db-before.txt）
const appts = await db.select().from(schema.appointments);
console.log('\nappointments total =', appts.length);
const byStatus = new Map<string, number>();
for (const a of appts) byStatus.set(a.status, (byStatus.get(a.status) ?? 0) + 1);
console.log('by status:', Object.fromEntries(byStatus));
client.close();
void inArray;
