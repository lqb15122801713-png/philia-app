/**
 * PD-70 软关店冒烟脚本（store.closeStore / store.reopenStore + 默认排除 + closed 写口闸）
 *
 * 运行：npx tsx src/routers/__tests__/storeClose.smoke.ts
 *
 * 覆盖：
 * 1. closeStore 开心路径：active→closed（changed:true），零物理删（店行/他店预约行均在），
 *    幂等重调 changed:false
 * 2. 默认排除：listMine 缺省不见 closed；includeClosed:true 可见且行 status=closed；
 *    chainDashboard 同口径（缺省排除 / includeClosed 含 closed 并透出 status）
 * 3. hq 硬禁关：storeType=hq → FORBIDDEN「总部门店记录不可关闭」；越店 → NOT_FOUND；
 *    manager 调 closeStore → FORBIDDEN（owner-only）
 * 4. 未完成履约强警示（非硬阻断）：未来 confirmed 单在 → 未勾选返回
 *    requiresAcknowledgement:true 且零写入；勾选 acknowledgeOpenFulfillment 后关店成功
 * 5. closed 写口闸：cloneStore 拒以 closed 为源（BAD_REQUEST）；cashier.hold 拒新开单
 *    （BAD_REQUEST）；stock2.transferCreate 拒 closed 目标店（BAD_REQUEST）
 * 6. reopenStore：closed→active（changed:true），恢复进默认 listMine；幂等重调 changed:false
 *
 * 所有夹具均为脚本自建（不动种子数据），finally 里按子表→父表清场，跑完种子原样。
 */

import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { ulid } from 'ulid';
import { client, db, schema } from '../../db';
import type { Context, SessionUser } from '../../trpc';
import { storeRouter } from '../store';
import { cashierRouter } from '../cashier';
import { stock2Router } from '../stock2';

/* ---------- 测试数据清理登记 ---------- */
const created = {
  userIds: [] as string[],
  storeIds: [] as string[],
  petIds: [] as string[],
  serviceIds: [] as string[],
  appointmentIds: [] as string[],
};

async function runCleanup() {
  if (created.appointmentIds.length) {
    await db.delete(schema.appointments).where(inArray(schema.appointments.id, created.appointmentIds));
  }
  if (created.serviceIds.length) {
    await db.delete(schema.services).where(inArray(schema.services.id, created.serviceIds));
  }
  if (created.petIds.length) {
    await db.delete(schema.pets).where(inArray(schema.pets.id, created.petIds));
  }
  if (created.storeIds.length) {
    await db.delete(schema.stores).where(inArray(schema.stores.id, created.storeIds));
  }
  if (created.userIds.length) {
    await db.delete(schema.notifications).where(inArray(schema.notifications.userId, created.userIds));
    await db.delete(schema.userRoles).where(inArray(schema.userRoles.userId, created.userIds));
    await db.delete(schema.users).where(inArray(schema.users.id, created.userIds));
  }
}

/* ---------- 小工具 ---------- */
async function makeUser(nickname: string, roles: string[]): Promise<string> {
  const [u] = await db
    .insert(schema.users)
    .values({ kimiId: `smoke_pd70_${ulid().toLowerCase()}`, nickname })
    .returning();
  created.userIds.push(u.id);
  for (const role of roles) {
    await db.insert(schema.userRoles).values({ userId: u.id, role });
  }
  return u.id;
}

async function makeStore(ownerId: string, name: string, storeType: 'store' | 'hq' = 'store') {
  const [s] = await db.insert(schema.stores).values({ ownerId, name, storeType }).returning();
  created.storeIds.push(s.id);
  return s;
}

function ctxOf(user: SessionUser): Context {
  return { db, user };
}

const errCode = (err: unknown) => (err as { code?: string }).code;

async function main() {
  /* ---------- 夹具：用户 / 门店 ---------- */
  const owner = await makeUser('PD70烟老板', ['merchant_owner']);
  const manager = await makeUser('PD70烟店长', ['merchant_manager']);
  const otherOwner = await makeUser('PD70烟外人', ['merchant_owner']);
  const customer = await makeUser('PD70烟客户', ['customer']);

  const store1 = await makeStore(owner, 'PD70烟门店一');
  const store2 = await makeStore(owner, 'PD70烟门店二');
  const hq = await makeStore(owner, 'PD70烟总部', 'hq');
  const storeOther = await makeStore(otherOwner, 'PD70烟外店');

  const ownerCtx = ctxOf({
    id: owner,
    nickname: 'PD70烟老板',
    roles: ['merchant_owner'],
    storeId: store1.id,
    storeIds: [store1.id, store2.id, hq.id],
  });
  const managerCtx = ctxOf({ id: manager, nickname: 'PD70烟店长', roles: ['merchant_manager'], storeId: store1.id });
  const otherCtx = ctxOf({
    id: otherOwner,
    nickname: 'PD70烟外人',
    roles: ['merchant_owner'],
    storeId: storeOther.id,
    storeIds: [storeOther.id],
  });
  const store = storeRouter.createCaller(ownerCtx);

  /* ---------- 1. closeStore 开心路径 + 零物理删 + 幂等 ---------- */
  const close1 = await store.closeStore({ storeId: store1.id });
  assert.equal(close1.closed, true, '关店应成功');
  assert.equal(close1.changed, true, '首次关店 changed:true');
  assert.equal(close1.requiresAcknowledgement, false, '无未完成履约不需强警示');
  assert.equal(close1.openFulfillment.total, 0, '无未完成履约 total=0');
  assert.equal(close1.store.status, 'closed', '返回行 status=closed');
  const store1Row = await db.select().from(schema.stores).where(eq(schema.stores.id, store1.id)).then((r) => r[0]);
  assert.ok(store1Row, '零物理删：店行仍在');
  assert.equal(store1Row.status, 'closed', '库内 status=closed');

  const closeAgain = await store.closeStore({ storeId: store1.id });
  assert.equal(closeAgain.closed, true, '已关重调仍 closed:true');
  assert.equal(closeAgain.changed, false, '已关重调幂等 changed:false');
  console.log('✅ 1. closeStore 开心路径（active→closed）+ 零物理删 + 幂等');

  /* ---------- 2. 默认排除：listMine / chainDashboard ---------- */
  const mineDefault = await store.listMine();
  const mineIds = mineDefault.stores.map((s) => s.id);
  assert.ok(!mineIds.includes(store1.id), 'listMine 缺省不见 closed 店');
  assert.ok(mineIds.includes(store2.id), 'listMine 缺省仍见 active 店');
  const mineAll = await store.listMine({ includeClosed: true });
  const closedRow = mineAll.stores.find((s) => s.id === store1.id);
  assert.ok(closedRow, 'includeClosed:true 可见 closed 店');
  assert.equal(closedRow.status, 'closed', 'closed 行透出 status=closed（前端标识数据源）');

  const chainDefault = await store.chainDashboard();
  assert.ok(!chainDefault.stores.some((s) => s.storeId === store1.id), 'chainDashboard 缺省排除 closed 店');
  const chainAll = await store.chainDashboard({ includeClosed: true });
  const chainClosed = chainAll.stores.find((s) => s.storeId === store1.id);
  assert.ok(chainClosed, 'chainDashboard includeClosed:true 含 closed 店');
  assert.equal(chainClosed.status, 'closed', '连锁卡 closed 行透出 status 供标识');
  console.log('✅ 2. listMine / chainDashboard 默认排除 closed（includeClosed 可含+标识）');

  /* ---------- 3. hq 硬禁关 / 越店 / 非 owner ---------- */
  await assert.rejects(
    store.closeStore({ storeId: hq.id }),
    (e) => errCode(e) === 'FORBIDDEN' && /总部门店记录不可关闭/.test((e as Error).message),
    'hq 关店应 FORBIDDEN 明文',
  );
  await assert.rejects(
    store.closeStore({ storeId: storeOther.id }),
    (e) => errCode(e) === 'NOT_FOUND',
    '越店关店应 NOT_FOUND（防探测口径）',
  );
  const storeAsManager = storeRouter.createCaller(managerCtx);
  await assert.rejects(
    storeAsManager.closeStore({ storeId: store2.id }),
    (e) => errCode(e) === 'FORBIDDEN',
    'manager 关店应 FORBIDDEN（owner-only）',
  );
  console.log('✅ 3. hq 硬禁关（FORBIDDEN 明文）/ 越店 NOT_FOUND / manager FORBIDDEN');

  /* ---------- 4. 未完成履约强警示（非硬阻断） ---------- */
  const [pet] = await db.insert(schema.pets).values({ ownerId: customer, name: 'PD70烟宠', species: 'dog' }).returning();
  created.petIds.push(pet.id);
  const [svc] = await db
    .insert(schema.services)
    .values({ storeId: store2.id, type: 'grooming', name: 'PD70烟服', priceFen: 100 })
    .returning();
  created.serviceIds.push(svc.id);
  const [appt] = await db
    .insert(schema.appointments)
    .values({
      code: `PD70${ulid()}`,
      customerId: customer,
      storeId: store2.id,
      petId: pet.id,
      serviceId: svc.id,
      type: 'grooming',
      status: 'confirmed',
      scheduledStart: new Date(Date.now() + 24 * 3600 * 1000),
      scheduledEnd: new Date(Date.now() + 25 * 3600 * 1000),
      priceFen: 100,
    })
    .returning();
  created.appointmentIds.push(appt.id);

  const warn = await store.closeStore({ storeId: store2.id });
  assert.equal(warn.closed, false, '有未完成履约且未勾选 → 不关');
  assert.equal(warn.requiresAcknowledgement, true, '返回强警示标记');
  assert.equal(warn.openFulfillment.upcoming, 1, '未来 confirmed 计入待履约');
  assert.equal(warn.openFulfillment.total, 1, 'total=1');
  const store2Mid = await db.select().from(schema.stores).where(eq(schema.stores.id, store2.id)).then((r) => r[0]);
  assert.equal(store2Mid.status, 'active', '强警示分支零写入：仍 active');

  const close2 = await store.closeStore({ storeId: store2.id, acknowledgeOpenFulfillment: true });
  assert.equal(close2.closed, true, '勾选后可关（非硬阻断）');
  assert.equal(close2.openFulfillment.total, 1, '关后仍回报当时未完成数');
  const apptAlive = await db.select().from(schema.appointments).where(eq(schema.appointments.id, appt.id)).then((r) => r[0]);
  assert.ok(apptAlive, '零物理删：关店后历史预约行仍在');
  assert.equal(apptAlive.status, 'confirmed', '关店不改写预约状态');
  console.log('✅ 4. 未完成履约：强警示+勾选后可关（非硬阻断），历史行全保留');

  /* ---------- 5. closed 写口闸：克隆源 / 收银新开单 / 调拨目标 ---------- */
  await assert.rejects(
    store.cloneStore({ name: 'PD70烟克隆', sourceStoreId: store2.id }),
    (e) => errCode(e) === 'BAD_REQUEST' && /已关闭门店不可作为克隆源/.test((e as Error).message),
    'closed 源克隆应 BAD_REQUEST',
  );
  const cashierOnClosed = cashierRouter.createCaller(ctxOf({
    id: owner,
    nickname: 'PD70烟老板',
    roles: ['merchant_owner'],
    storeId: store2.id,
    storeIds: [store1.id, store2.id, hq.id],
  }));
  await assert.rejects(
    cashierOnClosed.hold({
      items: [{ kind: 'custom', refId: 'pd70-custom', qty: 1, customName: '快捷收款', customAmountFen: 100 }],
      discountType: 'none',
      discountValue: 0,
    }),
    (e) => errCode(e) === 'BAD_REQUEST' && /门店已关闭，不可新开单/.test((e as Error).message),
    'closed 店新开单应 BAD_REQUEST',
  );
  const stock2 = stock2Router.createCaller(ownerCtx);
  await assert.rejects(
    stock2.transferCreate({ toStoreId: store2.id, items: [{ productId: 'pd70-none', qty: 1 }] }),
    (e) => errCode(e) === 'BAD_REQUEST' && /目标门店已关闭，不可调入/.test((e as Error).message),
    'closed 目标店调拨应 BAD_REQUEST',
  );
  console.log('✅ 5. closed 拒：克隆源 / 收银新开单 / 调拨目标');

  /* ---------- 6. reopenStore 对称恢复 + 幂等 ---------- */
  const reopen1 = await store.reopenStore({ storeId: store1.id });
  assert.equal(reopen1.reopened, true, '再开成功');
  assert.equal(reopen1.changed, true, 'closed→active changed:true');
  const reopenAgain = await store.reopenStore({ storeId: store1.id });
  assert.equal(reopenAgain.changed, false, 'active 重调幂等 changed:false');
  const mineAfter = await store.listMine();
  assert.ok(mineAfter.stores.some((s) => s.id === store1.id), '再开后恢复进默认 listMine');
  await assert.rejects(
    storeRouter.createCaller(otherCtx).reopenStore({ storeId: store1.id }),
    (e) => errCode(e) === 'NOT_FOUND',
    '越店再开应 NOT_FOUND',
  );
  console.log('✅ 6. reopenStore：closed→active 恢复默认可见 + 幂等 + 越店 NOT_FOUND');

  console.log('\n[storeClose.smoke] 全部 6 项通过 🎉');
}

try {
  await main();
} finally {
  await runCleanup();
  client.close();
}
