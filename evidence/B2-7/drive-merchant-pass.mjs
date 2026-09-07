// 商家端次卡管理页 CDP 驱动：登录店主 → /passes 截图列表 → 执行一次 UI 充次 → 截图结果
// 用法：node drive-merchant-pass.mjs <店主昵称> <客户昵称> <次数> <列表截图> <充次后截图>
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [merchantNick, customerNick, times, shotList, shotAfter] = process.argv.slice(2);
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => existsSync(p));
const DEBUG_PORT = 9223;
const API = 7200;
const APP = 7101;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser = null;
const profileDir = resolve(tmpdir(), `philia-b27-mpass-${process.pid}`);
function cleanup() {
  if (browser?.pid) {
    spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    browser = null;
  }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);

async function main() {
  const seeds = await (await fetch(`http://localhost:${API}/api/auth/dev-seed-users`)).json();
  const merchant = seeds.users.find((u) => u.nickname === merchantNick);
  const customer = seeds.users.find((u) => u.nickname === customerNick);
  if (!merchant || !customer) throw new Error('seed user missing');

  browser = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await r.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  // 平板视口（lg 断点以上 → 表格形态）
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, tries = 24) => {
    for (let i = 0; i < tries; i++) { if (await evalJs(expr)) return true; await sleep(500); }
    return false;
  };

  await send('Page.navigate', { url: `http://localhost:${APP}/dev-login` });
  await sleep(2500);
  const st = await evalJs(`fetch('http://localhost:${API}/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: '${merchant.id}' }), credentials: 'include' }).then((r) => r.status)`);
  console.log('login merchant HTTP', st);

  await send('Page.navigate', { url: `http://localhost:${APP}/passes` });
  console.log('list rendered:', await waitFor(`document.body.textContent.includes('次卡管理') && document.body.textContent.includes('${customerNick}')`));
  await sleep(1000);
  mkdirSync(dirname(shotList), { recursive: true });
  const s1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shotList, Buffer.from(s1.data, 'base64'));
  console.log('saved', shotList);

  // 打开充次对话框（行内「充次」按钮，预设该客户）
  await evalJs(`(() => { const tr = Array.from(document.querySelectorAll('tbody tr')).find((t) => t.textContent.includes('${customerNick}')); const btn = Array.from(tr.querySelectorAll('button')).find((b) => b.textContent.includes('充次')); btn.click(); return true; })()`);
  await waitFor(`!!document.querySelector('[role="dialog"]')`);
  // 填次数（React 受控 input：原生 setter + input 事件）
  await evalJs(`(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const input = dlg.querySelector('input[type="number"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '${times}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value;
  })()`);
  await sleep(400);
  const before = await evalJs(`(() => { const tr = Array.from(document.querySelectorAll('tbody tr')).find((t) => t.textContent.includes('${customerNick}')); return tr ? tr.textContent : ''; })()`);
  console.log('row before topup:', before.replace(/\\s+/g, ' '));
  await evalJs(`(() => { const dlg = document.querySelector('[role="dialog"]'); const btn = Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent.includes('确认充次')); btn.click(); return true; })()`);
  const toastOk = await waitFor(`document.body.textContent.includes('充次成功')`, 16);
  console.log('toast 充次成功:', toastOk);
  await sleep(1200);
  const after = await evalJs(`(() => { const tr = Array.from(document.querySelectorAll('tbody tr')).find((t) => t.textContent.includes('${customerNick}')); return tr ? tr.textContent : ''; })()`);
  console.log('row after topup:', after.replace(/\\s+/g, ' '));
  const s2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shotAfter, Buffer.from(s2.data, 'base64'));
  console.log('saved', shotAfter);
  ws.close();
  cleanup();
  process.exit(0);
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });
