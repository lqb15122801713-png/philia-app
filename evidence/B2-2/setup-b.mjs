/**
 * B2-2 造数（补单 B）：客户造 1 单明天 14:00 洗护并取消（>4h 直接 cancelled）。
 * 然后从 listMine 分组汇总 completed/cancelled 单 id 写 data.json（A 单由 setup-data 首次运行完成）。
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));

const customer = await findUser('customer');
const cCookie = await login(customer.id);

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
const slot = svc.slots.map((s) => new Date(s.slotStart)).find((d) => dayKeyOf(d) === tKey && d.getHours() === 14);
if (!slot) throw new Error('明天 14:00 无可用槽位');

const r = await trpcMutate('appointment.create', {
  storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
  scheduledStart: slot.toISOString(), paymentMode: 'pay_at_store', note: 'B2-2 验收单 B（取消）',
}, cCookie, ['scheduledStart']);
const apptB = (r.appointment ?? r).id;
console.log('B created:', apptB, slot.toString());

const cancelRes = await trpcMutate('appointment.cancel', { appointmentId: apptB }, cCookie);
console.log('B cancel outcome:', cancelRes.outcome);

const { groups } = await trpcQuery('appointment.listMine', null, cCookie);
const summary = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((a) => a.id)]));
console.log('groups:', JSON.stringify(summary));
writeFileSync(resolve(DIR, 'data.json'), JSON.stringify({
  apptA_completed: groups.completed.map((a) => a.id),
  apptB_cancelled: groups.cancelled.map((a) => a.id),
  counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
}, null, 2));
