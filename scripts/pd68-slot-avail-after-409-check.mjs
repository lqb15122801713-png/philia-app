#!/usr/bin/env node
/**
 * PD-68 · 409 后目标槽仍 data-available=true · 实证闸（仓例零新依赖——Edge headless CDP，同 PD-64 范式）
 *
 * 缺陷机理：客端单屏 /booking/grooming 栅格查询只带 URL 预填 serviceId——自然进店
 * （无 ?serviceId=）时服务端按 slotsNeeded=1 过滤可约槽，create 却以时长引擎输出
 * （连续多槽）判 groomer 空闲：首槽空、续槽占的时段列表可约 → create 409 → refetch
 * 仍按 slotsNeeded=1 → 该槽仍 data-available=true 可再点（列表 vs create 重叠闸差）。
 * 修复：栅格查询带「生效服务」（解析落定后回填查询入参），列表与 create 同源剔槽。
 *
 * 断言：
 *  A1 闸差剔槽：预置「唯一空闲窗口仅首 30min」槽 T_A（两名 groomer 在 [T_A+30, T_A+90)
 *     各挂 confirmed 单）——修复后 T_A 格初始即 data-available=false（同源剔除）；
 *     基线 data-available=true（缺陷复现 RED）。
 *  A2 409 后该槽不可再选（OBS 复现路径）：T_A 可点时点选→确认→真 409→refetch 落定后
 *     仍 data-available=true 即 FAIL（基线）；修复后 T_A 不可点（disabled）即 PASS。
 *  B  回归护栏（并发占满路径，PD-64 已修口径）：干净槽 T2 选中出「已选」→ 直插库占满
 *     两 groomer [T2-30, T2+150) → 真 409 → 底栏无已选 + T2 格 data-available=false。
 *
 * 前置：本窗栈 server(API_BASE)＋customer preview(CUSTOMER_URL) 已起；证据库已
 * migrate+seed 且门店营业/groomer 排班放宽全天（脱墙钟）；场景 A 占用由本脚本自置。
 * 用法：PREFIX=before CUSTOMER_URL=http://localhost:7168 node scripts/pd68-slot-avail-after-409-check.mjs
 *       PREFIX=after  CUSTOMER_URL=http://localhost:7169 node scripts/pd68-slot-avail-after-409-check.mjs
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

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7169').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7268').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9268);
const PREFIX = process.env.PREFIX ?? 'after';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd68-slot-avail-after-409');
const EVIDENCE_DB = process.env.EVIDENCE_DB ?? 'E:/KIMI_tmp/pd68/face.db';
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
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new MiniWs(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); return; }
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

/** 证据库直插：每名 groomer 在 [startMs, endMs) 各挂一单 confirmed（占满容量 → create 必 409） */
async function occupyAllGroomers(startMs, endMs) {
  const req = createRequire(new URL('../server/package.json', import.meta.url));
  const { createClient } = req('@libsql/client');
  const c = createClient({ url: `file:${EVIDENCE_DB}` });
  try {
    const store = (await c.execute('SELECT id FROM stores LIMIT 1')).rows[0];
    const groomers = (await c.execute("SELECT id FROM staff WHERE role='groomer' AND status='active' ORDER BY created_at")).rows;
    const svc = (await c.execute("SELECT id, price_fen FROM services WHERE type='grooming' ORDER BY created_at LIMIT 1")).rows[0];
    if (!store || groomers.length < 1 || !svc) throw new Error('证据库夹具缺失（store/groomer/service）');
    const stamp = Date.now().toString(36);
    for (let i = 0; i < groomers.length; i++) {
      const uid = `pd68-occ-u-${stamp}-${i}`;
      const pid = `pd68-occ-p-${stamp}-${i}`;
      await c.execute({ sql: 'INSERT INTO users (id, kimi_id, nickname) VALUES (?, ?, ?)', args: [uid, `pd68_occ_${stamp}_${i}`, `占位客${i + 1}`] });
      await c.execute({ sql: 'INSERT INTO pets (id, owner_id, name, species) VALUES (?, ?, ?, ?)', args: [pid, uid, `占位宠${i + 1}`, 'dog'] });
      await c.execute({
        sql: `INSERT INTO appointments (id, code, customer_id, store_id, staff_id, assign_source, pet_id, service_id, type, scheduled_start, scheduled_end, status, price_fen, payment_mode)
              VALUES (?, ?, ?, ?, ?, 'auto', ?, ?, 'grooming', ?, ?, 'confirmed', ?, 'pay_at_store')`,
        args: [`pd68-occ-a-${stamp}-${i}`, `${Math.floor(100000 + Math.random() * 900000)}`, uid, store.id, groomers[i].id, pid, svc.id,
          Math.floor(startMs / 1000), Math.floor(endMs / 1000), svc.price_fen],
      });
    }
    return { storeId: store.id, groomerIds: groomers.map((g) => g.id) };
  } finally {
    c.close();
  }
}

const fmtHM = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
/** 明天本地 h:mm 的时间戳（栅格按门店日界合成，取明天脱 leadtime 缓冲） */
const tomorrowAt = (h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d.getTime(); };

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = join(tmpdir(), `pd68-slot-avail-${Date.now()}`);
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

  /* ================= 场景 A：闸差槽 T_A（首 30min 空、续槽满） ================= */
  // T_A=明天 10:00；两名 groomer 在 [10:30, 11:30) 各挂 confirmed 单——
  // slotsNeeded=1 口径（漏传 serviceId，修复前）T_A 可约；60min 服务口径（同源，修复后）T_A 剔除
  const tA = tomorrowAt(10, 0);
  const occA = await occupyAllGroomers(tA + 30 * 60_000, tA + 90 * 60_000);
  console.log(`  🔧 场景A占用：T_A=${fmtHM(tA)} groomers=${occA.groomerIds.join('/')} 区间=[${fmtHM(tA + 30 * 60_000)},${fmtHM(tA + 90 * 60_000)})`);

  await cdp.goto(`${CUSTOMER_URL}/booking/grooming`);
  const gridOk = await cdp.waitFor(`document.querySelector('[data-testid="gs-time-grid"]')`);
  if (!gridOk) { console.error('时段栅格未渲染'); process.exit(2); }
  // 切「明天」日期页（T_A/T2 均在明天，脱 leadtime 缓冲）
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  const daySel = `[data-testid="gs-day-${tm.getFullYear()}-${tm.getMonth() + 1}-${tm.getDate()}"]`;
  await cdp.eval(`document.querySelector('${daySel}')?.click()`);
  await sleep(900);
  // 选宠物（种子客户多宠不默认，须明选——否则确认钮不可用；选后带 petId 同源重取）
  await cdp.eval(`document.querySelector('[data-testid="u2-chip-pet"]')?.click()`);
  await cdp.waitFor(`document.querySelector('[data-testid="u2-pet-sheet"]')`);
  await cdp.eval(`[...document.querySelectorAll('[data-testid="u2-pet-sheet"] button')].find((b) => b.textContent.includes('旺财'))?.click()`);
  await sleep(1200);
  await cdp.waitFor(`document.querySelector('[data-slot-start="${tA}"]')`, 15000);
  await sleep(400);

  const aInit = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${tA}"]');
    if (!cell) return JSON.stringify({ missing: true });
    return JSON.stringify({ disabled: cell.disabled, available: cell.dataset.available, text: cell.textContent.trim() });
  })()`));
  await cdp.shot('a-gate-diff');
  record('A1 闸差剔槽：续槽占用时段初始即不可约', aInit.missing !== true && aInit.available === 'false',
    `cell(${fmtHM(tA)}) available=${aInit.available} disabled=${aInit.disabled} text=「${aInit.text}」`, aInit);

  // A2：OBS 复现路径——T_A 可点时走真 create→409→refetch 后再读；修复后 T_A 不可点即 PASS
  if (aInit.disabled === false) {
    await cdp.eval(`document.querySelector('[data-slot-start="${tA}"]')?.click()`);
    await sleep(500);
    createResponses.length = 0;
    await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.click()`);
    const t0 = Date.now();
    while (!createResponses.some((r) => r.status !== 204)) {
      if (Date.now() - t0 > 20000) break;
      await sleep(300);
    }
    await sleep(1800); // onError→清零＋refetch 落定
    const aAfter = JSON.parse(await cdp.eval(`(() => {
      const cell = document.querySelector('[data-slot-start="${tA}"]');
      return JSON.stringify({ available: cell?.dataset.available ?? 'missing', summary: document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? '' });
    })()`));
    await cdp.shot('a-after-409');
    record('A2 409 后该槽不可再选（闸差路径 OBS）', aAfter.available === 'false',
      `409 后 cell(${fmtHM(tA)}) available=${aAfter.available} 底栏=「${aAfter.summary}」 create状态=${JSON.stringify(createResponses.map((r) => r.status))}`, aAfter);
  } else {
    record('A2 409 后该槽不可再选（闸差路径 OBS）', true,
      `cell(${fmtHM(tA)}) disabled=true 不可点（同源剔除后不进入 409 回路）`, aInit);
  }

  /* ================= 场景 B：并发占满 → 真 409 → 槽置灰（回归护栏） ================= */
  const t2 = tomorrowAt(14, 0);
  const bInit = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${t2}"]');
    return JSON.stringify({ available: cell?.dataset.available ?? 'missing', disabled: cell?.disabled ?? null });
  })()`));
  if (bInit.available !== 'true') { console.error(`场景B对照槽 ${fmtHM(t2)} 不可约（证据库被场景A波及？）`); process.exit(2); }
  await cdp.eval(`document.querySelector('[data-slot-start="${t2}"]')?.click()`);
  await sleep(500);
  const bSelected = await cdp.eval(`document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? ''`);
  await cdp.shot('b-selected');
  if (!bSelected.includes('已选')) { console.error(`选中 ${fmtHM(t2)} 未出「已选」（前置态不成立）：${bSelected}`); process.exit(2); }

  const occB = await occupyAllGroomers(t2 - 30 * 60_000, t2 + 150 * 60_000);
  console.log(`  🔧 场景B占满：T2=${fmtHM(t2)} groomers=${occB.groomerIds.join('/')}`);
  createResponses.length = 0;
  await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.click()`);
  {
    const t0 = Date.now();
    while (!createResponses.some((r) => r.status !== 204)) {
      if (Date.now() - t0 > 20000) break;
      await sleep(300);
    }
  }
  await sleep(1800); // onError→清零＋refetch 落定（T2 出集置灰）
  const bAfter = JSON.parse(await cdp.eval(`(() => {
    const cell = document.querySelector('[data-slot-start="${t2}"]');
    return JSON.stringify({
      summary: document.querySelector('[data-testid="u2-bottom-summary"]')?.textContent ?? '',
      cellAvailable: cell?.dataset.available ?? 'missing',
      cellText: cell?.textContent.trim() ?? '',
    });
  })()`));
  await cdp.shot('b-after-409');

  const s409 = createResponses.some((r) => r.status === 409);
  record('B0 接口证：appointment.create 真回 409', s409, `create 响应状态集=${JSON.stringify(createResponses.map((r) => r.status))}`, createResponses);
  record('B1 409 后底栏无已选', !bAfter.summary.includes('已选'), `409 后底栏=「${bAfter.summary}」`, bAfter);
  record('B2 409 后该槽置灰（不可约即不可选）', bAfter.cellAvailable === 'false', `cell(${fmtHM(t2)}) available=${bAfter.cellAvailable} text=「${bAfter.cellText}」`, bAfter);

  cdp.close();
  writeFileSync(join(OUT_DIR, `${PREFIX}-results.json`), JSON.stringify({ at: new Date().toISOString(), base: CUSTOMER_URL, tA, t2, results }, null, 2));
  const failures = results.filter((r) => !r.ok).length;
  console.log(`汇总：${results.length - failures}/${results.length} 通过；证据目录=${OUT_DIR}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`环境异常：${error?.message ?? error}`);
  process.exit(2);
});
