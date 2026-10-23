#!/usr/bin/env node
/**
 * PD-85（商家端日结 R18-01 独立 modal 收口）实尺截图 + 接口实证
 *
 * 口径（学 pd84-dayclose-print-shots.mjs，自含版）：
 * - 临时库：PHILIA_DB_URL=file:.runtime/pd85-<ts>/philia.db（migrate+seed）；
 *   本窗专用临时库≠现网库（禁直改库=现网/共享库，本夹具库测完即删）。
 * - **生产保真**：merchant 走 `npm run build`（tsc -b 静态闸＋vite build 生产包）
 *   ＋ vite preview 伺服 dist（非 dev server）——与现网部署同工艺；VITE_API_BASE
 *   显式注入临时 server（client.ts 留口②），preview 无代理不影射。
 * - 敏慧店长走测正例：浏览器 dev-login **店长**（merchant_manager，种子店绑定）→
 *   /cashier/close 点「日结并冻结全日账目」须出独立确认 modal（遮罩＋确认/取消成对、
 *   **PD-85：页面树内联渲染——#root 内可检、非 portal 挂 body 直连子**，禁页内闸）；
 *   Esc／点遮罩／取消三路中止=零提交（server 侧 listDayCloses 仍 0 单反证，禁假
 *   CLEARED=三路中止后无成功 toast）；确认才真冻结（真返回驱动 toast）。
 * - 涉钱一律 mock（本窗无真实支付，实点 ¥0 诚实口径）；零 schema（迁移预分 0126
 *   故意空留不占文件；0122–0125＋0117/0119 空留禁撞）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。视口 1280×800。
 * - 测完自清：子进程全收、临时库目录删除（KEEP_ENV=1 保留排查）。
 *
 * 用法：node apps/merchant/scripts/pd85-dayclose-modal-shots.mjs
 *        （Node 20 需 `node --experimental-websocket`——原生 WebSocket 未默认开；Node ≥22 直跑）
 * 环境变量：PD85_SERVER_PORT(7226) / PD85_MERCHANT_PORT(7126) / PD85_CDP_PORT(9285)
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
const SERVER_PORT = Number(process.env.PD85_SERVER_PORT ?? 7226);
const MERCHANT_PORT = Number(process.env.PD85_MERCHANT_PORT ?? 7126);
const CDP_PORT = Number(process.env.PD85_CDP_PORT ?? 9285);
const API_BASE = `http://localhost:${SERVER_PORT}`;
const MERCHANT_URL = `http://localhost:${MERCHANT_PORT}`;
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd85-merchant-dayclose-modal');
const KEEP = process.env.KEEP_ENV === '1';
const RUNTIME_DIR = join(REPO_ROOT, '.runtime', `pd85-${Date.now()}`);
const DB_FILE = join(RUNTIME_DIR, 'philia.db').replaceAll('\\', '/');
const DB_URL = `file:${DB_FILE}`;

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

async function waitHttp(url, timeoutMs = 90000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(500);
  }
}

/* ---- tRPC HTTP（batch=1 + superjson 线格式） ---- */
async function trpcQueryRaw(cookie, path, input) {
  const q = encodeURIComponent(JSON.stringify({ '0': { json: input ?? null } }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${q}`, {
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
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
  async waitFor(expression, timeoutMs = 90000) {
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

/** 填实点现金 ¥0（涉钱 mock 诚实口径） */
const FILL_ZERO_JS = `(() => {
  const inp = document.querySelector('[data-testid="dayclose-actual-input"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(inp, '0');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

/** PD-85 核心断言件：modal 结构五连（对话框/遮罩/成对钮/内联挂载/页内零闸） */
const MODAL_VIEW_JS = `(() => {
  const dlg = document.querySelector('[data-testid="dayclose-confirm-dialog"]');
  if (!dlg) return { dialog: false };
  const layer = dlg.closest('[data-testid="dayclose-confirm-layer"]');
  const appRoot = document.getElementById('root');
  return {
    dialog: true,
    roleDialog: dlg.getAttribute('role') === 'dialog' && dlg.getAttribute('aria-modal') === 'true',
    overlay: !!layer?.querySelector('[data-testid="dayclose-confirm-overlay"]'),
    /* PD-85：页面树内联渲染——modal 在 #root 内可检，且不以 portal 直连 body */
    inlineInRoot: !!(appRoot && appRoot.contains(dlg)),
    notPortalToBody: layer?.parentElement !== document.body,
    notInline: !document.querySelector('[data-testid="dayclose-form"] [data-testid="dayclose-confirm-dialog"]'),
    cancelBtn: !!document.querySelector('[data-testid="dayclose-confirm-cancel"]'),
    okBtn: !!document.querySelector('[data-testid="dayclose-confirm-ok"]'),
    actual: document.querySelector('[data-testid="dayclose-confirm-actual"]')?.textContent ?? '',
  };
})()`;

/** 成功 toast 侦测（禁假 CLEARED：三路中止后须零成功 toast） */
const SUCCESS_TOAST_JS = `(() => {
  const t = [...document.querySelectorAll('[data-sonner-toast]')].map((x) => x.textContent ?? '');
  return { count: t.length, clearedLike: t.some((s) => s.includes('日结单已冻结')) };
})()`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(RUNTIME_DIR, { recursive: true });

  /* ---- ① 临时库：migrate + seed ---- */
  console.log(`[pd85] 临时库 ${DB_URL}`);
  const dbEnv = { ...process.env, PHILIA_DB_URL: DB_URL };
  runStep(process.execPath, [tsxCli, 'src/db/migrate.ts'], { cwd: SERVER_DIR, env: dbEnv });
  runStep(process.execPath, [tsxCli, 'src/db/seed.ts'], { cwd: SERVER_DIR, env: dbEnv });

  /* ---- ② 夹具：店长账号（merchant_manager；种子只出店主/店员，店长=本窗临时库补造，
     口径=users + user_roles(merchant_manager) + staff 行绑店，同 middleware 登记口径；
     涉钱为零·测完随临时库自删） ---- */
  const libsql = serverReq('@libsql/client');
  const db = libsql.createClient({ url: DB_URL });
  const store = (await db.execute('SELECT id FROM stores ORDER BY created_at LIMIT 1')).rows[0];
  if (!store?.id) { console.error('种子库缺 store'); process.exit(2); }
  let mgr = (await db.execute("SELECT user_id AS id FROM user_roles WHERE role='merchant_manager' ORDER BY created_at LIMIT 1")).rows[0];
  if (!mgr?.id) {
    const MGR_ID = '01M9PD85MGR000000000000000';
    await db.execute({
      sql: `INSERT INTO users (id, kimi_id, nickname, phone, created_at, updated_at)
            VALUES (?, 'seed_kimi_pd85_mgr', '敏慧店长', '13900000085', unixepoch(), unixepoch())`,
      args: [MGR_ID],
    });
    await db.execute({
      sql: `INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
            VALUES ('01M9PD85MGRROLE0000000000', ?, 'merchant_manager', unixepoch(), unixepoch())`,
      args: [MGR_ID],
    });
    await db.execute({
      sql: `INSERT INTO staff (id, store_id, user_id, name, role, skills, schedule, status, grade, created_at, updated_at)
            VALUES ('01M9PD85MGRSTAFF000000000', ?, ?, '敏慧店长', 'frontdesk', '["wash"]', '{}', 'active', 'P1', unixepoch(), unixepoch())`,
      args: [store.id, MGR_ID],
    });
    mgr = { id: MGR_ID };
  }
  const mgrName = (await db.execute({ sql: 'SELECT nickname FROM users WHERE id = ?', args: [mgr.id] })).rows[0]?.nickname;
  note(true, '夹具：店长账号就绪（merchant_manager · 临时库）', `${mgrName ?? mgr.id}`);

  /* ---- ③ 生产保真：merchant npm run build（tsc -b 静态闸＋vite build）→ preview ---- */
  console.log('[pd85] merchant 生产构建（tsc -b && vite build）…');
  runStep('npm', ['run', 'build'], {
    cwd: MERCHANT_DIR,
    shell: true,
    env: { ...process.env, VITE_API_BASE: API_BASE },
  });
  note(true, '静态闸：tsc -b ＋ vite build 绿（生产包）');

  /* ---- ④ 起 server + merchant preview ---- */
  spawnLong(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: { ...process.env, PHILIA_DB_URL: DB_URL, PORT: String(SERVER_PORT), CORS_ORIGINS: MERCHANT_URL },
  });
  if (!(await waitHttp(`${API_BASE}/api/health`))) { console.error('server 未就绪'); process.exit(2); }
  note(true, 'server 就绪', API_BASE);
  const mgrCookie = await devLogin(mgr.id);
  spawnLong(process.execPath, [viteCli, 'preview', '--port', String(MERCHANT_PORT), '--strictPort'], {
    cwd: MERCHANT_DIR,
  });
  if (!(await waitHttp(MERCHANT_URL))) { console.error('merchant preview 未就绪'); process.exit(2); }
  note(true, 'merchant preview 就绪（生产 dist）', MERCHANT_URL);

  /* ---- ⑤ CDP 浏览器走测（店长登录） ---- */
  const profile = join(tmpdir(), `pd85-dayclose-${Date.now()}`);
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
    body: JSON.stringify({ userId: '${mgr.id}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店长·敏慧走测人设）', `HTTP ${loginStatus}`);

  /* ⑥A R18-01：点「日结」→ 独立确认 modal（遮罩＋确认/取消成对、PD-85 内联挂载可检） */
  await cdp.goto(`${MERCHANT_URL}/cashier/close`);
  await cdp.waitFor(`document.querySelector('[data-testid="dayclose-form"]') && document.querySelector('[data-testid="dayclose-actual-input"]')`);
  await sleep(1200);
  await cdp.eval(FILL_ZERO_JS);
  await sleep(300);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
  await sleep(700);
  const modalView = await cdp.eval(MODAL_VIEW_JS);
  note(
    modalView.dialog && modalView.roleDialog && modalView.overlay && modalView.inlineInRoot
      && modalView.notPortalToBody && modalView.notInline && modalView.cancelBtn && modalView.okBtn,
    'R18-01：点「日结」出独立确认 modal（遮罩＋确认/取消成对；PD-85 #root 内联可检、非 portal 直连 body、非页内闸）',
    JSON.stringify(modalView),
  );
  await cdp.shot(join(OUT_DIR, 'shots', '01-dayclose-confirm-modal.png'));

  /* ⑥A-1 Esc 中止=零提交＋零成功 toast（server listDayCloses 仍 0 单反证，禁假 CLEARED） */
  await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  await sleep(500);
  const escAbort = await cdp.eval(`!!document.querySelector('[data-testid="dayclose-confirm-dialog"]')`);
  const escToast = await cdp.eval(SUCCESS_TOAST_JS);
  const afterEsc = await trpcQueryRaw(mgrCookie, 'cashier.listDayCloses', { limit: 50 });
  const escCount = (afterEsc.body?.[0]?.result?.data?.json ?? []).length;
  note(!escAbort && escCount === 0 && !escToast.clearedLike,
    'R18-01：Esc 中止——modal 收、零真提交、零假 CLEARED toast（server 0 单）',
    `dialog=${escAbort} closes=${escCount} clearedToast=${escToast.clearedLike}`);
  await cdp.shot(join(OUT_DIR, 'shots', '02-dayclose-esc-abort.png'));

  /* ⑥A-2 点遮罩中止=零提交 */
  await cdp.eval(FILL_ZERO_JS);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-overlay"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await sleep(500);
  const overlayAbort = await cdp.eval(`!!document.querySelector('[data-testid="dayclose-confirm-dialog"]')`);
  const overlayToast = await cdp.eval(SUCCESS_TOAST_JS);
  const afterOverlay = await trpcQueryRaw(mgrCookie, 'cashier.listDayCloses', { limit: 50 });
  const overlayCount = (afterOverlay.body?.[0]?.result?.data?.json ?? []).length;
  note(!overlayAbort && overlayCount === 0 && !overlayToast.clearedLike,
    'R18-01：点遮罩中止——零真提交、零假 CLEARED toast', `dialog=${overlayAbort} closes=${overlayCount}`);

  /* ⑥A-3 取消钮中止=零提交 */
  await cdp.eval(FILL_ZERO_JS);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-cancel"]')?.click()`);
  await sleep(500);
  const cancelAbort = await cdp.eval(`!!document.querySelector('[data-testid="dayclose-confirm-dialog"]')`);
  const cancelToast = await cdp.eval(SUCCESS_TOAST_JS);
  const afterCancel = await trpcQueryRaw(mgrCookie, 'cashier.listDayCloses', { limit: 50 });
  const cancelCount = (afterCancel.body?.[0]?.result?.data?.json ?? []).length;
  note(!cancelAbort && cancelCount === 0 && !cancelToast.clearedLike,
    'R18-01：取消钮中止——零真提交、零假 CLEARED toast', `dialog=${cancelAbort} closes=${cancelCount}`);
  await cdp.shot(join(OUT_DIR, 'shots', '03-dayclose-cancel-abort.png'));

  /* ⑥A-4 确认才真冻结（真返回驱动 toast；¥0 诚实口径 · 涉钱 mock · 临时库） */
  await cdp.eval(FILL_ZERO_JS);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-ok"]')?.click()`);
  const confirmed = await cdp.waitFor(`document.querySelector('[data-testid^="dayclose-row-"]') && !document.querySelector('[data-testid="dayclose-confirm-dialog"]')`, 20000);
  const okToast = await cdp.eval(SUCCESS_TOAST_JS);
  const afterOk = await trpcQueryRaw(mgrCookie, 'cashier.listDayCloses', { limit: 50 });
  const okRows = (afterOk.body?.[0]?.result?.data?.json ?? []);
  note(confirmed && okRows.length === 1 && okRows[0].status === 'frozen' && okToast.clearedLike,
    'R18-01：确认「确认日结并冻结」才真冻结（modal 收＋frozen 单×1＋成功 toast 由真返回驱动）',
    `rows=${okRows.length} status=${okRows[0]?.status ?? '—'} clearedToast=${okToast.clearedLike}`);
  await cdp.shot(join(OUT_DIR, 'shots', '04-dayclose-confirmed.png'));

  /* ---- 收口 ---- */
  cdp.close();
  writeFileSync(join(OUT_DIR, 'api-check.json'), JSON.stringify({
    window: 'PD-85-merchant-dayclose-modal',
    base: { server: API_BASE, merchant: MERCHANT_URL, db: DB_URL, serve: 'vite preview（生产 dist，VITE_API_BASE 注入临时 server）' },
    role: { manager: { id: mgr.id, nickname: mgrName } },
    results,
  }, null, 2));
  console.log(`\n[pd85] ${failures === 0 ? '全绿' : `失败 ${failures} 项`} · 证据 ${OUT_DIR}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 2; })
  .finally(() => {
    killAll();
    if (!KEEP) { try { rmSync(RUNTIME_DIR, { recursive: true, force: true }); } catch {} }
    setTimeout(() => process.exit(process.exitCode ?? 0), 800);
  });
