/**
 * B2-5 复现截图（修复前）：寄养屏1 两个同尺寸日期网格纵向堆叠，
 * 选定入住日后入住网格仍可点——误触即改掉入住日。
 * 流程：选入住 d1 → 选退房 → 误触入住网格另一日 d2 → 入住日被改（checkout 被动清空或保留）。
 * 输出：before-1-checkin-picked.png / before-2-checkout-picked.png / before-3-mistouch.png / before-dom.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';

/** 页面内工具：按 h2 文本定位其后的日期网格按钮（返回 [{label, md, disabled}]） */
const GRID_FN = `(function gridInfo(title) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === title);
  if (!h2) return null;
  const grid = h2.nextElementSibling;
  if (!grid) return null;
  return Array.from(grid.querySelectorAll('button')).map(b => ({
    label: b.textContent.replace(/\\s+/g, ''), disabled: b.disabled,
  }));
})`;
const CLICK_FN = `(function clickDay(title, idx) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === title);
  if (!h2) throw new Error('无标题 ' + title);
  const btns = Array.from(h2.nextElementSibling.querySelectorAll('button')).filter(b => !b.disabled);
  if (!btns[idx]) throw new Error(title + ' 可点按钮不足: ' + btns.length);
  btns[idx].click();
  return btns[idx].textContent.replace(/\\s+/g, '');
})`;

const customer = await findUser('customer');
const b = new Browser();
const out = {};
try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto(`${CUSTOMER}/dev-login`, 2500);
  const st = await b.loginInPage(customer.id);
  if (st !== 200) throw new Error('客户登录失败');

  await b.goto(`${CUSTOMER}/booking/boarding`, 4000);
  out.step0 = await b.eval(`(() => ({
    checkinGrid: ${GRID_FN}('入住日期'),
    checkoutGridExists: ${GRID_FN}('退房日期') !== null,
    summary: document.body.innerText.includes('先选入住日'),
  }))()`);
  console.log('step0:', JSON.stringify(out.step0));

  // 1) 选入住（第 3 个可点日）
  out.pickedCheckin1 = await b.eval(`${CLICK_FN}('入住日期', 2)`);
  await sleep(1200);
  out.step1 = await b.eval(`(() => ({
    checkinGridStillVisible: ${GRID_FN}('入住日期') !== null,
    checkoutGrid: ${GRID_FN}('退房日期'),
  }))()`);
  console.log('picked checkin:', out.pickedCheckin1, '| step1:', JSON.stringify(out.step1));
  await b.shot(resolve(DIR, 'before-1-checkin-picked.png'));

  // 2) 选退房（第 3 个可点日 = 入住+3）
  out.pickedCheckout = await b.eval(`${CLICK_FN}('退房日期', 2)`);
  await sleep(1200);
  out.step2 = await b.eval(`(() => {
    const m = document.body.innerText.match(/共\\s*(\\d+)\\s*晚/);
    return { nights: m ? m[1] : null, checkinGridStillVisible: ${GRID_FN}('入住日期') !== null };
  })()`);
  console.log('picked checkout:', out.pickedCheckout, '| step2:', JSON.stringify(out.step2));
  await b.shot(resolve(DIR, 'before-2-checkout-picked.png'));

  // 3) 误触：选退房阶段入住网格仍可点 → 点另一个入住日，入住日被改
  out.mistouchClick = await b.eval(`${CLICK_FN}('入住日期', 4)`);
  await sleep(1200);
  out.step3 = await b.eval(`(() => {
    const active = Array.from(document.querySelectorAll('button.bg-brand-primary')).map(b2 => b2.textContent.replace(/\\s+/g, ''));
    const m = document.body.innerText.match(/共\\s*(\\d+)\\s*晚/);
    return { activeDays: active, nightsLine: m ? m[0] : null,
      hint: document.body.innerText.includes('先选入住日') };
  })()`);
  console.log('mistouch clicked:', out.mistouchClick, '| step3:', JSON.stringify(out.step3));
  await b.shot(resolve(DIR, 'before-3-mistouch.png'));

  writeFileSync(resolve(DIR, 'before-dom.json'), JSON.stringify(out, null, 2));
  const changed = !out.step3.activeDays.some((t) => t.includes(out.pickedCheckin1.replace(/今天|周./g, '')))
    && out.step3.activeDays.some((t) => out.mistouchClick.includes(t.replace(/今天|周./g, '')) || t.includes(out.mistouchClick.replace(/今天|周./g, '')));
  console.log(changed
    ? 'REPRO OK: 误触入住网格后入住日被改掉（缺陷复现）'
    : 'CHECK: activeDays=' + JSON.stringify(out.step3.activeDays));
} finally {
  b.close();
}
