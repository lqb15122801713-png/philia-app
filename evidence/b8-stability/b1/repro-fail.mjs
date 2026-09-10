// B1 复现（修复前）· 失败路径：不存在码 222222 / pending 状态码 7FCH98 的反馈观察
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b1';
const STAFF_USER = '01M20EDD8DCX0M28PR83D6XMPC';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7102/dev-login', 2000);
  console.log('login:', await cdp.loginAs(STAFF_USER));
  await cdp.nav('http://localhost:7102/today', 3000);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('扫码核销'))?.click()`);
  await sleep(1200);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('手动输入核销码'))?.click()`);
  await sleep(600);

  for (const [name, code] of [['notfound', '222222'], ['pending-status', '7FCH98']]) {
    await cdp.eval(`(() => {
      const input = document.querySelector('#manual-code');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '${code}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(300);
    await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.click()`);
    await sleep(2500);
    const r = await cdp.eval(`JSON.stringify({
      path: location.pathname,
      sonnerText: document.querySelector('[data-sonner-toaster]')?.innerText ?? null,
      toastCount: document.querySelectorAll('[data-sonner-toast]').length,
      toastVisible: (() => { const t = document.querySelector('[data-sonner-toast]'); if (!t) return null; const r = t.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
      scannerOpen: !!document.querySelector('[aria-label="扫码核销"]'),
    }, null, 1)`);
    console.log(name, '=>', r);
    await cdp.shot(`${DIR}\\repro-fail-${name}.png`);
    // 清空输入准备下一个
    await cdp.eval(`(() => {
      const input = document.querySelector('#manual-code');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await sleep(1200); // 等 toast 消退
  }
} finally {
  cdp.close();
}
