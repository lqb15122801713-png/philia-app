/** B2-1 造数：客户创建一单「明天」的洗护预约（勿确认），结果写 appt.json */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

const customer = await findUser('customer');
const cookie = await login(customer.id);
console.log('customer:', customer.nickname, customer.id);

const pets = await trpcQuery('pet.list', null, cookie);
const pet = pets[0];
console.log('pet:', pet.name, pet.id);

const { stores } = await trpcQuery('store.listNearby', {}, cookie);
const store = stores[0];
const svc = await trpcQuery('store.getWithServices', { storeId: store.id }, cookie);
const service = svc.services.find((s) => s.type === 'grooming');
console.log('service:', service.name, service.id);

// 明天的日期键（本地时区）
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const slot = svc.slots.find((s) => {
  const d = new Date(s.slotStart);
  const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return k === tKey && d.getHours() >= 13;
});
if (!slot) throw new Error('明天 13:00 后无可用槽位');
const start = new Date(slot.slotStart);
console.log('slot:', start.toString());

const created = await trpcMutate('appointment.create', {
  storeId: store.id,
  petId: pet.id,
  serviceId: service.id,
  type: 'grooming',
  scheduledStart: start.toISOString(),
  paymentMode: 'pay_at_store',
  note: 'B2-1 验收单（明天，待确认）',
}, cookie, ['scheduledStart']);
const appt = created.appointment ?? created;
console.log('created:', appt.id, appt.status, appt.scheduledStart);
writeFileSync(resolve(DIR, 'appt.json'), JSON.stringify({ appointmentId: appt.id, start: start.toISOString(), pet: pet.name, service: service.name }, null, 2));
