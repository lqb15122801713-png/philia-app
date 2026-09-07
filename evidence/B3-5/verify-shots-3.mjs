/** B3-5 修复后 UI 验收截图 · 段3：员工端（W-16 未来 7 天 / A-P2-14 员工退房） */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };
const fx = JSON.parse(readFileSync(join(OUT, 'ui-fixtures.json'), 'utf8'));
const users = await (await fetch('http://localhost:7200/api/auth/dev-seed-users').then((r) => r.json())).users;
const xm = users.find((u) => u.nickname === '小美');
const aq = users.find((u) => u.nickname === '阿强');

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

/* ---- W-16：未来 7 天视图 ---- */
await b.goto('http://localhost:7102/dev-login', 2500);
console.log('staff(小美) login:', await b.loginInPage(xm.id));
await b.goto('http://localhost:7102/today', 3200);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '未来 7 天')?.click()`);
await sleep(1800);
save('verify-w16-dom.json', await b.eval(`(() => ({
  tabPresent: [...document.querySelectorAll('[role="tab"]')].map((x) => x.textContent.trim()),
  groups: [...document.querySelectorAll('section h2')].map((h) => h.textContent.trim().replace(/\\s+/g, ' ')),
  cards: [...document.querySelectorAll('section ul li')].map((li) => li.innerText.replace(/\\n/g, ' | ')),
}))()`));
await b.shot(join(OUT, 'verify-w16-week-view.png'));
console.log('w16: shot');

/* ---- A-P2-14：员工退房 ---- */
await b.goto('http://localhost:7102/dev-login', 2000);
console.log('staff(阿强) login:', await b.loginInPage(aq.id));
await b.goto(`http://localhost:7102/boarding/${fx.orderF}/checkin`, 3500);
save('verify-p214-staff-dom.json', await b.eval(`(() => ({
  checkoutBtn: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('办理退房')),
  oldHintGone: !document.body.innerText.includes('退房请到商家端操作'),
}))()`));
await b.shot(join(OUT, 'verify-p214-staff-checkout-btn.png'));
console.log('p214: staff button shot');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('办理退房'))?.click()`);
await sleep(600);
await b.shot(join(OUT, 'verify-p214-staff-confirm.png'));
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '确认退房')?.click()`);
await sleep(2000);
save('verify-p214-staff-done-dom.json', await b.eval(`(() => ({
  completed: document.body.innerText.includes('本单已完成退房结算'),
}))()`));
await b.shot(join(OUT, 'verify-p214-staff-done.png'));
console.log('p214: staff done shot');

b.close();
console.log('done');
