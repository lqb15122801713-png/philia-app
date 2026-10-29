#!/usr/bin/env node
/**
 * PD-111 日结三撤原生 close＋撤后表单＋同页重开探针。
 *
 * server 静态托管同源链与现网 :7202 同工艺（SERVE_STATIC=1，Host m.* → merchant dist），
 * 不是 Vite preview。临时库测完即删；敏慧店长仅存在于该临时库；全程无 FILL，
 * 不点「确认日结并冻结」，fetch 计数与日结单数共同证明零真提交。
 *
 * 每路必须 acted=true、原生 close×1、dialog 关闭、表单仍可编辑且不是跨日交接班浅面，
 * 随后同页立即重开成功。候选包文件名另与现网对照 index-CQ1-atZf.js 比较；产品码改动
 * 由 git diff 单独证明，不从 hash 反推。
 *
 * 用法：node --experimental-websocket evidence/pd111-merchant-daily-close-revert/abort-native-close-probe.mjs
 * 环境变量：PD89_EQ_PORT / PD89_EQ_CDP / WT / OUT_JSON / SHOTS_DIR / KEEP_ENV=1
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const WT = process.env.WT ?? join(HERE, '..', '..');
const SERVER_DIR = join(WT, 'server');
const PORT = Number(process.env.PD89_EQ_PORT ?? 7489);
const CDP_PORT = Number(process.env.PD89_EQ_CDP ?? 9489);
const BASE = `http://m.localhost:${PORT}`;
const OUT_JSON = process.env.OUT_JSON ?? join(WT, 'evidence', 'pd111-merchant-daily-close-revert', 'probe.json');
const SHOTS_DIR = process.env.SHOTS_DIR ?? join(WT, 'evidence', 'pd111-merchant-daily-close-revert', 'shots');
const KEEP = process.env.KEEP_ENV === '1';
const RUNTIME_DIR = join(WT, '.runtime', `pd111-${Date.now()}`);
const DB_URL = `file:${join(RUNTIME_DIR, 'philia.db').replaceAll('\\', '/')}`;
const OLD_TIP_BUNDLE = 'index-CQ1-atZf.js';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

let failures = 0;
const results = [];
const abortEvidence = [];
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  results.push({ ok, name, detail });
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
function spawnLong(cmd, args, opts) { const p = spawn(cmd, args, { stdio: 'ignore', shell: false, ...opts }); children.push(p); return p; }
function killAll() { for (const p of children) { try { p.kill(); } catch {} } }
function runStep(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) throw new Error(`步骤失败(${r.status})：${cmd} ${args.join(' ')}`);
}
const serverReq = createRequire(join(SERVER_DIR, 'package.json'));
const tsxCli = join(SERVER_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

async function waitHttp(url, timeoutMs = 90000) {
  const t0 = Date.now();
  for (;;) {
    try { const r = await fetch(url); if (r.ok) return true; } catch {}
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(500);
  }
}

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.paused = []; }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
      else if (msg.method === 'Fetch.requestPaused') { this.paused.push(msg.params); }
    };
    await new Promise((r) => { this.ws.onopen = r; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
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
  async goto(url, waitMs = 4200) { await this.send('Page.navigate', { url }); await sleep(waitMs); }
  async waitFor(expression, timeoutMs = 90000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(150);
    }
  }
  async shot(outfile) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  async escTrusted() {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  close() { try { this.ws?.close(); } catch {} }
}

const READ_ACTUAL_JS = `(() => {
  const inp = document.querySelector('[data-testid="dayclose-actual-input"]');
  const btn = document.querySelector('[data-testid="dayclose-submit"]');
  const bookEl = document.querySelector('[data-testid="dayclose-book"]');
  return { actualValue: inp?.value ?? null, submitDisabled: btn ? btn.disabled : null, bookText: bookEl?.textContent ?? null };
})()`;
const MODAL_VIEW_JS = `(() => {
  const root = document.getElementById('root');
  const layer = document.querySelector('[data-testid="dayclose-confirm-layer"]');
  const card = document.querySelector('[data-testid="dayclose-confirm-dialog"]');
  const docDialogs = [...document.querySelectorAll('[role="dialog"]')];
  const rootDialogs = root ? [...root.querySelectorAll('[role="dialog"]')] : [];
  const nativeOpen = [...document.querySelectorAll('dialog[open]')];
  if (!layer || !card) return { dialog: false, dialogCount: docDialogs.length, rootDialogCount: rootDialogs.length, nativeOpenCount: nativeOpen.length };
  return {
    dialog: true, layerTag: layer.tagName,
    layerIsNativeDialog: layer instanceof HTMLDialogElement,
    nativeOpenCount: nativeOpen.length,
    layerMatchesOpen: !!(layer instanceof HTMLDialogElement && layer.open),
    roleDialog: card.getAttribute('role') === 'dialog' && card.getAttribute('aria-modal') === 'true',
    dialogCount: docDialogs.length, rootDialogCount: rootDialogs.length,
    overlay: !!layer.querySelector('[data-testid="dayclose-confirm-overlay"]'),
    inlineInRoot: !!(root && root.contains(card)),
    notPortalToBody: layer.parentElement !== document.body,
    cancelBtn: !!document.querySelector('[data-testid="dayclose-confirm-cancel"]'),
    okBtn: !!document.querySelector('[data-testid="dayclose-confirm-ok"]'),
    actual: document.querySelector('[data-testid="dayclose-confirm-actual"]')?.textContent ?? '',
  };
})()`;
const DIALOG_OPEN_JS = `!!document.querySelector('[data-testid="dayclose-confirm-dialog"]')`;
const CLICK_SUBMIT_JS = `document.querySelector('[data-testid="dayclose-submit"]')?.click()`;
const SUCCESS_TOAST_JS = `[...document.querySelectorAll('[data-sonner-toast]')].map((x) => x.textContent ?? '').filter((s) => s.includes('日结单已冻结')).length`;
const LIST_CLOSES_JS = `fetch('/trpc/cashier.listDayCloses?batch=1&input=' + encodeURIComponent(JSON.stringify({ '0': { json: { limit: 50 } } })), { credentials: 'include' })
  .then((r) => r.json()).then((b) => (b?.[0]?.result?.data?.json ?? []).length).catch(() => -1)`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(RUNTIME_DIR, { recursive: true });

  console.log(`[pd89-eq] 临时库 ${DB_URL}`);
  const dbEnv = { ...process.env, PHILIA_DB_URL: DB_URL };
  runStep(process.execPath, [tsxCli, 'src/db/migrate.ts'], { cwd: SERVER_DIR, env: dbEnv });
  runStep(process.execPath, [tsxCli, 'src/db/seed.ts'], { cwd: SERVER_DIR, env: dbEnv });

  const libsql = serverReq('@libsql/client');
  const db = libsql.createClient({ url: DB_URL });
  const store = (await db.execute('SELECT id FROM stores ORDER BY created_at LIMIT 1')).rows[0];
  const MGR_ID = '01M9PD89MGR000000000000000';
  await db.execute({ sql: `INSERT INTO users (id, kimi_id, nickname, phone, created_at, updated_at) VALUES (?, 'seed_kimi_pd89_mgr', '敏慧店长', '13900000089', unixepoch(), unixepoch())`, args: [MGR_ID] });
  await db.execute({ sql: `INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES ('01M9PD89MGRROLE0000000000', ?, 'merchant_manager', unixepoch(), unixepoch())`, args: [MGR_ID] });
  await db.execute({ sql: `INSERT INTO staff (id, store_id, user_id, name, role, skills, schedule, status, grade, created_at, updated_at) VALUES ('01M9PD89MGRSTAFF000000000', ?, ?, '敏慧店长', 'frontdesk', '["wash"]', '{}', 'active', 'P1', unixepoch(), unixepoch())`, args: [store.id, MGR_ID] });
  note(true, '夹具：店长账号就绪（merchant_manager · 临时库随库自删）');

  /* server 静态托管同源链（SERVE_STATIC=1 · STATIC_ROOT=WT/apps＝容器 /app/apps 同位） */
  spawnLong(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env, PHILIA_DB_URL: DB_URL, PORT: String(PORT),
      SERVE_STATIC: '1', STATIC_ROOT: join(WT, 'apps'),
    },
  });
  if (!(await waitHttp(`http://localhost:${PORT}/api/health`))) { console.error('server 未就绪'); process.exit(2); }
  note(true, 'server 就绪（SERVE_STATIC=1 · Host 分发＝现网同链）', `:${PORT}`);

  /* 钉包：实读 js 文件名＋sha256；产品码改动另由 git diff 证明。 */
  const idx = readFileSync(join(WT, 'apps', 'merchant', 'dist', 'index.html'), 'utf8');
  const jsName = /\/assets\/(index-[^"]+\.js)/.exec(idx)?.[1] ?? null;
  const jsBuf = jsName ? readFileSync(join(WT, 'apps', 'merchant', 'dist', 'assets', jsName)) : null;
  const jsSha = jsBuf ? createHash('sha256').update(jsBuf).digest('hex') : null;
  note(!!jsName && jsName !== OLD_TIP_BUNDLE, '商家构建包文件名 ≠ 现网对照 index-CQ1-atZf.js',
    `js=${jsName} len=${jsBuf?.length ?? 0} sha256=${jsSha?.slice(0, 12)}…${jsSha?.slice(-8)}`);
  const distHasGate = jsBuf ? jsBuf.includes('dayclose-form-loading') && jsBuf.includes('dayclose-submit') && jsBuf.includes('dayclose-confirm-layer') : false;
  note(distHasGate, '实读包内含 PD-89 就绪闸＋日结开闸 testid（dayclose-form-loading／dayclose-submit／dayclose-confirm-layer）');

  const profile = join(RUNTIME_DIR, 'browser-profile');
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--headless=new', '--window-size=1280,800',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ];
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  children.push(browser);
  let pageTarget = null;
  for (let i = 0; i < 40 && !pageTarget; i++) {
    try { const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' }); pageTarget = await res.json(); } catch { await sleep(400); }
  }
  if (!pageTarget?.webSocketDebuggerUrl) { console.error('CDP 页签创建失败'); process.exit(2); }
  const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  await cdp.goto(`${BASE}/dev-login`, 5200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const bundleInDom = await cdp.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? 'NONE'`);
  note(bundleInDom.endsWith(jsName ?? 'NONE'), '浏览器实载 js＝钉包一致（m.localhost 同源链）', bundleInDom);
  const loginStatus = await cdp.eval(`fetch('/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${MGR_ID}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店长·敏慧走测人设）', `HTTP ${loginStatus}`);

  /* ①未就绪不得假开闸：Fetch 拦阻 todayTenderStats 钉死加载窗口 */
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*todayTenderStats*', requestStage: 'Request' }] });
  await cdp.goto(`${BASE}/cashier/close`, 800);
  const loadingSeen = await cdp.waitFor(`document.querySelector('[data-testid="dayclose-form-loading"]')`, 30000);
  const gateState = await cdp.eval(`(() => {
    const btn = document.querySelector('[data-testid="dayclose-submit"]');
    if (btn) btn.click();
    return {
      loadingSkeleton: !!document.querySelector('[data-testid="dayclose-form-loading"]'),
      formMounted: !!document.querySelector('[data-testid="dayclose-form"]'),
      submitBtnCount: document.querySelectorAll('[data-testid="dayclose-submit"]').length,
    };
  })()`);
  await sleep(400);
  const heldProbe = await cdp.eval(MODAL_VIEW_JS);
  note(loadingSeen && gateState.loadingSkeleton && !gateState.formMounted && gateState.submitBtnCount === 0
    && heldProbe.dialogCount === 0 && heldProbe.nativeOpenCount === 0,
    '①未就绪不得假开闸：账面请求被拦阻 → 骨架在场＋dayclose-submit 不挂 → 点击无处落 → dialogCount=0 零副作用',
    `gate=${JSON.stringify(gateState)} probe=${JSON.stringify(heldProbe)}`);
  await cdp.shot(join(SHOTS_DIR, 'eq-01-loading-gate-no-submit.png'));

  /* 放行账面请求 → 表单首绘即就绪 */
  for (const p of cdp.paused.splice(0)) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); }
  await cdp.send('Fetch.disable');
  const formReady = await cdp.waitFor(`document.querySelector('[data-testid="dayclose-form"]') && document.querySelector('[data-testid="dayclose-submit"]')`, 30000);
  const pre = await cdp.eval(READ_ACTUAL_JS);
  note(formReady && pre.actualValue === '0' && pre.submitDisabled === false,
    '表单首绘即就绪：实点默认同步账面（¥0→字面 "0"）＋提交钮 enabled（actualInput=null 未手输）',
    `actualValue=${JSON.stringify(pre.actualValue)} book=${pre.bookText} disabled=${pre.submitDisabled}`);
  await cdp.shot(join(SHOTS_DIR, 'eq-02-ready-first-paint.png'));

  /* dayClose 真提交闸（计数器；全程禁点确认） */
  await cdp.eval(`window.__pd89Calls = 0;
    window.__pd89Fetch = window.fetch;
    window.fetch = (...a) => {
      try { if (String(a[0]).includes('cashier.dayClose') && !String(a[0]).includes('dayClosePreview')) window.__pd89Calls += 1; } catch {}
      return window.__pd89Fetch(...a);
    }; true`);
  const closesBefore = await cdp.eval(LIST_CLOSES_JS);

  /* ②无 FILL 故意短等（150ms）直点 → 真 dialog */
  await sleep(150);
  await cdp.eval(CLICK_SUBMIT_JS);
  await sleep(350);
  const modalView = await cdp.eval(MODAL_VIEW_JS);
  note(
    modalView.dialog && modalView.layerIsNativeDialog && modalView.layerMatchesOpen
      && modalView.nativeOpenCount >= 1 && modalView.roleDialog
      && modalView.dialogCount >= 1 && modalView.rootDialogCount >= 1
      && modalView.overlay && modalView.inlineInRoot && modalView.notPortalToBody
      && modalView.cancelBtn && modalView.okBtn,
    '②无 FILL 故意短等直点 dayclose-submit → 真 dialog（dialog[open]＋[role=dialog] 成对 · dialogCount≥1 双域）',
    JSON.stringify(modalView),
  );
  note((await cdp.eval(`window.__pd89Calls`)) === 0, '拦：开闸未确认 dayClose 调用=0');
  await cdp.shot(join(SHOTS_DIR, 'eq-03-dialog-open-nofill.png'));

  /* PD-111：三撤必须先触发原生 close，再由 onClose 复位 pendingDayClose。 */
  const abortCycle = async (label, doAbort, shotTag) => {
    await cdp.eval(`window.__pd111CloseEvents = 0;
      document.querySelector('[data-testid="dayclose-confirm-layer"]')?.addEventListener('close', () => {
        window.__pd111CloseEvents += 1;
      }, { once: true }); true`);
    const acted = (await doAbort()) === true;
    await sleep(450);
    const closedView = await cdp.eval(MODAL_VIEW_JS);
    const nativeCloseEvents = await cdp.eval(`window.__pd111CloseEvents`);
    const calls = await cdp.eval(`window.__pd89Calls`);
    const closes = await cdp.eval(LIST_CLOSES_JS);
    const toasts = await cdp.eval(SUCCESS_TOAST_JS);
    const afterForm = await cdp.eval(`(() => {
      const form = document.querySelector('[data-testid="dayclose-form"]');
      const btn = document.querySelector('[data-testid="dayclose-submit"]');
      const input = document.querySelector('[data-testid="dayclose-actual-input"]');
      const text = document.body?.innerText ?? '';
      return {
        formMounted: !!form,
        submitDisabled: btn ? btn.disabled : null,
        actualValue: input?.value ?? null,
        readyShallowAnchor: text.includes('店长确认交接班') || /已跨\\s*\\d+\\s*日未交班/.test(text),
      };
    })()`);
    const actedClosed = !closedView.dialog && closedView.dialogCount === 0 && closedView.nativeOpenCount === 0;
    const formEditable = afterForm.formMounted && afterForm.submitDisabled === false
      && afterForm.actualValue !== null && afterForm.actualValue !== '' && !afterForm.readyShallowAnchor;
    note(acted && actedClosed && nativeCloseEvents === 1 && formEditable && calls === 0 && closes === closesBefore && toasts === 0,
      `撤·${label}：acted＋原生 close×1＋closed＋可编辑表单（零提交＋零假 toast＋closes 不变）`,
      `acted=${acted} closed=${actedClosed} nativeClose=${nativeCloseEvents} form=${JSON.stringify(afterForm)} calls=${calls} closes=${closes}(基线${closesBefore}) toast=${toasts}`);
    await cdp.shot(join(SHOTS_DIR, `eq-${shotTag}-abort-${label}.png`));
    /* 同页立即再点（无 FILL 无等待——产品态保证重开） */
    await cdp.eval(CLICK_SUBMIT_JS);
    await sleep(350);
    const reopen = await cdp.eval(MODAL_VIEW_JS);
    const reopened = reopen.dialog && reopen.dialogCount >= 1 && reopen.nativeOpenCount >= 1
      && reopen.layerMatchesOpen && reopen.cancelBtn && reopen.okBtn;
    note(reopened, `撤后同页立即重开（${label} 后）：dialogCount≥1 无 reopen-fail`,
      `dialogCount=${reopen.dialogCount} nativeOpen=${reopen.nativeOpenCount}`);
    await cdp.shot(join(SHOTS_DIR, `eq-${shotTag}-reopen-after-${label}.png`));
    abortEvidence.push({
      path: label, acted, closed: actedClosed, nativeCloseEvents, pendingDayCloseNull: actedClosed,
      realDayCloseSubmit: calls > 0, formEditable, afterForm, reopened,
      reopenDialogCount: reopen.dialogCount, reopenNativeOpenCount: reopen.nativeOpenCount,
    });
    return acted && actedClosed && nativeCloseEvents === 1 && formEditable && reopened;
  };

  const r1 = await abortCycle('cancel', () => cdp.eval(`(() => {
    const btn = document.querySelector('[data-testid="dayclose-confirm-cancel"]');
    if (!btn) return false;
    btn.click();
    return true;
  })()`), '04');
  const r2 = await abortCycle('esc-trusted', async () => { await cdp.escTrusted(); return true; }, '05');
  const r3 = await abortCycle('esc-synthetic', () => cdp.eval(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    return true;
  })()`), '06');
  const r4 = await abortCycle('overlay', async () => {
    const exists = await cdp.eval(`!!document.querySelector('[data-testid="dayclose-confirm-overlay"]')`);
    if (!exists) return false;
    await cdp.clickAt(12, 12);
    return true;
  }, '07');
  note(r1 && r2 && r3 && r4, '③④四路撤＋撤后即开全通（Esc 双路保持；无 REOPEN_FAIL_before_esc）',
    `cancel=${r1} escTrusted=${r2} escSynthetic=${r3} overlay=${r4}`);

  /* 末段仍零真日结 */
  const callsEnd = await cdp.eval(`window.__pd89Calls`);
  const closesEnd = await cdp.eval(LIST_CLOSES_JS);
  note(callsEnd === 0 && closesEnd === closesBefore,
    '零真日结：全程 dayClose 调用=0＋closes 计数不变（realDayCloseSubmit=false；涉钱 mock）',
    `calls=${callsEnd} closes=${closesEnd}(基线${closesBefore})`);

  cdp.close();
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify({
    window: 'PD-111-merchant-daily-close-revert',
    leg: '等价现网（server 静态托管同源链 · SERVE_STATIC=1 · Host m.localhost→merchant dist · 非 vite preview）',
    base: BASE, db: DB_URL, role: 'merchant_manager(敏慧店长 · 临时库夹具)',
    bundle: {
      js: jsName, len: jsBuf?.length ?? 0, sha256: jsSha,
      differsFromLiveBundleCQ1atZf: jsName !== OLD_TIP_BUNDLE,
      isTipBundle: false, note: '候选包；未合未部，不冒充现网 tip 包',
    },
    noFill: true, shortWaitMs: 150, realDayCloseSubmit: callsEnd > 0,
    closesBefore, closesAfter: closesEnd, abortEvidence,
    discipline: '临时库与浏览器档测完即删；涉钱 mock（不点确认）；Fetch 拦阻仅钉死未就绪窗口',
    results,
  }, null, 2));
  console.log(`\n[pd111] ${failures === 0 ? '全绿' : `失败 ${failures} 项`} · ${OUT_JSON}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 2; })
  .finally(() => {
    killAll();
    if (!KEEP) { try { rmSync(RUNTIME_DIR, { recursive: true, force: true }); } catch {} }
    setTimeout(() => process.exit(process.exitCode ?? 0), 800);
  });
