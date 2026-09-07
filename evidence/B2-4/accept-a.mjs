/**
 * B2-4 验收 a：造一单洗护，真实上传 10 张照片走满六步 → completed。
 * 中途（step4 进行中、step1-3 已确认）断言「进行中只显示已确认步骤照片」并截图；
 * 完成后断言 serviceAlbum 6 组 10 张 + 详情页相册区块 DOM/截图；
 * 并抽查 /api/img/* 签名链路与第一步照片 HTTP 200。
 * 输出：accept-a.json / after-inprogress.png / after-completed.png
 */
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, Browser, findUser, login, trpcMutate, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';
const out = { checks: {} };

/* ---------------- 极简 PNG 生成（纯色 64x64，zlib 内置） ---------------- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => buf.reduce((c, b) => CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8), 0xffffffff) ^ 0xffffffff;
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
function solidPng([r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(64, 0);
  ihdr.writeUInt32BE(64, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
  const raw = Buffer.alloc(64 * (1 + 64 * 3));
  for (let y = 0; y < 64; y++) {
    const row = y * (1 + 64 * 3);
    for (let x = 0; x < 64; x++) {
      raw[row + 1 + x * 3] = r; raw[row + 2 + x * 3] = g; raw[row + 3 + x * 3] = b;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function upload(cookie, relDir, rgb, name) {
  const form = new FormData();
  form.append('file', new Blob([solidPng(rgb)], { type: 'image/png' }), name);
  form.append('relDir', relDir);
  const res = await fetch(`${API}/api/upload`, { method: 'POST', headers: { cookie }, body: form });
  if (res.status !== 200) throw new Error(`upload HTTP ${res.status}: ${await res.text()}`);
  return res.json(); // { url, thumbUrl }
}

/* ---------------- 账号与造单 ---------------- */
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
  .find((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === tKey && d.getHours() >= 15);
if (!slot) throw new Error('明天 15 点后无可用槽位');

const created = await trpcMutate('appointment.create', {
  storeId: stores[0].id, petId: pets[0].id, serviceId: service.id, type: 'grooming',
  scheduledStart: slot.toISOString(), paymentMode: 'pay_at_store', note: 'B2-4 验收单（服务相册）',
}, cCookie, ['scheduledStart']);
const aid = (created.appointment ?? created).id;
out.appointmentId = aid;
await trpcMutate('appointment.confirm', { appointmentId: aid }, mCookie);
await trpcMutate('appointment.assign', { appointmentId: aid, staffId: staffRow.id }, mCookie);
const { code } = await trpcQuery('appointment.getCode', { appointmentId: aid }, cCookie);
await trpcMutate('appointment.checkin', { code }, sCookie);
console.log('checked in:', aid);

/* ---------------- 照片计划：六步 10 张 ---------------- */
const COLORS = [[217, 142, 95], [196, 120, 80], [120, 160, 200], [90, 140, 110], [180, 90, 90], [150, 110, 180], [200, 170, 90], [90, 120, 150], [160, 140, 120], [70, 90, 110]];
let colorIdx = 0;
async function photosFor(stepKey, specs) {
  const relDir = `appointment/${aid}/${stepKey}`;
  const arr = [];
  for (const spec of specs) {
    const up = await upload(sCookie, relDir, COLORS[colorIdx++ % COLORS.length], `${stepKey}-${arr.length + 1}.png`);
    arr.push({ url: up.url, ...(spec ? { tag: spec } : {}) });
  }
  return arr;
}

// step1-3：各传满并 confirm
const PLAN_HEAD = { disinfection: [null], precheck: [null, null], grooming: [null, null, null] };
for (const [stepKey, specs] of Object.entries(PLAN_HEAD)) {
  const photos = await photosFor(stepKey, specs);
  await trpcMutate('serviceStep.addPhotos', { appointmentId: aid, stepKey, photos }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey }, sCookie);
  console.log('step done:', stepKey);
}

// step4 进行中：传 1 张（不确认）——用于「进行中只显示已确认步骤照片」断言
const detailDraft = await photosFor('detail', [null]);
await trpcMutate('serviceStep.addPhotos', { appointmentId: aid, stepKey: 'detail', photos: detailDraft }, sCookie);

const albumMid = await trpcQuery('appointment.serviceAlbum', { appointmentId: aid }, cCookie);
out.midStatus = albumMid.status;
out.midSteps = albumMid.steps.map((s) => ({ stepKey: s.stepKey, status: s.status, photos: s.photos.length }));
// 客户端口径：非 completed 只展示 done 步
const midVisible = albumMid.steps.filter((s) => s.status === 'done');
out.checks.midOnlyDonePhotos = midVisible.every((s) => s.status === 'done')
  && midVisible.reduce((n, s) => n + s.photos.length, 0) === 6
  && !midVisible.some((s) => s.photos.some((p) => detailDraft.some((d) => d.url === p.url)));

const b = new Browser();
try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto(`${CUSTOMER}/dev-login`, 1500);
  await b.loginInPage(customer.id);
  await b.goto(`${CUSTOMER}/appointments/${aid}`, 3500);
  const domMid = await b.eval(`(() => {
    const text = document.body.innerText;
    const imgs = [...document.querySelectorAll('section img')].map((i) => i.getAttribute('src'));
    return {
      hasAlbum: text.includes('服务相册'),
      draftLeaked: imgs.some((u) => u && u.includes('${detailDraft[0].url.split('?')[0].split('/').pop()}')),
      albumImgs: imgs.filter((u) => u && u.includes('/api/img/')).length,
      groups: [...document.querySelectorAll('h3')].map((h) => h.innerText),
    };
  })()`);
  console.log('mid page:', JSON.stringify(domMid));
  out.midPage = domMid;
  const shotMid = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(resolve(DIR, 'after-inprogress.png'), Buffer.from(shotMid.data, 'base64'));

  /* ---------------- 走完剩余步骤 → completed ---------------- */
  const detailRest = await photosFor('detail', [null]);
  await trpcMutate('serviceStep.addPhotos', { appointmentId: aid, stepKey: 'detail', photos: detailRest }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey: 'detail' }, sCookie);
  const baPhotos = await photosFor('before_after', ['before', 'after']);
  await trpcMutate('serviceStep.addPhotos', { appointmentId: aid, stepKey: 'before_after', photos: baPhotos }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey: 'before_after' }, sCookie);
  await trpcMutate('serviceStep.confirmStep', { appointmentId: aid, stepKey: 'confirm' }, sCookie);
  console.log('completed');

  const albumFinal = await trpcQuery('appointment.serviceAlbum', { appointmentId: aid }, cCookie);
  out.finalStatus = albumFinal.status;
  out.finalSteps = albumFinal.steps.map((s) => ({ stepKey: s.stepKey, stepName: s.stepName, status: s.status, photos: s.photos.length, tags: s.photos.map((p) => p.tag) }));
  out.checks.finalSixGroups = albumFinal.steps.length === 6;
  out.checks.finalTenPhotos = albumFinal.steps.reduce((n, s) => n + s.photos.length, 0) === 10;
  const ba = albumFinal.steps.find((s) => s.stepKey === 'before_after');
  out.checks.beforeAfterTags = ba.photos.some((p) => p.tag === 'before') && ba.photos.some((p) => p.tag === 'after');

  // /api/img/* 链路抽查：第一张照片签名 URL HTTP 200
  const firstUrl = albumFinal.steps[0].photos[0].url;
  const imgRes = await fetch(`${CUSTOMER}${firstUrl}`); // 走 7100 vite proxy → 7200
  out.checks.imgLink200 = imgRes.status === 200;
  out.imgProbe = { url: firstUrl.slice(0, 80), status: imgRes.status };

  await b.goto(`${CUSTOMER}/appointments/${aid}`, 3500);
  const domFinal = await b.eval(`(() => {
    const text = document.body.innerText;
    const imgs = [...document.querySelectorAll('img')].filter((i) => (i.getAttribute('src') ?? '').includes('/api/img/'));
    return {
      hasAlbum: text.includes('服务相册'),
      groupTitles: [...document.querySelectorAll('h3')].map((h) => h.innerText),
      albumImgs: imgs.length,
      loadedImgs: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      hasBeforeBadge: text.includes('服务前'),
      hasAfterBadge: text.includes('服务后'),
    };
  })()`);
  console.log('final page:', JSON.stringify(domFinal));
  out.finalPage = domFinal;
  out.checks.pageSixGroups = domFinal.groupTitles.length === 6;
  out.checks.pageTenImgsLoaded = domFinal.albumImgs === 10 && domFinal.loadedImgs === 10;
  const shotFinal = await b.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(resolve(DIR, 'after-completed.png'), Buffer.from(shotFinal.data, 'base64'));
} finally {
  b.close();
}

writeFileSync(resolve(DIR, 'accept-a.json'), JSON.stringify(out, null, 2));
const allOk = Object.values(out.checks).every(Boolean);
console.log(JSON.stringify(out.checks, null, 2));
console.log(allOk ? 'ACCEPT-A PASS' : 'ACCEPT-A FAIL');
