/**
 * U1-J 证据采集①：跨屏一致性矩阵客观指标（CDP 直连）
 *
 * 逐屏采集：dock 有无 / 返回圆钮 / 柠檬黄 accent 元素数（含/不含 dock 中央钮）/
 * 渐变类与 computed linear-gradient 扫描 / 彩色 emoji 扫描 / 破版检测 / console 异常。
 * 截图：主屏 8 张（矩阵文本全量 18 屏）。
 * 模式：默认 localhost 生产构建 preview；NONSECURE=1 时 BASE 用 LAN IP（SERVE_STATIC 同源），
 * 额外断言 isSecureContext===false（safeUuid 教训：HTTP 纯 IP 访问不崩）。
 * 运行：node matrix-e2e.mjs            （localhost preview 7100）
 *       NONSECURE=1 BASE=http://192.168.x.x:7200 node matrix-e2e.mjs
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NONSECURE = process.env.NONSECURE === '1';
const BASE = (process.env.BASE ?? 'http://localhost:7100').replace(/\/$/, '');
const API = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const SHOTS_DIR = resolve(__dirname, NONSECURE ? 'shots-nonsecure' : 'shots');
const DEBUG_PORT = 9223;
const APPT_ID = process.env.SMOKE_APPT_ID ?? '01M256D240E19GWNG2QMFV3Q8V';
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
async function waitHttp(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url); if (res.status > 0) return true; } catch {}
    await sleep(500);
  }
  return false;
}
let browser = null;
const profileDir = resolve(tmpdir(), `philia-u1j-e2e-${process.pid}`);
function cleanup() {
  if (browser?.pid) { spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); browser = null; }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

/** 屏清单：path / 期望 dock / 截图标记（shot: true 拍主屏） */
const SCREENS = [
  { path: '/home', dock: true, shot: true },
  { path: '/mall', dock: true, shot: true },
  { path: '/philia', dock: true, shot: true },
  { path: '/me', dock: true, shot: true },
  { path: '/booking/grooming', dock: false, shot: true },
  { path: '/booking/boarding', dock: false },
  { path: '/mall/product/PRODUCT', dock: false, shot: true, dynamic: 'product' },
  { path: '/mall/cart', dock: false },
  { path: '/mall/checkout', dock: false },
  { path: '/mall/orders', dock: false, shot: true },
  { path: '/appointments', dock: false },
  { path: `/appointments/${APPT_ID}`, dock: false },
  { path: `/appointments/${APPT_ID}/live`, dock: false, shot: true },
  { path: '/philia/pets', dock: false },
  { path: '/philia/member', dock: false },
  { path: '/philia/moments', dock: false },
  { path: '/me/card', dock: false, shot: true },
  { path: '/booking/success', dock: false },
  { path: '/dev-login', dock: false, public: true },
];

async function main() {
  if (!BROWSER) throw new Error('未找到 Edge');
  if (!(await waitHttp(`${API}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  if (!(await waitHttp(`${BASE}/`, 4))) throw new Error(`app ${BASE} 不可达`);
  mkdirSync(SHOTS_DIR, { recursive: true });
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(String(msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text ?? '').split('\n')[0]);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  };

  /* 登录 */
  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${BASE}/dev-login` });
  await sleep(2500);
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  /* 商品 id（PDP 屏） */
  const productId = await evalJs(`fetch('${API}/trpc/mall.listProducts?batch=1&input=' + encodeURIComponent(JSON.stringify({"0":{"json":{"page":1,"pageSize":1}}})), { credentials: 'include' })
    .then(r => r.json()).then(d => d?.[0]?.result?.data?.json?.items?.[0]?.id ?? null)`);

  if (NONSECURE) {
    const sec = await evalJs(`({ secure: window.isSecureContext, hasUuid: typeof crypto?.randomUUID === 'function' })`);
    assert('非安全上下文：isSecureContext=false（纯 IP HTTP）', sec.secure === false, `isSecureContext=${sec.secure} randomUUID=${sec.hasUuid}`);
  }

  const matrix = [];
  for (const scr of SCREENS) {
    const path = scr.dynamic === 'product' ? `/mall/product/${productId}` : scr.path;
    await send('Page.navigate', { url: `${BASE}${path}` });
    await sleep(3800);
    const m = await evalJs(`(() => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const text = document.getElementById('root')?.innerText ?? '';
      // 柠檬黄 accent：computed bg=rgb(253,200,48) 的元素（区分 dock 中央钮）
      const lemon = qa('*').filter((el) => {
        const cs = getComputedStyle(el);
        return cs.backgroundColor === 'rgb(253, 200, 48)' && el.children.length === 0 || (cs.backgroundColor === 'rgb(253, 200, 48)' && el.closest('[data-testid="app-dock"]') === null && ['BUTTON','A','SPAN','P','DIV'].includes(el.tagName));
      });
      const lemonOutsideDock = qa('body *').filter((el) => getComputedStyle(el).backgroundColor === 'rgb(253, 200, 48)' && !el.closest('[data-testid="app-dock"]'));
      const gradientEls = qa('body *').filter((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        return bg && bg.includes('linear-gradient');
      });
      const emojiRe = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u;
      const emoji = emojiRe.test(text);
      return {
        dock: !!q('[data-testid="app-dock"]'),
        backBtn: !!q('button[aria-label^="返回"]'),
        lemonCount: lemonOutsideDock.length,
        lemonLabels: lemonOutsideDock.slice(0, 4).map((el) => (el.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 18)),
        gradients: gradientEls.length,
        gradientSample: gradientEls.slice(0, 2).map((el) => el.className.toString().slice(0, 60)),
        emoji,
        rootText: text.trim().length,
        secure: window.isSecureContext,
      };
    })()`);
    matrix.push({ path, expectDock: scr.dock, ...m });
    const dockOk = m.dock === scr.dock;
    const backOk = scr.dock || m.backBtn || scr.public || path === '/booking/success'; // 成功页流程终点免返回条
    assert(`${path}：dock=${scr.dock ? '有' : '无'} / 破版=否 / 渐变=0 / 彩色emoji=0`,
      dockOk && m.rootText > 0 && m.gradients === 0 && !m.emoji,
      `dock=${m.dock} lemon=${m.lemonCount} grad=${m.gradients} emoji=${m.emoji}${m.gradients ? ' ' + m.gradientSample.join('|') : ''}`);
    if (!scr.dock) assert(`${path}：详情级返回条统一`, backOk, `backBtn=${m.backBtn}`);
    if (NONSECURE) assert(`${path}：非安全上下文渲染不崩`, m.secure === false && m.rootText > 0);
    if (scr.shot) await shot(path.replace(/\//g, '_').replace(/^_/, '') || 'root');
  }

  /* 柠檬黄 accent 汇总（每屏一处主行动 + dock 中央钮纪律；>0 即合规，>3 记观察） */
  const over = matrix.filter((m) => m.lemonCount > 3);
  assert('accent 纪律：无屏柠檬黄元素超 3 处（主行动+状态位观察阈）', over.length === 0,
    over.map((o) => `${o.path}:${o.lemonCount}(${o.lemonLabels.join('/')})`).join(' ') || '全屏 ≤3');
  /* console 异常（运行期） */
  const realErrors = consoleErrors.filter((e) => e && !/favicon|404/.test(e));
  assert('console 运行期零异常', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  writeFileSync(resolve(__dirname, NONSECURE ? 'matrix-nonsecure.json' : 'matrix.json'),
    JSON.stringify({ results, matrix, consoleErrors }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
