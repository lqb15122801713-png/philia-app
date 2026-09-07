/** B3-5 补拍：滚动到目标元素后截图（W-14 客户弹层 / A-P2-14 员工退房按钮） */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(OUT, 'ui-fixtures.json'), 'utf8'));
const users = await (await fetch('http://localhost:7200/api/auth/dev-seed-users').then((r) => r.json())).users;
const customer = users.find((u) => u.roles.includes('customer'));
const aq = users.find((u) => u.nickname === '阿强');

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

/* ---- W-14 补拍：取消弹层（ chips + 自由文本，滚动到弹层） ---- */
await b.goto('http://localhost:7100/dev-login', 2500);
console.log('customer login:', await b.loginInPage(customer.id));
// orderA 是 confirmed 且 >4h（明天 09:00），用它仅展示弹层（不真取消）
await b.goto(`http://localhost:7100/appointments/${fx.orderA}`, 3200);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('取消预约'))?.click()`);
await sleep(700);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '行程有变')?.click()`);
await b.eval(`(() => {
  const ta = document.querySelector('textarea[placeholder*="补充说明"]');
  if (ta) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '临时要出差');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
})()`);
await b.eval(`document.querySelector('textarea[placeholder*="补充说明"]')?.scrollIntoView({ block: 'center' })`);
await sleep(500);
await b.shot(join(OUT, 'verify-w14-cancel-sheet.png'));
console.log('w14 sheet re-shot');
// 关掉弹层，不动 orderA
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '再想想')?.click()`);

/* ---- A-P2-14 补拍：员工「办理退房」按钮（滚动到底部） ---- */
await b.goto('http://localhost:7102/dev-login', 2000);
console.log('staff(阿强) login:', await b.loginInPage(aq.id));
await b.goto(`http://localhost:7102/boarding/${fx.orderF}/checkin`, 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('办理退房'))?.scrollIntoView({ block: 'center' })`);
await sleep(500);
await b.shot(join(OUT, 'verify-p214-staff-checkout-btn.png'));
console.log('p214 staff button re-shot');

b.close();
console.log('done');
