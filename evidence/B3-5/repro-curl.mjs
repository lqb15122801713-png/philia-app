/**
 * B3-5 复现（修复前 · commit d7a40a5）：接口级证据采集。
 * 用法：先起 server(7200)，再 node repro-curl.mjs（cwd 无所谓，输出写到本脚本所在目录）。
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, findUser, login, trpcQuery, trpcMutate } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => {
  writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log('saved', name);
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');
const cCookie = await login(customer.id);
const mCookie = await login(merchant.id);
save('repro-users.json', { customer, merchant });

/* ---------- W-2：今天可约口径 ---------- */
// 门店与洗护服务
const nearby = await trpcQuery('store.listNearby', {}, cCookie);
const store = nearby.stores[0];
save('repro-w2-stores.json', { count: nearby.stores.length, stores: nearby.stores.map((s) => ({ id: s.id, name: s.name })) });
const gws = await trpcQuery('store.getWithServices', { storeId: store.id }, cCookie);
const now = new Date();
const todaySlots = gws.slots.filter((s) => {
  const d = new Date(s.slotStart);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
});
save('repro-w2-getWithServices.json', {
  now: fmt(now),
  slotsTotal: gws.slots.length,
  todaySlotsReturned: todaySlots.length,
  firstSlots: gws.slots.slice(0, 3).map((s) => fmt(new Date(s.slotStart))),
  lastSlots: gws.slots.slice(-3).map((s) => fmt(new Date(s.slotStart))),
});
const grooming = gws.services.find((s) => s.type === 'grooming');
const pets = await trpcQuery('pet.list', null, cCookie);
const pet = pets[0];

// 修复前后端口径：旧规则只拦 start<=now；今天 23:00（>now 但非营业时间 / <now+1h）
const today2300 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0, 0);
const res = await fetch(`${API}/trpc/appointment.create?batch=1`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: cCookie },
  body: JSON.stringify({
    '0': {
      json: {
        storeId: store.id, petId: pet.id, serviceId: grooming.id, type: 'grooming',
        scheduledStart: today2300.toISOString(), paymentMode: 'pay_at_store',
      },
      meta: { values: { scheduledStart: ['Date'] } },
    },
  }),
});
save('repro-w2-create-today2300.json', { httpStatus: res.status, targetSlot: fmt(today2300), body: await res.json() });

/* ---------- W-4：商家列表客户标识 ---------- */
const list = await trpcQuery('appointment.listForStore', {}, mCookie);
save('repro-w4-listForStore.json', {
  count: list.length,
  firstRowKeys: list[0] ? Object.keys(list[0]) : [],
  sample: list.slice(0, 3).map((r) => ({
    id: r.id, status: r.status, customerId: r.customerId,
    customerName: r.customerName, customerPhoneTail: r.customerPhoneTail,
  })),
});
// 详情同样无 customer 字段
const detail = await trpcQuery('appointment.get', { appointmentId: list.find((r) => r.status === 'confirmed')?.id ?? list[0].id }, mCookie);
save('repro-w4-get.json', { keys: Object.keys(detail), hasCustomer: 'customer' in detail });

/* ---------- A-P2-14：商家可调 checkout（publicProcedure 基类过宽） ---------- */
const inBoarding = list.find((r) => r.status === 'in_boarding');
if (inBoarding) {
  const co = await trpcMutate('boarding.checkout', { appointmentId: inBoarding.id }, mCookie).catch((e) => ({ error: String(e) }));
  save('repro-p214-merchant-checkout.json', { appointmentId: inBoarding.id, result: co });
} else {
  save('repro-p214-merchant-checkout.json', { note: '无 in_boarding 单' });
}

/* ---------- W-14：客户取消无原因入参（取消后 cancel_reason 仍为空） ---------- */
// 造一单明天 10:30 的洗护单并立刻 >4h 取消
const t1030 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 30, 0, 0);
const created = await trpcMutate('appointment.create', {
  storeId: store.id, petId: pet.id, serviceId: grooming.id, type: 'grooming',
  scheduledStart: t1030, paymentMode: 'pay_at_store',
}, cCookie, ['scheduledStart']);
const cancelled = await trpcMutate('appointment.cancel', {
  appointmentId: created.id,
  // 旧入参没有 reason 字段（zod 静默忽略未知键）
  reason: '行程有变：临时要出差',
}, cCookie);
save('repro-w14-cancel-no-reason.json', {
  createdId: created.id,
  outcome: cancelled.outcome,
  cancelReason: cancelled.appointment.cancelReason ?? null,
  cancelSource: cancelled.appointment.cancelSource ?? null,
  note: '旧版 cancel 无 reason 入参：即便客户端传了也被静默丢弃',
});
console.log('done');
