/**
 * B2-2 造数：1 单走完状态机到 completed + 1 单取消（>4h 直接 cancelled）。
 * 每个状态节点记录 listMine 分组归属（状态机回归证据），输出 data.json + stages.json。
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const stages = {};

/** 某预约当前在 listMine 哪个分组（客户端 Tab 数据源） */
async function groupOf(cookie, apptId) {
  const { groups } = await trpcQuery('appointment.listMine', null, cookie);
  const inGroups = Object.entries(groups).filter(([, arr]) => arr.some((a) => a.id === apptId)).map(([k]) => k);
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
  return { inGroups, counts };
}

const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');
const cCookie = await login(customer.id);
const mCookie = await login(merchant.id);
console.log('customer:', customer.nickname, '| merchant:', merchant.nickname);

const { staff } = await trpcQuery('store.staffList', null, mCookie);
const staffRow = staff.find((s) => (s.skills ?? []).includes('wash') && s.status === 'active');
if (!staffRow) throw new Error('无 wash 技能在职员工');
const sCookie = await login(staffRow.userId);
console.log('staff:', staffRow.name, staffRow.id);

const pets = await trpcQuery('pet.list', null, cCookie);
const pet = pets[0];
const { stores } = await trpcQuery('store.listNearby', {}, cCookie);
const store = stores[0];
const svc = await trpcQuery('store.getWithServices', { storeId: store.id }, cCookie);
const service = svc.services.find((s) => s.type === 'grooming');

// 明天 13:00 之后的两个不同槽位
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tomorrowSlots = svc.slots.map((s) => new Date(s.slotStart)).filter((d) => dayKeyOf(d) === tKey && d.getHours() >= 13);
if (tomorrowSlots.length < 2) throw new Error('明天可用槽位不足');
const startA = tomorrowSlots[0];
const startB = tomorrowSlots[tomorrowSlots.length - 1];

async function createAppt(start, note) {
  const r = await trpcMutate('appointment.create', {
    storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
    scheduledStart: start.toISOString(), paymentMode: 'pay_at_store', note,
  }, cCookie, ['scheduledStart']);
  return (r.appointment ?? r).id;
}

/* ---------- 单 A：completed ---------- */
const apptA = await createAppt(startA, 'B2-2 验收单 A（走完成）');
console.log('A created:', apptA, startA.toString());
stages['A.created'] = await groupOf(cCookie, apptA);

await trpcMutate('appointment.confirm', { appointmentId: apptA }, mCookie);
stages['A.confirmed'] = await groupOf(cCookie, apptA);
console.log('A confirmed');

await trpcMutate('appointment.assign', { appointmentId: apptA, staffId: staffRow.id }, mCookie);
console.log('A assigned ->', staffRow.name);

const { code } = await trpcQuery('appointment.getCode', { appointmentId: apptA }, cCookie);
await trpcMutate('appointment.checkin', { code }, sCookie);
stages['A.checkedin'] = await groupOf(cCookie, apptA);
console.log('A checkedin (in_service)');

const STEP_PHOTOS = {
  disinfection: [{ url: '/api/img/b2/a-dis-1.png' }],
  precheck: [{ url: '/api/img/b2/a-pre-1.png' }, { url: '/api/img/b2/a-pre-2.png' }],
  grooming: [{ url: '/api/img/b2/a-gr-1.png' }, { url: '/api/img/b2/a-gr-2.png' }, { url: '/api/img/b2/a-gr-3.png' }],
  detail: [{ url: '/api/img/b2/a-det-1.png' }, { url: '/api/img/b2/a-det-2.png' }],
  before_after: [{ url: '/api/img/b2/a-before.png', tag: 'before' }, { url: '/api/img/b2/a-after.png', tag: 'after' }],
};
for (const [stepKey, photos] of Object.entries(STEP_PHOTOS)) {
  await trpcMutate('serviceStep.addPhotos', { appointmentId: apptA, stepKey, photos }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: apptA, stepKey }, sCookie);
  console.log('A step done:', stepKey);
}
await trpcMutate('serviceStep.confirmStep', { appointmentId: apptA, stepKey: 'confirm' }, sCookie);
stages['A.completed'] = await groupOf(cCookie, apptA);
console.log('A completed');

/* ---------- 单 B：cancelled ---------- */
const apptB = await createAppt(startB, 'B2-2 验收单 B（取消）');
console.log('B created:', apptB, startB.toString());
stages['B.created'] = await groupOf(cCookie, apptB);
const cancelRes = await trpcMutate('appointment.cancel', { appointmentId: apptB }, cCookie);
console.log('B cancel outcome:', cancelRes.outcome);
stages['B.cancelled'] = await groupOf(cCookie, apptB);

/* ---------- 终态汇总 ---------- */
const finalGroups = await groupOf(cCookie, apptA);
console.log('final:', JSON.stringify(finalGroups));
writeFileSync(resolve(DIR, 'data.json'), JSON.stringify({ apptA, apptB, startA, startB }, null, 2));
writeFileSync(resolve(DIR, 'stages.json'), JSON.stringify(stages, null, 2));
