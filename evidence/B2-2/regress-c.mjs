/**
 * B2-2 回归：新建单 C 走完整状态机（confirm→assign→checkin→六步→completed），
 * 每个节点记录 listMine 分组归属与计数 → regress-stages.json。
 * 不动 B2-1 的 pending 验收单与既有 A(completed)/B(cancelled)。
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const stages = {};

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

const { staff } = await trpcQuery('store.staffList', null, mCookie);
const staffRow = staff.find((s) => (s.skills ?? []).includes('wash') && s.status === 'active');
const sCookie = await login(staffRow.userId);
console.log('customer:', customer.nickname, '| merchant:', merchant.nickname, '| staff:', staffRow.name, staffRow.id);

const pets = await trpcQuery('pet.list', null, cCookie);
const pet = pets[0];
const { stores } = await trpcQuery('store.listNearby', {}, cCookie);
const store = stores[0];
const svc = await trpcQuery('store.getWithServices', { storeId: store.id }, cCookie);
const service = svc.services.find((s) => s.type === 'grooming');

const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const dayKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const slot = svc.slots.map((s) => new Date(s.slotStart)).find((d) => dayKeyOf(d) === tKey && d.getHours() >= 13);
if (!slot) throw new Error('明天 ≥13:00 无可用槽位');

const r = await trpcMutate('appointment.create', {
  storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
  scheduledStart: slot.toISOString(), paymentMode: 'pay_at_store', note: 'B2-2 回归单 C（走全状态机）',
}, cCookie, ['scheduledStart']);
const apptC = (r.appointment ?? r).id;
console.log('C created:', apptC, slot.toString());
stages['C.created_expect_pending'] = await groupOf(cCookie, apptC);

await trpcMutate('appointment.confirm', { appointmentId: apptC }, mCookie);
stages['C.confirmed_expect_confirmed'] = await groupOf(cCookie, apptC);
console.log('C confirmed');

await trpcMutate('appointment.assign', { appointmentId: apptC, staffId: staffRow.id }, mCookie);
console.log('C assigned ->', staffRow.name);

const { code } = await trpcQuery('appointment.getCode', { appointmentId: apptC }, cCookie);
await trpcMutate('appointment.checkin', { code }, sCookie);
stages['C.checkedin_expect_in_service'] = await groupOf(cCookie, apptC);
console.log('C checkedin');

const STEP_PHOTOS = {
  disinfection: [{ url: '/api/img/b2/c-dis-1.png' }],
  precheck: [{ url: '/api/img/b2/c-pre-1.png' }, { url: '/api/img/b2/c-pre-2.png' }],
  grooming: [{ url: '/api/img/b2/c-gr-1.png' }, { url: '/api/img/b2/c-gr-2.png' }, { url: '/api/img/b2/c-gr-3.png' }],
  detail: [{ url: '/api/img/b2/c-det-1.png' }, { url: '/api/img/b2/c-det-2.png' }],
  before_after: [{ url: '/api/img/b2/c-before.png', tag: 'before' }, { url: '/api/img/b2/c-after.png', tag: 'after' }],
};
for (const [stepKey, photos] of Object.entries(STEP_PHOTOS)) {
  await trpcMutate('serviceStep.addPhotos', { appointmentId: apptC, stepKey, photos }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: apptC, stepKey }, sCookie);
  console.log('C step done:', stepKey);
}
await trpcMutate('serviceStep.confirmStep', { appointmentId: apptC, stepKey: 'confirm' }, sCookie);
stages['C.completed_expect_completed'] = await groupOf(cCookie, apptC);
console.log('C completed');

writeFileSync(resolve(DIR, 'regress-stages.json'), JSON.stringify({ apptC, stages }, null, 2));
console.log('final:', JSON.stringify(stages['C.completed_expect_completed']));
