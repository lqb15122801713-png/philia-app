/**
 * B2-3 数据准备：确保示例客户名下有 1 单已完成洗护 + 1 单已完成寄养。
 * 已有则复用（B2-2 造的 completed 洗护单），无则走接口级状态机造单：
 *   洗护：create → confirm → assign → checkin → 六步 → completed
 *   寄养：create → confirm → assign → checkin → checkinStay → checkout(completed)
 * 输出 data.json：{ groomingDone, boardingDone, pet, store, services }
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayKeyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');
const cCookie = await login(customer.id);
const mCookie = await login(merchant.id);
console.log('customer:', customer.nickname, customer.id);

const { staff } = await trpcQuery('store.staffList', null, mCookie);
const staffWash = staff.find((s) => (s.skills ?? []).includes('wash') && s.status === 'active');
const staffBoard = staff.find((s) => (s.skills ?? []).includes('boarding') && s.status === 'active');
const sWashCookie = await login(staffWash.userId);
const sBoardCookie = await login(staffBoard.userId);
console.log('staff wash:', staffWash.name, '| board:', staffBoard.name);

const pets = await trpcQuery('pet.list', null, cCookie);
const pet = pets[0];
const { stores } = await trpcQuery('store.listNearby', {}, cCookie);
const store = stores[0];
const svc = await trpcQuery('store.getWithServices', { storeId: store.id }, cCookie);
const svcGrooming = svc.services.find((s) => s.type === 'grooming');
const svcBoarding = svc.services.find((s) => s.type === 'boarding');

/** 门店某日开店时刻，向上对齐 30min（与客户端 checkinAt 同口径） */
function openAt(d) {
  const hours = store.openHours?.[DAY_KEYS[d.getDay()]];
  const [oh = 10, om = 0] = (hours?.open ?? '10:00').split(':').map(Number);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh, om, 0, 0);
  if (t.getMinutes() % 30 !== 0) t.setMinutes(t.getMinutes() + 30 - (t.getMinutes() % 30));
  return t;
}

/* ---------- 复用或造单 ---------- */
const { groups } = await trpcQuery('appointment.listMine', null, cCookie);
const completed = groups.completed ?? [];
let groomingDone = completed.find((a) => a.type === 'grooming');
let boardingDone = completed.find((a) => a.type === 'boarding');
console.log('existing completed:', completed.map((a) => `${a.type}:${a.id}`).join(', ') || '(none)');

if (!groomingDone) {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const slot = svc.slots
    .map((s) => new Date(s.slotStart))
    .find((d) => dayKeyOf(d) === dayKeyOf(tomorrow) && d.getHours() >= 13);
  if (!slot) throw new Error('明天 ≥13:00 无可用槽位');
  const r = await trpcMutate('appointment.create', {
    storeId: store.id, petId: pet.id, serviceId: svcGrooming.id, type: 'grooming',
    scheduledStart: slot.toISOString(), paymentMode: 'pay_at_store', note: 'B2-3 复现单（洗护·已完成）',
  }, cCookie, ['scheduledStart']);
  const aid = (r.appointment ?? r).id;
  await trpcMutate('appointment.confirm', { appointmentId: aid }, mCookie);
  await trpcMutate('appointment.assign', { appointmentId: aid, staffId: staffWash.id }, mCookie);
  const { code } = await trpcQuery('appointment.getCode', { appointmentId: aid }, cCookie);
  await trpcMutate('appointment.checkin', { code }, sWashCookie);
  const STEP_PHOTOS = {
    disinfection: [{ url: '/api/img/b23/g-dis-1.png' }],
    precheck: [{ url: '/api/img/b23/g-pre-1.png' }, { url: '/api/img/b23/g-pre-2.png' }],
    grooming: [{ url: '/api/img/b23/g-gr-1.png' }, { url: '/api/img/b23/g-gr-2.png' }, { url: '/api/img/b23/g-gr-3.png' }],
    detail: [{ url: '/api/img/b23/g-det-1.png' }, { url: '/api/img/b23/g-det-2.png' }],
    before_after: [{ url: '/api/img/b23/g-before.png', tag: 'before' }, { url: '/api/img/b23/g-after.png', tag: 'after' }],
  };
  for (const [stepKey, photos] of Object.entries(STEP_PHOTOS)) {
    await trpcMutate('serviceStep.addPhotos', { appointmentId: aid, stepKey, photos }, sWashCookie);
    await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey }, sWashCookie);
  }
  await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey: 'confirm' }, sWashCookie);
  groomingDone = { id: aid, type: 'grooming' };
  console.log('grooming completed created:', aid);
}

if (!boardingDone) {
  const now = new Date();
  const ci = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const co = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4); // 3 晚
  const r = await trpcMutate('appointment.create', {
    storeId: store.id, petId: pet.id, serviceId: svcBoarding.id, type: 'boarding',
    scheduledStart: openAt(ci).toISOString(), scheduledEnd: openAt(co).toISOString(),
    paymentMode: 'pay_at_store', note: 'B2-3 复现单（寄养·已完成）',
  }, cCookie, ['scheduledStart', 'scheduledEnd']);
  const aid = (r.appointment ?? r).id;
  await trpcMutate('appointment.confirm', { appointmentId: aid }, mCookie);
  await trpcMutate('appointment.assign', { appointmentId: aid, staffId: staffBoard.id }, mCookie);
  const { code } = await trpcQuery('appointment.getCode', { appointmentId: aid }, cCookie);
  await trpcMutate('appointment.checkin', { code }, sBoardCookie);
  await trpcMutate('boarding.checkinStay', { appointmentId: aid, checkinWeightKg: pet.weightKg ?? 5 }, sBoardCookie);
  await trpcMutate('boarding.checkout', { appointmentId: aid }, sBoardCookie);
  boardingDone = { id: aid, type: 'boarding' };
  console.log('boarding completed created:', aid);
}

/* ---------- 复核状态 ---------- */
const g = await trpcQuery('appointment.get', { appointmentId: groomingDone.id }, cCookie);
const b = await trpcQuery('appointment.get', { appointmentId: boardingDone.id }, cCookie);
if (g.appointment.status !== 'completed' || b.appointment.status !== 'completed') {
  throw new Error(`状态异常: grooming=${g.appointment.status} boarding=${b.appointment.status}`);
}

const out = {
  customerId: customer.id,
  groomingDone: { id: g.appointment.id, serviceId: g.appointment.serviceId, storeId: g.appointment.storeId, petId: g.appointment.petId, serviceName: g.service?.name, petName: g.pet?.name },
  boardingDone: { id: b.appointment.id, serviceId: b.appointment.serviceId, storeId: b.appointment.storeId, petId: b.appointment.petId, serviceName: b.service?.name, roomType: b.service?.boardingRoomType ?? null, petName: b.pet?.name },
};
writeFileSync(resolve(DIR, 'data.json'), JSON.stringify(out, null, 2));
console.log('data.json:', JSON.stringify(out, null, 2));
