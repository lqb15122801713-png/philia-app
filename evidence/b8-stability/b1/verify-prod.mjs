// B1 产物级复测（A 修复后）：preview 7102 输码 6PVCZ5 → 核销 → 成功反馈 + /execute/:id 直开不白屏
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b1';
const STAFF_USER = '01M20EDD8DCX0M28PR83D6XMPC';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7102/dev-login', 2200);
  console.log('login:', await cdp.loginAs(STAFF_USER));
  await cdp.nav('http://localhost:7102/today', 4000);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('扫码核销'))?.click()`);
  await sleep(1200);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('手动输入核销码'))?.click()`);
  await sleep(600);
  await cdp.eval(`(() => {
    const input = document.querySelector('#manual-code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '6PVCZ5');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(300);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.click()`);
  await sleep(3500);
  const r = await cdp.eval(`JSON.stringify({
    path: location.pathname,
    toast: document.querySelector('[data-sonner-toaster]')?.innerText ?? null,
    hasSteps: document.body.innerText.includes('第') && document.body.innerText.includes('步'),
    textLen: (document.body?.innerText ?? '').length,
  }, null, 1)`);
  console.log('after checkin =>', r);
  await cdp.shot(DIR + '\\prod-1-after-checkin.png');

  // 产物级直开 /execute/:id（A 修复验证：嵌套路由不白屏）
  await cdp.nav('http://localhost:7102/execute/01B8TESTCHECKIN000000000001', 4500);
  const d = await cdp.eval(`JSON.stringify({
    path: location.pathname, rc: document.getElementById('root')?.childElementCount ?? 0,
    hasSteps: document.body.innerText.includes('第') && document.body.innerText.includes('步'),
    textLen: (document.body?.innerText ?? '').length,
  }, null, 1)`);
  console.log('direct open /execute/:id =>', d);
  await cdp.shot(DIR + '\\prod-2-execute-direct.png');
} finally {
  cdp.close();
}
