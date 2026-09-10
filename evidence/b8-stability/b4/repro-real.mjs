// B4 复现（修复前）· 真实指针点击：等栅格稳定后用 Input.dispatchMouseEvent 点首个可约槽，
// 并用 elementFromPoint 检查点击点实际命中的元素（排查遮罩吞点击）
import { Cdp, sleep } from '../cdp.mjs';

const DIR = 'D:\\KimiData\\kimi\\tasks\\2026-09-07\\02-22-13-267fc560\\evidence\\b8-stability\\b4';
const CUSTOMER = '01M20EDD8DKJ5DR9FZY7A01Y04';

async function realClick(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

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
  await sleep(1500);

  const hit = await cdp.eval(`(() => {
    const b = document.querySelector('[data-available="true"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const el = document.elementFromPoint(x, y);
    return { slot: b.dataset.testid, x, y,
      hit: el ? (el.dataset?.testid ?? el.tagName + '.' + (el.className?.toString().slice(0, 60) ?? '')) : null,
      hitIsButton: el === b };
  })()`);
  console.log('hit test:', JSON.stringify(hit, null, 1));

  if (hit) {
    await realClick(cdp, Math.round(hit.x), Math.round(hit.y));
    await sleep(700);
    const after1 = await cdp.eval(`(() => {
      const active = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null;
      return active;
    })()`);
    console.log('after 1st REAL click, active =', after1);
    if (!after1) {
      await realClick(cdp, Math.round(hit.x), Math.round(hit.y));
      await sleep(700);
      console.log('after 2nd REAL click, active =', await cdp.eval(`[...document.querySelectorAll('[data-testid^="gs-slot-"]')].find(b => b.className.includes('bg-brand-primary'))?.dataset.testid ?? null`));
    }
  }
  await cdp.shot(DIR + '\\repro-realclick.png');
} finally {
  cdp.close();
}
