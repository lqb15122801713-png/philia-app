// B4 红/绿态扫描：客户端 CST（不覆盖时区）× 服务端 TZ=UTC（仿真 VPS 容器）
// 修复前预期（红）：可约槽偏移到 17:00-19:30，上午/下午大面积灰死、点击无响应
// 修复后预期（绿）：09:00-19:30（+1h 缓冲后）可点，单次点击即选中
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';
const TAG = process.argv[2] ?? 'run';

const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));
  await cdp.nav('http://localhost:7100/booking/grooming', 4000);
  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`!!document.querySelector('[data-testid="gs-time-grid"]') && !document.querySelector('[data-testid="gs-time-loading"]')`);
    if (ready) break;
    await sleep(500);
  }
  await sleep(1000);
  const r = await cdp.eval(`(() => {
    const btns = [...document.querySelectorAll('[data-testid^="gs-slot-"]')];
    const enabled = btns.filter(b => b.dataset.available === 'true').map(b => b.dataset.testid.replace('gs-slot-', ''));
    return { clientTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      day: document.querySelector('[data-testid^="gs-day-"][data-active="true"]')?.dataset.testid ?? null,
      total: btns.length, enabledCount: enabled.length, enabledFirst: enabled[0] ?? null, enabledLast: enabled[enabled.length - 1] ?? null, enabled };
  })()`);
  console.log(JSON.stringify(r, null, 1));
  await cdp.shot(`${DIR}\\tz-${TAG}-grid.png`);

  // 点击 10:00（营业时间内正常时段）：修复前灰死无响应；修复后单次点击选中
  const tap = await cdp.eval(`(() => {
    const b = document.querySelector('[data-testid="gs-slot-10:00"]');
    if (!b) return { found: false };
    const disabled = b.disabled;
    b.click();
    return { found: true, disabled };
  })()`);
  await sleep(600);
  const active = await cdp.eval(`[...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null`);
  console.log('tap 10:00 =>', JSON.stringify(tap), '| active =', active);
  await cdp.shot(`${DIR}\\tz-${TAG}-tap1000.png`);
} finally {
  cdp.close();
}
