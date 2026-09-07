// B3-3 修复前 DOM 断言 + 截图：商家端待确认列表无「婉拒」入口
import { writeFileSync } from 'node:fs';
const DEBUG_PORT = 9223;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
const targets = await res.json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
};
await new Promise(r => ws.onopen = r);
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 414, height: 896, deviceScaleFactor: 1, mobile: true });

// 登录（动态取种子商家）
await send('Page.navigate', { url: 'http://localhost:7101/' });
await sleep(2500);
const login = await send('Runtime.evaluate', { expression: `
  (async () => {
    const u = await fetch('http://localhost:7200/api/auth/dev-seed-users').then(r => r.json());
    const merchant = (u.users || u).find(x => (x.roles || []).includes('merchant_owner'));
    await fetch('http://localhost:7200/api/auth/dev-login', { method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: merchant.id }) });
    return merchant.id;
  })()
`, awaitPromise: true, returnByValue: true });
console.log('logged in as merchant', login.result.value);

// 待确认列表（全部日期，避免「今天」过滤吞单）
await send('Page.navigate', { url: 'http://localhost:7101/appointments?status=pending&date=all' });
await sleep(3500);
const dom = await send('Runtime.evaluate', { expression: `
  (() => {
    const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim());
    return {
      hasConfirmBtn: btns.some(t => t === '确认' || t === '确认预约'),
      hasRejectBtn: btns.some(t => t.includes('婉拒') || t.includes('拒')),
      allButtons: btns,
      bodyHasPendingCard: document.body.innerText.includes('待确认'),
    };
  })()
`, returnByValue: true });
console.log('DOM 断言:', JSON.stringify(dom.result.value, null, 1));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('repro-merchant-list-no-reject.png', Buffer.from(shot.data, 'base64'));
console.log('saved repro-merchant-list-no-reject.png');
ws.close();
process.exit(0);
