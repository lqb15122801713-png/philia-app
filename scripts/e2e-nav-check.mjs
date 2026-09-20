#!/usr/bin/env node
/**
 * e2e 导航实证（批次 W1 · 常备验收工具）：node scripts/e2e-nav-check.mjs
 *
 * Chromium 真机实证（390×844 mobile 仿真，真实 API 造单，真实点击）：
 *  1. 交易成功页四要素：真实下单 → /booking/success?aid=<真 id> →
 *     返回键存在（aria-label 返回）+ 双出口（查看我的预约/返回首页）+ 改期快捷入口；
 *     点击「返回首页」→ 断言落在 /home（一击回首页，验收条款 D1-1）；
 *  2. 选择器整行可点：/booking/grooming → 选宠物弹层 → 点宠物行文字区（非圆圈）→
 *     断言选中收层、宠物卡显示该宠物名（验收条款 D2-1）；
 *  3. R-Nav-2 返回保状态：/appointments 切非默认 tab → 进详情 → 返回 →
 *     断言 tab 保持（?tab= 保留）；
 *  4. R-Nav-3：底栏中位爪印按钮带文字标签。
 *
 * 环境变量：CUSTOMER_URL（默认 http://localhost:7100）、API_BASE（默认 http://localhost:7200）、
 *   CDP_PORT（默认 9225）。
 * 环境假设（P3 跨环境条款）：
 *   - Node ≥22（全局 WebSocket 稳定）；Node 20/21 须加 flag：
 *       node --experimental-websocket scripts/e2e-nav-check.mjs
 *   - 浏览器：CHROME_PATH 显式指定优先，其次 Windows/Linux 候选自动探测；
 *   - 口令假设：dev-seed-users / dev-login 不带 code——被检服务须未设 BETA_GATE_CODE（无门态）；
 *   - 构建口径（Y1 裁定）：三端构建只许根目录 `npm run build`。
 * 退出码：0 全绿；1 存在失败；2 环境不可用。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9225);

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
}

let browser = null;
const profileDir = join(tmpdir(), `philia-e2e-nav-${process.pid}`);
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
      }
    };
    await new Promise((r, rej) => { this.ws.onopen = r; this.ws.onerror = rej; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true });
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
  async waitFor(expr, timeout = 15000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await this.eval(expr).catch(() => false)) return true;
      await sleep(300);
    }
    return false;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

/* ---- tRPC（batch=1 + superjson 线格式，与 smoke-deploy 同口径） ---- */
function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    throw new Error(`${name} 失败：${e?.message ?? JSON.stringify(e)}`);
  }
  return first?.result?.data?.json;
}
async function trpcQuery(cookie, path, input, metaValues) {
  const frame = { json: input ?? null };
  if (metaValues) frame.meta = { values: metaValues };
  const payload = encodeURIComponent(JSON.stringify({ '0': frame }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: cookie ? { Cookie: cookie } : {} });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutate(cookie, path, input, metaValues) {
  const body = { '0': { json: input } };
  if (metaValues) body['0'].meta = { values: metaValues };
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function main() {
  /* ---- 种子与真实造单（成功页需要真 aid） ---- */
  const seeds = (await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json())?.users ?? [];
  const customer = seeds.find((u) => (u.roles ?? []).includes('customer'));
  if (!customer) throw new Error('无种子客户');
  const cookie = await devLogin(customer.id);
  const pets = await trpcQuery(cookie, 'pet.list');
  const pet = pets?.[0];
  const store = (await trpcQuery(cookie, 'store.listNearby', { lat: 30.2741, lng: 120.1551 }))?.stores?.[0];
  const detail = await trpcQuery(cookie, 'store.getWithServices', { storeId: store.id });
  const service = detail?.services?.find((s) => s.type === 'grooming');
  const TZ = 8 * 60 * 60 * 1000;
  const nowWc = new Date(Date.now() + TZ);
  let aid = null;
  for (let d = 1; d <= 7 && !aid; d++) {
    const start = new Date(Date.UTC(nowWc.getUTCFullYear(), nowWc.getUTCMonth(), nowWc.getUTCDate() + d, 10, 0, 0, 0) - TZ);
    for (let i = 0; i < 12 && !aid; i++) {
      try {
        const created = await trpcMutate(cookie, 'appointment.create', {
          storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
          scheduledStart: new Date(start.getTime() + i * 30 * 60_000).toISOString(),
          paymentMode: 'pay_at_store', note: 'e2e-nav-check 造单',
        }, { scheduledStart: ['Date'] });
        aid = created?.id ?? created?.appointment?.id ?? null;
      } catch { /* 满槽顺延 */ }
    }
  }
  check('真实造单（成功页数据源）', !!aid, `aid=${aid}`);

  /* ---- 浏览器登录 ---- */
  const wsUrl = await launchBrowser();
  const cdp = new Cdp(wsUrl);
  await cdp.open();
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/dev-login` });
  await sleep(1800);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  check('浏览器 dev-login', loginStatus === 200, `status=${loginStatus}`);

  /* ---- 1. 交易成功页四要素 + 一击回首页 ---- */
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/booking/success?aid=${aid}` });
  const settled = await cdp.waitFor(`(document.body?.innerText ?? '').includes('查看我的预约')`);
  check('成功页可达（?aid= 真实单据）', settled, '');
  const s1 = JSON.parse(await cdp.eval(`JSON.stringify({
    back: !!document.querySelector('button[aria-label*="返回"], a[aria-label*="返回"]'),
    exitA: [...document.querySelectorAll('button, a')].some((el) => (el.textContent || '').includes('查看我的预约')),
    exitB: [...document.querySelectorAll('button, a')].some((el) => (el.textContent || '').includes('返回首页')),
    rebook: [...document.querySelectorAll('button, a')].some((el) => /改期|再约|继续预约/.test(el.textContent || '')),
    code: (document.body?.innerText ?? '').includes('核销'),
  })`));
  check('成功页返回键存在', s1.back === true, '');
  check('成功页双出口（查看我的预约 / 返回首页）', s1.exitA && s1.exitB, '');
  check('成功页核销码区（工作文档）', s1.code === true, '');
  check('成功页改期快捷入口', s1.rebook === true, '');
  // 点击「返回首页」→ 落 /home
  await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('button, a')].find((el) => (el.textContent || '').includes('返回首页'));
    if (btn) { btn.click(); return true; } return false;
  })()`);
  await sleep(1500);
  const path1 = await cdp.eval('location.pathname');
  check('成功页一击回首页（落 /home）', path1 === '/home', `path=${path1}`);

  /* ---- 2. 选宠物弹层整行可点 ---- */
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/booking/grooming` });
  await cdp.waitFor(`(document.body?.innerText ?? '').includes('选择宠物') || (document.body?.innerText ?? '').includes('请选择宠物')`);
  await sleep(1200);
  // 打开弹层（点「请选择宠物」占位卡或「换一只」）
  await cdp.eval(`(() => {
    const el = [...document.querySelectorAll('button, a, div')].find((n) => /请选择宠物|换一只/.test(n.textContent || '') && n.textContent.length < 40);
    if (el) { el.click(); return true; } return false;
  })()`);
  const sheetOpen = await cdp.waitFor(`(document.body?.innerText ?? '').includes('选择宠物')`, 8000);
  check('选宠物弹层打开', sheetOpen, '');
  await sleep(800);
  // 记录目标宠物名，在弹层对话框作用域内点该行「文字区」（排除占位卡自身——其文案含「点按」）
  const pickRes = await cdp.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"], [data-testid*="sheet"], [class*="sheet"], [class*="Sheet"]') ?? document.body;
    const rows = [...dialog.querySelectorAll('button')].filter((b) => {
      const tx = (b.textContent || '').trim();
      return tx.length > 0 && tx.length < 30 && !/点按|请选择|换一只/.test(tx) && /旺财|咪咪/.test(tx);
    });
    const row = rows[0];
    if (!row) return JSON.stringify({ ok: false, reason: 'no-pet-row' });
    const name = (row.textContent || '').trim().slice(0, 6);
    // 点击行内文字区子元素（非右侧选择圆圈）
    const textNode = row.querySelector('span, div') ?? row;
    textNode.click();
    return JSON.stringify({ ok: true, name });
  })()`);
  const picked = JSON.parse(pickRes);
  await sleep(1200);
  // 选中后弹层应收起且宠物卡显示该宠物名
  const petSelected = await cdp.eval(`(() => {
    const tx = document.body?.innerText ?? '';
    return !document.querySelector('[role="dialog"]') && tx.includes(${JSON.stringify(picked.name ?? '')});
  })()`);
  check('选宠物弹层点整行可选中（文字区命中）', picked.ok === true && petSelected === true, `pet=${picked.name ?? '?'}`);

  /* ---- 3. R-Nav-2 返回保状态（数据闭环：listMine 运行时自取自证，非默认 tab 有行才断言） ---- */
  // tab 体系（AppointmentsPage TABS 常量）：已确认(默认)/待确认/服务中/已完成/已取消
  const TAB_BY_STATUS = { completed: '已完成', in_service: '服务中', in_boarding: '服务中', cancelled: '已取消', pending: '待确认' };
  const mine = await trpcQuery(cookie, 'appointment.listMine');
  const groups = mine?.groups ?? {};
  let navTarget = null;
  for (const statuses of [['completed'], ['in_service', 'in_boarding'], ['cancelled'], ['pending']]) {
    for (const s of statuses) {
      const rows = groups[s] ?? [];
      if (rows.length > 0) { navTarget = { aid: rows[0].id, label: TAB_BY_STATUS[s], status: s }; break; }
    }
    if (navTarget) break;
  }
  check('R-Nav-2 前置：listMine 取到非默认 tab 单据（运行时数据闭环）', navTarget !== null, navTarget ? `status=${navTarget.status} aid=${navTarget.aid}` : '全部为空');
  if (navTarget) {
    await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/appointments` });
    await cdp.waitFor(`(document.body?.innerText ?? '').includes('预约')`);
    await sleep(1200);
    // 切到该非默认 tab（label 前缀匹配——钮上计数无空格，如「已完成7」）
    const tabClicked = await cdp.eval(`(() => {
      const tab = [...document.querySelectorAll('button, a')].find((el) => (el.textContent || '').trim().startsWith(${JSON.stringify(navTarget.label)}));
      if (!tab) return false;
      tab.click();
      return true;
    })()`);
    check(`R-Nav-2 前置：切到「${navTarget.label}」tab`, tabClicked === true, '');
    await sleep(1200);
    const rowHit = await cdp.eval(`(() => {
      const row = document.querySelector('a[href*="/appointments/${navTarget.aid}"]');
      if (!row) return false;
      row.click();
      return true;
    })()`);
    check('R-Nav-2 前置：目标单据在列表可取（取不到=显式失败）', rowHit === true, '');
    await sleep(1800);
    const detailPath = await cdp.eval('location.pathname');
    const detailOk = rowHit === true && detailPath.includes(`/appointments/${navTarget.aid}`);
    check('R-Nav-2 前置：已进入目标单据详情（进详情成功才断言）', detailOk === true, `path=${detailPath}`);
    if (detailOk) {
      await cdp.eval(`(() => { const b = document.querySelector('button[aria-label*="返回"], a[aria-label*="返回"]'); if (b) { b.click(); return true; } history.back(); return true; })()`);
      await sleep(1500);
      const backUrl = await cdp.eval('location.pathname + location.search');
      check('R-Nav-2 返回列表保筛选 tab', backUrl.includes('tab='), `tab=${navTarget.label} 返回后=${backUrl}`);
    } else {
      check('R-Nav-2 返回列表保筛选 tab', false, '未进详情，显式失败');
    }
  } else {
    check('R-Nav-2 返回列表保筛选 tab', false, '无可用非默认 tab 数据，显式失败');
  }

  /* ---- 4. R-Nav-3 底栏中位文字标签（底栏只在主 tab 页渲染，先回 /home） ---- */
  await cdp.send('Page.navigate', { url: `${CUSTOMER_URL}/home` });
  await cdp.waitFor(`!!document.querySelector('[data-testid="app-dock"]')`);
  const dockLabel = await cdp.eval(`(() => {
    const c = document.querySelector('[data-testid="app-dock-philia"]');
    const wrap = c?.parentElement;
    return wrap ? (wrap.textContent || '').trim() : null;
  })()`);
  check('R-Nav-3 底栏中位爪印带文字标签', /philia/i.test(dockLabel ?? ''), `label=${dockLabel}`);

  console.log(failures === 0 ? '\ne2e-nav-check 全绿 🎉' : `\n${failures} 项失败`);
  cdp.close();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('e2e-nav-check 环境异常：', e?.message ?? e); process.exit(2); });
