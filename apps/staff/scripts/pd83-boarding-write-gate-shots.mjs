#!/usr/bin/env node
/**
 * PD-83 · 员工端寄养超期写闸＋去幂等工程腔 · 实机帧＋DOM 实证（A窗）
 *
 * 口径（学 pd76-badge-upload-shots 工艺）：
 * - 夹具：server/scripts/pd83-overdue-fixture.ts 先造（超期单＋在住对照单），本脚本只读走测，
 *   不点任何写 CTA（禁真提交／禁真退房），零支付动作（涉钱 mock 口径）。
 * - 超期页断言：超期横幅在；「修改／＋拍照／提交今日打卡／办理退房」写 CTA 全缺席；
 *   历史打卡只读保留；正文无「幂等／同日重复提交」工程腔。
 * - 对照页断言：写 CTA 仍在（不误伤）；副行新文案「当天再次提交，会更新今天的打卡记录」在。
 * - 渲染对象=本窗分支构建产物（vite preview，VITE_API_BASE 构建期指向本窗 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 错口纪律：本窗只用 7283（API）/ 7183（staff preview）/ 9283（CDP）。
 *
 * 用法：OVERDUE_AID=… CONTROL_AID=… STAFF_USER_ID=… node apps/staff/scripts/pd83-boarding-write-gate-shots.mjs
 * 环境变量：STAFF_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全绿；1=存在失败项；2=环境缺失。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/* Node 20 无全局 WebSocket：借 server 既有 ws 依赖（零新增） */
const WSImpl = globalThis.WebSocket ?? createRequire(join(REPO_ROOT, 'server', 'package.json'))('ws');

const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7183').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7283').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9283);
const OVERDUE_AID = process.env.OVERDUE_AID ?? '';
const CONTROL_AID = process.env.CONTROL_AID ?? '';
const STAFF_USER_ID = process.env.STAFF_USER_ID ?? '';
const EVIDENCE_DIR = join(REPO_ROOT, 'evidence', 'pd83-staff-boarding-write-gate');
const OUT_DIR = process.env.OUT_DIR ?? join(EVIDENCE_DIR, 'shots');
const NAV_WAIT = 4200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/* ---------- CDP 薄层（同 pd76 工艺） ---------- */
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WSImpl(this.wsUrl);
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
    if (r?.exceptionDetails) throw new Error(`页内 eval 异常：${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r?.result?.value;
  }
  async goto(url, waitMs = NAV_WAIT) { await this.send('Page.navigate', { url }); await sleep(waitMs); }
  async waitFor(expression, timeoutMs = 30000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`).catch(() => false);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(400);
    }
  }
  async viewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }
  async shot(outfile) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

/** 页面写 CTA / 文案探针（一次性取回，避免多次 eval 噪声） */
const PROBE = `(() => {
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.replace(/\\s+/g, ''));
  const text = document.body.innerText;
  return {
    editBtn: btns.some((t) => t === '修改'),
    checkoutBtn: btns.some((t) => t.includes('办理退房')),
    logForm: !!document.querySelector('[data-testid="daily-log-form"]'),
    addPhoto: !!document.querySelector('[data-testid="daily-add-photo"]'),
    dailySubmit: !!document.querySelector('[data-testid="daily-submit"]'),
    logList: !!document.querySelector('[data-testid="daily-log-list"]'),
    logRows: document.querySelectorAll('[data-testid^="log-"]').length,
    overdueBanner: (document.querySelector('[role="alert"]')?.textContent ?? '').includes('已超期'),
    jargonIdem: text.includes('幂等'),
    jargonRepeat: text.includes('同日重复提交'),
    newSub: text.includes('当天再次提交，会更新今天的打卡记录'),
    unavailable: !!document.querySelector('[data-testid="boarding-unavailable"]'),
  };
})()`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  if (!OVERDUE_AID || !CONTROL_AID || !STAFF_USER_ID) { console.error('缺 OVERDUE_AID/CONTROL_AID/STAFF_USER_ID'); process.exit(2); }
  mkdirSync(OUT_DIR, { recursive: true });

  /* ---- 0. 环境探活 ---- */
  const health = await fetch(`${API_BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!health) { console.error(`API ${API_BASE} 未就绪`); process.exit(2); }

  /* ---- 1. CDP 浏览器 ---- */
  const profile = join(tmpdir(), `pd83-staff-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);

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
  await cdp.viewport(390, 844, true);

  /* ---- 2. 登录员工（夹具回传的 boarding 技能员工） ---- */
  await cdp.goto(`${STAFF_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${STAFF_USER_ID}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(status === 200, '员工 dev-login', `HTTP ${status}`);

  /* ---- 3. 超期页：写 CTA 全缺席＋无工程腔（只读走测，零点击写钮） ---- */
  await cdp.goto(`${STAFF_URL}/boarding/${OVERDUE_AID}/checkin`);
  const loaded = await cdp.waitFor(`document.body.innerText.includes('寄养打卡') && (document.querySelector('[data-testid="daily-log-list"]') || document.querySelector('[role="alert"]'))`);
  note(loaded, '超期页加载（寄养打卡＋超期横幅/历史列表就位）');
  await sleep(800);
  const ov = await cdp.eval(PROBE);
  note(ov.overdueBanner, '帧① 超期横幅在（已超期，请提醒商家安排退房）', JSON.stringify({ banner: ov.overdueBanner }));
  note(!ov.editBtn, '帧② 「修改」写 CTA 缺席（入住信息卡纯只读）');
  note(!ov.logForm && !ov.addPhoto && !ov.dailySubmit, '帧③ 今日打卡表单＋＋拍照＋提交今日打卡 全缺席', JSON.stringify({ logForm: ov.logForm, addPhoto: ov.addPhoto, dailySubmit: ov.dailySubmit }));
  note(!ov.checkoutBtn, '帧④ 「办理退房」写 CTA 缺席');
  note(ov.logList && ov.logRows >= 1, '帧⑤ 历史打卡只读保留', `rows=${ov.logRows}`);
  note(!ov.jargonIdem && !ov.jargonRepeat, '帧⑥ 正文无「幂等／同日重复提交」工程腔', JSON.stringify({ idem: ov.jargonIdem, repeat: ov.jargonRepeat }));
  await cdp.shot(join(OUT_DIR, '01-overdue-readonly.png'));

  /* ---- 4. 对照页（正常在住）：写 CTA 仍在＝不误伤；新副行人话在 ---- */
  await cdp.goto(`${STAFF_URL}/boarding/${CONTROL_AID}/checkin`);
  const loaded2 = await cdp.waitFor(`document.querySelector('[data-testid="daily-log-form"]')`);
  note(loaded2, '对照页加载（今日打卡表单就位）');
  await sleep(800);
  const ct = await cdp.eval(PROBE);
  note(!ct.overdueBanner, '帧⑦ 对照页无超期横幅（未超期不误标）');
  note(ct.editBtn, '帧⑧ 对照页「修改」仍在');
  note(ct.logForm && ct.addPhoto && ct.dailySubmit, '帧⑨ 对照页 打卡表单＋＋拍照＋提交钮 仍在', JSON.stringify({ logForm: ct.logForm, addPhoto: ct.addPhoto, dailySubmit: ct.dailySubmit }));
  note(ct.checkoutBtn, '帧⑩ 对照页「办理退房」仍在');
  note(ct.newSub && !ct.jargonIdem && !ct.jargonRepeat, '帧⑪ 提交钮副行=人话新文案，工程腔清零', JSON.stringify({ newSub: ct.newSub, idem: ct.jargonIdem, repeat: ct.jargonRepeat }));
  await cdp.shot(join(OUT_DIR, '02-control-writable.png'));

  /* ---- 5. 断言汇总落盘 ---- */
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(join(EVIDENCE_DIR, 'assertions.json'), JSON.stringify({
    at: new Date().toISOString(), apiBase: API_BASE, staffUrl: STAFF_URL,
    overdueAid: OVERDUE_AID, controlAid: CONTROL_AID, staffUserId: STAFF_USER_ID,
    probe: { overdue: ov, control: ct }, results,
  }, null, 2));

  cdp.close();
  console.log(failures === 0 ? 'PD-83 走测全绿 ✅' : `PD-83 走测存在失败项 ❌（${failures}）`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
