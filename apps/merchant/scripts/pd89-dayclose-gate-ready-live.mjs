#!/usr/bin/env node
/**
 * PD-89 现网 :7202 活钉＋缺陷复现腿（只读 · 零写 · 全新浏览器档无 SW 存留）
 *
 * 目的（交付 HIT 的现网腿，与敏慧复测-R 同签名）：
 * - 钉齐现网 :7202 实读商家包 js 文件名＋sha256（预期＝合部前现网 tip 钉包
 *   index-CN4nyHT8.js，PD-88 零产品代码未换包）；
 * - **无 FILL 零手填、表单一出现即直点** [data-testid=dayclose-submit]（不等账面、
 *   不等 canSubmit——敏慧复测同步骤；附 Network 1500ms 延迟仿真钉死竞态窗口）→
 *   修前码预期：actual=''／disabled=true／点闸不置 pendingDayClose→dialogCount=0
 *   （DAYCLOSE_INLINE_GATE_NO_MODAL 现网实锤复现）；
 * - 对照段：关延迟仿真、账面就绪后再点 → 同包可出 dialog＋取消可关
 *   （证明「非错包、非 Esc 缺失」，触发差＝开闸瞬间就绪态，与根因短报②同构）。
 * - 零写纪律：全程不点「确认日结并冻结」；muts 仅 dev-login（口令门）；不输出 cookie。
 *
 * 用法：node --experimental-websocket apps/merchant/scripts/pd89-dayclose-gate-ready-live.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WT = process.env.WT ?? join(HERE, '..', '..', '..'); // apps/merchant/scripts → 仓根（WT 环境变量可覆盖）
const BASE = 'http://120.53.102.45:7202';
const GATE = 'Philia2026';
const MGR_ID = '01M2SEEDMGR000000000000001'; // 演示店长 merchant_manager（敏慧店长走测人设）
const CDP_PORT = 9589;
const LATENCY_MS = 1500; // 竞态窗口延迟仿真（钉死「表单已现、账面未齐」窗口，非修饰结论）
const SHOTS = join(WT, 'evidence', 'pd89-merchant-dayclose-gate-ready', 'shots-live');
const OUT_JSON = join(WT, 'evidence', 'pd89-merchant-dayclose-gate-ready', 'live-probe.json');
const LIVE_TIP_BUNDLE = 'index-CN4nyHT8.js';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const results = [];
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  results.push({ ok, name, detail });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  async waitFor(expression, timeoutMs = 60000) {
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
  close() { try { this.ws?.close(); } catch {} }
}

const READ_FORM_JS = `(() => {
  const inp = document.querySelector('[data-testid="dayclose-actual-input"]');
  const btn = document.querySelector('[data-testid="dayclose-submit"]');
  const bookEl = document.querySelector('[data-testid="dayclose-book"]');
  return { actualValue: inp?.value ?? null, submitDisabled: btn ? btn.disabled : null, bookText: bookEl?.textContent ?? null };
})()`;
const PROBE_DIALOG_JS = `(() => {
  const root = document.getElementById('root');
  const docDialogs = [...document.querySelectorAll('[role="dialog"]')];
  const rootDialogs = root ? [...root.querySelectorAll('[role="dialog"]')] : [];
  const nativeOpen = [...document.querySelectorAll('dialog[open]')];
  const layer = document.querySelector('[data-testid="dayclose-confirm-layer"]');
  return {
    dialogCount: docDialogs.length, rootDialogCount: rootDialogs.length,
    nativeOpenCount: nativeOpen.length,
    hasConfirmLayer: !!layer, layerOpen: !!(layer instanceof HTMLDialogElement && layer.open),
    hasCancel: !!document.querySelector('[data-testid="dayclose-confirm-cancel"]'),
    hasOk: !!document.querySelector('[data-testid="dayclose-confirm-ok"]'),
  };
})()`;
const LIST_CLOSES_JS = `fetch('/trpc/cashier.listDayCloses?batch=1&input=' + encodeURIComponent(JSON.stringify({ '0': { json: { limit: 50 } } })), { credentials: 'include' })
  .then((r) => r.json()).then((b) => (b?.[0]?.result?.data?.json ?? []).length).catch(() => -1)`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  const profile = join(tmpdir(), `pd89-live-probe-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--headless=new', '--window-size=1280,800',
  ];
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  try {
    let pageTarget = null;
    for (let i = 0; i < 40 && !pageTarget; i++) {
      try { const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' }); pageTarget = await res.json(); } catch { await sleep(400); }
    }
    if (!pageTarget?.webSocketDebuggerUrl) { console.error('CDP 页签创建失败'); process.exit(2); }
    const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    /* 全新档首载：无 SW 存留 → 实读当前 index.html 引用的 js（钉包） */
    await cdp.goto(`${BASE}/dev-login`, 5200);
    const bundle = await cdp.eval(`[...document.scripts].map((s) => s.src).find((s) => s.includes('/assets/index-')) ?? 'NONE'`);
    const jsSha = await cdp.eval(`fetch(${JSON.stringify('/assets/' + (bundle.split('/assets/')[1] ?? ''))})
      .then((r) => r.arrayBuffer())
      .then((b) => crypto.subtle.digest('SHA-256', b))
      .then((h) => [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join(''))
      .catch(() => null)`);
    note(bundle.endsWith(LIVE_TIP_BUNDLE), '现网 bundle 钉齐（全新档首载实读＝合部前现网 tip 钉包 index-CN4nyHT8.js）',
      `${bundle} sha256=${jsSha ? `${jsSha.slice(0, 12)}…${jsSha.slice(-8)}` : 'null'}`);

    const loginStatus = await cdp.eval(`fetch('/api/auth/dev-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: '${MGR_ID}', code: '${GATE}' }), credentials: 'include',
    }).then((r) => r.status).catch(() => 0)`);
    note(loginStatus === 200, 'dev-login 演示店长（merchant_manager · 口令门）', `HTTP ${loginStatus}`);

    const closesBefore = await cdp.eval(LIST_CLOSES_JS);

    /* 竞态窗口钉死：1500ms 延迟仿真下导航，表单一出现（账面未齐）即直点——敏慧复测同签名 */
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: LATENCY_MS, downloadThroughput: -1, uploadThroughput: -1,
    });
    await cdp.goto(`${BASE}/cashier/close`, 300);
    const formAppeared = await cdp.waitFor(`document.querySelector('[data-testid="dayclose-form"]') && document.querySelector('[data-testid="dayclose-actual-input"]')`, 45000);
    note(formAppeared, '/cashier/close 表单出现（延迟仿真竞态窗口内）');

    const preRace = await cdp.eval(READ_FORM_JS);
    await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
    await sleep(400);
    const raceProbe = await cdp.eval(PROBE_DIALOG_JS);
    note(
      preRace.actualValue === '' && preRace.submitDisabled === true
        && raceProbe.dialogCount === 0 && raceProbe.nativeOpenCount === 0 && !raceProbe.hasConfirmLayer,
      '缺陷复现（现网修前码）：账面未齐 actual=""＋钮 disabled，直点不置 pendingDayClose → dialogCount=0（NO_MODAL 与敏慧复测-R 同签名）',
      `pre=${JSON.stringify(preRace)} probe=${JSON.stringify(raceProbe)}`,
    );
    await cdp.shot(join(SHOTS, 'live-01-race-click-no-modal.png'));

    /* 对照段：关延迟仿真 → 账面就绪 → 同包再点出 dialog → 取消可关（零写） */
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const bookReady = await cdp.waitFor(`document.querySelector('[data-testid="dayclose-book"]')?.textContent !== '…'`, 60000);
    await sleep(600);
    const preReady = await cdp.eval(READ_FORM_JS);
    note(bookReady && preReady.submitDisabled === false,
      '对照：关延迟仿真后账面就绪（actual 默认同步账面＋钮 enabled）',
      `pre=${JSON.stringify(preReady)}`);
    await cdp.eval(`document.querySelector('[data-testid="dayclose-submit"]')?.click()`);
    await sleep(600);
    const readyProbe = await cdp.eval(PROBE_DIALOG_JS);
    note(readyProbe.dialogCount >= 1 && readyProbe.hasConfirmLayer && readyProbe.layerOpen && readyProbe.hasCancel && readyProbe.hasOk,
      '对照：同包就绪后点闸出真 dialog（dialog[open][dayclose-confirm-layer]）——非错包、非 Esc 缺失，触发差＝就绪态',
      JSON.stringify(readyProbe));
    await cdp.shot(join(SHOTS, 'live-02-ready-click-dialog.png'));
    await cdp.eval(`document.querySelector('[data-testid="dayclose-confirm-cancel"]')?.click()`);
    await sleep(500);
    const afterCancel = await cdp.eval(PROBE_DIALOG_JS);
    note(afterCancel.dialogCount === 0 && afterCancel.nativeOpenCount === 0,
      '对照：取消关闸（acted+closed，零提交）', JSON.stringify(afterCancel));

    const closesAfter = await cdp.eval(LIST_CLOSES_JS);
    note(closesAfter === closesBefore && closesBefore >= 0,
      '零写纪律：探针全程未落日结（closes 计数不变；未点确认）',
      `before=${closesBefore} after=${closesAfter}`);

    cdp.close();
    mkdirSync(dirname(OUT_JSON), { recursive: true });
    writeFileSync(OUT_JSON, JSON.stringify({
      window: 'PD-89-merchant-dayclose-gate-ready',
      leg: '现网 :7202 活钉＋缺陷复现（合部前现网 tip · 全新档 · 零写）',
      base: BASE, role: 'merchant_manager(演示店长/敏慧走测人设)', noFill: true,
      raceThrottleMs: LATENCY_MS,
      bundle: { js: bundle.split('/assets/')[1] ?? bundle, url: bundle, sha256: jsSha, isLiveTipBundleCN4nyHT8: bundle.endsWith(LIVE_TIP_BUNDLE) },
      note: '现网仍为 PD-88 零产品代码包（CN4nyHT8），竞态缺陷实锤复现＝预期红；修复绿证见 equiv-probe.json（等价现网腿，新包 index-B2Y5Z7e4.js）',
      results,
    }, null, 2));
    const fails = results.filter((r) => !r.ok).length;
    console.log(`\n[pd89-live] ${fails === 0 ? '全绿' : `失败 ${fails} 项`} · ${OUT_JSON}`);
    process.exitCode = fails === 0 ? 0 : 1;
  } finally {
    try { browser.kill(); } catch {}
    setTimeout(() => process.exit(process.exitCode ?? 0), 800);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
