/**
 * 批次 8 任务 A 根因定位：生产构建白屏复现脚本（不入库）
 *
 * 流程：自起 Edge headless(9223) → CDP 全量收集（Runtime.consoleAPICalled /
 * exceptionThrown / window.onerror / unhandledrejection / Network 失败）→
 * dev-login 登录 → 逐路由深链接直开 → 截图 + 日志 txt 落盘。
 *
 * 用法：node repro.mjs   （需 7100/7101/7200 服务已起）
 */
import { spawn, spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launchEdge() {
  const profileDir = resolve(tmpdir(), `b8-cdp-${process.pid}-${Date.now()}`);
  const proc = spawn(EDGE, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: 'ignore' });
  const cleanup = () => {
    if (proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  return cleanup;
}

async function connect() {
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  if (!targets?.length) throw new Error('Edge CDP 未就绪');
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg.method, msg.params);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Log.enable');
  const onEvent = (fn) => listeners.push(fn);
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    }
    return r.result.value;
  };
  const shot = async (outfile) => {
    mkdirSync(dirname(outfile), { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(outfile, Buffer.from(r.data, 'base64'));
  };
  return { send, evalJs, shot, onEvent, close: () => ws.close() };
}

/* ---------- 事件收集 ---------- */
function fmtArg(a) {
  if (a === undefined) return 'undefined';
  if (a.type === 'string') return a.value;
  if ('value' in a) return JSON.stringify(a.value);
  return a.description ?? a.unserializableValue ?? `[${a.type} ${a.className ?? ''}]`;
}
function fmtStack(st) {
  if (!st?.callFrames?.length) return '';
  return st.callFrames
    .map((f) => `    at ${f.functionName || '(anon)'} (${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1})`)
    .join('\n');
}

function makeCollector(cdp) {
  const lines = [];
  cdp.onEvent((method, p) => {
    if (method === 'Runtime.consoleAPICalled') {
      const args = (p.args ?? []).map(fmtArg).join(' ');
      lines.push(`[console.${p.type}] ${args}${fmtStack(p.stackTrace) ? '\n' + fmtStack(p.stackTrace) : ''}`);
    } else if (method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails;
      const desc = d.exception?.description ?? d.text;
      lines.push(`[EXCEPTION] ${desc}${d.stackTrace ? '\n' + fmtStack(d.stackTrace) : ''}\n  (url=${d.url}:${(d.lineNumber ?? 0) + 1}:${(d.columnNumber ?? 0) + 1})`);
    } else if (method === 'Network.loadingFailed') {
      lines.push(`[net.fail] ${p.errorText} type=${p.type} canceled=${p.canceled ?? false}`);
    } else if (method === 'Network.responseReceived') {
      const r = p.response;
      if (r.status >= 400) lines.push(`[net.${r.status}] ${r.url}`);
    } else if (method === 'Log.entryAdded') {
      const e = p.entry;
      if (e.level === 'error' || e.level === 'warning') {
        lines.push(`[log.${e.level}] (${e.source}) ${e.text} ${e.url ?? ''}:${(e.lineNumber ?? 0) + 1}`);
      }
    }
  });
  return lines;
}

/* ---------- 登录 ---------- */
async function devLogin(cdp, appOrigin, roleWanted) {
  const res = await fetch(`${API}/api/auth/dev-seed-users`);
  const data = await res.json();
  const user = (data?.users ?? []).find((u) => (u.roles ?? []).includes(roleWanted)) ?? data?.users?.[0];
  if (!user) throw new Error('dev-seed-users 未取到用户 ' + roleWanted);
  await cdp.send('Page.navigate', { url: `${appOrigin}/dev-login` });
  await sleep(2000);
  const status = await cdp.evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include'
  }).then(r => r.status)`);
  if (status !== 200) throw new Error(`dev-login(${roleWanted}) 失败 HTTP ` + status);
  return user;
}

/* ---------- 单路由复现 ---------- */
async function reproRoute(cdp, lines, { name, url, waitMs = 4500 }) {
  lines.length = 0;
  // 安装 window.onerror / unhandledrejection 钩子（对新文档生效）
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errs=[];
window.onerror=function(m,s,l,c,e){window.__errs.push({kind:'onerror',msg:String(m),src:s,line:l,col:c,stack:e&&e.stack});};
window.addEventListener('unhandledrejection',function(ev){var r=ev.reason;window.__errs.push({kind:'unhandledrejection',msg:(r&&(r.stack||r.message))||String(r)});});`,
  });
  const t0 = Date.now();
  await cdp.send('Page.navigate', { url });
  await sleep(waitMs);
  const errs = await cdp.evalJs('window.__errs ?? []').catch(() => []);
  const rootLen = await cdp.evalJs(`document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1`).catch(() => -2);
  const bodyText = await cdp.evalJs(`(document.body.innerText || '').slice(0, 300)`).catch(() => '');
  const href = await cdp.evalJs('location.href').catch(() => '');
  const png = resolve(OUT, `${name}.png`);
  await cdp.shot(png);
  const header = [
    `# 路由复现 ${name}`,
    `url: ${url}`,
    `final href: ${href}`,
    `耗时: ${Date.now() - t0}ms`,
    `#root innerHTML length: ${rootLen}`,
    `body.innerText 前300字: ${JSON.stringify(bodyText)}`,
    ``,
    `## window.__errs (${errs.length})`,
    ...errs.map((e, i) => `-- [${i}] ${e.kind}: ${e.msg}${e.stack ? '\n' + e.stack : ''}${e.src ? `\n  src=${e.src}:${e.line}:${e.col}` : ''}`),
    ``,
    `## CDP console/exception/network (${lines.length})`,
    ...lines,
  ];
  writeFileSync(resolve(OUT, `${name}.txt`), header.join('\n'));
  console.log(`=== ${name} rootLen=${rootLen} errs=${errs.length} console=${lines.length} -> ${name}.png/.txt`);
  return { rootLen, errs, lines, bodyText };
}

/* ---------- 主流程 ---------- */
const cleanup = launchEdge();
try {
  const cdp = await connect();
  const lines = makeCollector(cdp);

  /* ---- 客户端（移动视口） ---- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const customer = await devLogin(cdp, 'http://localhost:7100', 'customer');
  console.log('客户登录:', customer.nickname, customer.id);

  const APPT_PENDING = '01M20KGGXFE47W602NK45YND79';
  const APPT_INSVC = '01M256D240E19GWNG2QMFV3Q8V';

  await reproRoute(cdp, lines, { name: 'c0-home-control', url: 'http://localhost:7100/home' });
  await reproRoute(cdp, lines, { name: 'c1-appt-list-control', url: 'http://localhost:7100/appointments' });
  await reproRoute(cdp, lines, { name: 'a1-appointments-id-pending', url: `http://localhost:7100/appointments/${APPT_PENDING}` });
  await reproRoute(cdp, lines, { name: 'a1-appointments-id-inservice', url: `http://localhost:7100/appointments/${APPT_INSVC}` });
  await reproRoute(cdp, lines, { name: 'a2-mall-orders', url: 'http://localhost:7100/mall/orders' });
  await reproRoute(cdp, lines, { name: 'a4-philia-pets', url: 'http://localhost:7100/philia/pets' });
  await reproRoute(cdp, lines, { name: 'a4-philia-moments', url: 'http://localhost:7100/philia/moments' });
  await reproRoute(cdp, lines, { name: 'c2-philia-control', url: 'http://localhost:7100/philia' });

  /* ---- 商家端（平板视口） ---- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const merchant = await devLogin(cdp, 'http://localhost:7101', 'merchant_owner');
  console.log('商家登录:', merchant.nickname, merchant.id);

  await reproRoute(cdp, lines, { name: 'm0-dashboard-control', url: 'http://localhost:7101/dashboard' });
  await reproRoute(cdp, lines, { name: 'a3-merchant-appointments', url: 'http://localhost:7101/appointments' });

  cdp.close();
} finally {
  cleanup();
}
console.log('DONE');
