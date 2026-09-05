/**
 * MePage e2e（CDP 直连，无 puppeteer 依赖）
 *
 * 前置：server dev 已监听 7200、customer dev 已监听 7100（脚本只做可达性检查，不自起服务）。
 * 流程：
 *   1. 起 Chrome headless（remote-debugging-port=9223，390x844 移动视口）；
 *   2. dev-login 种子客户 → 导航 /me；
 *   3. Runtime.evaluate 断言 DOM：
 *      - 用户卡渲染（昵称非空 + 加入天数文案）；
 *      - 5 个功能入口 Link href 逐一存在（对照 App.tsx 路由表）；
 *      - 宠物区渲染（有数据：含宠物名 + 「添加」按钮；或空态引导卡）；
 *   4. 静态断言 MePage.tsx 源码含宠物区空态分支（pets.length===0 → 引导卡 → /philia/pets），
 *      种子客户有宠物、真实空态无法在现场模拟，故以源码路径 + 运行时分支互证；
 *   5. 截图 shots/me-page.png（登录态）；
 *   6. 真实点击「退出登录」→ 确认弹窗 → 断言落在 /dev-login → 截图 shots/me-page-logout.png；
 *   7. 杀掉本脚本启动的 Chrome。
 *
 * 运行：node scripts/me-page-e2e.mjs（工作目录 apps/customer）
 */

import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
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
const SEED_USER_ID = '01M1RH3FFNEV4CZM3FJZ4JA7AY'; // 示例客户（与 DevLoginPage 硬编码一致）
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

  /* ---------- 起 Chrome headless ---------- */
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

  /* ---------- dev-login ---------- */
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/dev-login` });
  await sleep(2500);
  const loginStatus = await evalJs(`fetch('http://localhost:${API_PORT}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${SEED_USER_ID}' }), credentials: 'include'
  }).then(r => r.status)`);
  assert('dev-login 种子客户登录', loginStatus === 200, `HTTP ${loginStatus}`);

  /* ---------- 导航 /me ---------- */
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/me` });
  // 等用户卡渲染出来（auth.me raw 查询完成）
  let domReady = false;
  for (let i = 0; i < 20; i++) {
    domReady = await evalJs(`!!document.querySelector('[data-testid="me-user-card"]')`);
    if (domReady) break;
    await sleep(500);
  }
  assert('用户卡渲染（登录态守卫放行）', domReady);

  /* ---------- 断言 1：用户信息卡 ---------- */
  const nickname = await evalJs(`document.querySelector('[data-testid="me-nickname"]')?.textContent?.trim() ?? ''`);
  assert('昵称文本非空（空则兜底「铲屎官」）', nickname.length > 0, nickname);
  const joinText = await evalJs(`document.querySelector('[data-testid="me-user-card"]')?.textContent ?? ''`);
  assert('加入天数文案存在', /加入菲丽亚第 \d+ 天/.test(joinText), joinText.match(/加入菲丽亚第 \d+ 天/)?.[0] ?? '');

  /* ---------- 断言 2：五个功能入口 href（对照 App.tsx 路由表） ---------- */
  const entryHrefs = await evalJs(`Array.from(document.querySelectorAll('[data-testid="me-entries"] a')).map(a => a.getAttribute('href'))`);
  const expected = ['/appointments', '/mall/orders', '/philia/member', '/philia/pets', '/philia/moments'];
  assert('功能入口共 5 项', entryHrefs.length === 5, JSON.stringify(entryHrefs));
  for (const href of expected) {
    assert(`入口存在：${href}`, entryHrefs.includes(href));
  }

  /* ---------- 断言 3：宠物区（有数据 / 空态两分支之一必渲染） ---------- */
  const petsInfo = await evalJs(`(() => {
    const el = document.querySelector('[data-testid="me-pets"]');
    if (!el) return null;
    const empty = el.getAttribute('data-empty') === 'true';
    const names = Array.from(el.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
    const addBtn = !!el.querySelector('a[aria-label="添加宠物"]');
    const emptyGuide = !!Array.from(el.querySelectorAll('a')).find(a => a.textContent.includes('建立宠物档案'));
    return { empty, names, addBtn, emptyGuide };
  })()`);
  assert('宠物区已渲染', petsInfo !== null);
  if (petsInfo) {
    if (petsInfo.empty) {
      assert('空态引导卡含「建立宠物档案」→ /philia/pets', petsInfo.emptyGuide);
    } else {
      assert('宠物区渲染真实宠物（pet.list 有数据）', petsInfo.names.length > 0, petsInfo.names.join(' / '));
      assert('末尾「添加」虚线圆按钮 → /philia/pets', petsInfo.addBtn);
    }
  }

  /* ---------- 断言 4：空态分支源码静态佐证（种子客户有宠物，真实空态现场不可达） ---------- */
  const src = readFileSync(resolve(__dirname, '..', 'src', 'pages', 'MePage.tsx'), 'utf8');
  assert('源码含空态分支 pets.length === 0', /pets\.length === 0/.test(src));
  assert('空态分支渲染「建立宠物档案」Link → /philia/pets',
    /data-empty="true"[\s\S]*?建立宠物档案/.test(src) && /to="\/philia\/pets"[\s\S]*?建立宠物档案|建立宠物档案[\s\S]*?\/philia\/pets/.test(src));

  /* ---------- 截图 1：登录态 /me ---------- */
  await sleep(1200); // 图片等收尾渲染
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(SHOTS_DIR, 'me-page.png'), Buffer.from(shot1.data, 'base64'));
  console.log('saved shots/me-page.png');

  /* ---------- 断言 5：退出登录真实流程 ---------- */
  await evalJs(`document.querySelector('[data-testid="me-logout-btn"]').click()`);
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
