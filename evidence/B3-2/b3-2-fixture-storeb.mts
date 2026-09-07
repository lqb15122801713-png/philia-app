/** B3-2 UI 证据用临时夹具（仅开发库，不入库）：门店B 周二休息 + 1 个 3 间房型 */
import { db, schema } from '../src/db';
import { eq } from 'drizzle-orm';

const roles = await db.select().from(schema.userRoles).where(eq(schema.userRoles.role, 'merchant_owner'));
const ownerId = roles[0]!.userId;

const OPEN = {
  mon: { open: '09:00', close: '20:00' },
  // tue 缺席 = 周二休息
  wed: { open: '09:00', close: '20:00' },
  thu: { open: '09:00', close: '20:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '20:00' },
  sun: { open: '09:00', close: '20:00' },
};

const [store] = await db
  .insert(schema.stores)
  .values({ ownerId, name: 'B3-2证据店B（周二休）', address: '测试地址', lat: 30.28, lng: 120.16, openHours: OPEN, status: 'active' })
  .returning();
await db.insert(schema.services).values({
  storeId: store.id,
  type: 'boarding',
  name: '证据店B 套房寄养',
  boardingRoomType: '观景套房',
  roomCount: 3,
  priceFen: 39900,
});
console.log('storeB id =', store.id);
process.exit(0);
