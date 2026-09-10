import { Cdp, sleep } from '../cdp.mjs';
const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const cdp = new Cdp();
try {
  await cdp.launch();
  await cdp.nav('http://localhost:7100/dev-login', 2000);
  console.log('login:', await cdp.loginAs('01M20EDD8DKJ5DR9FZY7A01Y04'));
  await cdp.nav('http://localhost:7100/booking/grooming', 4500);
  for (let i = 0; i < 30; i++) {
    const ready = await cdp.eval(`!!document.querySelector('[data-testid="gs-time-grid"]') && !document.querySelector('[data-testid="gs-time-loading"]')`);
    if (ready) break;
    await sleep(500);
  }
  await sleep(800);
  const tap = await cdp.eval(`(() => {
    const b = document.querySelector('[data-testid="gs-slot-14:00"]');
    if (!b) return { found: false };
    const disabled = b.disabled;
    b.click();
    return { found: true, disabled };
  })()`);
  await sleep(600);
  const active = await cdp.eval(`[...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null`);
  console.log('tap 14:00 (single click) =>', JSON.stringify(tap), '| active =', active);
  await cdp.shot(DIR + '\\tz-postfix-tap1400.png');
} finally { cdp.close(); }
