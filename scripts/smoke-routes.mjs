#!/usr/bin/env node
/**
 * 生产构建路由级渲染冒烟（批次 8 · 任务 C · 固定闸门）：node scripts/smoke-routes.mjs
 *
 * 背景（任务书）：历史验证停留在 dev/构建日志层，从未对构建产物做路由级渲染冒烟，
 * 导致生产构建 4 条路由必现白屏才被发现。本脚本为每批验收固定闸门。
 *
 * 口径：
 * - 对三端「构建产物」（vite preview / 任意静态托管）逐路由断言：
 *   1. 文档 HTTP 200；
 *   2. 非空白内容标记：#root 非空 + 关键锚点文本存在（server 依赖路由允许以
 *      「非白屏 + 登录守卫跳转 /dev-login」为断言口径，见 routes 表 serverDep 标记）；
 *   3. console 红线（Edge CDP Log/Runtime 收集）：出现 `Failed to load resource`
 *      （js/css/文档类资源）、`MIME type`、`Unexpected token '<'` 任一即失败；
 * - 覆盖清单：本批全部修复路由（B1 员工 /execute/:id、B2 商家 /monitor 系、B3 客户端
 *   /mall/checkout、B4 客户端 /booking/grooming）+ 三端首页 + 登录页 + 任务 A 白屏群
 *   路由；嵌套路由均带尾斜杠变体。
 * - 零依赖（Node 20+ 原生 fetch/WebSocket + Edge CDP），Edge 自动探测，无需 puppeteer。
 *
 * 环境变量（参数化）：
 * - CUSTOMER_URL / MERCHANT_URL / STAFF_URL  三端 base（默认 http://localhost:7100/7101/7102，
 *   本地对 vite preview 冒烟；单容器同源部署时三者同指 PUBLIC base）
 * - API_BASE        后端 base（默认 http://localhost:7200，dev-login 取种子用户用）
 * - SMOKE_LOGIN     0 时跳过 dev-login（全量走守卫跳转身口径）；默认 1
 * - CDP_PORT        Edge 远程调试端口（默认 9223）
 * - SMOKE_JSON      设置时把结果 JSON 写到该路径
 * - SMOKE_TIMEOUT_MS 每路由等待上限（默认 9000）
 *
 * 退出码：0 全绿；1 存在失败路由；2 环境不可用（Edge/端口）。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, '');
const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, '');
const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7102').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const SMOKE_LOGIN = process.env.SMOKE_LOGIN !== '0';
const CDP_PORT = Number(process.env.CDP_PORT ?? 9223);
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS ?? 9000);
const JSON_OUT = process.env.SMOKE_JSON ?? null;

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const BROWSER = EDGE_CANDIDATES.find((p) => existsSync(p));

/** 走查在卷测试数据（本地 DB 种子一致；缺失时 serverDep 口径仍可达守卫） */
const APPT_ID = process.env.SMOKE_APPT_ID ?? '01M256D240E19GWNG2QMFV3Q8V';

/**
 * 路由清单：app / 路径 / 锚点（任一命中）/ serverDep（守卫口径兜底）/ expectPath（重定向终态）
 */
const ROUTES = [
  /* ---- 客户端 ---- */
  { app: 'customer', path: '/dev-login', anchors: ['登录'] },
  { app: 'customer', path: '/', anchors: ['守护每一次洗护', '到店洗护'], expectPath: '/home', note: 'B9a 根路径重定向 + B9.3 新首页锚点' },
  { app: 'customer', path: '/home', anchors: ['守护每一次洗护', '到店洗护'], note: 'B9.3 首页完整改版' },
  { app: 'customer', path: '/mall', anchors: ['商城', '商品'] },
  { app: 'customer', path: '/mall/cart', anchors: ['购物车'] },
  { app: 'customer', path: '/mall/checkout', anchors: ['确认订单', '没有待结算'], note: 'B3 修复路由' },
  { app: 'customer', path: '/mall/orders', anchors: ['订单'], note: 'A2 白屏群' },
  { app: 'customer', path: '/mall/orders/', anchors: ['订单'], note: '尾斜杠变体' },
  { app: 'customer', path: '/booking', anchors: ['预约洗护'], expectPath: '/booking/grooming', note: 'B9.3 中间层 hub 退役直达单屏' },
  { app: 'customer', path: '/booking/grooming', anchors: ['预约洗护'], note: 'B4 修复路由' },
  { app: 'customer', path: '/booking/grooming/', anchors: ['预约洗护'], note: '尾斜杠变体' },
  { app: 'customer', path: '/booking/success', anchors: ['预约', '缺少预约参数'], note: 'B9a 任务B 一键再约落点' },
  { app: 'customer', path: '/appointments', anchors: ['预约'] },
  { app: 'customer', path: `/appointments/${APPT_ID}`, anchors: ['预约', '核销'], serverDep: true, note: 'A1 白屏群' },
  { app: 'customer', path: '/philia/pets', anchors: ['宠物'], note: 'A4 白屏群' },
  { app: 'customer', path: '/philia/moments', anchors: ['服务相册', '相册'], note: 'A4 白屏群' },
  // U1-H：会员卡页新路由（任务书许可补充锚点行，PR 注明）
  { app: 'customer', path: '/me/card', anchors: ['GUARDIAN CARD', '会员卡'], serverDep: true, note: 'U1-H 新路由' },
  /* ---- 商家端 ---- */
  { app: 'merchant', path: '/dev-login', anchors: ['登录'] },
  { app: 'merchant', path: '/dashboard', anchors: ['今日', '仪表', '预约'] },
  { app: 'merchant', path: '/monitor', anchors: ['在店监控'], note: 'B2 修复路由；U3 墨轨改版锚点' },
  { app: 'merchant', path: '/monitor/', anchors: ['在店监控'], note: '尾斜杠变体' },
  { app: 'merchant', path: `/monitor/${APPT_ID}`, anchors: ['实时监控', '预约'], serverDep: true, note: 'B2 别名深链；U3 锚点' },
  { app: 'merchant', path: '/login', anchors: ['登录'], note: 'U3 规范名登录页' },
  { app: 'merchant', path: '/pass', anchors: ['次卡'], serverDep: true, note: 'U3 规范名（/passes 重定向兼容）' },
  { app: 'merchant', path: '/live', anchors: ['在店监控'], expectPath: '/monitor', note: 'B2 重定向；U3 锚点' },
  { app: 'merchant', path: '/appointments', anchors: ['预约'], note: 'A3 白屏群' },
  { app: 'merchant', path: `/appointments/${APPT_ID}/monitor`, anchors: ['实时监控', '预约'], serverDep: true, note: 'P4 原深链；U3 锚点' },
  /* ---- 员工端 ---- */
  { app: 'staff', path: '/dev-login', anchors: ['登录'] },
  { app: 'staff', path: '/today', anchors: ['今天 ·', '任务台', '核销台'], note: 'U2 时间轴台 B′：顶栏「今天 · M月d日」+ dock 首栏（groomer=任务台/frontdesk=核销台）' },
  { app: 'staff', path: `/execute/${APPT_ID}`, anchors: ['第', '步', '核销'], serverDep: true, note: 'B1 修复路由' },
  { app: 'staff', path: `/execute/${APPT_ID}/`, anchors: ['第', '步', '核销'], serverDep: true, note: '尾斜杠变体' },
  { app: 'staff', path: '/history', anchors: ['记录', '历史'] },
  { app: 'staff', path: '/me', anchors: ['我的', '员工'] },
];

const APP_URLS = { customer: CUSTOMER_URL, merchant: MERCHANT_URL, staff: STAFF_URL };
const APP_ROLE = { customer: 'customer', merchant: 'merchant_owner', staff: 'staff' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const results = [];
function record(r) {
  results.push(r);
  const mark = r.ok ? '✅' : '❌';
  if (!r.ok) failures += 1;
  console.log(`${mark} [${r.app}] ${r.path} —— ${r.verdict}`);
}

/* ---------------- Edge CDP ---------------- */

let browser = null;
const profileDir = join(tmpdir(), `philia-smoke-routes-${process.pid}`);

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome 可执行文件');
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
      const targets = await res.json();
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
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.events = []; }
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
        // 拦截的 SSE 请求立即中止（不占连接），见 open() 中 Fetch.enable 注释
        this.send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'ConnectionAborted' }).catch(() => {});
        return;
      }
      this.events.push(msg);
    };
    await new Promise((r, rej) => { this.ws.onopen = r; this.ws.onerror = rej; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true }); // 冒烟目标为静态产物直出，绕开 PWA SW 干扰
    await this.send('Log.enable');
    if (process.env.SMOKE_DEBUG) await this.send('Inspector.enable');
    // 路由冒烟不订阅 SSE：拦截 /api/events 并立即失败（EventSource 会自动重试、
    // 每轮重试间释放连接）。否则快速逐路由跳转时 SSE 长连接累积占满浏览器
    // per-host 连接上限，后续路由的 auth.me 被饿死、守卫卡在「加载中…」误判白屏。
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

/** 红线 console 判定：同源 js/css/文档资源加载失败 / MIME / Unexpected token '<'。
 *  API（/trpc、/api、API_BASE 域）4xx/5xx 不属于静态产物渲染红线，不纳入。 */
function redConsoleEvents(events, docUrl, appBase) {
  const red = [];
  for (const msg of events) {
    if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      const text = String(e.text ?? '');
      const url = String(e.url ?? '');
      if (/MIME type/.test(text)) { red.push(`[log] ${text} (${url})`); continue; }
      if (/Failed to load resource/.test(text)) {
        const sameOrigin = url.startsWith(appBase);
        const isAsset = /\.(m?js|css)(\?|#|$)/.test(url) || url === docUrl
          || (sameOrigin && !/\.(png|jpe?g|svg|ico|webp|woff2?|ttf|json|webmanifest)(\?|#|$)/i.test(url));
        if (isAsset) red.push(`[log] ${text} (${url})`);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const text = String(d?.exception?.description ?? d?.text ?? '');
      if (/Unexpected token '</.test(text)) red.push(`[exception] ${text.split('\n')[0]}`);
    }
  }
  return red;
}

async function seedUserId(role) {
  const res = await fetch(`${API_BASE}/api/auth/dev-seed-users`);
  if (!res.ok) return null;
  const users = (await res.json())?.users ?? [];
  return (users.find((u) => (u.roles ?? []).includes(role)) ?? users[0])?.id ?? null;
}

/** 单路由断言：文档 200 + 非空白 + 锚点/守卫/重定向 + console 红线。
 *  偶发渲染迟滞（SSE 连接竞争等）以一次整页重试兜底：仅当两轮同判失败才记红
 *  （base 类白屏为必现，两轮必同红，不会被吞），重试通过会在 verdict 标注。 */
async function runRoute(cdp, route, _logged) {
  const first = await runRouteOnce(cdp, route);
  if (first.ok) { record(first); return; }
  const retry = await runRouteOnce(cdp, route);
  if (retry.ok) {
    retry.verdict += '（首轮异常，重试通过）';
    record(retry);
    return;
  }
  record({ ...first, verdict: `${first.verdict}（两轮同判）` });
  // 失败留证：截图 + 现场 DOM/readyState（供闸后排查；SMOKE_SHOT_DIR 缺省 ./smoke-shots）
  try {
    const shotDir = process.env.SMOKE_SHOT_DIR ?? 'smoke-shots';
    mkdirSync(shotDir, { recursive: true });
    const name = `${route.app}-${route.path.replaceAll('/', '_').replace(/^_+|_+$/g, '') || 'root'}.png`;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(shotDir, name), Buffer.from(shot.data, 'base64'));
    const dbg = await cdp.eval(`JSON.stringify({
      href: location.href, ready: document.readyState,
      htmlLen: document.documentElement.outerHTML.length,
      rootHtml: (document.getElementById('root')?.innerHTML ?? '').slice(0, 400),
    })`).catch((e) => `eval失败: ${e.message}`);
    console.log(`  [失败留证] ${join(shotDir, name)}`);
    console.log('  [现场]', typeof dbg === 'string' ? dbg.slice(0, 600) : dbg);
  } catch { /* 留证失败不阻塞 */ }
}

async function runRouteOnce(cdp, route) {
  const base = APP_URLS[route.app];
  const url = base + route.path;
  cdp.events = [];
  let docStatus = 0;
  // 文档状态监听与事件收集并行（不侵入主 events 数组结构）
  const watchInterval = setInterval(() => {
    for (const msg of cdp.events) {
      if (msg.method === 'Network.responseReceived' && msg.params.type === 'Document') {
        docStatus = msg.params.response.status;
      }
    }
  }, 250);

  await cdp.send('Page.navigate', { url });
  const t0 = Date.now();
  let settled = false;
  // 路由级沉降：锚点命中 / 守卫跳转 / 重定向终态 任一达成即判稳；
  // 白屏路由给足整段超时（渲染机会窗口），避免把守卫加载态误判为内容
  while (Date.now() - t0 < TIMEOUT) {
    await sleep(500);
    const s = await cdp.eval(`JSON.stringify({
      text: (document.body?.innerText ?? '').slice(0, 4000),
      path: location.pathname,
    })`).catch(() => null);
    if (!s) continue;
    const st = JSON.parse(s);
    const anchorNow = route.anchors.some((a) => st.text.includes(a));
    const guardNow = route.serverDep && st.path === '/dev-login';
    const redirectNow = route.expectPath && st.path === route.expectPath && anchorNow;
    if (anchorNow || guardNow || redirectNow) { settled = true; break; }
  }
  clearInterval(watchInterval);
  await sleep(400); // console 尾帧

  const state = JSON.parse(await cdp.eval(`JSON.stringify({
    rootChildren: document.getElementById('root')?.childElementCount ?? 0,
    text: (document.body?.innerText ?? '').slice(0, 4000),
    path: location.pathname,
  })`));
  const reds = redConsoleEvents(cdp.events, url, base);

  const reasons = [];
  if (docStatus !== 200) reasons.push(`文档 HTTP ${docStatus || '未知'}`);
  if (state.rootChildren === 0 || state.text.trim().length < 10) reasons.push('#root 空白');
  const anchorHit = route.anchors.some((a) => state.text.includes(a));
  const guardHit = route.serverDep && state.path === '/dev-login';
  const redirectHit = route.expectPath ? state.path === route.expectPath : true;
  if (!anchorHit && !guardHit) reasons.push(`锚点未命中（期望任一：${route.anchors.join('/')}${route.serverDep ? '，或守卫跳 /dev-login' : ''}）`);
  if (!redirectHit) reasons.push(`重定向终态不符（期望 ${route.expectPath}，实际 ${state.path}）`);
  if (reds.length > 0) reasons.push(`console 红线：${reds[0]}${reds.length > 1 ? ` 等 ${reds.length} 条` : ''}`);

  return {
    app: route.app, path: route.path, ok: reasons.length === 0,
    verdict: reasons.length === 0
      ? `200 + 非空白 + 锚点/守卫命中${route.note ? `（${route.note}）` : ''}${settled ? '' : '（超时边缘判定）'}`
      : reasons.join('；'),
    docStatus, finalPath: state.path, anchorHit, guardHit, redCount: reds.length,
    reds, note: route.note ?? null,
  };
}

async function main() {
  /* ---- 按端分组：每端独立浏览器实例（tab 隔离）——先登录本端再跑本端路由。
     dev-login 会话 cookie 互相覆盖（集中登录会顶号）；长会话内 SSE/SW/渲染
     累积会让后段路由加载迟滞（实测同 tab 26+ 导航后商家 /appointments 首渲染
     超时），每端重启实例后判定稳定。 ---- */
  const appOrder = ['customer', 'merchant', 'staff'];
  for (const app of appOrder) {
    const routes = ROUTES.filter((r) => r.app === app);
    if (routes.length === 0) continue;

    const wsUrl = await launchBrowser();
    const cdp = new Cdp(wsUrl);
    await cdp.open();

    let logged = false;
    if (SMOKE_LOGIN) {
      const uid = await seedUserId(APP_ROLE[app]).catch(() => null);
      if (!uid) {
        console.log(`⚠️  [${app}] 未取到种子用户（API_BASE=${API_BASE}），按未登录口径`);
      } else {
        await cdp.send('Page.navigate', { url: `${APP_URLS[app]}/dev-login` });
        await sleep(2200);
        const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: '${uid}' }), credentials: 'include',
        }).then((r) => r.status).catch(() => 0)`);
        logged = status === 200;
        if (!logged) console.log(`⚠️  [${app}] dev-login HTTP ${status}，按未登录口径`);
      }
    }

    for (const route of routes) {
      await runRoute(cdp, route, logged);
    }

    cdp.close();
    cleanup(); // 杀本端实例，下一端重起
  }

  const passed = results.length - failures;
  console.log(`\n===== 路由冒烟汇总：${passed}/${results.length} 通过 =====`);
  const failedList = results.filter((r) => !r.ok);
  for (const f of failedList) console.log(`  ❌ [${f.app}] ${f.path} —— ${f.verdict}`);

  if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), env: { CUSTOMER_URL, MERCHANT_URL, STAFF_URL, API_BASE, SMOKE_LOGIN }, passed, total: results.length, results }, null, 2));
    console.log(`结果 JSON：${JSON_OUT}`);
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('smoke-routes 环境异常：', e?.message ?? e);
  cleanup();
  process.exit(2);
});
