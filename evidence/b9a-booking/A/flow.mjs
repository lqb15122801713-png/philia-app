// b9a 任务 A：390×844 下单流程截图链（选服务→选宠→时间→确认→成功页，临时脚本不入库）
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:7200';
const APP = 'http://localhost:7100';
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  console.log('saved', `${name}.png`);
}
async function waitFor(sel, timeout = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await evalJs(`!!document.querySelector('[data-testid="${sel}"]')`).catch(() => false);
    if (ok) return true;
    await sleep(400);
  }
  return false;
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).res(msg.result); pending.delete(msg.id); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const users = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json())?.users ?? [];
  const cust = users.find((u) => (u.roles ?? []).includes('customer')) ?? users[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(1800);
  console.log('dev-login', await evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ userId: '${cust.id}' }), credentials:'include' }).then(r=>r.status)`));
  await evalJs(`Object.keys(localStorage).filter(k=>k.includes('booking')||k.includes('philia')).forEach(k=>localStorage.removeItem(k)); 'cleared'`);

  /* ---- 流程 1：进单屏，服务已预填 ---- */
  await send('Page.navigate', { url: `${APP}/booking/grooming` });
  await waitFor('grooming-single'); await sleep(1800);
  await shot('flow-1-service-prefilled');

  /* ---- 流程 2：选宠（新版 PetPickerFlat 半屏留证） ---- */
  await evalJs(`document.querySelector('[data-testid="gs-pet-card"]').click(); 'ok'`);
  await waitFor('gs-pet-sheet'); await sleep(700);
  await shot('flow-2a-pet-sheet');
  await evalJs(`[...document.querySelectorAll('[data-testid="gs-pet-sheet"] button')].find(x => x.getAttribute('aria-label') !== '关闭')?.click(); 'ok'`);
  await sleep(700);
  await shot('flow-2b-pet-picked');

  /* ---- 流程 3：选时段 ---- */
  await evalJs(`document.querySelector('[data-testid="gs-date-strip"]')?.scrollIntoView({block:'start'}); 'ok'`);
  const slot = await evalJs(`(() => { const b = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].filter(x => x.dataset.available === 'true'); if (!b.length) return 'none'; b[Math.min(2, b.length-1)].click(); return b[Math.min(2, b.length-1)].dataset.testid; })()`);
  console.log('slot:', slot);
  await sleep(700);
  await shot('flow-3-slot-picked');

  /* ---- 流程 3b：折叠区展开（新版 StaffPickerFlat 留证） ---- */
  await evalJs(`document.querySelector('[data-testid="gs-staff-toggle"]').click(); 'ok'`);
  await sleep(500);
  await evalJs(`document.querySelector('[data-testid="gs-extras"]')?.scrollIntoView({block:'center'}); 'ok'`);
  await sleep(500);
  await shot('flow-3b-staff-flat');

  /* ---- 流程 4：确认提交 → 成功页 ---- */
  await evalJs(`window.scrollTo(0,0); 'ok'`);
  const state = await evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.dataset.state`);
  console.log('confirm state:', state);
  await evalJs(`document.querySelector('[data-testid="gs-confirm"]').click(); 'ok'`);
  const t0 = Date.now();
  let okSuccess = false;
  while (Date.now() - t0 < 12000) {
    await sleep(500);
    const path = await evalJs(`location.pathname + location.search`).catch(() => '');
    if (path.includes('/booking/success')) { okSuccess = true; break; }
  }
  console.log('success page:', okSuccess);
  await sleep(1600);
  await shot('flow-4-success');

  ws.close();
  process.exit(okSuccess ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
