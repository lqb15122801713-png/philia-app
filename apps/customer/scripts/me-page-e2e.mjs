/**
 * MePage e2e（CDP 直连，无 puppeteer 依赖）
 *
 * 前置：server dev 已监听 7200、customer dev 已监听 7100（脚本只做可达性检查，不自起服务）。
 * 流程（补缺大批片 2 对齐版——换皮批片 2 新皮现码真值，属修复非删改）：
 *   1. 起 Chrome headless（remote-debugging-port=9223，390x844 移动视口）；
 *   2. GET /api/auth/dev-seed-users 动态取种子客户（禁止硬编码 ULID）→ dev-login → 导航 /me；
 *   3. Runtime.evaluate 断言 DOM：
 *      - 身份大卡 me-hero 渲染（登录态守卫放行）+ 回馈金格 me-rebate-cell；
 *      - 功能网格 me-grid8 链接入口（/philia/pets、/member/rebate、/booking/boarding）
 *        + 置灰槽位 testid（slot-gallery/coupons/address/concierge）+ me-qrrow；
 *      - 订单五格 me-orderrow（4 条 /appointments 链接 + slot-refund 槽位）；
 *      - 设置入口 me-settings 为 /me/settings 链接（R20 入口=出口）；
 *   4. 静态断言 MePage.tsx 源码含 me-grid8 网格与 /me/settings 导航（互证）；
 *   5. 截图 shots/me-page.png（登录态）；
 *   6. 退出流新路径：me-settings → /me/settings → settings-logout → 确认弹层
 *      （me-logout-confirm）→ /dev-login + auth.me 401 → 截图 shots/me-page-logout.png；
 *   7. 杀掉本脚本启动的 Chrome。
 *
 * 运行：node scripts/me-page-e2e.mjs（工作目录 apps/customer）
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHILIA_ROOT = resolve(__dirname, '..', '..', '..');
const SHOTS_DIR = resolve(PHILIA_ROOT, 'shots');
const APP_PORT = 7100;
const API_PORT = 7200;
const DEBUG_PORT = 9223;
// 浏览器自动探测：优先 Chrome，缺失时回退 Edge（同为 Chromium，CDP 行为一致）
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const CHROME = BROWSER_CANDIDATES.find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * v1.1-b2 B2-0：种子客户 userId 不再硬编码（reseed 后 ULID 全变）。
 * 一律先调 GET /api/auth/dev-seed-users 动态取角色含 customer 的种子用户。
 */
async function fetchSeedCustomerId() {
  const res = await fetch(`http://localhost:${API_PORT}/api/auth/dev-seed-users`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const users = data?.users ?? [];
  const customer = users.find((u) => (u.roles ?? []).includes('customer')) ?? users[0];
  return customer?.id ?? null;
}
const results = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function waitHttp(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

let chrome = null;
const profileDir = resolve(tmpdir(), `philia-me-e2e-chrome-${process.pid}`);

function cleanup() {
  if (chrome && chrome.pid) {
    // Windows：taskkill 树杀，确保不留子进程
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    chrome = null;
  }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

async function main() {
  /* ---------- 前置：服务可达 ---------- */
  if (!(await waitHttp(`http://localhost:${API_PORT}/api/auth/dev-login`, 4))) {
    throw new Error('server 7200 不可达，请先 cd server && npm run dev');
  }
  if (!(await waitHttp(`http://localhost:${APP_PORT}/`, 4))) {
    throw new Error('customer 7100 不可达，请先 cd apps/customer && npm run dev -- --port 7100');
  }
  mkdirSync(SHOTS_DIR, { recursive: true });

  /* ---------- 起浏览器 headless（Chrome，缺失时 Edge） ---------- */
  if (!CHROME) throw new Error('未找到 Chrome/Edge 可执行文件，无法跑 CDP e2e');
  console.log(`browser: ${CHROME}`);
  chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  if (!targets?.length) throw new Error('Chrome CDP 未就绪');
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
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`页面内脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
    return r.result.value;
  };

  /* ---------- dev-login（先动态取种子客户，再登录） ---------- */
  const seedUserId = await fetchSeedCustomerId();
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/dev-login` });
  await sleep(2500);
  const loginStatus = seedUserId
    ? await evalJs(`fetch('http://localhost:${API_PORT}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${seedUserId}' }), credentials: 'include'
  }).then(r => r.status)`)
    : 0;
  assert('dev-seed-users 动态取数 + dev-login 种子客户登录', seedUserId !== null && loginStatus === 200, `userId=${seedUserId ?? '（未取到）'} HTTP ${loginStatus}`);

  /* ---------- 导航 /me ---------- */
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/me` });
  // 等身份大卡渲染出来（auth.me raw 查询完成）
  let domReady = false;
  for (let i = 0; i < 20; i++) {
    domReady = await evalJs(`!!document.querySelector('[data-testid="me-hero"]')`);
    if (domReady) break;
    await sleep(500);
  }
  assert('身份大卡渲染（登录态守卫放行）', domReady);

  /* ---------- 断言 1：身份大卡（新皮 mehero：昵称区文本非空 + 回馈金格真值） ---------- */
  const heroText = await evalJs(`document.querySelector('[data-testid="me-hero"]')?.textContent?.trim() ?? ''`);
  assert('身份大卡文本非空（昵称兜底「铲屎官」）', heroText.length > 0, heroText.slice(0, 24));
  const rebateCell = await evalJs(`!!document.querySelector('[data-testid="me-rebate-cell"]')`);
  assert('回馈金格渲染（membership.my 真值落地件）', rebateCell);
  const qrrowHref = await evalJs(`document.querySelector('[data-testid="me-qrrow"]')?.getAttribute('href') ?? ''`);
  assert('会员码 qrrow 入口在案（/me/card 或 /member/open）', qrrowHref === '/me/card' || qrrowHref === '/member/open', qrrowHref);

  /* ---------- 断言 2：功能网格 me-grid8 + 订单五格 me-orderrow（对照 App.tsx 路由表） ---------- */
  const gridHrefs = await evalJs(`Array.from(document.querySelectorAll('[data-testid="me-grid8"] a')).map(a => a.getAttribute('href'))`);
  const expectedGrid = ['/philia/pets', '/member/rebate', '/booking/boarding'];
  for (const href of expectedGrid) {
    assert(`网格入口存在：${href}`, gridHrefs.includes(href));
  }
  const slotIds = await evalJs(`['slot-gallery','slot-coupons','slot-address','slot-concierge'].filter(id => !!document.querySelector('[data-testid="'+id+'"]'))`);
  assert('置灰槽位 4 件在案（PD-15 V1.1 三规）', slotIds.length === 4, slotIds.join(','));
  const settingsHref = await evalJs(`document.querySelector('[data-testid="me-settings"]')?.getAttribute('href') ?? ''`);
  assert('设置入口=/me/settings 链接（补缺批片 2：R20 入口=出口）', settingsHref === '/me/settings', settingsHref);
  const orderHrefs = await evalJs(`Array.from(document.querySelectorAll('[data-testid="me-orderrow"] a')).map(a => a.getAttribute('href'))`);
  assert('订单五格 4 链接均指 /appointments', orderHrefs.length === 4 && orderHrefs.every(h => (h ?? '').startsWith('/appointments')), JSON.stringify(orderHrefs));
  const slotRefund = await evalJs(`!!document.querySelector('[data-testid="slot-refund"]')`);
  assert('退款售后=置灰槽位（PD-15 V1.1 槽位 10）', slotRefund);

  /* ---------- 断言 3：宠物档案入口（grid8 首格，含宠物名/去建档副签） ---------- */
  const petCell = await evalJs(`(() => {
    const el = document.querySelector('[data-testid="me-grid8"] a[href="/philia/pets"]');
    return el ? el.textContent.trim() : null;
  })()`);
  assert('宠物档案入口渲染（含「宠物档案」签）', petCell !== null && petCell.includes('宠物档案'), petCell ?? '');

  /* ---------- 断言 4：空态分支源码静态佐证（网格结构 + 设置导航互证） ---------- */
  const src = readFileSync(resolve(__dirname, '..', 'src', 'pages', 'MePage.tsx'), 'utf8');
  assert('源码含功能网格 me-grid8', /data-testid="me-grid8"/.test(src));
  assert('源码含设置入口导航 /me/settings', /data-testid="me-settings"[\s\S]{0,200}?\/me\/settings|\/me\/settings[\s\S]{0,200}?data-testid="me-settings"/.test(src));

  /* ---------- 截图 1：登录态 /me ---------- */
  await sleep(1200); // 图片等收尾渲染
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(SHOTS_DIR, 'me-page.png'), Buffer.from(shot1.data, 'base64'));
  console.log('saved shots/me-page.png');

  /* ---------- 断言 5：退出登录真实流程（补缺批片 2 新路径：设置页内退出） ---------- */
  await evalJs(`document.querySelector('[data-testid="me-settings"]').click()`);
  let onSettings = '';
  for (let i = 0; i < 12; i++) {
    onSettings = await evalJs('location.pathname');
    if (onSettings === '/me/settings') break;
    await sleep(500);
  }
  assert('me-settings 导航落在 /me/settings', onSettings === '/me/settings', onSettings);
  let logoutBtn = false;
  for (let i = 0; i < 12; i++) {
    logoutBtn = await evalJs(`!!document.querySelector('[data-testid="settings-logout"]')`);
    if (logoutBtn) break;
    await sleep(500);
  }
  assert('设置页渲染退出登录钮', logoutBtn);
  await evalJs(`document.querySelector('[data-testid="settings-logout"]').click()`);
  await sleep(600);
  const dialogShown = await evalJs(`!!document.querySelector('[data-testid="me-logout-confirm"]')`);
  assert('点击「退出登录」弹出确认弹窗', dialogShown);
  await evalJs(`document.querySelector('[data-testid="me-logout-confirm"]').click()`);
  let landed = '';
  for (let i = 0; i < 16; i++) {
    landed = await evalJs('location.pathname');
    if (landed === '/dev-login') break;
    await sleep(500);
  }
  assert('退出后回到 /dev-login', landed === '/dev-login', landed);
  const guardBlocks = await evalJs(`(async () => {
    const r = await fetch('http://localhost:${API_PORT}/trpc/auth.me?batch=1&input=' + encodeURIComponent('{"0":{"json":null}}'), { credentials: 'include' });
    return r.status;
  })()`);
  assert('退出后 auth.me 不再放行（401）', guardBlocks === 401, `HTTP ${guardBlocks}`);

  /* ---------- 截图 2：登出态 /dev-login ---------- */
  await sleep(800);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(SHOTS_DIR, 'me-page-logout.png'), Buffer.from(shot2.data, 'base64'));
  console.log('saved shots/me-page-logout.png');

  ws.close();
  cleanup();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== e2e 汇总：${results.length - failed.length}/${results.length} 通过 =====`);
  if (failed.length) {
    console.error('失败项：' + failed.map((f) => f.name).join('；'));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  cleanup();
  process.exit(1);
});
