/** 造「无可约槽」测试店（openHours 全周休息 + 1 个在架洗护服务）；输出 id JSON；--cleanup 删除 */
import { db, schema } from '../src/db/index.js';
import { eq } from 'drizzle-orm';

const cleanup = process.argv.includes('--cleanup');
const NAME = 'B9B测试·全天休息店';

if (cleanup) {
  const store = await db.select().from(schema.stores).where(eq(schema.stores.name, NAME)).get();
  if (store) {
    await db.delete(schema.services).where(eq(schema.services.storeId, store.id));
    await db.delete(schema.stores).where(eq(schema.stores.id, store.id));
    console.log(JSON.stringify({ deleted: store.id }));
  } else {
    console.log(JSON.stringify({ deleted: null }));
  }
  process.exit(0);
}

const owner = await db.select().from(schema.users).where(eq(schema.users.nickname, '菲丽亚店主')).get();
if (!owner) throw new Error('店主不存在');
// 幂等：已存在则复用
let store = await db.select().from(schema.stores).where(eq(schema.stores.name, NAME)).get();
if (!store) {
  const [created] = await db
    .insert(schema.stores)
    .values({
      ownerId: owner.id,
      name: NAME,
      address: '测试地址（全天休息）',
      lat: 30.28,
      lng: 120.16,
      openHours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
      status: 'active',
    })
    .returning();
  store = created!;
}
let svc = await db.select().from(schema.services).where(eq(schema.services.storeId, store.id)).get();
if (!svc) {
  const [created] = await db
    .insert(schema.services)
    .values({ storeId: store.id, type: 'grooming', name: '测试洗护（不可约）', durationMin: 60, priceFen: 8800 })
    .returning();
  svc = created!;
}
console.log(JSON.stringify({ storeId: store.id, serviceId: svc.id }));
process.exit(0);
