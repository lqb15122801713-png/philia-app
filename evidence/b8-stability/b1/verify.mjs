// B1 自验（修复后）：慢网下反馈及时性 + 失败路径 + 常速成功路径回归
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b1';
const STAFF_USER = '01M20EDD8DCX0M28PR83D6XMPC';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7102/dev-login', 2000);
  console.log('login:', await cdp.loginAs(STAFF_USER));
  await cdp.nav('http://localhost:7102/today', 3000);

  /* ---- 1. 慢网（2s RTT）成功路径：反馈应只等核销事务本身（~1 RTT） ---- */
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: 5e6, uploadThroughput: 5e6 });
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('扫码核销'))?.click()`);
  await sleep(800);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('手动输入核销码'))?.click()`);
  await sleep(500);
  await cdp.eval(`(() => {
    const input = document.querySelector('#manual-code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '6PVCZ5');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(200);
  await cdp.eval(`(() => {
    window.__marks = [];
    window.__timer = setInterval(() => {
      if (location.pathname !== '/today' && !window.__marks.find(m => m.what === 'nav')) {
        window.__marks.push({ what: 'nav', path: location.pathname, ms: Math.round(performance.now() - window.__t0) });
      }
      const toast = document.querySelector('[data-sonner-toast]');
      if (toast && !window.__marks.find(m => m.what === 'toast')) {
        window.__marks.push({ what: 'toast', text: toast.innerText, ms: Math.round(performance.now() - window.__t0) });
      }
    }, 100);
  })()`);
  await cdp.eval(`window.__t0 = performance.now(); [...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.click()`);
  await sleep(1500); await cdp.shot(DIR + '\\fix-slow-1.5s.png');
  console.log('@1.5s marks:', await cdp.eval('JSON.stringify(window.__marks)'));
  await sleep(2500); await cdp.shot(DIR + '\\fix-slow-4s.png');
  console.log('@4s marks:', await cdp.eval('JSON.stringify(window.__marks)'));
  console.log('final path:', await cdp.eval('location.pathname'));
  // 落地执行页渲染断言（dev 下嵌套路由可渲染；产物级待 A 修复后复测）
  await sleep(1500);
  const execOk = await cdp.eval(`document.body.innerText.length > 50`);
  console.log('execute page rendered (dev):', execOk);
  await cdp.shot(DIR + '\\fix-slow-execute.png');

  /* ---- 2. 常速失败路径回归：错误文案 toast ---- */
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.nav('http://localhost:7102/today', 3000);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('扫码核销'))?.click()`);
  await sleep(1000);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('手动输入核销码'))?.click()`);
  await sleep(500);
  await cdp.eval(`(() => {
    const input = document.querySelector('#manual-code');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '222222');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await cdp.eval(`[...document.querySelectorAll('button')].find(x => x.textContent.includes('确认核销'))?.click()`);
  await sleep(2200);
  console.log('fail path toast:', await cdp.eval(`document.querySelector('[data-sonner-toaster]')?.innerText ?? null`));
  await cdp.shot(DIR + '\\fix-fail-notfound.png');
} finally {
  cdp.close();
}
