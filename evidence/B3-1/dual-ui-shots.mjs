/**
 * B3-1 客户端/商家端「重开中」状态截图（CDP 直连）：
 * 用法：node dual-ui-shots.mjs <aid> <outPrefix>
 * 需 server:7200 + customer:7100 + merchant:7101 已启动，且预约处于重开后 in_service 状态。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_PORT = 9225;
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
const [aid, outPrefix] = process.argv.slice(2);
if (!aid || !outPrefix) throw new Error('用法: dual-ui-shots.mjs <aid> <outPrefix>');
mkdirSync(dirname(outPrefix), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = resolve(tmpdir(), `philia-b31-dual-${process.pid}`);
const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`,
  'about:blank',
]);
function cleanup() {
  if (edge?.pid) spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
}
process.on('exit', cleanup);

let ws;
let msgId = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return r?.result?.value;
}
async function shot(file) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
  console.log('saved', file);
}

async function openAs(userId, appPort, path, file, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: mobile ? 390 : 1280,
    height: mobile ? 844 : 800,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
  await send('Page.navigate', { url: `http://localhost:${appPort}/` });
  await sleep(2500);
  const ok = await evaluate(`fetch('http://localhost:7200/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ userId: '${userId}' }),
  }).then(r => r.ok)`);
  console.log(`login@${appPort}:`, ok);
  await send('Page.navigate', { url: `http://localhost:${appPort}${path}` });
  await sleep(4500);
  const text = await evaluate('document.body.innerText.slice(0, 260)');
  console.log(`page@${appPort}${path}:`, JSON.stringify(text));
  await shot(file);
}

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');

  const seeds = await (await fetch('http://localhost:7200/api/auth/dev-seed-users')).json();
  const customer = seeds.users.find((u) => u.nickname === '示例客户');
  const owner = seeds.users.find((u) => (u.roles ?? []).includes('merchant_owner'));

  await openAs(customer.id, 7100, `/appointments/${aid}`, `${outPrefix}-customer-detail.png`, true);
  await openAs(owner.id, 7101, `/appointments/${aid}/monitor`, `${outPrefix}-merchant-monitor.png`, false);
  await openAs(owner.id, 7101, `/appointments?date=all`, `${outPrefix}-merchant-list.png`, false);
  ws.close();
} finally {
  cleanup();
}
process.exit(0);
