/**
 * B2-5 验收截图（修复后）——两阶段选日期：
 *  1. 选入住 9/14 → 入住网格消失，只剩摘要 chip「入住 9月14日 · 点击修改」+ 退房网格
 *  2. 选退房 9/17 → 即时显示「共 3 晚」
 *  3. 点 chip → 入住网格回来、退房选择清空；重选入住 9/15 → chip 更新、退房无选中
 * 输出：after-1~4.png / after-dom.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';

/** 在指定标题的日期网格中点含 md（如 '9月14日'）的按钮 */
const CLICK_MD = `(function clickMd(title, md) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === title);
  if (!h2) throw new Error('无标题 ' + title);
  const grid = h2.nextElementSibling;
  const btn = Array.from(grid.querySelectorAll('button')).find(b => !b.disabled && b.textContent.includes(md));
  if (!btn) throw new Error(title + ' 网格无 ' + md);
  btn.click();
  return btn.textContent.replace(/\\s+/g, '');
})`;
/** 页面状态采样 */
const SAMPLE = `(() => {
  const h2in = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === '入住日期');
  const inGrid = h2in && h2in.nextElementSibling?.className.includes('grid')
    ? h2in.nextElementSibling.querySelectorAll('button').length : 0;
  const chip = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('入住') && b.textContent.includes('点击修改'));
  const h2out = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === '退房日期');
  const outGrid = h2out ? Array.from(h2out.nextElementSibling.querySelectorAll('button')) : [];
  const outActive = outGrid.filter(b => b.className.includes('bg-brand-primary')).map(b => b.textContent.replace(/\\s+/g, ''));
  const m = document.body.innerText.match(/共\\s*(\\d+)\\s*晚/);
  return {
    checkinGridButtons: inGrid,
    chipText: chip ? chip.textContent.replace(/\\s+/g, '') : null,
    checkoutGridButtons: outGrid.length,
    checkoutActive: outActive,
    nights: m ? m[1] : null,
  };
})()`;

const customer = await findUser('customer');
const b = new Browser();
const out = { checks: {} };
const check = (name, ok, extra) => {
  out.checks[name] = { ok, ...extra };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, extra ? JSON.stringify(extra) : '');
};

try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto(`${CUSTOMER}/dev-login`, 2500);
  if ((await b.loginInPage(customer.id)) !== 200) throw new Error('客户登录失败');

  await b.goto(`${CUSTOMER}/booking/boarding`, 4000);

  // 1) 选入住 9月14日 → 网格收起为 chip
  console.log('pick checkin:', await b.eval(`${CLICK_MD}('入住日期', '9月14日')`));
  await sleep(1200);
  let dom = await b.eval(SAMPLE);
  check('phase2.chipOnly', dom.checkinGridButtons === 0 && dom.chipText !== null
    && dom.chipText.includes('9月14日') && dom.checkoutGridButtons > 0, dom);
  await b.shot(resolve(DIR, 'after-1-checkin-chip.png'));

  // 2) 选退房 9月17日 → 即时「共 3 晚」
  console.log('pick checkout:', await b.eval(`${CLICK_MD}('退房日期', '9月17日')`));
  await sleep(1200);
  dom = await b.eval(SAMPLE);
  check('phase2.instantNights', dom.nights === '3' && dom.checkoutActive.some((t) => t.includes('9月17日'))
    && dom.checkinGridButtons === 0, dom);
  await b.shot(resolve(DIR, 'after-2-nights.png'));

  // 3) 点 chip 返回重选 → 入住网格回来、退房清空
  await b.eval(`Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.includes('入住') && b.textContent.includes('点击修改')).click()`);
  await sleep(1200);
  dom = await b.eval(SAMPLE);
  check('phase1.reselect', dom.checkinGridButtons > 0 && dom.chipText === null
    && dom.checkoutGridButtons === 0 && dom.nights === null, dom);
  await b.shot(resolve(DIR, 'after-3-reselect-checkin.png'));

  // 4) 重选入住 9月15日 → chip 更新，退房网格重现且无选中
  console.log('re-pick checkin:', await b.eval(`${CLICK_MD}('入住日期', '9月15日')`));
  await sleep(1200);
  dom = await b.eval(SAMPLE);
  check('phase2.repicked', dom.chipText !== null && dom.chipText.includes('9月15日')
    && dom.checkoutGridButtons > 0 && dom.checkoutActive.length === 0 && dom.nights === null, dom);
  await b.shot(resolve(DIR, 'after-4-repicked.png'));

  writeFileSync(resolve(DIR, 'after-dom.json'), JSON.stringify(out, null, 2));
  const fails = Object.entries(out.checks).filter(([, v]) => !v.ok);
  console.log(fails.length === 0 ? 'ALL CHECKS PASS' : `FAILED: ${fails.map(([k]) => k).join(', ')}`);
} finally {
  b.close();
}
