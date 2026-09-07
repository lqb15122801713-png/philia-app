/** B3-5 补拍：员工端「办理退房」按钮可见态 + 内联确认（再造一单寄养到 in_boarding，拍后 curl 退房收尾） */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, login, sleep, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };
const localAt = (dayOffset, h) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, 0, 0, 0); return d; };

const users = await (await fetch('http://localhost:7200/api/auth/dev-seed-users').then((r) => r.json())).users;
const customer = users.find((u) => u.roles.includes('customer'));
const merchant = users.find((u) => u.roles.includes('merchant_owner'));
const aq = users.find((u) => u.nickname === '阿强');
const cC = await login(customer.id);
const mC = await login(merchant.id);
const aqC = await login(aq.id);

const store = (await trpcQuery('store.listNearby', {}, cC)).stores[0];
const gws = await trpcQuery('store.getWithServices', { storeId: store.id }, cC);
const boardingSvc = gws.services.find((s) => s.type === 'boarding' && /猫/.test(s.boardingRoomType ?? s.name));
const pets = await trpcQuery('pet.list', null, cC);
const cat = pets.find((p) => p.species === 'cat');
const staffList = (await trpcQuery('store.staffList', null, mC)).staff;
const aqRow = staffList.find((s) => s.name === '阿强');

// 建单（9/10→9/11 一晚，避开 orderF 已占晚）→ 确认 → 派阿强 → 核销 → 入住登记
const appt = await trpcMutate('appointment.create', {
  storeId: store.id, petId: cat.id, serviceId: boardingSvc.id, type: 'boarding',
  scheduledStart: localAt(3, 9), scheduledEnd: localAt(4, 9), paymentMode: 'pay_at_store',
}, cC, ['scheduledStart', 'scheduledEnd']);
await trpcMutate('appointment.confirm', { appointmentId: appt.id }, mC);
await trpcMutate('appointment.assign', { appointmentId: appt.id, staffId: aqRow.id }, mC);
const codeRes = await trpcQuery('appointment.getCode', { appointmentId: appt.id }, cC);
await trpcMutate('appointment.checkin', { code: codeRes.code }, aqC);
await trpcMutate('boarding.checkinStay', {
  appointmentId: appt.id, checkinWeightKg: 4.2, belongings: [{ name: '猫条' }], roomNo: 'C02',
}, aqC);
save('verify-p214-orderG.json', { orderG: appt.id, status: 'in_boarding' });

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);
await b.goto('http://localhost:7102/dev-login', 2500);
console.log('staff(阿强) login:', await b.loginInPage(aq.id));
await b.goto(`http://localhost:7102/boarding/${appt.id}/checkin`, 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('办理退房'))?.scrollIntoView({ block: 'center' })`);
await sleep(600);
await b.shot(join(OUT, 'verify-p214-staff-checkout-btn.png'));
console.log('button visible shot');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('办理退房'))?.click()`);
await sleep(600);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '确认退房')?.scrollIntoView({ block: 'center' })`);
await sleep(400);
await b.shot(join(OUT, 'verify-p214-staff-confirm.png'));
console.log('confirm shot');
b.close();

// 收尾：该单 curl 退房（员工 200 回归再证一次；完成后看板干净）
const co = await trpcMutate('boarding.checkout', { appointmentId: appt.id }, aqC);
save('verify-p214-staff-curl-200.json', { alreadyCompleted: co.alreadyCompleted, status: co.appointment.status, checkoutAt: co.stay.checkoutAt });
console.log('done');
