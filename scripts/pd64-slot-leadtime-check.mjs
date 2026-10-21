#!/usr/bin/env node
/**
 * PD-64 · M-1 时段提前量 UI · 实证闸（仓例零新依赖——Edge headless CDP 驱动，同 PD-62 范式）
 *
 * 断言（令钉死的三条期望）：
 *  A. 不足 1h 的时段不可选／选中即被前置校验拦截并清空「已选」态——
 *     经 Fetch 注入「距开场 <1h 却在可约集」的滞留槽：修复后该格 disabled 且点不动、
 *     底栏无「已选」；基线则可选中并出现「已选」（缺陷复现 RED）。
 *     同帧核对文案口径：临近格灰显保留时刻明文不标「已满」（不可约≠约满）。
 *  B. 拒约／409 后底栏「已选」清零——真实构造：先选中可约槽 T（底栏出「已选」），
 *     再直插库占满两名 groomer（confirmed 单叠占 [T-30min, T+90min)），点「确认预约」
 *     走真接口得真 409 CONFLICT；修复后底栏「已选」清零且该格随 refetch 置灰；
 *     基线残留「已选」（缺陷复现 RED）。
 *  C. 回归护栏：>1h 可约槽照常可选（不过拦）；409 接口证经 Network 域留痕 HTTP 状态。
 *
 * 前置：本窗栈 server(API_BASE)＋customer preview(CUSTOMER_URL) 已起，库已 migrate+seed
 * （证据库 groomer 排班/门店营业时间已放宽至全天，与墙钟解耦）。
 * 用法：PREFIX=before CUSTOMER_URL=http://localhost:7163 node scripts/pd64-slot-leadtime-check.mjs
 *       PREFIX=after  CUSTOMER_URL=http://localhost:7164 node scripts/pd64-slot-leadtime-check.mjs
 * 环境变量：CUSTOMER_URL / API_BASE / CDP_PORT / OUT_DIR / EVIDENCE_DB / HEADFUL=1
 * 退出码：0=断言 PASS；1=断言 FAIL；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
      if (op === 9) { this.sendFrame(10, payload); continue; }
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

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7164').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7264').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9264);
const PREFIX = process.env.PREFIX ?? 'after';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd64-slot-leadtime');
const EVIDENCE_DB = process.env.EVIDENCE_DB ?? 'E:/KIMI_tmp/pd64/face.db';
const VIEW_W = 414;
const VIEW_H = 896;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const results = [];
const createResponses = [];
function record(id, ok, detail, extra) {
  results.push({ id, ok, detail, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} —— ${detail}`);
}

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.onPaused = null; }
  async open() {
    this.ws = new MiniWs(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); return; }
      if (msg.method === 'Fetch.requestPaused' && this.onPaused) {
        this.onPaused(msg.params).catch(() => {});
        return;
      }
      if (msg.method === 'Network.responseReceived') {
        const { url, status } = msg.params.response;
        if (url.includes('/trpc/appointment.create')) createResponses.push({ url, status });
      }
    };
    await this.ws.open();
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
    if (r?.exceptionDetails) throw new Error('eval 异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r?.result?.value;
  }
  async goto(url, waitMs = 3000) { await this.send('Page.navigate', { url }); await sleep(waitMs); }
  async waitFor(expression, timeoutMs = 45000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`).catch(() => false);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(400);
    }
  }
  async shot(name) {
    mkdirSync(OUT_DIR, { recursive: true });
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT_DIR, `${PREFIX}-${name}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${file}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

/** superjson 响应注入：往 getWithServices 的可约槽里塞一个距开场 <1h 的滞留槽（append 不挪既有索引） */
function injectNearSlot(bodyB64, nearMs) {
  const arr = JSON.parse(Buffer.from(bodyB64, 'base64').toString('utf8'));
  let done = false;
  for (const el of arr) {
    const data = el?.result?.data;
    if (!data?.json?.slots || !Array.isArray(data.json.slots) || data.json.slots.length === 0) continue;
    const slots = data.json.slots;
    const meta = (data.meta ??= {});
    const values = (meta.values ??= {});
    const refIdx = slots.length - 1;
    const ref = slots[refIdx];
    const newIdx = slots.length;
    const near = { ...ref, id: `virtual:pd64-inject:${nearMs}`, slotStart: new Date(nearMs).toISOString() };
    slots.push(near);
    for (const [k, v] of Object.entries(values)) {
      if (k.startsWith(`slots.${refIdx}.`)) values[`slots.${newIdx}.${k.split('.').slice(2).join('.')}`] = v;
    }
    done = true;
  }
  return done ? Buffer.from(JSON.stringify(arr), 'utf8').toString('base64') : null;
}

/** 证据库直插：两名 groomer 在目标区间各挂一单 confirmed（占满容量 → create 必 409） */
async function occupyBothGroomers(tMs) {
  const req = createRequire(new URL('../server/package.json', import.meta.url));
  const { createClient } = req('@libsql/client');
  const c = createClient({ url: `file:${EVIDENCE_DB}` });
  const store = (await c.execute('SELECT id FROM stores LIMIT 1')).rows[0];
  const groomers = (await c.execute("SELECT id FROM staff WHERE role='groomer' AND status='active' ORDER BY created_at")).rows;
  const svc = (await c.execute("SELECT id, price_fen FROM services WHERE type='grooming' ORDER BY created_at LIMIT 1")).rows[0];
  if (!store || groomers.length < 2 || !svc) throw new Error('证据库夹具缺失（store/groomer×2/service）');
  const stamp = Date.now().toString(36);
  for (let i = 0; i < 2; i++) {
    const uid = `pd64-occ-u-${stamp}-${i}`;
    const pid = `pd64-occ-p-${stamp}-${i}`;
    await c.execute({ sql: 'INSERT INTO users (id, kimi_id, nickname) VALUES (?, ?, ?)', args: [uid, `pd64_occ_${stamp}_${i}`, `占位客${i + 1}`] });
    await c.execute({ sql: 'INSERT INTO pets (id, owner_id, name, species) VALUES (?, ?, ?, ?)', args: [pid, uid, `占位宠${i + 1}`, 'dog'] });
    await c.execute({
      sql: `INSERT INTO appointments (id, code, customer_id, store_id, staff_id, assign_source, pet_id, service_id, type, scheduled_start, scheduled_end, status, price_fen, payment_mode)
            VALUES (?, ?, ?, ?, ?, 'auto', ?, ?, 'grooming', ?, ?, 'confirmed', ?, 'pay_at_store')`,
      args: [`pd64-occ-a-${stamp}-${i}`, `${Math.floor(100000 + Math.random() * 900000)}`, uid, store.id, groomers[i].id, pid, svc.id,
        Math.floor((tMs - 30 * 60_000) / 1000), Math.floor((tMs + 90 * 60_000) / 1000), svc.price_fen],
    });
  }
  return { storeId: store.id, groomerIds: groomers.map((g) => g.id) };
}

const fmtHM = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = join(tmpdir(), `pd64-slot-leadtime-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW_W, height: VIEW_H, deviceScaleFactor: 2, mobile: true });

  /* ---- 客户会话（dev-login 种子客户；cookie 入浏览器档案） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const customerId = seed.users.find((u) => (u.roles ?? []).includes('customer'))?.id;
  if (!customerId) { console.error('种子客户缺失'); process.exit(2); }
  await cdp.goto(`${CUSTOMER_URL}/dev-login`, 2600);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customerId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  if (loginStatus !== 200) { console.error(`dev-login 失败 HTTP ${loginStatus}`); process.exit(2); }

  /* ================= 场景 A：注入「<1h 滞留可约槽」 ================= */
  // 距开场 5~35 分钟内的下一个 30min 整界（必 <1h；栅格按营业合成全天，该格必在今日栅格）
  const nearMs = Math.ceil((Date.now() + 5 * 60_000) / (30 * 60_000)) * 30 * 60_000;
  cdp.onPaused = async (params) => {
    const { requestId, request, responseHeaders } = params;
    if (!request.url.includes('store.getWithServices')) {
      await cdp.send('Fetch.continueRequest', { requestId }).catch(() => {});
      return;
    }
    try {
      const got = await cdp.send('Fetch.getResponseBody', { requestId });
      const body = got.base64Encoded ? got.body : Buffer.from(got.body, 'utf8').toString('base64');
      const mutated = injectNearSlot(body, nearMs);
      if (mutated) {
        await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders, body: mutated });
      } else {
        await cdp.send('Fetch.continueRequest', { requestId }).catch(() => {});
      }
    } catch { await cdp.send('Fetch.continueRequest', { requestId }).catch(() => {}); }
  };
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*store.getWithServices*', requestStage: 'Response' }] });
  await cdp.goto(`${CUSTOMER_URL}/booking/grooming`);
  const gridOk = await cdp.waitFor(`document.querySelector('[data-testid="gs-time-grid"]')`);
  if (!gridOk) { console.error('时段栅格未渲染'); process.exit(2); }
  await cdp.waitFor(`document.querySelector('[data-slot-start="${nearMs}"]')`, 15000);
  await sleep(600);

  const aState = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${nearMs}"]');
    if (!cell) return JSON.stringify({ missing: true });
    return JSON.stringify({ disabled: cell.disabled, available: cell.dataset.available, text: cell.textContent.trim(), aria: cell.getAttribute('aria-label') ?? '' });
  })()`));
  await cdp.eval(`document.querySelector('[data-slot-start="${nearMs}"]')?.click()`);
  await sleep(500); // 点击态落定后再读底栏（React 重渲一帧）
  const aAfter = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${nearMs}"]');
    return JSON.stringify({
      summaryAfterClick: document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? '',
      legend: document.querySelector('[data-testid="u2-time-legend"]')?.textContent ?? '',
      cellDisabledAfter: cell?.disabled ?? null,
    });
  })()`));
  await cdp.shot('a-lead-gate');

  // A1：<1h 滞留槽不可进入已选态（disabled 且点击后底栏无「已选」）
  record('A1 不足1h时段不可选／拦截后无已选',
    !aState.missing && aState.disabled === true && !aAfter.summaryAfterClick.includes('已选'),
    `cell(${fmtHM(nearMs)}) disabled=${aState.disabled} available=${aState.available} 点击后底栏=「${aAfter.summaryAfterClick}」`, { aState, aAfter });
  // A2：临近格灰显保留时刻明文、不标「已满」（不可约≠约满误导）；图例口径齐
  record('A2 临近格不误导约满（时刻明文＋图例）',
    !aState.missing && aState.text === fmtHM(nearMs) && aState.aria.includes('临近') && aAfter.legend.includes('临近'),
    `text=「${aState.text}」 aria=「${aState.aria}」 legend=「${aAfter.legend}」`, { aState, aAfter });

  // C 回归护栏：>1h 真可约槽照常可选进已选态
  const okCellMs = await cdp.eval(`(() => {
    const now = Date.now();
    const cells = [...document.querySelectorAll('[data-slot-start]')];
    const c = cells.find((el) => el.dataset.available === 'true' && Number(el.dataset.slotStart) >= now + 62 * 60 * 1000 && Number(el.dataset.slotStart) !== ${nearMs});
    return c ? c.dataset.slotStart : null;
  })()`);
  if (!okCellMs) { console.error('无可约对照槽'); process.exit(2); }
  await cdp.eval(`document.querySelector('[data-slot-start="${okCellMs}"]').click()`);
  await sleep(400);
  const cSummary = await cdp.eval(`document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? ''`);
  record('C 可约槽照常可选（不过拦）', cSummary.includes('已选'), `点选 ${fmtHM(Number(okCellMs))} 后底栏=「${cSummary}」`);

  await cdp.send('Fetch.disable').catch(() => {});
  cdp.onPaused = null;

  /* ================= 场景 B：真 409 后底栏「已选」清零 ================= */
  await cdp.goto(`${CUSTOMER_URL}/booking/grooming`);
  await cdp.waitFor(`document.querySelector('[data-testid="gs-time-grid"]')`);
  await sleep(600);
  // 选宠物（种子客户 2 宠不默认，须明选——否则确认钮不可用）
  await cdp.eval(`document.querySelector('[data-testid="u2-chip-pet"]')?.click()`);
  await cdp.waitFor(`document.querySelector('[data-testid="u2-pet-sheet"]')`);
  await cdp.eval(`[...document.querySelectorAll('[data-testid="u2-pet-sheet"] button')].find((b) => b.textContent.includes('旺财'))?.click()`);
  await sleep(500);
  // 选 T：今日 ≥now+2h 且当日打烊前服务得完（≤21:00，留足引擎时长 150min 余量）的第一个可约槽；
  // 今日无合法槽（晚间运行）→ 切「明天」取首个可约槽
  let tMs = await cdp.eval(`(() => {
    const now = Date.now();
    const end = new Date(); end.setHours(21, 0, 0, 0);
    const cells = [...document.querySelectorAll('[data-slot-start]')]
      .filter((el) => el.dataset.available === 'true' && Number(el.dataset.slotStart) >= now + 2 * 60 * 60 * 1000 && Number(el.dataset.slotStart) <= end.getTime())
      .sort((a, b) => Number(a.dataset.slotStart) - Number(b.dataset.slotStart));
    return cells[0]?.dataset.slotStart ?? null;
  })()`);
  if (!tMs) {
    const tm = new Date(); tm.setDate(tm.getDate() + 1);
    const daySel = `[data-testid="gs-day-${tm.getFullYear()}-${tm.getMonth() + 1}-${tm.getDate()}"]`;
    await cdp.eval(`document.querySelector('${daySel}')?.click()`);
    await sleep(800);
    tMs = await cdp.eval(`(() => {
      const cells = [...document.querySelectorAll('[data-slot-start]')]
        .filter((el) => el.dataset.available === 'true')
        .sort((a, b) => Number(a.dataset.slotStart) - Number(b.dataset.slotStart));
      return cells[0]?.dataset.slotStart ?? null;
    })()`);
  }
  if (!tMs) { console.error('可约槽缺失（证据库营业时间/排班未放宽？）'); process.exit(2); }
  await cdp.eval(`document.querySelector('[data-slot-start="${tMs}"]').click()`);
  await sleep(400);
  const bSelected = await cdp.eval(`document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? ''`);
  await cdp.shot('b-selected');
  if (!bSelected.includes('已选')) { console.error(`选中 ${fmtHM(Number(tMs))} 未出「已选」（前置态不成立）：${bSelected}`); process.exit(2); }

  // 直插库占满 groomer 容量（[T-30min, T+90min) 双 confirmed 单）→ 真 409
  const occ = await occupyBothGroomers(Number(tMs));
  console.log(`  🔧 占容量：T=${fmtHM(Number(tMs))} groomers=${occ.groomerIds.join('/')}`);
  createResponses.length = 0;
  await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.click()`);
  // 网络域等 create 落定（toast 3.2s 易错过；以真响应为准）
  {
    const t0 = Date.now();
    while (!createResponses.some((r) => r.status !== 204)) {
      if (Date.now() - t0 > 20000) break;
      await sleep(300);
    }
  }
  await sleep(1800); // onError→清零＋refetch 落定（T 出集置灰）
  const bAfter = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${tMs}"]');
    return JSON.stringify({
      summary: document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? '',
      cellAvailable: cell?.dataset.available ?? 'missing',
      cellText: cell?.textContent.trim() ?? '',
    });
  })()`));
  await cdp.shot('b-after-409');

  const s409 = createResponses.some((r) => r.status === 409);
  record('B0 接口证：appointment.create 真回 409', s409, `create 响应状态集=${JSON.stringify(createResponses.map((r) => r.status))}`, createResponses);
  // B1：409 后底栏「已选」清零（不得残留）
  record('B1 409 后底栏无已选', !bAfter.summary.includes('已选'), `409 后底栏=「${bAfter.summary}」`, bAfter);
  // B2：409 文案与可约态一致——T 随 refetch 出集置灰（不可约即不可选）
  record('B2 409 后该槽置灰（不可约即不可选）', bAfter.cellAvailable === 'false', `cell(${fmtHM(Number(tMs))}) available=${bAfter.cellAvailable} text=「${bAfter.cellText}」`, bAfter);

  cdp.close();
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, nearMs, tMs: Number(tMs), results }, null, 2));
  const failures = results.filter((r) => !r.ok).length;
  console.log(`汇总：${results.length - failures}/${results.length} 通过；证据目录=${OUT_DIR}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`环境异常：${error?.message ?? error}`);
  process.exit(2);
});
