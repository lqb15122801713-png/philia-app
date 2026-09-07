/**
 * B2-3 越权与未登录验收：
 *  - curl 级：未登录 appointment.get → UNAUTHORIZED；他人客户 → FORBIDDEN；本人 → 200
 *  - 页面级：未登录打开详情 URL → 错误态/登录页，无「再次预约」；
 *           他人客户打开 → 「预约不存在或无权查看」，无「再次预约」
 * 依赖：stranger 客户已由 server/tmp-b23-stranger.mts 写入（kimiId=seed_kimi_customer2）。
 * 输出：access-http.json / after-7-guest-detail.png / after-8-stranger-detail.png
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, Browser, findUser, login, seedUsers, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';
const data = JSON.parse(readFileSync(resolve(DIR, 'data.json'), 'utf8'));

const http = {};
// 未登录
try {
  await trpcQuery('appointment.get', { appointmentId: data.groomingDone.id }, null);
  http.guest = { ok: false, note: '未登录竟取到详情！' };
} catch (e) {
  http.guest = { ok: /UNAUTHORIZED/.test(String(e)), error: String(e).slice(0, 200) };
}
// 他人（stranger）
const users = await seedUsers();
const stranger = users.find((u) => u.nickname === '路人客户');
if (!stranger) throw new Error('未找到路人客户，请先跑 server/tmp-b23-stranger.mts');
const strangerCookie = await login(stranger.id);
try {
  await trpcQuery('appointment.get', { appointmentId: data.groomingDone.id }, strangerCookie);
  http.stranger = { ok: false, note: '他人竟取到详情！' };
} catch (e) {
  http.stranger = { ok: /FORBIDDEN/.test(String(e)), error: String(e).slice(0, 200) };
}
// 本人（对照）
const customer = await findUser('customer');
const cCookie = await login(customer.id);
const mine = await trpcQuery('appointment.get', { appointmentId: data.groomingDone.id }, cCookie);
http.owner = { ok: mine.appointment?.id === data.groomingDone.id };
console.log(JSON.stringify(http, null, 2));
writeFileSync(resolve(DIR, 'access-http.json'), JSON.stringify(http, null, 2));

/* ---------- 页面级 ---------- */
const b = new Browser();
try {
  await b.launch();
  await b.viewport(390, 844, true);
  // 未登录（全新 profile，无会话）
  await b.goto(`${CUSTOMER}/appointments/${data.groomingDone.id}`, 3500);
  let dom = await b.eval(`(() => ({
    path: location.pathname,
    hasRebook: document.body.innerText.includes('再次预约'),
    text: document.body.innerText.slice(0, 120),
  }))()`);
  console.log('guest page:', JSON.stringify(dom));
  http.guestPage = { ok: !dom.hasRebook, ...dom };
  await b.shot(resolve(DIR, 'after-7-guest-detail.png'));

  // 他人登录后打开
  await b.goto(`${CUSTOMER}/dev-login`, 2000);
  await b.loginInPage(stranger.id);
  await b.goto(`${CUSTOMER}/appointments/${data.groomingDone.id}`, 3500);
  dom = await b.eval(`(() => ({
    hasRebook: document.body.innerText.includes('再次预约'),
    notFound: document.body.innerText.includes('预约不存在或无权查看') || document.body.innerText.includes('预约详情加载失败'),
    leakedInfo: document.body.innerText.includes('预约信息'),
  }))()`);
  console.log('stranger page:', JSON.stringify(dom));
  http.strangerPage = { ok: !dom.hasRebook && dom.notFound && !dom.leakedInfo, ...dom };
  await b.shot(resolve(DIR, 'after-8-stranger-detail.png'));

  writeFileSync(resolve(DIR, 'access-http.json'), JSON.stringify(http, null, 2));
  const allOk = http.guest.ok && http.stranger.ok && http.owner.ok && http.guestPage.ok && http.strangerPage.ok;
  console.log(allOk ? 'ACCESS CHECKS PASS' : 'ACCESS CHECKS FAIL');
} finally {
  b.close();
}
