/**
 * 批次 8 任务 A 复现第三弹：页内跳转（client-side nav）对照组
 * 证明「深链接白屏、页内跳转正常」是同根的硬币两面：
 * 页内跳转载入的是已 boot 的 SPA，不重新请求文档与静态资源，相对 base 不发作。
 * 用法：node repro3.mjs（需 7100/7101 preview + 7200 server 在跑）
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
  const profileDir = resolve(tmpdir(), `b8-cdp3-${process.pid}-${Date.now()}`);
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
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
    try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
  ws.onmessage = (ev) => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); } };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable'); await send('Runtime.enable');
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };
  const shot = async (outfile) => { mkdirSync(dirname(outfile), { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(outfile, Buffer.from(r.data, 'base64')); };
  return { send, evalJs, shot, close: () => ws.close() };
}
async function login(cdp, appOrigin, roleWanted) {
  const res = await fetch(`http://localhost:7200/api/auth/dev-seed-users`);
  const data = await res.json();
  const user = (data?.users ?? []).find((u) => (u.roles ?? []).includes(roleWanted)) ?? data?.users?.[0];
  await cdp.send('Page.navigate', { url: `${appOrigin}/dev-login` });
  await sleep(2000);
  const status = await cdp.evalJs(`fetch('http://localhost:7200/api/auth/dev-login', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include' }).then(r => r.status)`);
  if (status !== 200) throw new Error('dev-login 失败 HTTP ' + status);
}
async function run(cdp, { name, url, steps }) {
  await cdp.send('Page.navigate', { url });
  await sleep(4500);
  const log = [`# ${name}`, `start: ${url}`];
  for (const s of steps) {
    const r = await cdp.evalJs(s).catch((e) => ({ error: e.message }));
    log.push(`step: ${JSON.stringify(r).slice(0, 300)}`);
    await sleep(2200);
  }
  const href = await cdp.evalJs('location.href');
  const rootLen = await cdp.evalJs(`document.getElementById('root').innerHTML.length`);
  const text = await cdp.evalJs(`(document.body.innerText||'').slice(0,150)`);
  log.push(`final href: ${href}`, `rootLen: ${rootLen}`, `text: ${JSON.stringify(text)}`);
  await cdp.shot(resolve(OUT, `${name}.png`));
  writeFileSync(resolve(OUT, `${name}.txt`), log.join('\n'));
  console.log(`=== ${name} rootLen=${rootLen} href=${href}`);
}

const cleanup = launchEdge();
try {
  const cdp = await connect();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  await login(cdp, 'http://localhost:7100', 'customer');
  // A4 对照：/philia 页内点「宠物档案」→ /philia/pets（嵌套路由页内跳转）
  await run(cdp, {
    name: 'nav-a4-pets-inapp', url: 'http://localhost:7100/philia',
    steps: [`(function(){const a=[...document.querySelectorAll('a')].find(x=>(x.getAttribute('href')||'')==='/philia/pets');if(a){a.click();return {clicked:'/philia/pets'}}return {clicked:null,hrefs:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href'))}})()`],
  });
  // A2 对照：/mall 页内找「订单」入口（若无则从 /me 进）
  await run(cdp, {
    name: 'nav-a2-orders-inapp', url: 'http://localhost:7100/me',
    steps: [`(function(){const a=[...document.querySelectorAll('a')].find(x=>(x.getAttribute('href')||'')==='/mall/orders');if(a){a.click();return {clicked:'/mall/orders'}}return {clicked:null,hrefs:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href'))}})()`],
  });
  // A1 对照：/appointments 列表页内点第一张卡 → /appointments/:id
  await run(cdp, {
    name: 'nav-a1-detail-inapp', url: 'http://localhost:7100/appointments',
    steps: [`(function(){const a=[...document.querySelectorAll('a')].find(x=>/^\\/appointments\\/[0-9A-Z]+$/.test(x.getAttribute('href')||''));if(a){a.click();return {clicked:a.getAttribute('href')}}return {clicked:null,hrefs:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href'))}})()`],
  });

  await login(cdp, 'http://localhost:7101', 'merchant_owner');
  // A3 对照 1：仪表盘页内点 TabBar「预约」
  await run(cdp, {
    name: 'nav-m-appt-tab-inapp', url: 'http://localhost:7101/dashboard',
    steps: [`(function(){const a=[...document.querySelectorAll('a')].find(x=>(x.getAttribute('href')||'')==='/appointments');if(a){a.click();return {clicked:'/appointments'}}return {clicked:null,hrefs:[...document.querySelectorAll('a')].map(x=>x.getAttribute('href'))}})()`],
  });
  // A3 对照 2：列表切「全部」日期后点行 → /appointments/:id（移动视口走 navigate）
  await run(cdp, {
    name: 'nav-m-detail-inapp', url: 'http://localhost:7101/appointments',
    steps: [
      `(function(){const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='全部' );if(b){b.click();return {clicked:'全部-range'}}return {clicked:null}})()`,
      `(function(){const r=[...document.querySelectorAll('[role=button]')].find(x=>x.textContent.includes('旺财')||x.textContent.includes('咪咪'))||document.querySelector('[role=button]');if(r){r.click();return {clicked:'row',text:r.textContent.slice(0,60)}}return {clicked:null}})()`,
    ],
  });
  cdp.close();
} finally { cleanup(); }
console.log('DONE3');
