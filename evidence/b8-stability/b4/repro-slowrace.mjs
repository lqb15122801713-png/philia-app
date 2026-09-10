// B4 复现（修复前）· 慢网+全程探针：记录从页面加载起 grid/loading/active/可用槽 的全部变迁
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

const PROBE = `
window.__trace = [];
window.__t0 = performance.now();
setInterval(() => {
  const loading = !!document.querySelector('[data-testid="gs-time-loading"]');
  const active = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null;
  const firstAvail = document.querySelector('[data-available="true"]')?.dataset.testid ?? null;
  const dayEl = document.querySelector('[data-testid^="gs-day-"][data-active="true"]');
  const snap = { ms: Math.round(performance.now() - window.__t0), loading, active, firstAvail, day: dayEl?.dataset.testid ?? null };
  const last = window.__trace[window.__trace.length - 1];
  if (!last || JSON.stringify(last) !== JSON.stringify(snap)) window.__trace.push(snap);
}, 60);
window.__clickFirst = () => {
  const b = document.querySelector('[data-available="true"]');
  if (!b) return null;
  b.click();
  return b.dataset.testid + '@' + Math.round(performance.now() - window.__t0) + 'ms';
};
`;

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));

  // 慢网 1200ms RTT，拉宽启动链各窗口
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1200, downloadThroughput: 3e6, uploadThroughput: 3e6 });
  await cdp.nav('http://localhost:7100/booking/grooming', 500);

  // 栅格第一次出现可约槽就立刻点击（走查用户行为）
  let clicked = null;
  for (let i = 0; i < 200; i++) {
    clicked = await cdp.eval('window.__clickFirst ? window.__clickFirst() : null').catch(() => null);
    if (clicked) break;
    await sleep(120);
  }
  console.log('clicked:', clicked);
  // 观察 12s（覆盖整个启动链）
  await sleep(12000);
  console.log('trace:', await cdp.eval('JSON.stringify(window.__trace, null, 1)'));
  await cdp.shot(DIR + '\\repro-slowrace-final.png');
} finally {
  cdp.close();
}
