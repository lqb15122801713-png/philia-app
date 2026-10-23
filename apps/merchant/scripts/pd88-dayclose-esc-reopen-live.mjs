#!/usr/bin/env node
/**
 * PD-88 商家端日结 Esc 成对关闸＋abort 后重开闸现网 HIT。
 *
 * - 默认只走 :7202 现网商家包，不以 localhost preview 充当 PASS。
 * - 无 FILL；首开与每次 abort 后同页重开（不 reload）都等提交钮 enabled，再可信点击 testid。
 * - 取消／可信 Esc／合成 Escape／遮罩均须 acted=true、closed=true、dialogCount≥1 重开；
 *   任一开闸失败均记 no-modal-reopen-fail，Esc 未按时 escPressed=false，禁假绿。
 * - 不点确认；fetch 安全闸阻断一切 cashier.dayClose 写请求，另以 CDP Network.requestWillBeSent
 *   跨页面观察真实网络请求，并以日结单计数复核零写。
 * - 口令只经 PD88_GATE_CODE 环境变量传入，不写卷宗；全新浏览器档，测完删除。
 *
 * 用法：
 *   PD88_GATE_CODE=... node --experimental-websocket apps/merchant/scripts/pd88-dayclose-esc-reopen-live.mjs
 * 可选：PD88_BASE_URL / PD88_MGR_ID / PD88_TIP_BUNDLE / PD88_CDP_PORT /
 *      PD88_OUT_JSON / PD88_SHOTS_DIR / HEADFUL=1。
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(SCRIPT_FILE), '..', '..', '..');
const BASE = (process.env.PD88_BASE_URL ?? 'http://120.53.102.45:7202').replace(/\/$/, '');
const GATE = process.env.PD88_GATE_CODE;
const MGR_ID = process.env.PD88_MGR_ID ?? '01M2SEEDMGR000000000000001';
const TIP_BUNDLE = process.env.PD88_TIP_BUNDLE ?? 'index-CN4nyHT8.js';
const CDP_PORT = Number(process.env.PD88_CDP_PORT ?? 9588);
const OUT_DIR = join(REPO_ROOT, 'evidence', 'pd88-merchant-dayclose-esc-reopen');
const OUT_JSON = process.env.PD88_OUT_JSON ?? join(OUT_DIR, 'live-probe.json');
const SHOTS_DIR = process.env.PD88_SHOTS_DIR ?? join(OUT_DIR, 'shots-live');
const RUN_STARTED_AT = new Date().toISOString();
const SCRIPT_SHA256 = createHash('sha256').update(readFileSync(SCRIPT_FILE)).digest('hex');
const HEAD_SHA = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout?.trim() ?? 'UNKNOWN';
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const results = [];
const abortResults = {};
const realDayCloseRequests = [];
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  results.push({ ok, name, detail });
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Network.requestWillBeSent') {
        const url = String(msg.params?.request?.url ?? '');
        if (url.includes('cashier.dayClose') && !url.includes('dayClosePreview')) {
          realDayCloseRequests.push({ method: msg.params.request.method, observedAt: new Date().toISOString() });
        }
      }
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      }
    };
    await new Promise((resolve) => { this.ws.onopen = resolve; });
    await this.send('Network.enable');
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, (msg) => msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result?.exceptionDetails) {
      throw new Error(`eval 失败：${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`);
    }
    return result?.result?.value;
  }
  async goto(url, waitMs = 1200) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }
  async waitFor(expression, timeoutMs = 30000) {
    const started = Date.now();
    for (;;) {
      if (await this.eval(`!!(${expression})`)) return true;
      if (Date.now() - started > timeoutMs) return false;
      await sleep(100);
    }
  }
  async clickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async clickSelector(selector) {
    const point = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled };
    })()`);
    if (!point) return { acted: false, disabled: null };
    await this.clickAt(point.x, point.y);
    return { acted: true, disabled: point.disabled };
  }
  async escTrusted() {
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  }
  async shot(filename) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    const outfile = join(SHOTS_DIR, filename);
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
  }
  close() { try { this.ws?.close(); } catch {} }
}

const FORM_READY_JS = `document.querySelector('[data-testid="dayclose-form"]') && document.querySelector('[data-testid="dayclose-submit"]')`;
const CAN_SUBMIT_JS = `(() => {
  const btn = document.querySelector('[data-testid="dayclose-submit"]');
  const input = document.querySelector('[data-testid="dayclose-actual-input"]');
  return btn && input && !btn.disabled && input.value !== '';
})()`;
const READ_ACTUAL_JS = `(() => {
  const btn = document.querySelector('[data-testid="dayclose-submit"]');
  const input = document.querySelector('[data-testid="dayclose-actual-input"]');
  return {
    actualValue: input?.value ?? null,
    submitDisabled: btn?.disabled ?? null,
    bookText: document.querySelector('[data-testid="dayclose-book"]')?.textContent ?? null,
  };
})()`;
const MODAL_VIEW_JS = `(() => {
  const root = document.getElementById('root');
  const layer = document.querySelector('dialog[data-testid="dayclose-confirm-layer"]');
  const card = document.querySelector('[data-testid="dayclose-confirm-dialog"][role="dialog"]');
  const docDialogs = [...document.querySelectorAll('[role="dialog"]')];
  const rootDialogs = root ? [...root.querySelectorAll('[role="dialog"]')] : [];
  return {
    dialogCount: docDialogs.length,
    rootDialogCount: rootDialogs.length,
    nativeOpenCount: document.querySelectorAll('dialog[open]').length,
    hasConfirmLayer: !!layer,
    layerOpen: !!(layer && layer.open),
    hasModalPair: !!(layer && layer.open && card),
    hasCancel: !!document.querySelector('[data-testid="dayclose-confirm-cancel"]'),
    hasConfirm: !!document.querySelector('[data-testid="dayclose-confirm-ok"]'),
    pendingDayCloseNull: !layer,
  };
})()`;
const LIST_CLOSES_JS = `fetch('/trpc/cashier.listDayCloses?batch=1&input=' + encodeURIComponent(JSON.stringify({ '0': { json: { limit: 50 } } })), { credentials: 'include' })
  .then((r) => r.json()).then((b) => (b?.[0]?.result?.data?.json ?? []).length).catch(() => -1)`;
const SUCCESS_TOAST_JS = `[...document.querySelectorAll('[data-sonner-toast]')].some((x) => (x.textContent ?? '').includes('日结单已冻结'))`;

async function main() {
  rmSync(OUT_JSON, { force: true });
  rmSync(SHOTS_DIR, { recursive: true, force: true });
  mkdirSync(SHOTS_DIR, { recursive: true });
  if (!BROWSER) throw new Error('未探测到 Edge/Chrome');
  if (!GATE) throw new Error('缺少 PD88_GATE_CODE（口令不进卷宗）');
  const portOwner = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`).catch(() => null);
  if (portOwner?.ok) throw new Error(`CDP 端口 ${CDP_PORT} 已被占用，拒绝控制其他浏览器`);
  const profile = join(tmpdir(), `pd88-live-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--window-size=1280,800',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  let cdp;
  const cleanupErrors = [];
  let cleaning = false;
  const cleanup = async () => {
    if (cleaning) return;
    cleaning = true;
    cdp?.close();
    if (process.platform === 'win32' && browser.pid) {
      const stopped = spawnSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
      if (stopped.error) cleanupErrors.push(stopped.error.message);
      else if (stopped.status !== 0 && browser.exitCode === null && browser.signalCode === null) {
        cleanupErrors.push(`taskkill exit ${stopped.status}`);
      }
    } else {
      browser.kill();
    }
    await sleep(700);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error.message : String(error));
    }
    if (existsSync(OUT_JSON)) {
      try {
        const evidence = JSON.parse(readFileSync(OUT_JSON, 'utf8'));
        evidence.cleanup = { profileRemoved: !existsSync(profile), errors: [...cleanupErrors] };
        writeFileSync(OUT_JSON, JSON.stringify(evidence, null, 2));
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (cleanupErrors.length > 0) {
      console.error('清理失败', cleanupErrors);
      process.exitCode = 2;
    }
  };
  const onInterrupt = () => { void cleanup().finally(() => process.exit(130)); };
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);
  try {
    let target;
    for (let i = 0; i < 50 && !target; i += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
        target = await response.json();
      } catch { await sleep(200); }
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('CDP 页签创建失败');
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const original = window.fetch;
        window.__pd88BlockedDayCloseCalls = 0;
        window.fetch = (...args) => {
          const url = String(args[0]?.url ?? args[0]);
          if (url.includes('cashier.dayClose') && !url.includes('dayClosePreview')) {
            window.__pd88BlockedDayCloseCalls += 1;
            return Promise.reject(new Error('PD88_BLOCKED_REAL_DAYCLOSE'));
          }
          return original(...args);
        };
      })();`,
    });

    await cdp.goto(`${BASE}/dev-login`, 2500);
    const bundleUrl = await cdp.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? ''`);
    const jsName = bundleUrl.split('/assets/')[1] ?? bundleUrl;
    const jsResponse = await fetch(bundleUrl);
    const jsBody = Buffer.from(await jsResponse.arrayBuffer());
    const jsSha256 = createHash('sha256').update(jsBody).digest('hex');
    note(jsName === TIP_BUNDLE && jsResponse.ok, '现网商家包与指定 tip 对齐', `${jsName} len=${jsBody.length} sha256=${jsSha256}`);

    const loginStatus = await cdp.eval(`fetch('/api/auth/dev-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: ${JSON.stringify(MGR_ID)}, code: ${JSON.stringify(GATE)} }),
      credentials: 'include',
    }).then((r) => r.status).catch(() => 0)`);
    note(loginStatus === 200, '敏慧店长人设 dev-login（merchant_manager）', `HTTP ${loginStatus}`);
    if (loginStatus !== 200) throw new Error('登录失败，停止走测');

    const openDayCloseGate = async (label, waitReady) => {
      if (waitReady) await cdp.waitFor(CAN_SUBMIT_JS, 30000);
      const pre = await cdp.eval(READ_ACTUAL_JS);
      const click = await cdp.clickSelector('[data-testid="dayclose-submit"]');
      await cdp.waitFor(`document.querySelector('dialog[open][data-testid="dayclose-confirm-layer"]')`, 1500);
      const view = await cdp.eval(MODAL_VIEW_JS);
      const opened = click.acted && pre.submitDisabled === false && view.layerOpen && view.hasModalPair
        && view.dialogCount >= 1 && view.rootDialogCount >= 1 && view.hasCancel && view.hasConfirm;
      note(opened, `${label}：无 FILL 点 dayclose-submit 后 dialogCount≥1`,
        JSON.stringify({ pre, click, view, detail: opened ? null : 'no-modal-reopen-fail' }));
      return { opened, pre, click, view, detail: opened ? null : 'no-modal-reopen-fail' };
    };

    const abortCurrent = async (path, gate) => {
      if (!gate.opened) {
        const skipped = { acted: false, closed: false, escPressed: false, detail: 'no-modal-reopen-fail', afterDialogCount: gate.view.dialogCount };
        note(false, `${path}：未开闸，禁止把撤销记为已执行`, JSON.stringify(skipped));
        await cdp.shot(`abort-${path}-skip.png`);
        return skipped;
      }
      let acted = false;
      let escPressed = false;
      if (path === 'cancel') {
        acted = (await cdp.clickSelector('[data-testid="dayclose-confirm-cancel"]')).acted;
      } else if (path === 'esc') {
        await cdp.escTrusted();
        acted = true;
        escPressed = true;
      } else if (path === 'escSynthetic') {
        acted = await cdp.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
        escPressed = true;
      } else if (path === 'overlay') {
        acted = await cdp.eval(`!!document.querySelector('[data-testid="dayclose-confirm-overlay"]')`);
        if (acted) await cdp.clickAt(12, 12);
      } else {
        throw new Error(`未知撤销路径 ${path}`);
      }
      const closed = await cdp.waitFor(`!document.querySelector('[data-testid="dayclose-confirm-layer"]') && !document.querySelector('[data-testid="dayclose-confirm-dialog"]')`, 5000);
      const after = await cdp.eval(MODAL_VIEW_JS);
      const blockedCalls = await cdp.eval(`window.__pd88BlockedDayCloseCalls`);
      const observedDayCloseRequests = realDayCloseRequests.length;
      const clearedToast = await cdp.eval(SUCCESS_TOAST_JS);
      const closeCount = await cdp.eval(LIST_CLOSES_JS);
      const result = {
        acted, closed, escPressed, afterDialogCount: after.dialogCount,
        pendingDayCloseNull: after.pendingDayCloseNull,
        blockedDayCloseCalls: blockedCalls, observedDayCloseRequests,
        realDayCloseSubmit: observedDayCloseRequests > 0,
        closeCount, clearedToast, detail: closed ? null : 'modal-abort-fail',
      };
      result.ok = acted && closed && after.dialogCount === 0 && after.pendingDayCloseNull
        && blockedCalls === 0 && observedDayCloseRequests === 0 && closeCount === closesBefore && !clearedToast;
      note(result.ok, `${path}：acted=true＋closed=true＋pendingDayClose=null＋零真提交`, JSON.stringify(result));
      await cdp.shot(`abort-${path}.png`);
      return result;
    };

    await cdp.goto(`${BASE}/cashier/close`, 0);
    note(await cdp.waitFor(FORM_READY_JS, 45000), '/cashier/close 表单就绪');
    note(await cdp.waitFor(CAN_SUBMIT_JS, 45000), '首开前等待账面默认同步＋canSubmit=true（无 FILL）');
    const closesBefore = await cdp.eval(LIST_CLOSES_JS);
    let gate = await openDayCloseGate('initial', true);
    await cdp.shot('01-initial-dialog-nofill.png');

    for (const path of ['cancel', 'esc', 'escSynthetic', 'overlay']) {
      const aborted = await abortCurrent(path, gate);
      abortResults[path] = aborted;
      gate = await openDayCloseGate(`${path} 后同页重开`, true);
      aborted.reopenDialogCount = gate.view.dialogCount;
      aborted.reopenOpened = gate.opened;
      aborted.reopenDetail = gate.detail;
      aborted.ok = aborted.ok && gate.opened;
      if (gate.opened) await cdp.shot(`reopen-after-${path}.png`);
    }

    if (gate.opened) {
      await cdp.clickSelector('[data-testid="dayclose-confirm-cancel"]');
      await cdp.waitFor(`!document.querySelector('[data-testid="dayclose-confirm-layer"]')`, 5000);
    }
    const closesAfter = await cdp.eval(LIST_CLOSES_JS);
    const blockedDayCloseCalls = await cdp.eval(`window.__pd88BlockedDayCloseCalls`);
    const observedDayCloseRequests = realDayCloseRequests.length;
    const realDayCloseSubmit = observedDayCloseRequests > 0;
    note(closesAfter === closesBefore && closesBefore >= 0 && !realDayCloseSubmit && blockedDayCloseCalls === 0,
      '零真日结：计数不变＋CDP 网络观察为零＋写请求安全闸零触发',
      `before=${closesBefore} after=${closesAfter} blocked=${blockedDayCloseCalls} observed=${observedDayCloseRequests}`);

    const strictPath = (path) => {
      const item = abortResults[path];
      return item.ok && item.acted && item.closed && item.reopenOpened
        && item.reopenDetail === null && item.reopenDialogCount >= 1 && !item.realDayCloseSubmit;
    };
    const abortAllThree = ['cancel', 'esc', 'overlay'].every(strictPath);
    const escBoth = ['esc', 'escSynthetic'].every((path) => strictPath(path) && abortResults[path].escPressed);
    const noReopenFail = Object.values(abortResults).every((item) => item.reopenOpened
      && item.reopenDetail === null && item.reopenDialogCount >= 1);
    note(abortAllThree && escBoth && noReopenFail, 'PD-88 总结：三撤＋Esc 双路＋每次同页重开均通，无 reopen-fail',
      JSON.stringify({ abortAllThree, escBoth, noReopenFail }));

    mkdirSync(dirname(OUT_JSON), { recursive: true });
    writeFileSync(OUT_JSON, JSON.stringify({
      window: 'PD-88-merchant-dayclose-esc-reopen',
      run: { startedAt: RUN_STARTED_AT, scriptSha256: SCRIPT_SHA256, headSha: HEAD_SHA, reopenMode: 'same-page-no-reload', networkObservation: 'CDP Network.requestWillBeSent' },
      base: BASE,
      role: { id: MGR_ID, kind: 'merchant_manager', persona: '敏慧店长' },
      bundle: { js: jsName, url: bundleUrl, len: jsBody.length, sha256: jsSha256, isTipBundle: jsName === TIP_BUNDLE, expectedTipBundle: TIP_BUNDLE },
      noFill: true,
      closesBefore,
      closesAfter,
      blockedDayCloseCalls,
      observedDayCloseRequests,
      realDayCloseRequests,
      realDayCloseSubmit,
      abortAllThree,
      escBoth,
      noReopenFail,
      abortResults,
      results,
    }, null, 2));
    const failures = results.filter((item) => !item.ok).length;
    console.log(`\n[pd88-live] ${failures === 0 ? '全绿' : `失败 ${failures} 项`} · ${OUT_JSON}`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
    await cleanup();
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
