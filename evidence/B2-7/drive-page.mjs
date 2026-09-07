// 通用 CDP 页面截图：登录指定种子用户 → 打开指定路径 → 等表达式成立 → 截图
// 用法：node drive-page.mjs <昵称> <路径> <输出png> <等待表达式> [宽] [高] [mobile 0/1] [截图前额外评估JS]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [nickname, path, outfile, waitExpr, w = '390', h = '844', mobile = '1', extraJs] = process.argv.slice(2);
// Git Bash 会把 /xxx 形参做 MSYS 路径转换，故统一规整为以 / 开头的站内路径
const pagePath = path.startsWith('/') ? path : `/${path}`;
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => existsSync(p));
const DEBUG_PORT = 9223;
const API = 7200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const APP_PORT = { customer: 7100, merchant: 7101, staff: 7102 };

let browser = null;
const profileDir = resolve(tmpdir(), `philia-b27-page-${process.pid}`);
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
  const user = seeds.users.find((u) => u.nickname === nickname);
  if (!user) throw new Error('seed user not found: ' + nickname);
  const appPort = APP_PORT[process.env.APP_NAME ?? 'customer'] ?? 7100;

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
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: mobile === '1' });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };

  await send('Page.navigate', { url: `http://localhost:${appPort}/dev-login` });
  await sleep(2500);
  const st = await evalJs(`fetch('http://localhost:${API}/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include' }).then((r) => r.status)`);
  console.log('login', nickname, 'HTTP', st, 'app', appPort);

  await send('Page.navigate', { url: `http://localhost:${appPort}${pagePath}` });
  let ok = false;
  for (let i = 0; i < 24; i++) {
    ok = await evalJs(waitExpr);
    if (ok) break;
    await sleep(500);
  }
  console.log('waitExpr', ok, waitExpr.slice(0, 80));
  if (extraJs) {
    const v = await evalJs(extraJs);
    console.log('extra:', JSON.stringify(v));
  }
  await sleep(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outfile);
  ws.close();
  cleanup();
  process.exit(0);
}
main().catch((e) => { console.error(e); cleanup(); process.exit(1); });
