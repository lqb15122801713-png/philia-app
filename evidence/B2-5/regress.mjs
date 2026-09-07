/**
 * B2-5 回归：寄养下单全流程（选日期→选房→选宠→确认→成功页），
 * 校验合计 = 单价 × 晚数（UI 文案 + 服务端 priceFen 双重核对）。
 * 输出：regress-1-confirm.png / regress-2-success.png / regress-dom.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, login, sleep, trpcQuery } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';

const CLICK_MD = `(function clickMd(title, md) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === title);
  if (!h2) throw new Error('无标题 ' + title);
  const btn = Array.from(h2.nextElementSibling.querySelectorAll('button')).find(b => !b.disabled && b.textContent.includes(md));
  if (!btn) throw new Error(title + ' 网格无 ' + md);
  btn.click();
  return btn.textContent.replace(/\\s+/g, '');
})`;
const NEXT = `(() => {
  const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步');
  if (!b || b.disabled) throw new Error('下一步不可用');
  b.click();
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
  // 屏1：9月18日入住 → 9月21日退房（3 晚，避开既有完成单的日期）
  await b.eval(`${CLICK_MD}('入住日期', '9月18日')`); await sleep(1000);
  await b.eval(`${CLICK_MD}('退房日期', '9月21日')`); await sleep(1000);
  await b.eval(NEXT); await sleep(2500);
  // 屏2：选第一个房型
  const room = await b.eval(`(() => {
    const card = Array.from(document.querySelectorAll('button')).find(x => x.className.includes('rounded-card') && !x.disabled);
    card.click();
    return card.textContent.replace(/\\s+/g, '');
  })()`);
  console.log('picked room:', room);
  await sleep(1000);
  await b.eval(NEXT); await sleep(2000);
  // 屏3：选第一只可选宠物（非阻断卡）
  const pet = await b.eval(`(() => {
    const card = Array.from(document.querySelectorAll('button')).find(x => x.className.includes('rounded-card') && !x.disabled);
    card.click();
    return card.textContent.replace(/\\s+/g, '');
  })()`);
  console.log('picked pet:', pet);
  await sleep(1000);
  await b.eval(NEXT); await sleep(2000);
  // 屏4：确认页 合计文案
  const confirm = await b.eval(`(() => {
    const text = document.body.innerText.replace(/\\s+/g, ' ');
    const m = text.match(/单价\\s*(¥[\\d.]+)\\/晚\\s*×\\s*(\\d+)\\s*晚\\s*=\\s*(¥[\\d.]+)/);
    return { match: m ? { unit: m[1], nights: m[2], total: m[3] } : null, hasSubmit: !!Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '确认预约') };
  })()`);
  console.log('confirm:', JSON.stringify(confirm));
  check('confirm.totalText', confirm.match !== null && confirm.match.nights === '3', confirm);
  await b.shot(resolve(DIR, 'regress-1-confirm.png'));

  const unitFen = Math.round(parseFloat(confirm.match.unit.slice(1)) * 100);
  const totalFen = Math.round(parseFloat(confirm.match.total.slice(1)) * 100);
  check('confirm.totalMath', totalFen === unitFen * 3, { unitFen, totalFen });

  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '确认预约').click()`);
  await sleep(3500);
  const success = await b.eval(`(() => ({
    path: location.pathname, aid: new URLSearchParams(location.search).get('aid'),
    successText: document.body.innerText.includes('预约成功'),
  }))()`);
  console.log('success:', JSON.stringify(success));
  check('success.page', success.path === '/booking/success' && success.successText && !!success.aid, success);
  await b.shot(resolve(DIR, 'regress-2-success.png'));

  // 服务端复核：总价 = 单价 × 3 晚，状态 pending
  const cCookie = await login(customer.id);
  const detail = await trpcQuery('appointment.get', { appointmentId: success.aid }, cCookie);
  check('server.price', detail.appointment.priceFen === detail.service.priceFen * 3
    && detail.appointment.status === 'pending' && detail.appointment.type === 'boarding', {
    priceFen: detail.appointment.priceFen, unitFen: detail.service.priceFen,
    status: detail.appointment.status, type: detail.appointment.type,
  });

  writeFileSync(resolve(DIR, 'regress-dom.json'), JSON.stringify(out, null, 2));
  const fails = Object.entries(out.checks).filter(([, v]) => !v.ok);
  console.log(fails.length === 0 ? 'ALL REGRESS PASS' : `FAILED: ${fails.map(([k]) => k).join(', ')}`);
} finally {
  b.close();
}
