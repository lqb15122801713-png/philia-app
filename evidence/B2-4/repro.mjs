/**
 * B2-4 复现：B2-2 留下的已完成洗护单（库内 10 张步骤照片）在客户详情页无相册区块。
 * 输出：repro.json + before-detail.png
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, login, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const APPT = '01M1WZ4AGPAHCGNGH86BSJ07PB'; // B2-2 造数：completed 洗护单，10 张照片
const out = {};

const customer = await findUser('customer'); // 示例客户
const cCookie = await login(customer.id);

const detail = await trpcQuery('appointment.get', { appointmentId: APPT }, cCookie);
out.status = detail.appointment?.status;
out.type = detail.appointment?.type;
out.stepCountInGet = detail.steps?.length ?? 0; // get 返回 steps 但不含照片
out.getHasPhotos = (detail.steps ?? []).some((s) => Array.isArray(s.photos) && s.photos.length > 0);

// 服务端确有 10 张未失效照片（serviceStep.list 为 publicProcedure+归属校验，客户可读）
const steps = await trpcQuery('serviceStep.list', { appointmentId: APPT }, cCookie);
out.photoCountInDb = steps.reduce((n, s) => n + (s.photos?.length ?? 0), 0);
out.stepPhotoBreakdown = steps.map((s) => ({ stepKey: s.stepKey, status: s.status, photos: s.photos?.length ?? 0 }));

console.log(JSON.stringify(out, null, 2));

const b = new Browser();
try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto('http://localhost:7100/dev-login', 1500);
  await b.loginInPage(customer.id);
  await b.goto(`http://localhost:7100/appointments/${APPT}`, 3500);
  const dom = await b.eval(`(() => ({
    statusText: document.body.innerText.includes('已完成'),
    hasAlbum: document.body.innerText.includes('相册'),
    imgCount: document.querySelectorAll('img').length,
    sections: [...document.querySelectorAll('h2')].map((h) => h.innerText),
  }))()`);
  out.page = dom;
  console.log('page:', JSON.stringify(dom));
  await b.shot(resolve(DIR, 'before-detail.png'));
  writeFileSync(resolve(DIR, 'repro.json'), JSON.stringify(out, null, 2));
  console.log(out.photoCountInDb === 10 && !dom.hasAlbum ? 'REPRO CONFIRMED（库内10张照片，详情页无相册）' : 'REPRO UNCERTAIN');
} finally {
  b.close();
}
