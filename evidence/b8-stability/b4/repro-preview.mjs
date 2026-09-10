// B4 复现（修复前）：预约洗护单屏，等时段栅格稳定后点击首个可约槽，观察选中态
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:8100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));
  await cdp.nav('http://localhost:8100/booking/grooming', 4000);

  // 等时段栅格出现且稳定（不在加载态）
  let ready = false;
  for (let i = 0; i < 30; i++) {
    ready = await cdp.eval(`!!document.querySelector('[data-testid="gs-time-grid"]') && !document.querySelector('[data-testid="gs-time-loading"]')`);
    if (ready) break;
    await sleep(500);
  }
  console.log('grid ready:', ready);
  // 再稳态等待 2s（排除后台 refetch 中途换网格）
  await sleep(2000);
  const stable = await cdp.eval(`!document.querySelector('[data-testid="gs-time-loading"]')`);
  console.log('grid stable:', stable);
  await cdp.shot(DIR + '\\repro-1-grid.png');

  const state = (label) => cdp.eval(`JSON.stringify({
    label: '${label}',
    dayLoading: !!document.querySelector('[data-testid="gs-time-loading"]'),
    firstAvail: document.querySelector('[data-available="true"]')?.dataset.testid ?? null,
    activeSlot: (() => { const el = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary')); return el?.dataset.testid ?? null; })(),
    confirmText: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => t.includes('确认预约') || t.includes('请选择')) ?? null,
    activeDay: document.querySelector('[data-testid^="gs-day-"][data-active="true"]')?.dataset.testid ?? null,
  })`);
  console.log(await state('before-click'));

  // 点击首个可约槽（仅一次）
  const clicked = await cdp.eval(`(() => { const b = document.querySelector('[data-available="true"]'); if (!b) return null; b.click(); return b.dataset.testid; })()`);
  console.log('clicked:', clicked);
  for (const ms of [200, 600, 1200, 2500, 4000]) {
    await sleep(ms === 200 ? 200 : ms - [200, 600, 1200, 2500, 4000][[200, 600, 1200, 2500, 4000].indexOf(ms) - 1]);
    console.log(await state('t+' + ms + 'ms'));
  }
  await cdp.shot(DIR + '\\repro-2-after-first-click.png');

  // 第二次点击（walkthrough 说点两次才选中）
  const firstAvailNow = await cdp.eval(`document.querySelector('[data-available="true"]')?.dataset.testid ?? null`);
  await cdp.eval(`(() => { const b = document.querySelector('[data-testid="' + '${firstAvailNow}' + '"]'); b?.click(); })()`);
  await sleep(800);
  console.log(await state('after-2nd-click'));
  await cdp.shot(DIR + '\\repro-3-after-2nd-click.png');
} finally {
  cdp.close();
}
