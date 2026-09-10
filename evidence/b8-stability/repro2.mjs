/**
 * 批次 8 任务 A 复现第二弹：VPS 等价服务路径（server SERVE_STATIC=1 同源托管）
 * - 经 *.localhost 子域（Chromium 自动解析到 127.0.0.1）触发 Host 头分发；
 * - 验证：尾斜杠变体 / 嵌套路由直开 → 模块脚本被 SPA fallback 成 text/html →
 *   浏览器拒绝执行（MIME mismatch）→ 白屏；
 * - 对照：单段路由直开、页内点击跳转（client-side nav）。
 * 用法：node repro2.mjs（需 server 7200 以 SERVE_STATIC=1 + CORS_ORIGINS 含 *.localhost 起服）
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
  const profileDir = resolve(tmpdir(), `b8-cdp2-${process.pid}-${Date.now()}`);
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

function fmtArg(a) {
  if (a === undefined) return 'undefined';
  if (a.type === 'string') return a.value;
  if ('value' in a) return JSON.stringify(a.value);
  return a.description ?? a.unserializableValue ?? `[${a.type}]`;
}
function fmtStack(st) {
  if (!st?.callFrames?.length) return '';
  return st.callFrames.map((f) => `    at ${f.functionName || '(anon)'} (${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1})`).join('\n');
}
function makeCollector(cdp) {
  const lines = [];
  cdp.onEvent((method, p) => {
    if (method === 'Runtime.consoleAPICalled') {
      lines.push(`[console.${p.type}] ${(p.args ?? []).map(fmtArg).join(' ')}${fmtStack(p.stackTrace) ? '\n' + fmtStack(p.stackTrace) : ''}`);
    } else if (method === 'Runtime.exceptionThrown') {
      const d = p.exceptionDetails;
      lines.push(`[EXCEPTION] ${d.exception?.description ?? d.text}${d.stackTrace ? '\n' + fmtStack(d.stackTrace) : ''}`);
    } else if (method === 'Network.loadingFailed') {
      lines.push(`[net.fail] ${p.errorText} type=${p.type}`);
    } else if (method === 'Network.responseReceived') {
      const r = p.response;
      if (r.status >= 400) lines.push(`[net.${r.status}] ${r.url}`);
      else if (r.url.includes('/assets/') && !r.mimeType.includes('javascript') && !r.mimeType.includes('css') && !r.mimeType.includes('image') && !r.mimeType.includes('font')) {
        lines.push(`[net.MIME-ODD ${r.status} ${r.mimeType}] ${r.url}`);
      }
    } else if (method === 'Log.entryAdded') {
      const e = p.entry;
      if (e.level === 'error' || e.level === 'warning') lines.push(`[log.${e.level}] (${e.source}) ${e.text} ${e.url ?? ''}`);
    }
  });
  return lines;
}

async function loginBoth(cdp, appOrigin, roleWanted) {
  const res = await fetch(`http://localhost:7200/api/auth/dev-seed-users`);
  const data = await res.json();
  const user = (data?.users ?? []).find((u) => (u.roles ?? []).includes(roleWanted)) ?? data?.users?.[0];
  await cdp.send('Page.navigate', { url: `${appOrigin}/dev-login` });
  await sleep(2000);
  // 跨域 dev-login（CORS_ORIGINS 已含本 origin）→ cookie 落在 localhost 域，供 tRPC 调用携带
  const status = await cdp.evalJs(`fetch('http://localhost:7200/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include'
  }).then(r => r.status)`);
  if (status !== 200) throw new Error(`dev-login(${roleWanted}) 失败 HTTP ` + status);
  return user;
}

async function visit(cdp, lines, { name, url, waitMs = 4500, click = null, postClickWait = 2500 }) {
  lines.length = 0;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errs=[];
window.onerror=function(m,s,l,c,e){window.__errs.push({kind:'onerror',msg:String(m),src:s,line:l,col:c,stack:e&&e.stack});};
window.addEventListener('unhandledrejection',function(ev){var r=ev.reason;window.__errs.push({kind:'unhandledrejection',msg:(r&&(r.stack||r.message))||String(r)});});`,
  });
  await cdp.send('Page.navigate', { url });
  await sleep(waitMs);
  let clickNote = '';
  if (click) {
    clickNote = await cdp.evalJs(click).then((v) => `click: ${JSON.stringify(v)}`).catch((e) => `click 异常: ${e.message}`);
    await sleep(postClickWait);
  }
  const errs = await cdp.evalJs('window.__errs ?? []').catch(() => []);
  const rootLen = await cdp.evalJs(`document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1`).catch(() => -2);
  const bodyText = await cdp.evalJs(`(document.body.innerText || '').slice(0, 200)`).catch(() => '');
  const href = await cdp.evalJs('location.href').catch(() => '');
  await cdp.shot(resolve(OUT, `${name}.png`));
  writeFileSync(resolve(OUT, `${name}.txt`), [
    `# 路由复现 ${name}`, `url: ${url}`, `final href: ${href}`, clickNote,
    `#root innerHTML length: ${rootLen}`, `body.innerText 前200字: ${JSON.stringify(bodyText)}`, ``,
    `## window.__errs (${errs.length})`,
    ...errs.map((e, i) => `-- [${i}] ${e.kind}: ${e.msg}${e.stack ? '\n' + e.stack : ''}`), ``,
    `## CDP console/exception/network (${lines.length})`, ...lines,
  ].join('\n'));
  console.log(`=== ${name} rootLen=${rootLen} errs=${errs.length} console=${lines.length} href=${href}`);
  return { rootLen };
}

const cleanup = launchEdge();
try {
  const cdp = await connect();
  const lines = makeCollector(cdp);

  /* ---- 客户（app.localhost:7200，server 同源托管 = VPS 路径） ---- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await loginBoth(cdp, 'http://app.localhost:7200', 'customer');

  await visit(cdp, lines, { name: 'vps-c-home-control', url: 'http://app.localhost:7200/home' });
  await visit(cdp, lines, { name: 'vps-a1-appt-detail', url: 'http://app.localhost:7200/appointments/01M20KGGXFE47W602NK45YND79' });
  await visit(cdp, lines, { name: 'vps-a2-mall-orders', url: 'http://app.localhost:7200/mall/orders' });
  await visit(cdp, lines, { name: 'vps-a4-pets', url: 'http://app.localhost:7200/philia/pets' });
  await visit(cdp, lines, { name: 'vps-a4-moments', url: 'http://app.localhost:7200/philia/moments' });
  // 页内跳转对照：/philia 渲染后点击「宠物档案」卡片链接（client-side nav）
  await visit(cdp, lines, {
    name: 'vps-a4-pets-inapp',
    url: 'http://app.localhost:7200/philia',
    click: `(function(){
      const a=[...document.querySelectorAll('a')].find(x=>(x.getAttribute('href')||'')==='/philia/pets');
      if(a){a.click();return {clicked:a.getAttribute('href')}}
      return {clicked:null, links:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).slice(0,20)};
    })()`,
  });

  /* ---- 商家（m.localhost:7200） ---- */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await loginBoth(cdp, 'http://m.localhost:7200', 'merchant_owner');

  await visit(cdp, lines, { name: 'vps-m-dashboard-control', url: 'http://m.localhost:7200/dashboard' });
  // 进入方式 1：TabBar「预约」页内点击
  await visit(cdp, lines, {
    name: 'vps-m-appt-inapp-tab',
    url: 'http://m.localhost:7200/dashboard',
    click: `(function(){
      const a=[...document.querySelectorAll('a')].find(x=>(x.getAttribute('href')||'')==='/appointments');
      if(a){a.click();return {clicked:'/appointments'}}
      return {clicked:null, links:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).slice(0,20)};
    })()`,
  });
  await visit(cdp, lines, { name: 'vps-m-appt-direct', url: 'http://m.localhost:7200/appointments' });
  await visit(cdp, lines, { name: 'vps-m-appt-trailslash', url: 'http://m.localhost:7200/appointments/' });
  await visit(cdp, lines, { name: 'vps-m-appt-detail', url: 'http://m.localhost:7200/appointments/01M20KGGXFE47W602NK45YND79' });

  cdp.close();
} finally {
  cleanup();
}
console.log('DONE2');
