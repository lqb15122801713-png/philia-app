/**
 * U1-A 证据采集：全局 dock 统一验收（CDP 直连，无 puppeteer）
 *
 * 前置：server 7200 + customer preview/dev 7100 已监听（脚本只做可达性检查）。
 * 流程：起 Edge headless（390×844 移动视口）→ dev-seed-users 取种子客户 → dev-login
 *   → 逐路由导航断言：
 *     - 主级页（/home /mall /me /philia）：[data-testid="app-dock"] 存在且五槽位顺序
 *       首页/预约/philia/商城/我的；中央钮 60px 柠檬黄 paw；
 *     - 详情级页：app-dock 不存在 + 返回条圆钮（aria-label^="返回"）存在；
 *   → 每页截图 shots/NN-name.png；
 *   → /home 长按中央钮（pointerdown 700ms）弹快捷弹层，截图；
 *   → 输出 PASS/FAIL 汇总，退出码 0=全绿。
 * 运行：node dock-e2e.mjs（任意工作目录）
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, 'shots');
const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const APPT_ID = process.env.SMOKE_APPT_ID ?? '01M256D240E19GWNG2QMFV3Q8V';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
const profileDir = resolve(tmpdir(), `philia-u1a-e2e-${process.pid}`);
function cleanup() {
  if (browser?.pid) { spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); browser = null; }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

/** 路由清单：main=dock 在；detail=无 dock + 返回圆钮 */
const ROUTES = [
  { name: '01-home', path: '/home', kind: 'main', dockKey: 'home' },
  { name: '02-philia', path: '/philia', kind: 'main', dockKey: 'philia' },
  { name: '03-mall', path: '/mall', kind: 'main', dockKey: 'mall' },
  { name: '04-me', path: '/me', kind: 'main', dockKey: 'me' },
  { name: '05-booking-grooming', path: '/booking/grooming', kind: 'detail' },
  { name: '06-booking-boarding', path: '/booking/boarding', kind: 'detail' },
  { name: '07-appointments', path: '/appointments', kind: 'detail' },
  { name: '08-appointment-detail', path: `/appointments/${APPT_ID}`, kind: 'detail' },
  { name: '09-appointment-live', path: `/appointments/${APPT_ID}/live`, kind: 'detail' },
  { name: '10-mall-orders', path: '/mall/orders', kind: 'detail' },
  { name: '11-mall-cart', path: '/mall/cart', kind: 'detail' },
  { name: '12-philia-pets', path: '/philia/pets', kind: 'detail' },
  { name: '13-philia-member', path: '/philia/member', kind: 'detail' },
  { name: '14-philia-moments', path: '/philia/moments', kind: 'detail' },
  { name: '15-booking-success', path: `/booking/success?aid=${APPT_ID}`, kind: 'detail-noback' }, // 流程终点页：无返回条属设计（主行动=查看我的预约）
  { name: '16-product-detail', path: 'PRODUCT_URL', kind: 'detail' }, // 运行时替换
  { name: '17-wizard-regression', path: '/booking/grooming/wizard', kind: 'detail' },
];

async function main() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome');
  if (!(await waitHttp(`${API}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  if (!(await waitHttp(`${APP}/`, 4))) throw new Error('customer 7100 不可达');
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
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`页面脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  };

  /* dev-login */
  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  const loginStatus = await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`);
  assert('dev-login 种子客户', loginStatus === 200, `HTTP ${loginStatus}`);

  /* 取一个真实商品 id（PDP 截图用） */
  const productId = await evalJs(`fetch('${API}/trpc/mall.listProducts?batch=1&input=' + encodeURIComponent(JSON.stringify({"0":{"json":{"page":1,"pageSize":1}}})), { credentials: 'include' })
    .then(r => r.json()).then(d => d?.[0]?.result?.data?.json?.items?.[0]?.id ?? null)`);
  assert('取真实商品 id（PDP 路由）', !!productId, `id=${productId}`);
  const productRoute = ROUTES.find((r) => r.path === 'PRODUCT_URL');
  productRoute.path = productId ? `/mall/product/${productId}` : '/mall';
  if (!productId) productRoute.kind = 'main-skip'; // 无商品时退化为商城页重复截，不判 dock

  /* 逐路由验收 */
  for (const route of ROUTES) {
    await send('Page.navigate', { url: `${APP}${route.path}` });
    await sleep(3200);
    const state = await evalJs(`(() => {
      const dock = document.querySelector('[data-testid="app-dock"]');
      const tabs = [...document.querySelectorAll('[data-testid^="app-dock-"]')].map(e => e.getAttribute('data-testid'));
      const back = document.querySelector('button[aria-label^="返回"]');
      const philiaBtn = document.querySelector('[data-testid="app-dock-philia"]');
      const rect = philiaBtn ? (() => { const r = philiaBtn.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() : null;
      const bg = philiaBtn ? getComputedStyle(philiaBtn).backgroundColor : null;
      const rootText = (document.getElementById('root')?.innerText ?? '').trim().length;
      const activeTab = [...document.querySelectorAll('[data-testid^="app-dock-"][aria-current="page"]')].map(e => e.getAttribute('data-testid'));
      // dock 视觉可见性：中央钮中心点 elementFromPoint 须命中 dock 内部（防 fixed 浮层压盖）
      const visible = philiaBtn ? (() => { const r = philiaBtn.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return !!el?.closest('[data-testid="app-dock"]'); })() : false;
      return { dock: !!dock, tabs, back: !!back, rect, bg, rootText, activeTab, visible, url: location.pathname };
    })()`);
    const crashed = state.rootText === 0;
    if (route.kind === 'main') {
      const orderOk = JSON.stringify(state.tabs) === JSON.stringify(['app-dock-home','app-dock-booking','app-dock-philia','app-dock-mall','app-dock-me']);
      assert(`${route.name} 主级页 dock 存在且可见`, state.dock && state.visible && !crashed);
      assert(`${route.name} 五槽位顺序 首页/预约/philia/商城/我的`, orderOk, state.tabs.join(','));
      assert(`${route.name} 中央钮 60px 柠檬黄`, state.rect?.w === 60 && state.rect?.h === 60 && state.bg === 'rgb(253, 200, 48)', `${JSON.stringify(state.rect)} ${state.bg}`);
      assert(`${route.name} 路由感知 active=${route.dockKey}`, state.activeTab.includes(`app-dock-${route.dockKey}`), state.activeTab.join(','));
    } else if (route.kind === 'detail') {
      assert(`${route.name} 详情级无 dock`, !state.dock && !crashed);
      assert(`${route.name} 返回圆钮存在`, state.back);
    } else if (route.kind === 'detail-noback') {
      assert(`${route.name} 详情级无 dock（流程终点免返回条）`, !state.dock && !crashed);
    } else {
      assert(`${route.name} 页面渲染`, !crashed);
    }
    await shot(route.name);
  }

  /* 长按中央钮 → 快捷弹层 */
  await send('Page.navigate', { url: `${APP}/home` });
  await sleep(3200);
  await evalJs(`(() => {
    const btn = document.querySelector('[data-testid="app-dock-philia"]');
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.x + r.width/2, clientY: r.y + r.height/2, bubbles: true, pointerId: 1 }));
    return true;
  })()`);
  await sleep(800);
  const sheet = await evalJs(`(() => {
    const dlg = document.querySelector('[role="dialog"][aria-label="快捷操作"]');
    const items = [...document.querySelectorAll('[data-testid^="app-dock-sheet-"]')].map(e => e.getAttribute('data-testid'));
    return { open: !!dlg, items };
  })()`);
  assert('长按 500ms 弹快捷弹层', sheet.open, sheet.items.join(','));
  assert('弹层含会员码/一键预约', sheet.items.includes('app-dock-sheet-member') && sheet.items.includes('app-dock-sheet-rebook'), sheet.items.join(','));
  await shot('18-longpress-sheet');
  await evalJs(`(() => {
    const btn = document.querySelector('[data-testid="app-dock-philia"]');
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    document.querySelector('[role="dialog"][aria-label="快捷操作"]')?.click();
    return true;
  })()`);

  ws.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  writeFileSync(resolve(__dirname, 'dock-e2e-results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
