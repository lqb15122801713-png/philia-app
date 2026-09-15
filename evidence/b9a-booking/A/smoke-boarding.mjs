// b9a 任务 A：/booking/boarding 及尾斜杠变体冒烟补证（口径同 scripts/smoke-routes.mjs，临时脚本不入库）
// 官方闸门 ROUTES 未含 boarding 路由，按验收口径另行实证。
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const CDP_PORT = 9223;
const TIMEOUT = 9000;
const OUT = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(existsSync);
const profileDir = join(tmpdir(), `b9a-boarding-smoke-${process.pid}`);
let browser = null;

const ROUTES = [
  { path: '/booking/boarding', anchors: ['预约寄养'] },
  { path: '/booking/boarding/', anchors: ['预约寄养'], note: '尾斜杠变体' },
];

async function launch() {
  browser = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP 未就绪');
}

let ws, id = 0;
const pending = new Map();
const events = [];
const send = (m, p = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method: m, params: p })); });
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

async function main() {
  const wsUrl = await launch();
  ws = new WebSocket(wsUrl);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).res(msg.result); pending.delete(msg.id); return; }
    events.push(msg);
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  // 登录
  const users = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json())?.users ?? [];
  const cust = users.find((u) => (u.roles ?? []).includes('customer')) ?? users[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2000);
  const st = await evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ userId: '${cust.id}' }), credentials:'include' }).then(r=>r.status)`);
  console.log('dev-login', st);

  let failures = 0;
  const results = [];
  for (const route of ROUTES) {
    events.length = 0;
    let docStatus = 0;
    const url = APP + route.path;
    await send('Page.navigate', { url });
    const t0 = Date.now();
    let anchorHit = false;
    while (Date.now() - t0 < TIMEOUT) {
      await sleep(500);
      for (const msg of events) if (msg.method === 'Network.responseReceived' && msg.params.type === 'Document') docStatus = msg.params.response.status;
      const text = await evalJs(`(document.body?.innerText ?? '').slice(0, 4000)`).catch(() => '');
      if (route.anchors.some((a) => text.includes(a))) { anchorHit = true; break; }
    }
    await sleep(400);
    const state = JSON.parse(await evalJs(`JSON.stringify({ rootChildren: document.getElementById('root')?.childElementCount ?? 0, text: (document.body?.innerText ?? '').slice(0, 2000) })`));
    const reds = [];
    for (const msg of events) {
      if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry; const text = String(e.text ?? ''); const u = String(e.url ?? '');
        if (/MIME type/.test(text)) reds.push(text);
        else if (/Failed to load resource/.test(text) && (/\.(m?js|css)(\?|#|$)/.test(u) || u === url)) reds.push(`${text} (${u})`);
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const t = String(msg.params.exceptionDetails?.exception?.description ?? '');
        if (/Unexpected token '</.test(t)) reds.push(t.split('\n')[0]);
      }
    }
    const reasons = [];
    if (docStatus !== 200) reasons.push(`文档 HTTP ${docStatus || '未知'}`);
    if (state.rootChildren === 0 || state.text.trim().length < 10) reasons.push('#root 空白');
    if (!anchorHit) reasons.push(`锚点未命中（期望：${route.anchors.join('/')}）`);
    if (reds.length) reasons.push(`console 红线：${reds[0]}`);
    const ok = reasons.length === 0;
    if (!ok) failures++;
    const verdict = ok ? `200 + 非空白 + 锚点命中${route.note ? `（${route.note}）` : ''}` : reasons.join('；');
    console.log(`${ok ? '✅' : '❌'} [customer] ${route.path} —— ${verdict}`);
    results.push({ app: 'customer', path: route.path, ok, verdict });
  }
  writeFileSync(join(OUT, 'smoke-boarding-variants.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log(`\n===== boarding 变体冒烟：${results.length - failures}/${results.length} 通过 =====`);
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  process.exit(failures > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); process.exit(2); });
