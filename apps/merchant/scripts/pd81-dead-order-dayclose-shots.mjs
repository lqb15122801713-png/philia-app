#!/usr/bin/env node
/**
 * PD-81（商家端死单前台隐藏＋日结/报表打印入口）实尺截图 + 接口实证
 *
 * 口径（学 pd79-in-service-void-shots.mjs，自含版）：
 * - 临时库：PHILIA_DB_URL=file:.runtime/pd81-<ts>/philia.db（migrate+seed 后插两笔
 *   商城 mock 单：死单 P261022YKNXD2／01M5H1E1… ¥19＋对照单 P261022PD81C）；
 *   本窗专用临时库≠现网库（禁直改库=现网/共享库，本夹具库测完即删）。
 * - 真链路：浏览器内 dev-login 店主（敏慧人设=种子「菲丽亚店主」）→ /orders 死单
 *   不可见且对照单可见、计数同源；/cashier/close 日结单详情「打印日结单」可达
 *   （owner 同导出闸）；/finance/report/d1「导出 CSV」＋「打印」双入口可达。
 * - 日结单=真接口 cashier.dayClose(actualCashFen:0) 冻结今日（¥0 诚实口径，
 *   敏慧 R5 ¥0→¥88→¥0 双口径先例）；涉钱全 mock（本窗无真实支付）。
 * - 库内仍在：走测后同库 SELECT 死单行仍在（显示层过滤非删库反证）。
 * - 打印隔离实证：CDP Emulation.setEmulatedMedia=print 下 #report-print-area
 *   打印头 display:block、report-print 钮继承 visibility:hidden。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。视口 1280×800。
 * - 测完自清：子进程全收、临时库目录删除（KEEP_ENV=1 保留排查）。
 *
 * 用法：node apps/merchant/scripts/pd81-dead-order-dayclose-shots.mjs
 * 环境变量：PD81_SERVER_PORT(7210) / PD81_MERCHANT_PORT(7111) / PD81_CDP_PORT(9271)
 *          / OUT_DIR / HEADFUL=1 / KEEP_ENV=1。
 * 退出码：0=截图落盘且断言全绿；1=存在失败项；2=环境缺失。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SERVER_DIR = join(REPO_ROOT, 'server');
const MERCHANT_DIR = join(REPO_ROOT, 'apps', 'merchant');
const SERVER_PORT = Number(process.env.PD81_SERVER_PORT ?? 7210);
const MERCHANT_PORT = Number(process.env.PD81_MERCHANT_PORT ?? 7111);
const CDP_PORT = Number(process.env.PD81_CDP_PORT ?? 9271);
const API_BASE = `http://localhost:${SERVER_PORT}`;
const MERCHANT_URL = `http://localhost:${MERCHANT_PORT}`;
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd81-merchant-dead-order-dayclose');
const KEEP = process.env.KEEP_ENV === '1';
const RUNTIME_DIR = join(REPO_ROOT, '.runtime', `pd81-${Date.now()}`);
const DB_FILE = join(RUNTIME_DIR, 'philia.db').replaceAll('\\', '/');
const DB_URL = `file:${DB_FILE}`;

const DEAD_ORDER_ID = '01M5H1E1PD81DEAD0RDER00000';
const DEAD_ORDER_NO = 'P261022YKNXD2';
const CTRL_ORDER_ID = '01M9PD81CTRL00000000000000';
const CTRL_ORDER_NO = 'P261022PD81C';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

let failures = 0;
const results = [];
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  results.push({ ok, name, detail });
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- 子进程编排 ---- */
const children = [];
function spawnLong(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: 'ignore', shell: false, ...opts });
  children.push(p);
  return p;
}
function killAll() {
  for (const p of children) { try { p.kill(); } catch {} }
}
function runStep(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) throw new Error(`步骤失败(${r.status})：${cmd} ${args.join(' ')}`);
}
const serverReq = createRequire(join(SERVER_DIR, 'package.json'));
/* tsx/vite bin 直取文件路径（包 exports 未暴露子路径，绕过 ERR_PACKAGE_PATH_NOT_EXPORTED） */
const tsxCli = join(SERVER_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const viteCli = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

async function waitHttp(url, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(500);
  }
}

/* ---- tRPC HTTP（batch=1 + superjson 线格式） ---- */
function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    throw new Error(`${name} 失败：${e?.message ?? JSON.stringify(e)}`);
  }
  return first?.result?.data?.json;
}
async function trpcMutateRaw(cookie, path, input) {
  const body = { '0': { json: input ?? null } };
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { httpStatus: res.status, body: await res.json() };
}
async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

/* ---- CDP 最小幅（导航/求值/截图） ---- */
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
    };
    await new Promise((r) => { this.ws.onopen = r; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++this.id;
      this.pending.set(mid, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r?.exceptionDetails) throw new Error(`eval 失败：${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r?.result?.value;
  }
  async goto(url, waitMs = 4200) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }
  async waitFor(expression, timeoutMs = 60000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(500);
    }
  }
  async viewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }
  async shot(outfile) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(RUNTIME_DIR, { recursive: true });

  /* ---- ① 临时库：migrate + seed ---- */
  console.log(`[pd81] 临时库 ${DB_URL}`);
  const dbEnv = { ...process.env, PHILIA_DB_URL: DB_URL };
  runStep(process.execPath, [tsxCli, 'src/db/migrate.ts'], { cwd: SERVER_DIR, env: dbEnv });
  runStep(process.execPath, [tsxCli, 'src/db/seed.ts'], { cwd: SERVER_DIR, env: dbEnv });

  /* ---- ② 夹具：死单＋对照单（本窗临时库直插，≠现网库） ---- */
  const libsql = serverReq('@libsql/client');
  const db = libsql.createClient({ url: DB_URL });
  const store = (await db.execute('SELECT id FROM stores ORDER BY created_at LIMIT 1')).rows[0];
  const customer = (await db.execute("SELECT user_id AS id FROM user_roles WHERE role='customer' ORDER BY created_at LIMIT 1")).rows[0];
  if (!store?.id || !customer?.id) { console.error('种子库缺 store/customer'); process.exit(2); }
  const itemsJson = (name) => JSON.stringify([{ product_id: 'pd81-fixture', name, quantity: 1, price_fen: 1900 }]);
  await db.execute({
    sql: `INSERT INTO orders (id, order_no, customer_id, store_id, items, total_fen, address, status, tracking_no, delivery_method, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1900, NULL, 'paid', NULL, 'express', unixepoch(), unixepoch())`,
    args: [DEAD_ORDER_ID, DEAD_ORDER_NO, customer.id, store.id, itemsJson('发声橡胶球')],
  });
  await db.execute({
    sql: `INSERT INTO orders (id, order_no, customer_id, store_id, items, total_fen, address, status, tracking_no, delivery_method, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1900, NULL, 'paid', NULL, 'express', unixepoch(), unixepoch())`,
    args: [CTRL_ORDER_ID, CTRL_ORDER_NO, customer.id, store.id, itemsJson('发声橡胶球')],
  });
  note(true, '夹具：死单＋对照单已入临时库（¥19 发声橡胶球 ×2，status=paid）', `${DEAD_ORDER_NO}／${CTRL_ORDER_NO}`);

  /* ---- ③ 起 server + merchant dev ---- */
  spawnLong(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PHILIA_DB_URL: DB_URL, PORT: String(SERVER_PORT), CORS_ORIGINS: MERCHANT_URL },
  });
  if (!(await waitHttp(`${API_BASE}/api/health`))) { console.error('server 未就绪'); process.exit(2); }
  note(true, 'server 就绪', API_BASE);
  spawnLong(process.execPath, [viteCli, '--port', String(MERCHANT_PORT), '--strictPort'], {
    cwd: MERCHANT_DIR,
    env: { ...process.env, VITE_API_BASE: API_BASE },
  });
  if (!(await waitHttp(MERCHANT_URL))) { console.error('merchant dev 未就绪'); process.exit(2); }
  note(true, 'merchant dev 就绪', MERCHANT_URL);

  /* ---- ④ 真链路造今日日结（owner · ¥0 诚实口径 · 涉钱 mock） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const ownerUserId = seed.users.find((u) => u.nickname === '菲丽亚店主')?.id;
  if (!ownerUserId) { console.error('种子店主缺失'); process.exit(2); }
  const ownerCookie = await devLogin(ownerUserId);
  const closeRaw = await trpcMutateRaw(ownerCookie, 'cashier.dayClose', { actualCashFen: 0 });
  const closeOk = closeRaw.httpStatus === 200 && !closeRaw.body?.[0]?.error;
  note(closeOk, '日结正例：cashier.dayClose(actualCashFen=0) 冻结今日', `HTTP ${closeRaw.httpStatus}`);

  /* ---- ⑤ CDP 浏览器走测 ---- */
  const profile = join(tmpdir(), `pd81-deadorder-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  children.push(browser);

  let pageTarget = null;
  for (let i = 0; i < 40 && !pageTarget; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      pageTarget = await res.json();
    } catch { await sleep(400); }
  }
  if (!pageTarget?.webSocketDebuggerUrl) { console.error('CDP 页签创建失败'); process.exit(2); }
  const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.viewport(1280, 800, false);

  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店主·敏慧人设）', `HTTP ${loginStatus}`);

  /* ⑤A 死单前台隐藏：/orders 三队列不见死单、对照单在、计数同源 */
  await cdp.goto(`${MERCHANT_URL}/orders`);
  await cdp.waitFor(`document.querySelector('[data-testid="orders-page"]') && !document.body.innerText.includes('订单加载失败')`);
  await cdp.waitFor(`document.querySelector('[data-testid="order-${CTRL_ORDER_ID}"]')`);
  const ordersView = await cdp.eval(`({
    deadRow: !!document.querySelector('[data-testid="order-${DEAD_ORDER_ID}"]'),
    ctrlRow: !!document.querySelector('[data-testid="order-${CTRL_ORDER_ID}"]'),
    deadText: document.body.innerText.includes('${DEAD_ORDER_NO}'),
    ctrlText: document.body.innerText.includes('${CTRL_ORDER_NO}'),
    paidChip: document.querySelector('[data-testid="orders-tab-paid"]')?.textContent ?? '',
  })`);
  note(!ordersView.deadRow && !ordersView.deadText, '死单前台不可见（/orders 行＋全文双缺席）', JSON.stringify(ordersView));
  note(ordersView.ctrlRow && ordersView.ctrlText, '对照单正常可见（不误伤）', ordersView.paidChip.trim());
  note(ordersView.paidChip.includes('1') && !ordersView.paidChip.includes('2'), '待发货计数同源剔除死单（=1 非 2）', ordersView.paidChip.trim());
  await cdp.shot(join(OUT_DIR, 'shots', '01-orders-dead-hidden.png'));

  /* ⑤B 日结 R18-01：详情弹层「打印日结单」可达（owner 同导出闸） */
  await cdp.goto(`${MERCHANT_URL}/cashier/close`);
  await cdp.waitFor(`document.querySelector('[data-testid="dayclose-list"] table')`);
  const closeList = await cdp.eval(`({
    rows: document.querySelectorAll('[data-testid^="dayclose-row-"]').length,
    hasExport: !!document.querySelector('[data-testid^="dayclose-export-"]'),
  })`);
  note(closeList.rows >= 1 && closeList.hasExport, '日结留痕列表出今日冻结单＋导出可达', JSON.stringify(closeList));
  await cdp.eval(`document.querySelector('[data-testid^="dayclose-row-"]')?.click()`);
  await sleep(1200);
  const closeDetail = await cdp.eval(`({
    dialog: !!document.querySelector('[data-testid="dayclose-detail"]'),
    printBtn: !!document.querySelector('[data-testid="dayclose-print"]'),
    printText: document.querySelector('[data-testid="dayclose-print"]')?.textContent ?? '',
  })`);
  note(closeDetail.dialog && closeDetail.printBtn, '日结单详情「打印日结单」入口可达（R18-01 可 RECAPTURED）', JSON.stringify(closeDetail));
  await cdp.shot(join(OUT_DIR, 'shots', '02-dayclose-detail-print.png'));

  /* ⑤C 报表入口：/finance/report/d1 导出＋打印双可达 + 打印隔离实证 */
  await cdp.goto(`${MERCHANT_URL}/finance/report/d1`);
  await cdp.waitFor(`document.querySelector('[data-testid="report-page-d1"]') && (document.querySelector('[data-testid="d1-deltas"]') || document.querySelector('[aria-label="加载中"]')===null)`);
  const reportView = await cdp.eval(`({
    exportBtn: !!document.querySelector('[data-testid="report-export"]'),
    printBtn: !!document.querySelector('[data-testid="report-print"]'),
    printArea: !!document.querySelector('#report-print-area'),
  })`);
  note(reportView.exportBtn && reportView.printBtn && reportView.printArea, '报表 D1「导出 CSV」＋「打印」双入口可达', JSON.stringify(reportView));
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(600);
  const printCss = await cdp.eval(`({
    headDisplay: getComputedStyle(document.querySelector('#report-print-area .report-print-head')).display,
    printBtnHidden: getComputedStyle(document.querySelector('[data-testid="report-print"]')).visibility === 'hidden',
  })`);
  note(printCss.headDisplay === 'block' && printCss.printBtnHidden, '打印隔离生效（打印头亮出／钮区隐藏）', JSON.stringify(printCss));
  await cdp.send('Emulation.setEmulatedMedia', { media: '' });
  await cdp.shot(join(OUT_DIR, 'shots', '03-report-d1-print-export.png'));

  /* ⑤D 库内仍在反证：同库 SELECT 死单行保留（显示层过滤≠删库） */
  const deadInDb = await db.execute({ sql: 'SELECT id, order_no, status, total_fen FROM orders WHERE order_no = ?', args: [DEAD_ORDER_NO] });
  note(deadInDb.rows.length === 1 && deadInDb.rows[0].status === 'paid',
    '死单库内仍在（status=paid · 零库写）', JSON.stringify(deadInDb.rows[0] ?? null));

  /* ---- 收口 ---- */
  cdp.close();
  writeFileSync(join(OUT_DIR, 'api-check.json'), JSON.stringify({
    window: 'PD-81-merchant-dead-order-dayclose',
    base: { server: API_BASE, merchant: MERCHANT_URL, db: DB_URL },
    fixtures: { deadOrder: { id: DEAD_ORDER_ID, orderNo: DEAD_ORDER_NO }, controlOrder: { id: CTRL_ORDER_ID, orderNo: CTRL_ORDER_NO } },
    results,
  }, null, 2));
  console.log(`\n[pd81] ${failures === 0 ? '全绿' : `失败 ${failures} 项`} · 证据 ${OUT_DIR}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 2; })
  .finally(() => {
    killAll();
    if (!KEEP) { try { rmSync(RUNTIME_DIR, { recursive: true, force: true }); } catch {} }
    setTimeout(() => process.exit(process.exitCode ?? 0), 800);
  });
