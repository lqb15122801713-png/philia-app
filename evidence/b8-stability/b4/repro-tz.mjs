// B4 时区错位验证：客户端模拟 UTC（服务端 CST）→ 栅格可点槽应与本地不一致（大面积灰死）
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

async function scanGrid(cdp, label) {
  // 等栅格稳定
  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`!!document.querySelector('[data-testid="gs-time-grid"]') && !document.querySelector('[data-testid="gs-time-loading"]')`);
    if (ready) break;
    await sleep(500);
  }
  await sleep(1000);
  const r = await cdp.eval(`(() => {
    const btns = [...document.querySelectorAll('[data-testid^="gs-slot-"]')];
    const enabled = btns.filter(b => b.dataset.available === 'true').map(b => b.dataset.testid.replace('gs-slot-', ''));
    const disabled = btns.filter(b => b.dataset.available === 'false').map(b => b.dataset.testid.replace('gs-slot-', ''));
    return { label: '${label}', total: btns.length, enabledCount: enabled.length,
      enabled: enabled.slice(0, 30), disabledSample: disabled.slice(0, 10),
      day: document.querySelector('[data-testid^="gs-day-"][data-active="true"]')?.dataset.testid ?? null,
      clientTz: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMin: new Date().getTimezoneOffset() };
  })()`);
  console.log(JSON.stringify(r, null, 1));
  return r;
}

const cdp = new Cdp();
try {
  await cdp.launch();
  // 客户端强制 UTC（服务端进程为 Asia/Shanghai，UTC+8）—— 复刻 VPS(UTC 服务端)+走查机(CST) 的 8h 错位
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs(CUSTOMER));
  await cdp.nav('http://localhost:7100/booking/grooming', 4000);
  const r = await scanGrid(cdp, 'client=UTC server=CST(+8)');
  await cdp.shot(DIR + '\\repro-tz-grid.png');
  // 尝试点击一个「栅格内但灰色」的槽（如 14:00）：应无响应（disabled）
  const tap = await cdp.eval(`(() => {
    const b = document.querySelector('[data-testid="gs-slot-14:00"]');
    if (!b) return { found: false };
    const wasDisabled = b.disabled;
    b.click();
    return { found: true, wasDisabled };
  })()`);
  await sleep(500);
  const active = await cdp.eval(`[...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null`);
  console.log('tap 14:00 =>', JSON.stringify(tap), '| active after tap:', active);
} finally {
  cdp.close();
}
