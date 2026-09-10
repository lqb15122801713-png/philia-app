/**
 * 批次 8 任务 A 复现第四弹：影响面扫尾——任务书未点名但同机理的嵌套路由
 * 用法：node repro4.mjs（需 7100/7101 preview + 7200 server 在跑）
 */
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const DEBUG_PORT = 9223;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function launchEdge() {
  const profileDir = resolve(tmpdir(), `b8-cdp4-${process.pid}-${Date.now()}`);
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { if (proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); try { rmSync(profileDir, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);
  return cleanup;
}
async function connect() {
  let targets = null;
  for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await r.json(); if (targets.length) break; } catch {} await sleep(500); }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
  ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); } };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable'); await send('Runtime.enable');
  const evalJs = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); return r.result.value; };
  const shot = async (f) => { mkdirSync(dirname(f), { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(f, Buffer.from(r.data, 'base64')); };
  return { send, evalJs, shot, close: () => ws.close() };
}
async function login(cdp, appOrigin, role) {
  const res = await fetch(`http://localhost:7200/api/auth/dev-seed-users`);
  const data = await res.json();
  const user = (data?.users ?? []).find((u) => (u.roles ?? []).includes(role)) ?? data?.users?.[0];
  await cdp.send('Page.navigate', { url: `${appOrigin}/dev-login` });
  await sleep(1800);
  const status = await cdp.evalJs(`fetch('http://localhost:7200/api/auth/dev-login', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include' }).then(r => r.status)`);
  if (status !== 200) throw new Error('dev-login 失败 HTTP ' + status);
}
const cleanup = launchEdge();
try {
  const cdp = await connect();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await login(cdp, 'http://localhost:7100', 'customer');
  const routes = [
    ['x-booking-grooming', 'http://localhost:7100/booking/grooming'],
    ['x-booking-success', 'http://localhost:7100/booking/success'],
    ['x-mall-cart', 'http://localhost:7100/mall/cart'],
    ['x-mall-checkout', 'http://localhost:7100/mall/checkout'],
    ['x-philia-member', 'http://localhost:7100/philia/member'],
    ['x-mall-product', 'http://localhost:7100/mall/product/01M20EDD8GG8B9DM30FRF0A7T8'],
  ];
  for (const [name, url] of routes) {
    await cdp.send('Page.navigate', { url });
    await sleep(3500);
    const rootLen = await cdp.evalJs(`document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1`);
    await cdp.shot(resolve(OUT, `${name}.png`));
    writeFileSync(resolve(OUT, `${name}.txt`), `# ${name}\nurl: ${url}\nrootLen: ${rootLen}\n`);
    console.log(`=== ${name} rootLen=${rootLen}`);
  }
  cdp.close();
} finally { cleanup(); }
console.log('DONE4');
