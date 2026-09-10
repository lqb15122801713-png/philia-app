// B1 复现（修复前）：员工端手动核销 6PVCZ5 点「确认核销」观察反馈
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b1';
const STAFF_USER = '01M20EDD8DCX0M28PR83D6XMPC'; // 小美

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7102/dev-login', 2000);
  console.log('login:', await cdp.loginAs(STAFF_USER));
  await cdp.nav('http://localhost:7102/today', 3500);

  // 打开扫码核销
  const opened = await cdp.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('扫码核销')); if (b) { b.click(); return true; } return false; })()`);
  console.log('open scanner:', opened);
  await sleep(1500);
  await cdp.shot(DIR + '\\repro-1-scanner.png');

  // 切手动输入
  const toManual = await cdp.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('手动输入核销码')); if (b) { b.click(); return true; } return false; })()`);
  console.log('to manual:', toManual);
  await sleep(800);

  // 输入核销码（native setter 触发 React onChange）
  await cdp.eval(`(() => {
    const input = document.querySelector('#manual-code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '6PVCZ5');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`);
  await sleep(400);
  await cdp.shot(DIR + '\\repro-2-code-entered.png');

  // 记录点击前状态
  console.log('before click:', await cdp.eval(`JSON.stringify({ path: location.pathname, btn: [...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.disabled })`));

  // 点击确认核销
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.click()`);
  await sleep(600);
  await cdp.shot(DIR + '\\repro-3-after-click-0.6s.png');
  await sleep(3000);
  await cdp.shot(DIR + '\\repro-4-after-click-3.6s.png');

  // 点击后状态：toast / 跳转 / 按钮文案 / DOM 中 sonner 节点
  const after = await cdp.eval(`JSON.stringify({
    path: location.pathname,
    sonner: document.querySelector('[data-sonner-toaster]')?.innerText ?? null,
    sonnerInDom: !!document.querySelector('[data-sonner-toaster]'),
    sonnerVisible: (() => { const t = document.querySelector('[data-sonner-toaster]'); if (!t) return null; const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { rect: [r.x, r.y, r.width, r.height], z: cs.zIndex, display: cs.display }; })(),
    scannerOpen: !!document.querySelector('[aria-label="扫码核销"]'),
    btnText: [...document.querySelectorAll('button')].find(x => x.textContent.includes('核销'))?.textContent?.trim() ?? null,
    bodyHasSuccess: document.body.innerText.includes('核销成功'),
  }, null, 1)`);
  console.log('after:', after);
  console.log('console:', JSON.stringify(cdp.consoleLogs, null, 1));
} finally {
  cdp.close();
}
