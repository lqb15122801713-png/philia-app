/**
 * B3-5 修复后接口级验收 + UI 证据数据准备。
 * 输出 verify-*.json/txt 到本脚本目录；并把 UI 验收需要的订单 id 写入 ui-fixtures.json。
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, findUser, login, seedUsers, trpcQuery, trpcMutate } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => {
  writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log('saved', name);
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const localAt = (dayOffset, h, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};

/** 带原始 HTTP 状态的 mutation（验收要证明 400/401/403/200） */
async function trpcMutateRaw(proc, input, cookie, dateKeys = []) {
  const cell = { json: input };
  if (dateKeys.length) cell.meta = { values: Object.fromEntries(dateKeys.map((k) => [k, ['Date']])) };
  const res = await fetch(`${API}/trpc/${proc}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ '0': cell }),
  });
  return { httpStatus: res.status, body: await res.json() };
}

const users = await seedUsers();
const customer = users.find((u) => u.roles.includes('customer'));
const merchant = users.find((u) => u.roles.includes('merchant_owner'));
const staffUsers = users.filter((u) => u.roles.includes('staff'));
const cC = await login(customer.id);
const mC = await login(merchant.id);
const sC = await login(staffUsers[0].id); // 小美

const store = (await trpcQuery('store.listNearby', {}, cC)).stores[0];
const gws0 = await trpcQuery('store.getWithServices', { storeId: store.id }, cC);
const groomingSvc = gws0.services.find((s) => s.type === 'grooming' && s.durationMin === 60);
const boardingSvc = gws0.services.find((s) => s.type === 'boarding');
const pets = await trpcQuery('pet.list', null, cC);
const [pet1, pet2] = pets;

const fx = { storeId: store.id };

/* ==================== W-2：+1h 缓冲双拦 + 今天可约 ==================== */
// ① 可约槽口径：响应全部 ≥ now+1h（含合成栅格；此刻 22:5x 已打烊，今天无在营业时段内的槽属预期）
const gws = await trpcQuery('store.getWithServices', { storeId: store.id, serviceId: groomingSvc.id }, cC);
const now = new Date();
const slotTimes = gws.slots.map((s) => new Date(s.slotStart).getTime());
save('verify-w2-getWithServices.json', {
  now: fmt(now),
  slotsTotal: gws.slots.length,
  allAfterBuffer: slotTimes.every((t) => t >= now.getTime() + 60 * 60_000),
  earliest: fmt(new Date(Math.min(...slotTimes))),
  todaySlots: slotTimes.filter((t) => {
    const d = new Date(t);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  }).length,
  note: '采集于打烊后（09:00-20:00 营业）：今天无 ≥now+1h 且在营业内的时段属预期；明天槽位全量合成返回',
});

// ② 后端拦：+1h 内时段（今天 23:00，修复前报「营业时间」，修复后应报「1 小时」缓冲文案）
const r2300 = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(0, 23), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart']);
save('verify-w2-create-within-1h.json', { targetSlot: fmt(localAt(0, 23)), ...r2300 });

// ③ 可约：≥now+1h 的营业时段建单 200（明天 09:00；白天运行即「今天晚些时候」）
const rA = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 9), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart']);
fx.orderA = rA.body?.[0]?.result?.data?.json?.id;
save('verify-w2-create-bookable.json', { targetSlot: fmt(localAt(1, 9)), httpStatus: rA.httpStatus, appointmentId: fx.orderA });

// ④ 满槽置灰数据：明天 10:00 连订两单（capacity=2）→ 第三单 CONFLICT
const rC1 = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 10), paymentMode: 'pay_at_store', note: '满槽演示 1/2',
}, cC, ['scheduledStart']);
const rC2 = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet2.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 10), paymentMode: 'pay_at_store', note: '满槽演示 2/2',
}, cC, ['scheduledStart']);
const rC3 = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 10), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart']);
fx.orderC1 = rC1.body?.[0]?.result?.data?.json?.id;
fx.orderC2 = rC2.body?.[0]?.result?.data?.json?.id;
save('verify-w2-fullslot.json', {
  slot: fmt(localAt(1, 10)),
  first: rC1.httpStatus, second: rC2.httpStatus,
  third: { httpStatus: rC3.httpStatus, message: rC3.body?.[0]?.error?.json?.message },
});

/* ==================== W-16 数据：小美未来 7 天两单 ==================== */
const rB = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet2.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(3, 14), paymentMode: 'pay_at_store', note: 'W-16 前瞻演示单',
}, cC, ['scheduledStart']);
fx.orderB = rB.body?.[0]?.result?.data?.json?.id;
const staffList = (await trpcQuery('store.staffList', null, mC)).staff;
const xm = staffList.find((s) => s.name === '小美');
const aq = staffList.find((s) => s.name === '阿强');
for (const oid of [fx.orderA, fx.orderB]) {
  await trpcMutate('appointment.confirm', { appointmentId: oid }, mC);
  await trpcMutate('appointment.assign', { appointmentId: oid, staffId: xm.id }, mC);
}
save('verify-w16-assigned.json', { staff: xm.name, orders: [fx.orderA, fx.orderB], slots: [fmt(localAt(1, 9)), fmt(localAt(3, 14))] });

/* ==================== W-4：客户标识 + 越权口径 ==================== */
const list = await trpcQuery('appointment.listForStore', {}, mC);
save('verify-w4-listForStore.json', {
  count: list.length,
  fields: Object.keys(list[0]).filter((k) => k.startsWith('customer')),
  sample: list.slice(0, 3).map((r) => ({ id: r.id, status: r.status, customerName: r.customerName, customerPhoneTail: r.customerPhoneTail })),
});
const get1 = await trpcQuery('appointment.get', { appointmentId: fx.orderA }, mC);
save('verify-w4-get.json', { customer: get1.customer });
// 越权口径：客户角色调商家接口 → 403
const forbid = await trpcMutateRaw('appointment.listForStore?batch=1'.replace('?batch=1', ''), null, cC).catch((e) => ({ error: String(e) }));
const q = encodeURIComponent(JSON.stringify({ '0': { json: null } }));
const resF = await fetch(`${API}/trpc/appointment.listForStore?batch=1&input=${q}`, { headers: { cookie: cC } });
save('verify-w4-crossrole.json', { httpStatus: resF.status, body: await resF.json(), note: '客户角色调 listForStore → 403；接口本身 merchantProcedure + storeId=本店硬过滤，非本店订单不可达' });
void forbid;

/* ==================== W-14：客户取消原因 ==================== */
// >4h 直消单（明天 15:00），UI 走 chips 取消；此处先做 ≤4h 审核链数据：
const rD = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 15), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart']);
fx.orderD = rD.body?.[0]?.result?.data?.json?.id;
// ≤4h 审核链：明天 16:00 建单+确认，随后用 DB 脚本把 scheduledStart 拨到 now+2h 再取消
const rE = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet2.id, serviceId: groomingSvc.id, type: 'grooming',
  scheduledStart: localAt(1, 16), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart']);
fx.orderE = rE.body?.[0]?.result?.data?.json?.id;
await trpcMutate('appointment.confirm', { appointmentId: fx.orderE }, mC);
save('verify-w14-fixtures.json', { orderD: fx.orderD, orderE: fx.orderE, note: 'orderE 待 tmp-b35-bump.mts 拨到 now+2h 后走客户取消→商家审核链' });

/* ==================== A-P2-14：checkout 权限矩阵 ==================== */
// 寄养单 F：9/8 入住 9/10 退房 → 确认 → 派阿强 → 客户取码 → 阿强核销 → 入住登记
const rF = await trpcMutateRaw('appointment.create', {
  storeId: store.id, petId: pet1.id, serviceId: boardingSvc.id, type: 'boarding',
  scheduledStart: localAt(1, 9), scheduledEnd: localAt(3, 9), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart', 'scheduledEnd']);
fx.orderF = rF.body?.[0]?.result?.data?.json?.id;
await trpcMutate('appointment.confirm', { appointmentId: fx.orderF }, mC);
await trpcMutate('appointment.assign', { appointmentId: fx.orderF, staffId: aq.id }, mC);
const codeRes = await trpcQuery('appointment.getCode', { appointmentId: fx.orderF }, cC);
const aqCookie = await login(staffUsers.find((u) => u.nickname === '阿强').id);
fx.aqCookieNote = '阿强 cookie 仅本次进程内使用';
const ck = await trpcMutate('appointment.checkin', { code: codeRes.code }, aqCookie);
const stay = await trpcMutate('boarding.checkinStay', {
  appointmentId: fx.orderF, checkinWeightKg: 28.5,
  belongings: [{ name: '狗粮', note: '每日两餐' }], roomNo: 'A01',
}, aqCookie);
fx.checkin = { status: ck.appointment.status, staffId: ck.appointment.staffId };
fx.stayId = stay.stay.id;

// 权限矩阵（在员工退房前逐一打）：anon 401 / customer 403 / merchant 403
const p214 = {};
p214.anon = await trpcMutateRaw('boarding.checkout', { appointmentId: fx.orderF }, null);
p214.customer = await trpcMutateRaw('boarding.checkout', { appointmentId: fx.orderF }, cC);
p214.merchant = await trpcMutateRaw('boarding.checkout', { appointmentId: fx.orderF }, mC);
save('verify-p214-matrix.json', {
  appointmentId: fx.orderF,
  anon: { httpStatus: p214.anon.httpStatus, message: p214.anon.body?.[0]?.error?.json?.message },
  customer: { httpStatus: p214.customer.httpStatus, message: p214.customer.body?.[0]?.error?.json?.message },
  merchant: { httpStatus: p214.merchant.httpStatus, message: p214.merchant.body?.[0]?.error?.json?.message },
  note: '员工 200 退房回归在 verify-shots 之后由 verify-checkout.mjs 执行（先留 in_boarding 供 UI 截图）',
});

save('ui-fixtures.json', fx);
console.log('fixtures:', JSON.stringify(fx, null, 2));
console.log('done');
