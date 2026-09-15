/** S1-R2 改后截图（一次性，不入库）：小美登录 → /today → 扫码大按钮纯色底截图 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:7200';
const STAFF = 'http://localhost:7102';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let mid = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++mid;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
  }
};
await new Promise((r, rej) => { ws.onopen = r; ws.onerror = rej; });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};

const seedUsers = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json()).users ?? [];
const xiaomei = seedUsers.find((u) => u.nickname === '小美')?.id;
await send('Page.navigate', { url: `${STAFF}/dev-login` });
await sleep(1500);
const status = await evalJs(`fetch('${API}/api/auth/dev-login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ userId: '${xiaomei}' }), credentials: 'include',
}).then((r) => r.status).catch(() => 0)`);
if (status !== 200) throw new Error(`dev-login HTTP ${status}`);
await send('Page.navigate', { url: `${STAFF}/today` });
for (let i = 0; i < 25; i++) {
  await sleep(400);
  if (await evalJs(`(document.body?.innerText ?? '').includes('扫码核销')`).catch(() => false)) break;
}
await sleep(800);
const cls = await evalJs(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText ?? '').includes('扫码核销'));
  return btn ? btn.className : '';
})()`);
console.log('按钮 className:', cls);
console.log('含 bg-brand-primary:', cls.includes('bg-brand-primary'), '；含 bg-philia-gradient:', cls.includes('bg-philia-gradient'));
const s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(join(OUT, 'r2-frontdesk-button-after.png'), Buffer.from(s.data, 'base64'));
console.log('[截图] r2-frontdesk-button-after.png');
ws.close();
process.exit(cls.includes('bg-brand-primary') && !cls.includes('bg-philia-gradient') ? 0 : 1);
