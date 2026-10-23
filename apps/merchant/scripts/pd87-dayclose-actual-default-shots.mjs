#!/usr/bin/env node
/**
 * PD-87（商家端日结 actualInput 默认同步账面——无 FILL 可开闸）实尺截图 + 接口实证
 *
 * 口径（学 pd86-dayclose-modal-shots.mjs，自含版；差异＝全程零 FILL）：
 * - 临时库：PHILIA_DB_URL=file:.runtime/pd87-<ts>/philia.db（migrate+seed）；
 *   本窗专用临时库≠现网库（禁直改库=现网/共享库，本夹具库测完即删）。
 * - 生产保真：merchant 走 `npm run build`（tsc -b 静态闸＋vite build 生产包）
 *   ＋ vite preview 伺服 dist（非 dev server）——与现网部署同工艺；VITE_API_BASE
 *   显式注入临时 server（client.ts 留口②），preview 无代理不影射。
 * - PD-87 核心：**不跑 FILL_ZERO／无任何手填**——账面预览就绪后实点现金输入框
 *   默认同步账面元串（book=0→字面 '0'；非 0→fenToYuanInput(book)），
 *   `dayclose-submit` 默认 enabled（canSubmit=true），直点即置 pendingDayClose →
 *   真 `dialog[open][data-testid=dayclose-confirm-layer]`＋
 *   `[data-testid=dayclose-confirm-dialog][role=dialog]` 成对可检（dialogCount≥1）。
 * - 撤＝取消钮／Esc（可信 Input 键事件→原生 cancel 路）／点遮罩（可信 Input 鼠标
 *   落点 12,12）三撤成对，每撤零真提交（server listDayCloses 计数不变）＋
 *   零成功 toast（禁假 CLEARED）；另测盲交遮罩不透账面（开盲交→实点框清空不透
 *   账面数；关盲交→重新同步账面）。
 * - 确认才真冻结：末段点「确认日结并冻结」真冻结（frozen×1，真返回驱动 toast）。
 *   涉钱一律 mock（实点＝账面 ¥0 诚实口径）；零 schema（迁移预分 0128 故意空留
 *   不占文件；0122–0127＋0117/0119 空留禁撞）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。视口 1280×800。
 * - 测完自清：子进程全收、临时库目录删除（KEEP_ENV=1 保留排查）。
 *
 * 用法：node --experimental-websocket apps/merchant/scripts/pd87-dayclose-actual-default-shots.mjs
 *        （Node 20 需 --experimental-websocket；Node ≥22 直跑）
 * 环境变量：PD87_SERVER_PORT(7287) / PD87_MERCHANT_PORT(7187) / PD87_CDP_PORT(9387)
 *          / OUT_DIR / HEADFUL=1 / KEEP_ENV=1 / SKIP_BUILD=1（复用既有 dist）。
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
const SERVER_PORT = Number(process.env.PD87_SERVER_PORT ?? 7287);
const MERCHANT_PORT = Number(process.env.PD87_MERCHANT_PORT ?? 7187);
const CDP_PORT = Number(process.env.PD87_CDP_PORT ?? 9387);
const API_BASE = `http://localhost:${SERVER_PORT}`;
const MERCHANT_URL = `http://localhost:${MERCHANT_PORT}`;
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd87-merchant-dayclose-actual-default');
const KEEP = process.env.KEEP_ENV === '1';
const SKIP_BUILD = process.env.SKIP_BUILD === '1';
const RUNTIME_DIR = join(REPO_ROOT, '.runtime', `pd87-${Date.now()}`);
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

/* ---- CDP 最小幅（导航/求值/截图/可信输入） ---- */
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
  /** 可信 Esc（走浏览器原生键路——原生 <dialog> cancel 事件由此触发） */
  async escTrusted() {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  /** 可信鼠标点（走原生命中测试——顶层 dialog 的遮罩/背景 inert 由此实证） */
  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  close() { try { this.ws?.close(); } catch {} }
}

/** PD-87：零 FILL——只读实点框当前值与提交钮 enabled 态（不写值、不发 input 事件） */
const READ_ACTUAL_JS = `(() => {
  const inp = document.querySelector('[data-testid="dayclose-actual-input"]');
  const btn = document.querySelector('[data-testid="dayclose-submit"]');
  const bookEl = document.querySelector('[data-testid="dayclose-book"]');
  return {
    actualValue: inp?.value ?? null,
    placeholder: inp?.placeholder ?? null,
    submitDisabled: btn ? btn.disabled : null,
    bookText: bookEl?.textContent ?? null,
  };
})()`;

/** PD-86 同构断言件：真独立 dialog 结构（原生 dialog／role 双域计数／遮罩／成对／挂载／非页内闸） */
const MODAL_VIEW_JS = `(() => {
  const root = document.getElementById('root');
  const layer = document.querySelector('[data-testid="dayclose-confirm-layer"]');
  const card = document.querySelector('[data-testid="dayclose-confirm-dialog"]');
  if (!layer || !card) return { dialog: false };
  const docDialogs = [...document.querySelectorAll('[role="dialog"]')];
  const rootDialogs = root ? [...root.querySelectorAll('[role="dialog"]')] : [];
  const nativeOpen = [...document.querySelectorAll('dialog[open]')];
  return {
    dialog: true,
    layerTag: layer.tagName,
    layerIsNativeDialog: layer instanceof HTMLDialogElement,
    nativeOpenCount: nativeOpen.length,
    layerMatchesOpen: !!(layer instanceof HTMLDialogElement && layer.open),
    roleDialog: card.getAttribute('role') === 'dialog' && card.getAttribute('aria-modal') === 'true',
    dialogCount: docDialogs.length,
    rootDialogCount: rootDialogs.length,
    overlay: !!layer.querySelector('[data-testid="dayclose-confirm-overlay"]'),
    inlineInRoot: !!(root && root.contains(card)),
    notPortalToBody: layer.parentElement !== document.body,
    notInline: !document.querySelector('[data-testid="dayclose-form"] [data-testid="dayclose-confirm-dialog"]'),
    cancelBtn: !!document.querySelector('[data-testid="dayclose-confirm-cancel"]'),
    okBtn: !!document.querySelector('[data-testid="dayclose-confirm-ok"]'),
    bookShown: document.querySelector('[data-testid="dayclose-confirm-book"]')?.textContent ?? '',
    actual: document.querySelector('[data-testid="dayclose-confirm-actual"]')?.textContent ?? '',
    diff: document.querySelector('[data-testid="dayclose-confirm-diff"]')?.textContent ?? '',
  };
})()`;

/** 成功 toast 侦测（禁假 CLEARED：中止后须零成功 toast） */
const SUCCESS_TOAST_JS = `(() => {
  const t = [...document.querySelectorAll('[data-sonner-toast]')].map((x) => x.textContent ?? '');
  return { count: t.length, clearedLike: t.some((s) => s.includes('日结单已冻结')) };
})()`;

const DIALOG_OPEN_JS = `!!document.querySelector('[data-testid="dayclose-confirm-dialog"]')`;
/** 无 FILL 直点开闸（唯一允许的点闸动作——禁 /日结/ 宽匹配，钉死 testid） */
const CLICK_SUBMIT_JS = `document.querySelector('[data-testid="dayclose-submit"]')?.click()`;

async function listCloseCount(cookie) {
  const r = await trpcQueryRaw(cookie, 'cashier.listDayCloses', { limit: 50 });
  return (r.body?.[0]?.result?.data?.json ?? []).length;
}

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(RUNTIME_DIR, { recursive: true });

  /* ---- ① 临时库：migrate + seed ---- */
  console.log(`[pd87] 临时库 ${DB_URL}`);
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
    const MGR_ID = '01M9PD87MGR000000000000000';
    await db.execute({
      sql: `INSERT INTO users (id, kimi_id, nickname, phone, created_at, updated_at)
            VALUES (?, 'seed_kimi_pd87_mgr', '敏慧店长', '13900000087', unixepoch(), unixepoch())`,
      args: [MGR_ID],
    });
    await db.execute({
      sql: `INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
            VALUES ('01M9PD87MGRROLE0000000000', ?, 'merchant_manager', unixepoch(), unixepoch())`,
      args: [MGR_ID],
    });
    await db.execute({
      sql: `INSERT INTO staff (id, store_id, user_id, name, role, skills, schedule, status, grade, created_at, updated_at)
            VALUES ('01M9PD87MGRSTAFF000000000', ?, ?, '敏慧店长', 'frontdesk', '["wash"]', '{}', 'active', 'P1', unixepoch(), unixepoch())`,
      args: [store.id, MGR_ID],
    });
    mgr = { id: MGR_ID };
  }
  const mgrName = (await db.execute({ sql: 'SELECT nickname FROM users WHERE id = ?', args: [mgr.id] })).rows[0]?.nickname;
  note(true, '夹具：店长账号就绪（merchant_manager · 临时库）', `${mgrName ?? mgr.id}`);

  /* ---- ③ 生产保真：merchant npm run build（tsc -b 静态闸＋vite build）→ preview ---- */
  if (!SKIP_BUILD) {
    console.log('[pd87] merchant 生产构建（tsc -b && vite build）…');
    runStep('npm', ['run', 'build'], {
      cwd: MERCHANT_DIR,
      shell: true,
      env: { ...process.env, VITE_API_BASE: API_BASE },
    });
  }
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

  /* 账面现金真值（server 同源口径；入参须空对象非 null）→ 期望默认串（0→'0'；非 0→String(fen/100)=fenToYuanInput） */
  const tenderRes = await trpcQueryRaw(mgrCookie, 'store.todayTenderStats', {});
  const tenderJson = tenderRes.body?.[0]?.result?.data?.json;
  const bookFen = tenderJson && !tenderJson.restricted ? tenderJson.tender.cashFen : null;
  const expectedDefault = bookFen === null ? null : bookFen === 0 ? '0' : String(bookFen / 100);
  note(bookFen !== null, '账面预览就绪（todayTenderStats 同源）', `bookCashFen=${bookFen} → 期望实点默认串 '${expectedDefault}'`);

  /* ---- ⑤ CDP 浏览器走测（店长登录） ---- */
  const profile = join(tmpdir(), `pd87-dayclose-${Date.now()}`);
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

  /* ⑥A PD-87 核心：账面就绪→实点默认同步→**无 FILL** 直点 dayclose-submit 出真 dialog */
  await cdp.goto(`${MERCHANT_URL}/cashier/close`);
  await cdp.waitFor(`document.querySelector('[data-testid="dayclose-form"]') && document.querySelector('[data-testid="dayclose-actual-input"]')`);
  await cdp.waitFor(`document.querySelector('[data-testid="dayclose-book"]')?.textContent !== '…'`);
  await sleep(800);

  const pre = await cdp.eval(READ_ACTUAL_JS);
  note(
    pre.actualValue === expectedDefault && pre.submitDisabled === false,
    'PD-87 默认同步：账面就绪后实点框＝账面元串（零 FILL 零手填）＋提交钮 enabled（canSubmit=true）',
    `actualValue=${JSON.stringify(pre.actualValue)} 期望='${expectedDefault}' placeholder=${pre.placeholder} book=${pre.bookText} disabled=${pre.submitDisabled}`,
  );
  await cdp.shot(join(OUT_DIR, 'shots', '01-actual-default-synced.png'));

  /* 拦：未确认不得落日结——点开闸前 instrument dayClose 调用计数（fetch wrap） */
  await cdp.eval(`window.__pd87DayCloseCalls = 0;
    window.__pd87OrigFetch = window.fetch;
    window.fetch = (...a) => {
      try { if (String(a[0]).includes('cashier.dayClose') && !String(a[0]).includes('dayClosePreview')) window.__pd87DayCloseCalls += 1; } catch {}
      return window.__pd87OrigFetch(...a);
    };
    true`);

  await cdp.eval(CLICK_SUBMIT_JS);
  await sleep(700);
  const modalView = await cdp.eval(MODAL_VIEW_JS);
  note(
    modalView.dialog && modalView.layerIsNativeDialog && modalView.layerMatchesOpen
      && modalView.nativeOpenCount >= 1 && modalView.roleDialog
      && modalView.dialogCount >= 1 && modalView.rootDialogCount >= 1
      && modalView.overlay && modalView.inlineInRoot && modalView.notPortalToBody
      && modalView.notInline && modalView.cancelBtn && modalView.okBtn,
    '无 FILL 直点 [data-testid=dayclose-submit] → pendingDayClose 置位 → 真 dialog（dialog[open]=dayclose-confirm-layer＋[role=dialog]=dayclose-confirm-dialog 成对；dialogCount≥1 双域；遮罩＋确认/取消成对；非页内闸非 portal）',
    JSON.stringify(modalView),
  );
  const callsAfterOpen = await cdp.eval(`window.__pd87DayCloseCalls`);
  note(callsAfterOpen === 0, '拦：开闸未确认——dayClose 调用=0（未确认不得落日结）', `calls=${callsAfterOpen}`);
  const actualShownInModal = modalView.actual;
  await cdp.shot(join(OUT_DIR, 'shots', '02-dayclose-confirm-dialog-nofill.png'));

  /* ⑥A-1 撤①Esc 可信键路（原生 cancel 事件路）：中止＝零提交＋零成功 toast */
  await cdp.escTrusted();
  await sleep(500);
  const escAbort = await cdp.eval(DIALOG_OPEN_JS);
  const escToast = await cdp.eval(SUCCESS_TOAST_JS);
  const escCalls = await cdp.eval(`window.__pd87DayCloseCalls`);
  const escCount = await listCloseCount(mgrCookie);
  note(!escAbort && escCalls === 0 && escCount === 0 && !escToast.clearedLike,
    '撤①Esc（可信键路→原生 cancel）：modal 收、零真提交、零假 CLEARED toast（server 0 单）',
    `open=${escAbort} calls=${escCalls} closes=${escCount} clearedToast=${escToast.clearedLike}`);
  await cdp.shot(join(OUT_DIR, 'shots', '03-dayclose-esc-abort.png'));

  /* ⑥A-2 撤②点遮罩 可信鼠标路（原生命中测试落点 12,12）：中止＝零提交（无 FILL 重开） */
  await cdp.eval(CLICK_SUBMIT_JS);
  await sleep(600);
  await cdp.clickAt(12, 12);
  await sleep(500);
  const ovAbort = await cdp.eval(DIALOG_OPEN_JS);
  const ovCalls = await cdp.eval(`window.__pd87DayCloseCalls`);
  const ovCount = await listCloseCount(mgrCookie);
  note(!ovAbort && ovCalls === 0 && ovCount === 0,
    '撤②点遮罩（可信鼠标路 12,12）：modal 收、零真提交',
    `open=${ovAbort} calls=${ovCalls} closes=${ovCount}`);
  await cdp.shot(join(OUT_DIR, 'shots', '04-dayclose-overlay-abort.png'));

  /* ⑥A-3 撤③取消钮：中止＝零提交＋零成功 toast（无 FILL 重开） */
  await cdp.eval(CLICK_SUBMIT_JS);
  await sleep(600);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-cancel"]')?.click()`);
  await sleep(500);
  const cancelAbort = await cdp.eval(DIALOG_OPEN_JS);
  const cancelToast = await cdp.eval(SUCCESS_TOAST_JS);
  const cancelCalls = await cdp.eval(`window.__pd87DayCloseCalls`);
  const cancelCount = await listCloseCount(mgrCookie);
  note(!cancelAbort && cancelCalls === 0 && cancelCount === 0 && !cancelToast.clearedLike,
    '撤③取消钮：modal 收、零真提交、零假 CLEARED toast',
    `open=${cancelAbort} calls=${cancelCalls} closes=${cancelCount} clearedToast=${cancelToast.clearedLike}`);
  await cdp.shot(join(OUT_DIR, 'shots', '05-dayclose-cancel-abort.png'));

  /* ⑥B 盲交不透账面：开盲交→实点框空（不透账面数）；关盲交→重新同步账面默认 */
  await cdp.eval(`document.querySelector('[data-testid="dayclose-blind-toggle"]')?.click()`);
  await sleep(600);
  const blindOn = await cdp.eval(READ_ACTUAL_JS);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-blind-toggle"]')?.click()`);
  await sleep(600);
  const blindOff = await cdp.eval(READ_ACTUAL_JS);
  note(
    blindOn.actualValue === '' && blindOn.submitDisabled === true
      && blindOff.actualValue === expectedDefault && blindOff.submitDisabled === false,
    '盲交互斥：开盲交→实点框清空不透账面（canSubmit=false 实点先行）；关盲交→重新同步账面默认',
    `blindOn.value=${JSON.stringify(blindOn.actualValue)} disabled=${blindOn.submitDisabled}；blindOff.value=${JSON.stringify(blindOff.actualValue)} disabled=${blindOff.submitDisabled}`,
  );

  /* ⑥C 确认才真冻结（真返回驱动 toast；实点＝账面 ¥0 诚实口径 · 涉钱 mock · 临时库） */
  await cdp.eval(CLICK_SUBMIT_JS);
  await sleep(600);
  const preConfirm = await cdp.eval(MODAL_VIEW_JS);
  await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-ok"]')?.click()`);
  const confirmed = await cdp.waitFor(`document.querySelector('[data-testid^="dayclose-row-"]') && !document.querySelector('[data-testid="dayclose-confirm-dialog"]')`, 20000);
  const okToast = await cdp.eval(SUCCESS_TOAST_JS);
  const okCalls = await cdp.eval(`window.__pd87DayCloseCalls`);
  const okRows = await (async () => {
    const r = await trpcQueryRaw(mgrCookie, 'cashier.listDayCloses', { limit: 50 });
    return r.body?.[0]?.result?.data?.json ?? [];
  })();
  note(confirmed && okCalls === 1 && okRows.length === 1 && okRows[0].status === 'frozen' && okToast.clearedLike,
    '确认「确认日结并冻结」才真冻结（modal 收＋dayClose 调用=1＋frozen 单×1＋成功 toast 真返回驱动）',
    `calls=${okCalls} rows=${okRows.length} status=${okRows[0]?.status ?? '—'} clearedToast=${okToast.clearedLike}`);
  await cdp.shot(join(OUT_DIR, 'shots', '06-dayclose-confirmed.png'));

  /* ---- 收口 ---- */
  cdp.close();
  writeFileSync(join(OUT_DIR, 'api-check.json'), JSON.stringify({
    window: 'PD-87-merchant-dayclose-actual-default',
    base: { server: API_BASE, merchant: MERCHANT_URL, db: DB_URL, serve: 'vite preview（生产 dist，VITE_API_BASE 注入临时 server）' },
    role: { manager: { id: mgr.id, nickname: mgrName } },
    bookCashFen: bookFen,
    expectedDefault,
    modalActualShown: actualShownInModal,
    preConfirmModal: preConfirm,
    noFill: true,
    results,
  }, null, 2));
  console.log(`\n[pd87] ${failures === 0 ? '全绿' : `失败 ${failures} 项`} · 证据 ${OUT_DIR}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 2; })
  .finally(() => {
    killAll();
    if (!KEEP) { try { rmSync(RUNTIME_DIR, { recursive: true, force: true }); } catch {} }
    setTimeout(() => process.exit(process.exitCode ?? 0), 800);
  });
