/**
 * B2-3 回归：预约向导从零进入（无 URL 参数）流程不受影响。
 *  - /booking/grooming：屏1 无选中服务、下一步禁用；逐步可走完（选服务→店→槽→宠物→确认页）
 *  - /booking/boarding：屏1 无选中日期、下一步禁用
 * 输出：regress-*.png / regress-dom.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';

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

  /* 洗护向导（无参数） */
  await b.goto(`${CUSTOMER}/booking/grooming`, 4000);
  let dom = await b.eval(`(() => ({
    search: location.search,
    activeCards: Array.from(document.querySelectorAll('button.ring-2')).length,
    nextDisabled: Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步')?.disabled,
  }))()`);
  check('grooming.zeroEntry', dom.search === '' && dom.activeCards === 0 && dom.nextDisabled === true, dom);
  await b.shot(resolve(DIR, 'regress-wizard-grooming-zero.png'));

  // 从零走一遍：选服务 → 下一步 → 选店(默认) → 下一步 → 选槽 → 下一步 → 确认屏
  await b.eval(`(() => {
    const card = Array.from(document.querySelectorAll('button')).find(x => x.className.includes('rounded-card') && !x.disabled);
    card.click();
  })()`);
  await sleep(1000);
  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步').click()`);
  await sleep(1500);
  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步').click()`);
  await sleep(2500);
  await b.eval(`(() => {
    const slot = Array.from(document.querySelectorAll('button')).find(x => x.className.includes('rounded-input') && !x.disabled);
    if (!slot) throw new Error('无可用槽位');
    slot.click();
  })()`);
  await sleep(1000);
  await b.eval(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步').click()`);
  await sleep(2000);
  dom = await b.eval(`(() => ({
    atConfirm: document.body.innerText.includes('收款方式'),
    petCards: document.body.innerText.includes('选择宠物'),
    submitBtn: !!Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '确认预约'),
  }))()`);
  check('grooming.zeroFlowReachesConfirm', dom.atConfirm && dom.petCards && dom.submitBtn, dom);
  await b.shot(resolve(DIR, 'regress-wizard-grooming-confirm.png'));

  /* 寄养向导（无参数） */
  await b.goto(`${CUSTOMER}/booking/boarding`, 4000);
  dom = await b.eval(`(() => {
    const h2 = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === '入住日期');
    const gridActive = h2
      ? Array.from(h2.nextElementSibling.querySelectorAll('button')).filter(x => x.className.includes('bg-brand-primary')).length
      : -1;
    return {
      search: location.search,
      activeDays: gridActive,
      nextDisabled: Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === '下一步')?.disabled,
    };
  })()`);
  check('boarding.zeroEntry', dom.search === '' && dom.activeDays === 0 && dom.nextDisabled === true, dom);
  await b.shot(resolve(DIR, 'regress-wizard-boarding-zero.png'));

  writeFileSync(resolve(DIR, 'regress-dom.json'), JSON.stringify(out, null, 2));
  const fails = Object.entries(out.checks).filter(([, v]) => !v.ok);
  console.log(fails.length === 0 ? 'ALL REGRESS PASS' : `FAILED: ${fails.map(([k]) => k).join(', ')}`);
} finally {
  b.close();
}
