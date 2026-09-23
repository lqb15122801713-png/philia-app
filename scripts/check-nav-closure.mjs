#!/usr/bin/env node
/**
 * 导航闭环体检（批次 W1 · 常备验收工具）：node scripts/check-nav-closure.mjs
 *
 * 来源：任务书 W1 §二冻结规则（每页①底栏常显 或 ②返回键+明确主出口；交易成功页双出口）
 *      + §五巡检地图（51 路由；后续批次申报补入，现 66 路由）+ §六 Harness 规格（四要素检测/死胡同判定）。
 *
 * 检测要素（页内真实渲染断言）：
 *   - back   返回键（页首左上 aria-label 含「返回」的可点区）
 *   - dock   底部工具栏（客户端 app-dock / 员工端 staff-dock / 商家端 merchant-rail 常驻导航）
 *   - home   首页链接（指向 /home 或底栏首页槽位）
 *   - exit   出口按钮/链接（返回|回首页|任务台|查看我的预约|查看订单|去逛逛|查看全程 类动作）
 * 判定（§六）：四者全无=死胡同（阻断，exit 1）；仅有链接形出口=弱（整改项，不阻断）；
 *   门禁/登录页豁免；新增路由须在 PR 中申报并补入本表。
 *
 * 环境假设（P3 跨环境条款）：
 *   - Node ≥22（全局 WebSocket 稳定）；Node 20/21 须加 flag 运行：
 *       node --experimental-websocket scripts/check-nav-closure.mjs
 *   - 浏览器自动探测：CHROME_PATH 显式指定优先，其次 Windows Edge/Chrome 候选，
 *     再 Linux 候选（/usr/bin/google-chrome、chromium、chromium-browser、microsoft-edge）；
 *   - 口令假设：dev-seed-users / dev-login 不带 code——被检服务须未设 BETA_GATE_CODE
 *     （无门态；设门环境请先以无门实例跑本表）。
 *   - 构建口径（Y1 裁定）：三端构建只许根目录 `npm run build`（一条命令三端全量）。
 *
 * 环境变量：CUSTOMER_URL / MERCHANT_URL / STAFF_URL（默认 vite preview 7100/7101/7102）、
 *   API_BASE（默认 http://localhost:7200）、CDP_PORT（默认 9224，避免与 smoke-routes 撞车）、
 *   NAV_JSON（设置时把 66 行结果写 JSON 到该路径）。
 * 退出码：0=无死胡同；1=存在死胡同；2=环境不可用。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const APP_URLS = {
  customer: (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, ''),
  merchant: (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, ''),
  staff: (process.env.STAFF_URL ?? 'http://localhost:7102').replace(/\/$/, ''),
};
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9224);
const NAV_JSON = process.env.NAV_JSON ?? null;
const APPT_ID = process.env.NAV_APPT_ID ?? '01M2SW1M3YQ9AT8SH6T05Z69M3';
const STAY_ID = process.env.NAV_STAY_ID ?? '01000000000000000000000000';
const PRODUCT_ID = process.env.NAV_PRODUCT_ID ?? '01M2S57Y960FYBQ4H8SQGP2396';
const INVALID_ID = '01000000000000000000000000'; // 无效 id 异常态断言（W1 补改：子页错误态须出口）
const TIMEOUT = 9000;

const BROWSER = [
  process.env.CHROME_PATH, // 跨环境显式指定（P3）
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean).find((p) => existsSync(p));

/** 66 路由体检表（任务书 W1 §五巡检地图 51 路由 + 后续批次申报补入；expect: tab=主tab页 / sub=子页 / success=交易成功页 / gate=门禁豁免） */
const ROUTES = [
  /* 客户端 27 */
  { app: 'customer', path: '/home', expect: 'tab' },
  { app: 'customer', path: '/mall', expect: 'tab' },
  { app: 'customer', path: '/me', expect: 'tab' },
  { app: 'customer', path: '/philia', expect: 'tab' },
  { app: 'customer', path: '/booking', expect: 'sub' },
  { app: 'customer', path: '/booking/grooming', expect: 'sub' },
  { app: 'customer', path: '/booking/grooming/wizard', expect: 'sub' },
  { app: 'customer', path: '/booking/boarding', expect: 'sub' },
  { app: 'customer', path: '/booking/boarding/wizard', expect: 'sub' },
  { app: 'customer', path: `/booking/success?aid=${APPT_ID}`, expect: 'success' },
  { app: 'customer', path: '/appointments', expect: 'sub' },
  { app: 'customer', path: `/appointments/${APPT_ID}`, expect: 'sub' },
  { app: 'customer', path: `/appointments/${INVALID_ID}`, expect: 'sub', note: '无效 id 异常态须出口（W1 补改）' },
  { app: 'customer', path: `/appointments/${APPT_ID}/live`, expect: 'sub' },
  { app: 'customer', path: '/mall/orders', expect: 'sub' },
  { app: 'customer', path: '/mall/cart', expect: 'sub' },
  { app: 'customer', path: '/mall/checkout', expect: 'sub' },
  { app: 'customer', path: `/mall/product/${PRODUCT_ID}`, expect: 'sub', note: '商品 id 缺失时守卫口径' },
  { app: 'customer', path: `/mall/product/${INVALID_ID}`, expect: 'sub', note: '无效 id 异常态须出口（W1 补改）' },
  { app: 'customer', path: '/me/card', expect: 'sub' },
  { app: 'customer', path: '/philia/member', expect: 'sub' },
  { app: 'customer', path: '/philia/moments', expect: 'sub' },
  { app: 'customer', path: '/philia/pets', expect: 'sub' },
  { app: 'customer', path: '/dev-login', expect: 'gate' },
  { app: 'customer', path: '/login', expect: 'gate', note: '门禁别名' },
  { app: 'customer', path: '/member', expect: 'sub', note: '批次 R11a' },
  { app: 'customer', path: '/member/open', expect: 'sub', note: '批次 R11a' },
  { app: 'customer', path: '/member/rebate', expect: 'sub', note: '批次 R11b 新路由申报（W-01 账本独立页）' },
  /* 商家端 25 */
  { app: 'merchant', path: '/dashboard', expect: 'tab' },
  { app: 'merchant', path: '/appointments', expect: 'sub' },
  { app: 'merchant', path: `/appointments/${APPT_ID}`, expect: 'sub' },
  { app: 'merchant', path: `/appointments/${INVALID_ID}`, expect: 'sub', note: '无效 id 异常态须出口（W1 补改）' },
  { app: 'merchant', path: '/monitor', expect: 'sub' },
  { app: 'merchant', path: `/monitor/${APPT_ID}`, expect: 'sub' },
  { app: 'merchant', path: `/monitor/${INVALID_ID}`, expect: 'sub', note: '无效 id 异常态须出口（W1 补改）' },
  { app: 'merchant', path: '/boarding', expect: 'sub' },
  { app: 'merchant', path: '/orders', expect: 'sub' },
  { app: 'merchant', path: '/products', expect: 'sub' },
  { app: 'merchant', path: '/pass', expect: 'sub' },
  { app: 'merchant', path: '/staff', expect: 'sub' },
  { app: 'merchant', path: '/finance', expect: 'sub' },
  { app: 'merchant', path: '/settings', expect: 'sub' },
  { app: 'merchant', path: '/settings/rules', expect: 'sub', note: '批次 staff-2 R9-F：owner 专属（clerk 守卫引导页 / manager 页内引导卡，rail 布局内）' },
  { app: 'merchant', path: '/cashier', expect: 'sub' },
  { app: 'merchant', path: '/cashier/records', expect: 'sub' },
  { app: 'merchant', path: '/cashier/close', expect: 'sub' },
  { app: 'merchant', path: '/cashier/refunds', expect: 'sub', note: '批次 R12 退款单列表（墨轨常驻；clerk 引导页）' },
  { app: 'merchant', path: '/dev-login', expect: 'gate' },
  { app: 'merchant', path: '/login', expect: 'gate' },
  { app: 'merchant', path: '/passes', expect: 'sub', note: '重定向兼容' },
  { app: 'merchant', path: '/live', expect: 'sub', note: '重定向→/monitor' },
  { app: 'merchant', path: '/', expect: 'sub', note: '重定向→/dashboard' },
  { app: 'merchant', path: '/dev-login', expect: 'gate' },
  /* 员工端 14 */
  { app: 'staff', path: '/today', expect: 'tab' },
  { app: 'staff', path: '/history', expect: 'tab' },
  { app: 'staff', path: '/me', expect: 'tab' },
  { app: 'staff', path: `/execute/${APPT_ID}`, expect: 'sub', note: '异常态守卫页亦须出口' },
  { app: 'staff', path: `/boarding/${STAY_ID}/checkin`, expect: 'sub', note: '异常态守卫页（W1 弱出口已按钮化）' },
  { app: 'staff', path: '/dev-login', expect: 'gate' },
  { app: 'staff', path: '/', expect: 'sub', note: '重定向→/today' },
  /* 批次 staff-2（R7~R10）：/me 列表进入的子页，统一 PageHeader 返回条（aria-label 返回，backTo=/me） */
  { app: 'staff', path: '/attendance', expect: 'sub', note: '批次 staff-2 R7~R10' },
  { app: 'staff', path: '/inventory', expect: 'sub', note: '批次 staff-2 R7~R10' },
  { app: 'staff', path: `/inventory/${INVALID_ID}`, expect: 'sub', note: '无效 id 异常态须出口（批次 staff-2 R7~R10；无种子盘点单 id，INVALID 行即可）' },
  { app: 'staff', path: '/pay', expect: 'sub', note: '批次 staff-2 R7~R10' },
  { app: 'staff', path: '/xp', expect: 'sub', note: '批次 staff-2 R7~R10' },
  { app: 'staff', path: '/reviews', expect: 'sub', note: '批次 staff-2 R7~R10' },
  { app: 'staff', path: '/manager', expect: 'sub', note: '批次 staff-2 R7~R10；非店长登录渲染引导卡（「返回我的」按钮出口）' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser = null;
const profileDir = join(tmpdir(), `philia-nav-check-${process.pid}`);

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome 可执行文件');
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`);
}
function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  browser = null;
  try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

class Cdp {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
        return;
      }
      if (msg.method === 'Fetch.requestPaused') {
        // 拦截 SSE 请求立即中止（不占连接）——headless 逐路由快跳时 EventSource
        // 长连接累积占满 per-host 上限，后续页 auth.me 被饿死（smoke-routes 同款口径）
        this.send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'ConnectionAborted' }).catch(() => {});
        return;
      }
    };
    await new Promise((r, rej) => { this.ws.onopen = r; this.ws.onerror = rej; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true });
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/events*', requestStage: 'Request' }] });
    await this.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  }
  send(method, params = {}) {
    return new Promise((res, rej) => {
      const mid = ++this.id;
      this.pending.set(mid, { res, rej });
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

const APP_ROLE = { customer: 'customer', merchant: 'merchant_owner', staff: 'staff' };
async function seedUserId(role) {
  const res = await fetch(`${API_BASE}/api/auth/dev-seed-users`);
  if (!res.ok) return null;
  const users = (await res.json())?.users ?? [];
  return (users.find((u) => (u.roles ?? []).includes(role)) ?? users[0])?.id ?? null;
}

/** 四要素检测表达式（页内执行） */
const DETECT = `(() => {
  const back = !!document.querySelector('button[aria-label*="返回"], a[aria-label*="返回"]');
  const dock = !!document.querySelector('[data-testid="app-dock"], [data-testid="staff-dock"], [data-testid="merchant-rail"]');
  const homeLink = !!document.querySelector('a[href="/home"], [data-testid="app-dock-home"], [data-testid="app-dock-首页"], [data-testid="staff-dock-today"]');
  const EXIT_RE = /返回|回首页|回到首页|任务台|查看我的预约|查看订单|查看全程|去逛逛|再逛逛/;
  let exitBtn = false, exitLink = false;
  for (const el of document.querySelectorAll('button, a')) {
    const tx = (el.textContent || '').trim();
    if (tx && EXIT_RE.test(tx)) {
      // 按钮形判定：button 标签 / role=button / 或链接带按钮样式（柠檬/墨底/圆角块级——任务书「按钮样式」口径）
      const styled = /btn|bg-brand|bg-ink|rounded|border/.test(el.className || '');
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || styled) exitBtn = true;
      else exitLink = true;
    }
  }
  const rootNonEmpty = (document.getElementById('root')?.children.length ?? 0) > 0;
  return JSON.stringify({ back, dock, homeLink, exitBtn, exitLink, rootNonEmpty, path: location.pathname });
})()`;

async function checkRoute(cdp, route) {
  await cdp.send('Page.navigate', { url: APP_URLS[route.app] + route.path });
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < TIMEOUT) {
    await sleep(500);
    st = JSON.parse(await cdp.eval(DETECT).catch(() => '{}'));
    if (st && st.rootNonEmpty && (st.back || st.dock || st.exitBtn || st.exitLink)) break;
  }
  if (!st || !st.rootNonEmpty) return { ...route, verdict: '死胡同', detail: '页面空白/未渲染' };
  if (route.expect === 'gate') return { ...route, verdict: '豁免', detail: '门禁页' };
  if (st.back || st.dock || st.exitBtn) return { ...route, verdict: 'OK', detail: `back=${st.back} dock=${st.dock} 出口钮=${st.exitBtn}` };
  if (st.homeLink || st.exitLink) return { ...route, verdict: '弱', detail: `仅链接形出口 home=${st.homeLink} exitLink=${st.exitLink}` };
  return { ...route, verdict: '死胡同', detail: '四要素全无' };
}

async function main() {
  console.log('导航闭环体检（W1 §六 harness）：66 路由 · 四要素检测');
  const results = [];
  for (const app of ['customer', 'merchant', 'staff']) {
    const routes = ROUTES.filter((r) => r.app === app);
    if (routes.length === 0) continue;
    // 每端独立浏览器实例（同 tab 长跑 SSE/SW 累积会饿死后段路由——smoke-routes 同款隔离口径）
    const wsUrl = await launchBrowser();
    const cdp = new Cdp(wsUrl);
    await cdp.open();
    const uid = await seedUserId(APP_ROLE[app]).catch(() => null);
    if (uid) {
      await cdp.send('Page.navigate', { url: `${APP_URLS[app]}/dev-login` });
      await sleep(1800);
      const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: '${uid}' }), credentials: 'include',
      }).then((r) => r.status).catch(() => 0)`);
      console.log(`[${app}] dev-login ${status === 200 ? '✓' : '✗(' + status + ')'}`);
    } else {
      console.log(`[${app}] 未取到种子用户，按未登录口径`);
    }
    for (const route of routes) {
      results.push(await checkRoute(cdp, route));
      const r = results[results.length - 1];
      const mark = r.verdict === 'OK' ? '✅' : r.verdict === '豁免' ? '➖' : r.verdict === '弱' ? '🟡' : '❌';
      console.log(`${mark} [${app}] ${route.path} —— ${r.verdict}${r.note ? `（${r.note}）` : ''} ${r.detail}`);
    }
    cdp.close();
    cleanup();
  }

  const dead = results.filter((r) => r.verdict === '死胡同');
  const weak = results.filter((r) => r.verdict === '弱');
  console.log(`\n===== 体检汇总：${results.length} 路由 · 死胡同 ${dead.length} · 弱 ${weak.length} · 豁免 ${results.filter((r) => r.verdict === '豁免').length} =====`);
  if (NAV_JSON) {
    mkdirSync(dirname(NAV_JSON), { recursive: true });
    writeFileSync(NAV_JSON, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
    console.log(`结果 JSON：${NAV_JSON}`);
  }
  process.exit(dead.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error('check-nav-closure 环境异常：', e?.message ?? e); process.exit(2); });
