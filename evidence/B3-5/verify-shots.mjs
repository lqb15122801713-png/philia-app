/** B3-5 修复后 UI 验收截图（Edge CDP）。依赖 verify-curl.mjs 已跑（ui-fixtures.json）。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, login, sleep, trpcMutate } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };
const fx = JSON.parse(readFileSync(join(OUT, 'ui-fixtures.json'), 'utf8'));

const users = await (await fetch('http://localhost:7200/api/auth/dev-seed-users').then((r) => r.json())).users;
const customer = users.find((u) => u.roles.includes('customer'));
const merchant = users.find((u) => u.roles.includes('merchant_owner'));
const xm = users.find((u) => u.nickname === '小美');
const aq = users.find((u) => u.nickname === '阿强');

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

/* ================= 客户端 ================= */
await b.goto('http://localhost:7100/dev-login', 2500);
console.log('customer login:', await b.loginInPage(customer.id));

/* ---- W-1：单店自动选中并跳过选店页 ---- */
await b.goto('http://localhost:7100/booking/grooming', 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('分钟'))?.click()`);
await sleep(400);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(1200);
const w1 = await b.eval(`(() => ({
  onTimeStep: document.body.innerText.includes('选择洗护师') && document.body.innerText.includes('选择时间'),
  storePageShown: !document.body.innerText.includes('选择洗护师') && document.body.innerText.includes('菲丽亚宠物·示例店'),
  summaryChips: [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('门店')).map((x) => x.textContent.trim()),
}))()`);
save('verify-w1-dom.json', w1);
await b.shot(join(OUT, 'verify-w1-skip-store.png')); // 屏1 选服务后直达屏3 选时间
// 可返回修改：点摘要胶囊「门店」chip → 回到屏2
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('门店'))?.click()`);
await sleep(800);
const w1b = await b.eval(`(() => ({ backToStoreStep: !!document.body.innerText.includes('菲丽亚宠物·示例店') && !document.body.innerText.includes('选择洗护师') }))()`);
save('verify-w1-back-dom.json', w1b);
await b.shot(join(OUT, 'verify-w1-back-to-store.png'));

/* ---- W-14：客户取消弹层 chips + 自由文本（>4h 直消单 orderD） ---- */
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
const w14 = await b.eval(`(() => ({
  chips: ['行程有变', '时间不合适', '价格因素', '其他'].map((c) => document.body.innerText.includes(c)),
  hasFreeText: !!document.querySelector('textarea[placeholder*="补充说明"]'),
}))()`);
save('verify-w14-dom.json', w14);
await b.shot(join(OUT, 'verify-w14-cancel-sheet.png'));
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '确认取消')?.click()`);
await sleep(1500);
await b.shot(join(OUT, 'verify-w14-cancelled-toast.png'));

/* ---- A-P2-13：live 页确认步文案 ---- */
await b.goto(`http://localhost:7100/appointments/01M1Y840Y6HYYJ3H6JXZ24NA7W/live`, 3500);
const p213 = await b.eval(`(() => ({
  newCopy: document.body.innerText.includes('洗护师正在为您完成最后确认'),
  oldCopyGone: !document.body.innerText.includes('等待家长确认接回'),
}))()`);
save('verify-p213-dom.json', p213);
await b.shot(join(OUT, 'verify-p213-live-confirm.png'));

/* ---- W-2：冻结客户端时钟到 9/8 10:00，今天栅格可约（10:00 已满灰显，其余彩色） ---- */
await b.send('Page.addScriptToEvaluateOnNewDocument', {
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
await b.goto('http://localhost:7100/booking/grooming', 3500);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('分钟'))?.click()`);
await sleep(400);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '下一步')?.click()`);
await sleep(1800);
const w2 = await b.eval(`(() => {
  const dayBtns = [...document.querySelectorAll('button')].filter((x) => /今天|明天|周/.test(x.textContent)).slice(0, 3).map((x) => ({ t: x.textContent.trim(), gray: x.className.includes('ink-placeholder') }));
  const cells = [...document.querySelectorAll('.grid.grid-cols-4 button')].map((x) => ({ t: x.textContent.trim(), disabled: x.disabled }));
  return { dayBtns, cells, enabled: cells.filter((c) => !c.disabled).map((c) => c.t), disabled: cells.filter((c) => c.disabled).map((c) => c.t) };
})()`);
save('verify-w2-dom.json', w2);
await b.shot(join(OUT, 'verify-w2-today-bookable.png'));
await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: '1' }).catch(() => {});

/* ================= 商家端 ================= */
await b.goto('http://localhost:7101/dev-login', 2500);
console.log('merchant login:', await b.loginInPage(merchant.id));

// W-14 ≤4h 链：客户取消 orderE（已拨到 now+2h）带原因 → cancel_requested
const cC = await login(customer.id);
await trpcMutate('appointment.cancel', { appointmentId: fx.orderE, reason: '时间不合适：临时加班赶不过来' }, cC);

/* ---- W-4：列表/详情客户标识 ---- */
await b.viewport(1280, 900, false);
await b.goto('http://localhost:7101/appointments?date=all', 3500);
const w4 = await b.eval(`(() => {
  const rows = [...document.querySelectorAll('[role="button"]')].map((r) => r.innerText.replace(/\\n/g, ' | ')).filter((t) => t.includes('示例客户'));
  return { rowsWithNickname: rows.length, sample: rows[0] ?? null, oldStyle: document.body.innerText.includes('客户 XDTB') };
})()`);
save('verify-w4-dom.json', w4);
await b.shot(join(OUT, 'verify-w4-merchant-list.png'));
await b.goto(`http://localhost:7101/appointments/${fx.orderA}`, 3000);
const w4d = await b.eval(`(() => ({ detail: document.body.innerText.includes('示例客户') && document.body.innerText.includes('尾号 0000') }))()`);
save('verify-w4-detail-dom.json', w4d);
await b.shot(join(OUT, 'verify-w4-merchant-detail.png'));

/* ---- W-14（商家侧）：取消审核透出原因 → 批准 ---- */
await b.goto(`http://localhost:7101/appointments/${fx.orderE}`, 3000);
const w14m = await b.eval(`(() => ({
  reasonShown: document.body.innerText.includes('客户取消原因') && document.body.innerText.includes('时间不合适'),
  hasApprove: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('批准取消')),
}))()`);
save('verify-w14-merchant-review-dom.json', w14m);
await b.shot(join(OUT, 'verify-w14-merchant-review.png'));
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('批准取消'))?.click()`);
await sleep(600);
await b.shot(join(OUT, 'verify-w14-merchant-approve-dialog.png'));
await b.eval(`[...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === '批准取消').pop()?.click()`);
await sleep(1500);
// 已取消列表透出原因
await b.goto('http://localhost:7101/appointments?status=cancelled&date=all', 3500);
const w14l = await b.eval(`(() => {
  const rows = [...document.querySelectorAll('[role="button"]')].filter((r) => r.innerText.includes('已取消'));
  return { cancelledRows: rows.length, withReason: rows.filter((r) => r.innerText.includes('：')).map((r) => r.innerText.replace(/\\n/g, ' | ')).slice(0, 4) };
})()`);
save('verify-w14-merchant-cancelled-dom.json', w14l);
await b.shot(join(OUT, 'verify-w14-merchant-cancelled.png'));

/* ---- A-P2-14（商家侧）：退房结算按钮禁用 ---- */
await b.goto('http://localhost:7101/boarding', 3000);
await b.eval(`[...document.querySelectorAll('[class*="rounded-card"]')].find((x) => x.textContent.includes('旺财') && x.textContent.includes('在店'))?.click()`);
await sleep(800);
const p214m = await b.eval(`(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('退房结算'));
  return { found: !!btn, disabled: btn?.disabled ?? null, hintShown: document.body.innerText.includes('退房核销由员工在员工端办理') };
})()`);
save('verify-p214-merchant-dom.json', p214m);
await b.shot(join(OUT, 'verify-p214-merchant-disabled.png'));

/* ================= 员工端 ================= */
await b.viewport(390, 844, true);
await b.goto('http://localhost:7102/dev-login', 2500);
console.log('staff(小美) login:', await b.loginInPage(xm.id));

/* ---- W-16：未来 7 天视图 ---- */
await b.goto('http://localhost:7102/today', 3000);
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '未来 7 天')?.click()`);
await sleep(1500);
const w16 = await b.eval(`(() => ({
  groups: [...document.querySelectorAll('section h2')].map((h) => h.textContent.trim()),
  cards: [...document.querySelectorAll('section ul li')].map((li) => li.innerText.replace(/\\n/g, ' | ')),
}))()`);
save('verify-w16-dom.json', w16);
await b.shot(join(OUT, 'verify-w16-week-view.png'));

/* ---- A-P2-14（员工侧）：办理退房入口 ---- */
await b.goto('http://localhost:7102/dev-login', 2000);
console.log('staff(阿强) login:', await b.loginInPage(aq.id));
await b.goto(`http://localhost:7102/boarding/${fx.orderF}/checkin`, 3000);
const p214s = await b.eval(`(() => ({
  checkoutBtn: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('办理退房')),
  oldHintGone: !document.body.innerText.includes('退房请到商家端操作'),
}))()`);
save('verify-p214-staff-dom.json', p214s);
await b.shot(join(OUT, 'verify-p214-staff-checkout-btn.png'));
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('办理退房'))?.click()`);
await sleep(500);
await b.shot(join(OUT, 'verify-p214-staff-confirm.png'));
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '确认退房')?.click()`);
await sleep(1800);
const p214done = await b.eval(`(() => ({ completed: document.body.innerText.includes('本单已完成退房结算') }))()`);
save('verify-p214-staff-done-dom.json', p214done);
await b.shot(join(OUT, 'verify-p214-staff-done.png'));

b.close();
console.log('done');
