// CDP 驱动：以指定种子用户登录客户端，走完洗护预约向导到确认屏并截图
// 用法：node drive-booking.mjs <昵称> <截图输出路径> [确认屏评估表达式]
// 前置：server:7200 与 customer:7100 已在运行（脚本只做可达性检查，不自起服务）
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const [nickname, outfile, expectExpr] = process.argv.slice(2);
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p));
const DEBUG_PORT = 9223;
const API = 7200;
const APP = 7100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let browser = null;
const profileDir = resolve(tmpdir(), `philia-b27-cdp-${process.pid}`);
function cleanup() {
  if (browser?.pid) {
    spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    browser = null;
  }
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

async function main() {
  if (!EDGE) throw new Error('未找到 Edge 可执行文件');
  const seedRes = await fetch(`http://localhost:${API}/api/auth/dev-seed-users`);
  const seeds = await seedRes.json();
  const user = seeds.users.find((u) => u.nickname === nickname);
  if (!user) throw new Error('seed user not found: ' + nickname);
  console.log(`login as ${nickname} (${user.id})`);

  browser = spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
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
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails)
      throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };

  // 登录（同域 fetch + credentials:include）
  await send('Page.navigate', { url: `http://localhost:${APP}/dev-login` });
  await sleep(2500);
  const st = await evalJs(`fetch('http://localhost:${API}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${user.id}' }), credentials: 'include'
  }).then((r) => r.status)`);
  console.log('dev-login HTTP', st);

  // 洗护预约向导
  await send('Page.navigate', { url: `http://localhost:${APP}/booking/grooming` });
  await sleep(3000);
  const waitFor = async (expr, tries = 24) => {
    for (let i = 0; i < tries; i++) {
      if (await evalJs(expr)) return true;
      await sleep(500);
    }
    return false;
  };
  const clickBtn = async (pred, label) => {
    const ok = await evalJs(
      `(() => { const b = Array.from(document.querySelectorAll('button')).find(${pred}); if (b && !b.disabled) { b.click(); return true; } return false; })()`,
    );
    console.log('click', label, ok);
    return ok;
  };

  // 屏1：选第一个服务（卡片含「分钟」）
  await waitFor(`Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('分钟'))`);
  await clickBtn(`(b) => b.textContent.includes('分钟')`, 'service');
  await sleep(400);
  await clickBtn(`(b) => b.textContent.trim() === '下一步'`, 'next1');
  await sleep(1000);
  // 屏2：默认已选中第一家门店，直接下一步
  await clickBtn(`(b) => b.textContent.trim() === '下一步'`, 'next2');
  await sleep(1800);
  // 屏3：选第一个可约槽位（HH:MM 且未禁用）
  await waitFor(`Array.from(document.querySelectorAll('button')).some((b) => /^\\d{2}:\\d{2}$/.test(b.textContent.trim()) && !b.disabled)`);
  await clickBtn(`(b) => /^\\d{2}:\\d{2}$/.test(b.textContent.trim()) && !b.disabled`, 'slot');
  await sleep(400);
  await clickBtn(`(b) => b.textContent.trim() === '下一步'`, 'next3');
  await sleep(1800);
  // 屏4：确认屏
  const ok = await waitFor(`document.body.textContent.includes('收款方式')`);
  console.log('confirm screen reached:', ok);
  if (expectExpr) {
    const v = await evalJs(expectExpr);
    console.log('expect:', JSON.stringify(v));
  }
  await sleep(800);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(dirname(outfile), { recursive: true });
  writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
  console.log('saved', outfile);
  ws.close();
  cleanup();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  cleanup();
  process.exit(1);
});
