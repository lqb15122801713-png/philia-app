// B4 复现（修复前）· 启动竞态：栅格一出现立刻点击首个可约槽，观察选中态是否被预填链吞掉
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));

  // 页面内探针先装好：记录 slot 选中态变化时间线
  await cdp.nav('http://localhost:7100/booking/grooming', 300);
  await cdp.eval(`(() => {
    window.__trace = [];
    const t0 = performance.now();
    window.__t0 = t0;
    setInterval(() => {
      const loading = !!document.querySelector('[data-testid="gs-time-loading"]');
      const active = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null;
      const firstAvail = document.querySelector('[data-available="true"]')?.dataset.testid ?? null;
      const last = window.__trace[window.__trace.length - 1];
      const snap = { ms: Math.round(performance.now() - t0), loading, active, firstAvail };
      if (!last || last.loading !== snap.loading || last.active !== snap.active || last.firstAvail !== snap.firstAvail) {
        window.__trace.push(snap);
      }
    }, 50);
  })()`).catch(() => {}); // 导航竞态下允许失败，重试一次
  // 导航可能打断了上面的注入；等待栅格出现后确保探针在位
  for (let i = 0; i < 20; i++) {
    const hasProbe = await cdp.eval('Array.isArray(window.__trace)').catch(() => false);
    if (hasProbe) break;
    await cdp.eval(`(() => {
      window.__trace = [];
      const t0 = performance.now();
      setInterval(() => {
        const loading = !!document.querySelector('[data-testid="gs-time-loading"]');
        const active = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null;
        const firstAvail = document.querySelector('[data-available="true"]')?.dataset.testid ?? null;
        const last = window.__trace[window.__trace.length - 1];
        const snap = { ms: Math.round(performance.now() - t0), loading, active, firstAvail };
        if (!last || last.loading !== snap.loading || last.active !== snap.active || last.firstAvail !== snap.firstAvail) {
          window.__trace.push(snap);
        }
      }, 50);
    })()`).catch(() => {});
    await sleep(200);
  }

  // 栅格一出现可约槽就立刻点击（模拟走查用户的「首次点击」）
  let clickedAt = null;
  for (let i = 0; i < 120; i++) {
    const r = await cdp.eval(`(() => {
      const b = document.querySelector('[data-available="true"]');
      if (!b) return null;
      b.click();
      return { slot: b.dataset.testid, ms: Math.round(performance.now()) };
    })()`);
    if (r) { clickedAt = r; break; }
    await sleep(100);
  }
  console.log('clicked:', JSON.stringify(clickedAt));
  await sleep(6000);
  console.log('trace:', await cdp.eval('JSON.stringify(window.__trace, null, 1)'));
  await cdp.shot(DIR + '\\repro-race-final.png');
} finally {
  cdp.close();
}
