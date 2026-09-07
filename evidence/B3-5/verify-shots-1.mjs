/** B3-5 修复后 UI 验收截图 · 段1：客户端（W-1 / W-14 / A-P2-13 / W-2 冻结时钟） */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };
const fx = JSON.parse(readFileSync(join(OUT, 'ui-fixtures.json'), 'utf8'));
const customer = await findUser('customer');

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);
await b.goto('http://localhost:7100/dev-login', 2500);
console.log('customer login:', await b.loginInPage(customer.id));

/* ---- W-1：单店跳步 ---- */
await b.goto('http://localhost:7100/booking/grooming', 3500);
console.log('w1: wizard loaded');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('分钟'))?.click()`);
await sleep(400);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(1200);
const w1 = await b.eval(`(() => ({
  onTimeStep: document.body.innerText.includes('选择洗护师') && document.body.innerText.includes('选择时间'),
  summaryChips: [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('门店')).map((x) => x.textContent.trim()),
}))()`);
save('verify-w1-dom.json', w1);
await b.shot(join(OUT, 'verify-w1-skip-store.png'));
console.log('w1: step3 shot');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('门店'))?.click()`);
await sleep(800);
save('verify-w1-back-dom.json', await b.eval(`(() => ({ backToStoreStep: document.body.innerText.includes('菲丽亚宠物·示例店') && !document.body.innerText.includes('选择洗护师') }))()`));
await b.shot(join(OUT, 'verify-w1-back-to-store.png'));
console.log('w1: back-to-store shot');

/* ---- W-14：取消弹层 ---- */
await b.goto(`http://localhost:7100/appointments/${fx.orderD}`, 3000);
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
await sleep(400);
save('verify-w14-dom.json', await b.eval(`(() => ({
  chips: ['行程有变', '时间不合适', '价格因素', '其他'].map((c) => document.body.innerText.includes(c)),
  hasFreeText: !!document.querySelector('textarea[placeholder*="补充说明"]'),
}))()`));
await b.shot(join(OUT, 'verify-w14-cancel-sheet.png'));
console.log('w14: sheet shot');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '确认取消')?.click()`);
await sleep(1500);
await b.shot(join(OUT, 'verify-w14-cancelled-toast.png'));
console.log('w14: cancelled shot');

/* ---- A-P2-13：live 页确认步文案 ---- */
await b.goto('http://localhost:7100/appointments/01M1Y840Y6HYYJ3H6JXZ24NA7W/live', 4000);
save('verify-p213-dom.json', await b.eval(`(() => ({
  newCopy: document.body.innerText.includes('洗护师正在为您完成最后确认'),
  oldCopyGone: !document.body.innerText.includes('等待家长确认接回'),
  bodyHead: document.body.innerText.slice(0, 200),
}))()`));
await b.shot(join(OUT, 'verify-p213-live-confirm.png'));
console.log('p213: shot');

/* ---- W-2：冻结客户端时钟到 9/8 10:00 ---- */
const { identifier } = await b.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `(() => {
    const RealDate = Date;
    const FIXED = new RealDate(2026, 8, 8, 10, 0, 0).getTime();
    class FakeDate extends RealDate {
      constructor(...a) { a.length === 0 ? super(FIXED) : super(...a); }
      static now() { return FIXED; }
    }
    window.Date = FakeDate;
  })()`,
});
console.log('clock shim id:', identifier);
await b.goto('http://localhost:7100/booking/grooming', 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('分钟'))?.click()`);
await sleep(400);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(1800);
const w2 = await b.eval(`(() => {
  const dayBtns = [...document.querySelectorAll('button')].filter((x) => /今天|明天|周/.test(x.textContent)).slice(0, 3).map((x) => ({ t: x.textContent.trim(), gray: x.className.includes('ink-placeholder') }));
  const cells = [...document.querySelectorAll('.grid.grid-cols-4 button')].map((x) => ({ t: x.textContent.trim(), disabled: x.disabled }));
  return { dayBtns, enabled: cells.filter((c) => !c.disabled).map((c) => c.t), disabledCells: cells.filter((c) => c.disabled).map((c) => c.t) };
})()`);
save('verify-w2-dom.json', w2);
await b.shot(join(OUT, 'verify-w2-today-bookable.png'));
console.log('w2: frozen-clock shot');

b.close();
console.log('done');
