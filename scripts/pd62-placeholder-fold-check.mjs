#!/usr/bin/env node
/**
 * PD-62 占位层（储值／报表口径）首屏可视断言 · 1280×800 boundingBox（Playwright 同义口径，
 * 仓例零新依赖——Edge headless CDP 驱动，同 PD-55/u6 片三闸范式）。
 *
 * 断言（令钉死）：商家 console 办事首页 1280×800 下，占位层顶边 boundingBox.y＋最小可见高(32) ≤ 800，
 *   即占位层（两张占位卡 console-card-stored/console-card-reportSpec 或其提示条 console-tier-pending）免滚动可见。
 * 量测留痕：kill 条／home 卡头／三层签与网格／两张占位卡／高级层 的 boundingBox 全量记 JSON。
 *
 * 前置：本窗栈 server(API_BASE)＋merchant preview(MERCHANT_URL) 已起，库已 migrate+seed。
 * 用法：node scripts/pd62-placeholder-fold-check.mjs
 * 环境变量：MERCHANT_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1
 * 退出码：0=断言 PASS；1=断言 FAIL／元素缺失；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { createHash, randomBytes } from 'node:crypto';

/* ---- 最小 RFC6455 客户端（node20 无全局 WebSocket；零新依赖，仅够 CDP JSON 文本帧） ---- */
class MiniWs {
  constructor(wsUrl) {
    const u = new URL(wsUrl);
    this.host = u.hostname;
    this.port = Number(u.port);
    this.path = u.pathname + u.search;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.onmessage = null;
  }
  open() {
    return new Promise((resolve, reject) => {
      const key = randomBytes(16).toString('base64');
      this.sock = connect(this.port, this.host, () => {
        this.sock.write(
          `GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      let hs = Buffer.alloc(0);
      let done = false;
      this.sock.on('data', (chunk) => {
        if (!done) {
          hs = Buffer.concat([hs, chunk]);
          const idx = hs.indexOf('\r\n\r\n');
          if (idx === -1) return;
          const head = hs.subarray(0, idx).toString();
          const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
          if (!head.includes('101') || !head.includes(accept)) return reject(new Error('WS 握手失败: ' + head.split('\r\n')[0]));
          done = true;
          this.buf = Buffer.concat([this.buf, hs.subarray(idx + 4)]);
          this.drain();
          resolve();
        } else {
          this.buf = Buffer.concat([this.buf, chunk]);
          this.drain();
        }
      });
      this.sock.on('error', reject);
    });
  }
  drain() {
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const op = b0 & 0x0f;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (this.buf.length < off + len) return;
      const payload = this.buf.subarray(off, off + len);
      this.buf = this.buf.subarray(off + len);
      if (op === 9) { this.sendFrame(10, payload); continue; } // ping→pong
      if (op === 8) { this.close(); continue; }
      this.frags.push(payload);
      if (fin) {
        const full = Buffer.concat(this.frags);
        this.frags = [];
        if (this.onmessage) this.onmessage({ data: full.toString('utf8') });
      }
    }
  }
  sendFrame(op, payload) {
    const mask = randomBytes(4);
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.from([0x80 | op, 0x80 | len]); }
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
    const masked = Buffer.from(payload);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
    this.sock.write(Buffer.concat([head, mask, masked]));
  }
  send(text) { this.sendFrame(1, Buffer.from(text, 'utf8')); }
  close() { try { this.sock?.destroy(); } catch {} }
}

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7162').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7262').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9262);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd62-placeholder-fold');
const VIEW_W = 1280;
const VIEW_H = 800;
const MIN_VISIBLE = 32; // 最小可见高（px）：占位层顶边起 ≥32px 落在首屏内才算「免滚动可见」
const NAV_WAIT = 4200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new MiniWs(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
    };
    await this.ws.open();
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
    return r?.result?.value;
  }
  async goto(url, waitMs = NAV_WAIT) {
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
  async shot(outfile, fullPage = false) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

const MEASURE_JS = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    scrollY: Math.round(window.scrollY),
    killStrip: box('[data-testid="console-kill-danger"]') ?? box('[data-testid="console-kill-alert"]'),
    homeCard: box('[data-testid="console-home"]'),
    tierDaily: box('[data-testid="console-tier-daily"]'),
    tierCareful: box('[data-testid="console-tier-careful"]'),
    tierPending: box('[data-testid="console-tier-pending"]'),
    cardStored: box('[data-testid="console-card-stored"]'),
    cardReportSpec: box('[data-testid="console-card-reportSpec"]'),
    pendingHint: box('[data-testid="console-pending-hint"]'),
    advanced: box('[data-testid="console-advanced"]'),
    docH: Math.round(document.documentElement.scrollHeight),
    /* PD-55 不动项留痕：15 卡等权（常办5/慎办8/占位2）计数核对 */
    tierCounts: {
      daily: document.querySelectorAll('[data-testid="console-tier-daily"] [data-testid^="console-card-"]').length,
      careful: document.querySelectorAll('[data-testid="console-tier-careful"] [data-testid^="console-card-"]').length,
      pending: document.querySelectorAll('[data-testid="console-tier-pending"] [data-testid^="console-card-"]').length,
    },
  };
})()`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = join(tmpdir(), `pd62-placeholder-fold-${Date.now()}`);
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
  await cdp.viewport(VIEW_W, VIEW_H, false);

  /* ---- 店主会话（dev-login 种子；cookie 入浏览器档案） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const ownerUserId = seed.users.find((u) => u.nickname === '菲丽亚店主')?.id;
  if (!ownerUserId) { console.error('种子缺 菲丽亚店主'); process.exit(2); }
  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  if (loginStatus !== 200) { console.error(`dev-login 失败 HTTP ${loginStatus}`); process.exit(2); }

  /* ---- /console 办事首页 · 1280×800 量测 ---- */
  await cdp.goto(`${MERCHANT_URL}/console`);
  const okHome = await cdp.waitFor(`document.querySelector('[data-testid="console-home"]')`);
  if (!okHome) { console.error('console-home 未渲染'); process.exit(2); }
  await cdp.waitFor(`document.querySelector('[data-testid="console-tier-pending"]') || document.querySelector('[data-testid="console-pending-hint"]')`);
  await sleep(1200); // 留痕行异步数据落定，版面终态
  const m = await cdp.eval(MEASURE_JS);

  /* ---- 断言：占位层顶边 y＋最小可见高 ≤ 800（占位卡或其提示条） ---- */
  const layer = m.tierPending ?? m.pendingHint ?? null;
  const layerName = m.tierPending ? 'console-tier-pending' : 'console-pending-hint';
  let pass = false;
  let why = '';
  if (!layer) {
    why = '占位层元素缺失（tier-pending/pending-hint 均无）';
  } else if (m.innerW !== VIEW_W || m.innerH !== VIEW_H) {
    why = `视口异常 ${m.innerW}×${m.innerH}`;
  } else {
    pass = layer.y + MIN_VISIBLE <= VIEW_H;
    why = `${layerName}.y=${layer.y} h=${layer.h} → y+${MIN_VISIBLE}=${layer.y + MIN_VISIBLE} ${pass ? '≤' : '>'} ${VIEW_H}`;
  }

  console.log(`[PD-62] 视口 ${m.innerW}×${m.innerH} scrollY=${m.scrollY} docH=${m.docH}`);
  for (const k of ['killStrip', 'homeCard', 'tierDaily', 'tierCareful', 'tierPending', 'cardStored', 'cardReportSpec', 'pendingHint', 'advanced']) {
    if (m[k]) console.log(`  ${k}: y=${m[k].y} h=${m[k].h} w=${m[k].w}`);
    else console.log(`  ${k}: （不在场）`);
  }
  console.log(`[PD-62] 断言 ${pass ? 'PASS' : 'FAIL'} —— ${why}`);

  await cdp.shot(join(OUT_DIR, 'console-1280x800-视口.png'));
  await cdp.shot(join(OUT_DIR, 'console-1280x800-全页.png'), true);

  const log = {
    gate: 'PD-62 占位层首屏可视（1280×800 boundingBox）',
    viewport: { w: VIEW_W, h: VIEW_H },
    minVisible: MIN_VISIBLE,
    measured: m,
    assert: { target: layerName, pass, why },
    at: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, 'pd62-placeholder-fold-gate.log.json'), JSON.stringify(log, null, 2));
  cdp.close();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
