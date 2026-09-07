/** B3-5 修复前 UI 复现截图（Edge CDP）。输出到本脚本所在目录。 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };

const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');
const staff = await findUser('staff'); // 小美（staff 列表第一个）

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

/* ================= 客户端 ================= */
await b.goto('http://localhost:7100/dev-login', 2500);
console.log('customer login:', await b.loginInPage(customer.id));

/* ---- W-1 修复前：单店仍走选店页 ---- */
await b.goto('http://localhost:7100/booking/grooming', 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('分钟'))?.click()`);
await sleep(400);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(800);
const w1 = await b.eval(`(() => {
  const step2Visible = !!document.querySelector('section .ring-brand-primary, section');
  const storeCards = [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('菲丽亚')).length;
  const stepText = document.querySelector('.mt-4')?.textContent ?? '';
  return { storeCards, bodyHasStorePick: document.body.innerText.includes('菲丽亚宠物·示例店'), stepText: stepText.slice(0, 120) };
})()`);
save('repro-w1-dom.json', w1);
await b.shot(join(OUT, 'repro-w1-single-store-step2.png')); // 仅 1 家门店仍整页选店

/* ---- W-2 修复前：今天全灰（无可约槽返回） ---- */
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('菲丽亚宠物·示例店'))?.click()`);
await sleep(300);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(1500);
const w2 = await b.eval(`(() => {
  const dayBtns = [...document.querySelectorAll('button')].filter((x) => /今天|明天|周/.test(x.textContent)).slice(0, 8).map((x) => ({ t: x.textContent.trim(), cls: x.className.includes('ink-placeholder') ? 'gray' : 'normal' }));
  const slotCells = [...document.querySelectorAll('.grid.grid-cols-4 button')].map((x) => ({ t: x.textContent.trim(), disabled: x.disabled }));
  return { dayBtns, todaySlotCells: slotCells.slice(0, 30), enabledToday: slotCells.filter((c) => !c.disabled).length, todayLabelInGrid: document.body.innerText.includes('今日营业时段已过') };
})()`);
save('repro-w2-dom.json', w2);
await b.shot(join(OUT, 'repro-w2-today-gray.png'));

/* ---- W-14 修复前：取消弹层无原因 chips ---- */
await b.goto('http://localhost:7100/appointments/01M1XZ7RRS14Q63DNN4RN4TB67', 3000);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('取消预约'))?.click()`);
await sleep(600);
const w14 = await b.eval(`(() => {
  const text = document.body.innerText;
  const chips = ['行程有变', '时间不合适', '价格因素'].map((c) => ({ chip: c, present: text.includes(c) }));
  return { chips, hasReasonTextarea: !!document.querySelector('section textarea[placeholder*="原因"], .rounded-card textarea') };
})()`);
save('repro-w14-dom.json', w14);
await b.shot(join(OUT, 'repro-w14-cancel-sheet.png'));

/* ================= 商家端 ================= */
await b.goto('http://localhost:7101/dev-login', 2500);
console.log('merchant login:', await b.loginInPage(merchant.id));

/* ---- W-4 修复前：列表「客户 XDTB」 ---- */
await b.goto('http://localhost:7101/appointments?date=all', 3500);
const w4 = await b.eval(`(() => {
  const rows = [...document.querySelectorAll('[role="button"]')].map((r) => r.innerText.replace(/\\n/g, ' | ')).filter((t) => t.includes('客户'));
  return { rowCount: rows.length, samples: rows.slice(0, 4) };
})()`);
save('repro-w4-dom.json', w4);
await b.viewport(1280, 900, false);
await b.shot(join(OUT, 'repro-w4-merchant-list.png'));

/* ---- W-14 修复前（商家侧）：取消审核/已取消无原因透出（已取消列表行无原因行） ---- */
const w14m = await b.eval(`(() => {
  const cancelled = [...document.querySelectorAll('[role="button"]')].filter((r) => r.innerText.includes('已取消'));
  return { cancelledRows: cancelled.length, withReason: cancelled.filter((r) => r.innerText.includes('原因')).length };
})()`);
save('repro-w14-merchant-dom.json', w14m);

/* ================= 员工端 ================= */
await b.viewport(390, 844, true);
await b.goto('http://localhost:7102/dev-login', 2500);
console.log('staff login:', await b.loginInPage(staff.id));

/* ---- W-16 修复前：仅今日，无未来 7 天视图 ---- */
await b.goto('http://localhost:7102/today', 3000);
const w16 = await b.eval(`(() => ({
  hasWeekView: document.body.innerText.includes('未来 7 天') || document.body.innerText.includes('未来7天'),
  header: document.querySelector('header')?.innerText ?? '',
  tabs: [...document.querySelectorAll('[role="tab"], .flex button')].slice(0, 10).map((x) => x.textContent.trim()),
}))()`);
save('repro-w16-dom.json', w16);
await b.shot(join(OUT, 'repro-w16-today-only.png'));

b.close();
console.log('done');
