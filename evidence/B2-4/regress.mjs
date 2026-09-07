/**
 * B2-4 回归：员工端六步上传链路不受影响（接口级）。
 * 新建一单 → 核销 → step1 addPhotos/confirmStep 正常；locked 步 addPhotos 仍 FORBIDDEN；
 * step2 确认后 appointment.get / serviceStep.list 数据完好。
 * 输出：regress.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const out = { checks: {} };

const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');
const cCookie = await login(customer.id);
const mCookie = await login(merchant.id);
const { staff } = await trpcQuery('store.staffList', null, mCookie);
const staffRow = staff.find((s) => (s.skills ?? []).includes('wash') && s.status === 'active');
const sCookie = await login(staffRow.userId);

const pets = await trpcQuery('pet.list', null, cCookie);
const { stores } = await trpcQuery('store.listNearby', {}, cCookie);
const svc = await trpcQuery('store.getWithServices', { storeId: stores[0].id }, cCookie);
const service = svc.services.find((s) => s.type === 'grooming');
const now = new Date();
const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const tKey = `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`;
const slot = svc.slots
  .map((s) => new Date(s.slotStart))
  .find((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === tKey && d.getHours() >= 16);
const created = await trpcMutate('appointment.create', {
  storeId: stores[0].id, petId: pets[0].id, serviceId: service.id, type: 'grooming',
  scheduledStart: slot.toISOString(), paymentMode: 'pay_at_store', note: 'B2-4 回归单',
}, cCookie, ['scheduledStart']);
const aid = (created.appointment ?? created).id;
out.appointmentId = aid;
await trpcMutate('appointment.confirm', { appointmentId: aid }, mCookie);
await trpcMutate('appointment.assign', { appointmentId: aid, staffId: staffRow.id }, mCookie);
const { code } = await trpcQuery('appointment.getCode', { appointmentId: aid }, cCookie);
await trpcMutate('appointment.checkin', { code }, sCookie);

// step1 上传 1 张（伪 URL 即可，回归只走接口语义）
const add = await trpcMutate('serviceStep.addPhotos', {
  appointmentId: aid, stepKey: 'disinfection', photos: [{ url: '/api/img/regress/r-dis-1.png' }],
}, sCookie);
out.checks.addPhotosOk = add.added === 1 && add.totalValid === 1;

// locked 步（grooming）上传仍被规则 2 拒绝
try {
  await trpcMutate('serviceStep.addPhotos', {
    appointmentId: aid, stepKey: 'grooming', photos: [{ url: '/api/img/regress/x.png' }],
  }, sCookie);
  out.checks.lockedRejected = false;
} catch (e) {
  out.checks.lockedRejected = /FORBIDDEN/.test(String(e));
}

// step1 confirm → step2 active
const conf = await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey: 'disinfection' }, sCookie);
out.checks.confirmStepOk = conf.status === 'done' && conf.nextStepKey === 'precheck' && conf.appointmentCompleted === false;

const steps = await trpcQuery('serviceStep.list', { appointmentId: aid }, cCookie);
out.checks.step1PhotoVisible = steps.find((s) => s.stepKey === 'disinfection')?.photos?.length === 1;
out.checks.step2Active = steps.find((s) => s.stepKey === 'precheck')?.status === 'active';

// 本人 serviceAlbum 也能看到这 1 张（进行中含未确认步，数据完整返回，端上过滤）
const album = await trpcQuery('appointment.serviceAlbum', { appointmentId: aid }, cCookie);
out.checks.albumInService = album.status === 'in_service'
  && album.steps.find((s) => s.stepKey === 'disinfection')?.photos?.length === 1;

writeFileSync(resolve(DIR, 'regress.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.checks, null, 2));
console.log(Object.values(out.checks).every(Boolean) ? 'REGRESS PASS' : 'REGRESS FAIL');
