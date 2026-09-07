/**
 * B3-1 员工端 UI 取证（CDP 直连，无 puppeteer）：
 * 1. 动态取种子员工 → dev-login → 打开 /execute/<aid>（重开后：step6 active + 打标横幅）→ 截图；
 * 2. 点击「确认本步完成」（二次完成，员工端真实操作）→ 庆祝层截图。
 * 用法：node staff-ui-drive.mjs <appointmentId> <outPrefix>（需 server:7200 + staff:7102 已启动）
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_PORT = 9224;
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
const [aid, outPrefix] = process.argv.slice(2);
if (!aid || !outPrefix) throw new Error('用法: staff-ui-drive.mjs <aid> <outPrefix>');
mkdirSync(dirname(outPrefix), { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = resolve(tmpdir(), `philia-b31-staff-${process.pid}`);
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  // 动态取种子员工并登录（禁止硬编码 ULID 的纪律：现场接口取数）
  const seeds = await (await fetch('http://localhost:7200/api/auth/dev-seed-users')).json();
  const staffUser = seeds.users.find((u) => (u.roles ?? []).includes('staff'));
  await send('Page.navigate', { url: 'http://localhost:7102/' });
  await sleep(2500);
  const login = await evaluate(`fetch('http://localhost:7200/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ userId: '${staffUser.id}' }),
  }).then(r => r.ok)`);
  console.log('dev-login(staff):', login, staffUser.nickname);

  await send('Page.navigate', { url: `http://localhost:7102/execute/${aid}` });
  await sleep(4500);
  const state1 = await evaluate(`({
    url: location.pathname,
    flaggedBanner: document.body.innerText.includes('重拍') || document.body.innerText.includes('打标'),
    capsule: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t.includes('确认本步完成')),
    activeChip: document.body.innerText.includes('已打标，等待重拍'),
  })`);
  console.log('reopened page state:', JSON.stringify(state1));
  await shot(`${outPrefix}-reopened.png`);

  // 二次完成：点击末步「确认服务完成」（其余步为「确认本步完成」，两种文案都匹配）
  const clicked = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b =>
      (b.textContent.includes('确认服务完成') || b.textContent.includes('确认本步完成')) && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  console.log('confirm clicked:', clicked);
  await sleep(2500);
  const state2 = await evaluate(`({
    celebrate: document.body.innerText.includes('完成') || document.body.innerText.includes('辛苦'),
    text: document.body.innerText.slice(0, 200),
  })`);
  console.log('after confirm state:', JSON.stringify(state2));
  await shot(`${outPrefix}-second-complete.png`);

  ws.close();
} finally {
  cleanup();
}
process.exit(0);
