// CDP 驱动：登录 → 导航 → 可选页面内脚本 → 截图
// 用法: node shot.mjs <role:customer|merchant_owner|staff> <url> <outfile> [evalJsFile] [settleMs]
// evalJsFile: 页面加载后执行（await 可用，返回最后表达式）；执行完再等待 settleMs 后截图
import { readFileSync, writeFileSync } from 'node:fs';

const DEBUG_PORT = 9223;
const [role, url, outfile, evalJsFile, settleMsArg] = process.argv.slice(2);
const settleMs = settleMsArg ? +settleMsArg : 1200;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 800));
    return r.result?.value;
  };

  // 1) 打开站点根，页面内登录（dev-seed-users 按 role 动态取 id，禁止硬编码 ULID）
  await send('Page.navigate', { url: url.split('/').slice(0, 3).join('/') + '/' });
  await sleep(2000);
  const login = await evaluate(`(async () => {
    const res = await fetch('http://localhost:7200/api/auth/dev-seed-users');
    const { users } = await res.json();
    const u = users.find(x => x.roles.includes(${JSON.stringify(role)}));
    if (!u) return 'no-user';
    const r2 = await fetch('http://localhost:7200/api/auth/dev-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ userId: u.id }),
    });
    const j = await r2.json();
    return j.ok ? u.id + ':' + u.nickname : 'login-fail';
  })()`);
  console.log('login:', login);

  // 2) 导航目标页
  await send('Page.navigate', { url });
  await sleep(3000);

  // 3) 可选页面内脚本（点击/滚动等）
  if (evalJsFile) {
    const js = readFileSync(evalJsFile, 'utf8');
    const out = await evaluate(`(async () => { ${js} })()`);
    console.log('eval:', JSON.stringify(out));
    await sleep(settleMs);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outfile);
  ws.close();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
