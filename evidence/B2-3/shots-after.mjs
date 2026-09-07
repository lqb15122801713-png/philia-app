/**
 * B2-3 验收截图（修复后）：
 *  1. 完成单详情页出现「再次预约」主按钮（洗护 + 寄养）
 *  2. 点击 → 落向导且 URL 带 serviceId/storeId/petId 预填
 *  3. 洗护向导：屏1 服务已选中同款；走到屏4 宠物已选
 *  4. 寄养向导：选日期后屏2 房型已选中；屏3 宠物已选
 * 输出：after-*.png / after-dom.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';
const data = JSON.parse(readFileSync(resolve(DIR, 'data.json'), 'utf8'));

const NEXT = `(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步');
  if (!b) throw new Error('无下一步按钮');
  if (b.disabled) throw new Error('下一步被禁用');
  b.click();
})()`;
const CLICK_DAY = `(function clickDay(title, idx) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === title);
  if (!h2) throw new Error('无标题 ' + title);
  const btns = Array.from(h2.nextElementSibling.querySelectorAll('button')).filter(b => !b.disabled);
  btns[idx].click();
  return btns[idx].textContent.replace(/\\s+/g, '');
})`;

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

  /* ---------- 洗护 ---------- */
  await b.goto(`${CUSTOMER}/appointments/${data.groomingDone.id}`, 3500);
  let dom = await b.eval(`(() => ({
    hasRebook: !!Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '再次预约'),
    statusCompleted: document.body.innerText.includes('已完成'),
  }))()`);
  check('grooming.detail.hasRebook', dom.hasRebook && dom.statusCompleted, dom);
  await b.shot(resolve(DIR, 'after-1-detail-grooming.png'));

  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '再次预约').click()`);
  await sleep(2500);
  dom = await b.eval(`(() => {
    const p = new URLSearchParams(location.search);
    return { path: location.pathname, serviceId: p.get('serviceId'), storeId: p.get('storeId'), petId: p.get('petId') };
  })()`);
  check('grooming.wizard.url', dom.path === '/booking/grooming'
    && dom.serviceId === data.groomingDone.serviceId && dom.storeId === data.groomingDone.storeId && dom.petId === data.groomingDone.petId, dom);
  await sleep(2000);
  dom = await b.eval(`(() => {
    const card = Array.from(document.querySelectorAll('button.ring-2')).map(x => x.textContent.replace(/\\s+/g, ''));
    return { activeCards: card };
  })()`);
  check('grooming.wizard.servicePreselected', dom.activeCards.some((t) => t.includes(data.groomingDone.serviceName)), dom);
  await b.shot(resolve(DIR, 'after-2-wizard-grooming-service.png'));

  await b.eval(NEXT); await sleep(1500);           // 屏1→屏2 门店（URL 已预填本店）
  await b.eval(NEXT); await sleep(2500);           // 屏2→屏3 员工+时间
  dom = await b.eval(`(() => {
    const slot = Array.from(document.querySelectorAll('button')).find(x => x.className.includes('rounded-input') && !x.disabled);
    if (!slot) throw new Error('无可用槽位');
    slot.click();
    return slot.textContent.trim();
  })()`);
  console.log('picked slot:', dom);
  await sleep(1200);
  await b.eval(NEXT); await sleep(2000);           // 屏3→屏4 确认（选宠物）
  dom = await b.eval(`(() => ({
    activeCards: Array.from(document.querySelectorAll('button.ring-2')).map(x => x.textContent.replace(/\\s+/g, '')),
    petName: ${JSON.stringify(data.groomingDone.petName)},
  }))()`);
  check('grooming.wizard.petPreselected', dom.activeCards.some((t) => t.includes(dom.petName)), dom);
  await b.shot(resolve(DIR, 'after-3-wizard-grooming-pet.png'));

  /* ---------- 寄养 ---------- */
  await b.goto(`${CUSTOMER}/appointments/${data.boardingDone.id}`, 3500);
  dom = await b.eval(`(() => ({
    hasRebook: !!Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '再次预约'),
    statusCompleted: document.body.innerText.includes('已完成'),
  }))()`);
  check('boarding.detail.hasRebook', dom.hasRebook && dom.statusCompleted, dom);
  await b.shot(resolve(DIR, 'after-4-detail-boarding.png'));

  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '再次预约').click()`);
  await sleep(2500);
  dom = await b.eval(`(() => {
    const p = new URLSearchParams(location.search);
    return { path: location.pathname, serviceId: p.get('serviceId'), storeId: p.get('storeId'), petId: p.get('petId') };
  })()`);
  check('boarding.wizard.url', dom.path === '/booking/boarding'
    && dom.serviceId === data.boardingDone.serviceId && dom.storeId === data.boardingDone.storeId && dom.petId === data.boardingDone.petId, dom);
  await sleep(1500);

  // 屏1 选日期（此脚本在 B2-5 修复前跑：入住+退房双网格）
  const ci = await b.eval(`${CLICK_DAY}('入住日期', 2)`);
  await sleep(1000);
  const co = await b.eval(`${CLICK_DAY}('退房日期', 2)`);
  console.log('boarding dates:', ci, '→', co);
  await sleep(1000);
  await b.eval(NEXT); await sleep(2500);           // 屏2 房型
  dom = await b.eval(`(() => ({
    activeCards: Array.from(document.querySelectorAll('button.ring-2')).map(x => x.textContent.replace(/\\s+/g, '')),
    roomType: ${JSON.stringify(data.boardingDone.roomType ?? data.boardingDone.serviceName)},
  }))()`);
  check('boarding.wizard.roomPreselected', dom.activeCards.some((t) => t.includes(dom.roomType)), dom);
  await b.shot(resolve(DIR, 'after-5-wizard-boarding-room.png'));

  await b.eval(NEXT); await sleep(2000);           // 屏3 宠物
  dom = await b.eval(`(() => ({
    activeCards: Array.from(document.querySelectorAll('button.ring-2')).map(x => x.textContent.replace(/\\s+/g, '')),
    petName: ${JSON.stringify(data.boardingDone.petName)},
  }))()`);
  check('boarding.wizard.petPreselected', dom.activeCards.some((t) => t.includes(dom.petName)), dom);
  await b.shot(resolve(DIR, 'after-6-wizard-boarding-pet.png'));

  writeFileSync(resolve(DIR, 'after-dom.json'), JSON.stringify(out, null, 2));
  const fails = Object.entries(out.checks).filter(([, v]) => !v.ok);
  console.log(fails.length === 0 ? 'ALL CHECKS PASS' : `FAILED: ${fails.map(([k]) => k).join(', ')}`);
} finally {
  b.close();
}
