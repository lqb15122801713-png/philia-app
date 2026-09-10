// B4 复现（修复前）· 生产构建（vite preview）：模拟走查路径（/home → Tab 预约 → 预约洗护），
// 栅格稳定后点击首个可约槽一次，观察选中态
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2500);
  console.log('login:', await cdp.loginAs(CUSTOMER));
  await cdp.nav('http://localhost:7100/home', 3500);
  console.log('home rendered:', await cdp.eval(`document.body.innerText.length > 50`));

  // 客户端内导航到预约单屏（与走查一致；直开 /booking/grooming 的白屏属任务 A）
  const toBooking = await cdp.eval(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => (x.getAttribute('href') ?? '').includes('/booking'));
    if (a) { a.click(); return a.getAttribute('href'); }
    return null;
  })()`);
  console.log('clicked booking entry:', toBooking);
  await sleep(2500);
  const toGrooming = await cdp.eval(`(() => {
    const a = [...document.querySelectorAll('a')].find(x => (x.getAttribute('href') ?? '').startsWith('/booking/grooming'));
    if (a) { a.click(); return a.getAttribute('href'); }
    return null;
  })()`);
  console.log('clicked grooming entry:', toGrooming);
  await sleep(3500);
  console.log('path:', await cdp.eval('location.pathname + location.search'));

  // 等栅格稳定
  let ready = false;
  for (let i = 0; i < 30; i++) {
    ready = await cdp.eval(`!!document.querySelector('[data-testid="gs-time-grid"]') && !document.querySelector('[data-testid="gs-time-loading"]')`);
    if (ready) break;
    await sleep(500);
  }
  console.log('grid ready:', ready);
  await sleep(1500);
  await cdp.shot(DIR + '\\repro-prod-1-grid.png');

  const state = (label) => cdp.eval(`JSON.stringify({
    label: '${label}',
    dayLoading: !!document.querySelector('[data-testid="gs-time-loading"]'),
    firstAvail: document.querySelector('[data-available="true"]')?.dataset.testid ?? null,
    activeSlot: [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null,
    activeDay: document.querySelector('[data-testid^="gs-day-"][data-active="true"]')?.dataset.testid ?? null,
  })`);
  console.log(await state('before-click'));

  const clicked = await cdp.eval(`(() => { const b = document.querySelector('[data-available="true"]'); if (!b) return null; b.click(); return b.dataset.testid; })()`);
  console.log('clicked:', clicked);
  for (const ms of [300, 900, 2000, 4000]) {
    await sleep(ms === 300 ? 300 : ms - [300, 900, 2000, 4000][[300, 900, 2000, 4000].indexOf(ms) - 1]);
    console.log(await state('t+' + ms + 'ms'));
  }
  await cdp.shot(DIR + '\\repro-prod-2-after-1st.png');
  // 第二次点击
  await cdp.eval(`document.querySelector('[data-available="true"]')?.click()`);
  await sleep(800);
  console.log(await state('after-2nd'));
  await cdp.shot(DIR + '\\repro-prod-3-after-2nd.png');
} finally {
  cdp.close();
}
