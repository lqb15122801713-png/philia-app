// B1 复现（修复前）· 慢网门控证据：2s 网络延迟下，点击→反馈 的耗时构成
// 理论：useCheckin.ts `await queryClient.invalidateQueries()` 把 toast/跳转 门控在所有活跃查询 refetch 完成之后
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b1';
const STAFF_USER = '01M20EDD8DCX0M28PR83D6XMPC';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7102/dev-login', 2000);
  console.log('login:', await cdp.loginAs(STAFF_USER));
  await cdp.nav('http://localhost:7102/today', 3000);

  // 2s 往返延迟（模拟 VPS 走查弱网）
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

  // 页面内计时探针：记录 toast 出现 / 路由跳转 的时刻
  await cdp.eval(`(() => {
    window.__t0 = performance.now();
    window.__marks = [];
    const mo = new MutationObserver(() => {
      const toast = document.querySelector('[data-sonner-toast]');
      if (toast && !window.__marks.find(m => m.what === 'toast')) {
        window.__marks.push({ what: 'toast', text: toast.innerText, ms: Math.round(performance.now() - window.__t0) });
      }
      if (location.pathname !== '/today' && !window.__marks.find(m => m.what === 'nav')) {
        window.__marks.push({ what: 'nav', path: location.pathname, ms: Math.round(performance.now() - window.__t0) });
      }
    });
    mo.observe(document.body, { subtree: true, childList: true });
    // 轮询兜底（路由变化不一定触发 body 子树变化到可观测）
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
  // 分段截图：1.5s / 4s / 8s
  await sleep(1500); await cdp.shot(DIR + '\\repro-slow-1.5s.png');
  console.log('@1.5s marks:', await cdp.eval('JSON.stringify(window.__marks)'));
  await sleep(2500); await cdp.shot(DIR + '\\repro-slow-4s.png');
  console.log('@4s marks:', await cdp.eval('JSON.stringify(window.__marks)'));
  await sleep(4000); await cdp.shot(DIR + '\\repro-slow-8s.png');
  console.log('@8s marks:', await cdp.eval('JSON.stringify(window.__marks)'));
  console.log('final path:', await cdp.eval('location.pathname'));
} finally {
  cdp.close();
}
