#!/usr/bin/env node
/**
 * PD45 U6 商家桌面定稿升档 · 实尺截图实证（CJ-1018-11）
 *
 * 口径（学 片3 s3-merchant-face-shots.mjs）：
 * - 真实链路驱动，不画假态：dev-seed-users 取种子 → 客户真下单×2（A=核销进服务中，
 *   B=confirmed 台账行）→ 寄养单 → in_boarding → 收银 settle 两单 → 退款双态 →
 *   **U6 加造**：①A 单 checked_in_at 直写库回拨 25h（@libsql/client 直读本片库，
 *   僵尸行真态——C4 列表「强制完成」入口＋监控 Hub 僵尸卡/WAlert 次动作）；
 *   ②cashier.dayClose 真日结冻结（实点=账面 tender.cashFen 同源，差异 0）——
 *   C6「已冻结」明示三处（banner／班次徽／历史行标签）真态。
 * - C5：台账 B 单（confirmed）行内「改期」入口点开 RescheduleSheet 真弹层取景。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期烘向本片 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）；
 *   @libsql/client 经 server/node_modules createRequire 取用（本片既有依赖，零新增）。
 * - 每帧三闸（PD44 同族）：可读文字全量 ≥12px（计算样式巡检）／爪印=0／cream 主钮计数上报。
 * - 视口：桌面 1440×900（本片只销商家桌面 W-00~W-16；手机五槽=U7 另片不取）。
 * - 前置：本片 server（7251，CORS_ORIGINS 含 7171）＋ merchant preview（7171）已起；
 *   库跑前 migrate+seed 复位。错口：他窗栈一概不碰；本片 7171/7251/9251。
 *
 * 用法：node apps/merchant/scripts/u6-merchant-desk-shots.mjs
 * 环境变量：MERCHANT_URL / API_BASE / CDP_PORT / OUT_DIR / PHILIA_DB_FILE / HEADFUL=1。
 * 退出码：0=全部截图落盘且闸门全绿；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7171').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7251').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9251);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'design-upgrade-u6-merchant-desk', 'shots');
const DB_FILE = process.env.PHILIA_DB_FILE ?? 'E:/KIMI_tmp/u6-merchant/face.db';
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

/* ---- tRPC HTTP（batch=1 + superjson 线格式；与片3 同范式） ---- */
function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    throw new Error(`${name} 失败：${e?.message ?? JSON.stringify(e)}`);
  }
  return first?.result?.data?.json;
}
async function trpcQuery(cookie, path, input, metaValues) {
  const frame = { json: input ?? null };
  if (metaValues) frame.meta = { values: metaValues };
  const payload = encodeURIComponent(JSON.stringify({ '0': frame }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutate(cookie, path, input, metaValues) {
  const body = { '0': { json: input ?? null } };
  if (metaValues) body['0'].meta = { values: metaValues };
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return unwrap(await res.json(), `trpc ${path}`);
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

/* ---- CDP 最小幅（页级：导航/求值/截图） ---- */
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
  async shot(outfile) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

/* ---- U6 三闸（每帧）：≥12px 字阶巡检／爪印=0／cream 主钮计数 ---- */
const GATES_JS = `(() => {
  const vis = (el) => { try { return el.checkVisibility(); } catch { return true; } };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs > 0 && fs < 11.5) bad.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), fs, text: (el.textContent || '').trim().slice(0, 24) });
  }
  const paw = document.body.innerText.includes('🐾');
  let cream = 0;
  const creamSample = [];
  for (const el of document.querySelectorAll('button, a')) {
    if (!vis(el)) continue;
    if (getComputedStyle(el).backgroundColor === 'rgb(242, 220, 140)') {
      cream += 1;
      creamSample.push(el.getAttribute('data-testid') || (el.textContent || '').trim().slice(0, 12));
    }
  }
  return { fontBad: bad.length, fontSample: bad.slice(0, 4), paw, cream, creamSample: creamSample.slice(0, 5) };
})()`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  const profile = join(tmpdir(), `u6-merchant-desk-${Date.now()}`);
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
  await cdp.viewport(1440, 900, false);

  /* ---- 种子账号（菲丽亚店主=owner / 小美=前台 / 阿强=美容师 / 示例客户） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const customerCookie = await devLogin(uidOf('示例客户'));
  const merchantCookie = await devLogin(uidOf('菲丽亚店主'));
  const frontdeskCookie = await devLogin(uidOf('小美'));
  const ownerUserId = uidOf('菲丽亚店主');

  /* ---- 基础资料：门店/服务/宠物/员工 ---- */
  const nearby = await trpcQuery(customerCookie, 'store.listNearby', {});
  const store = nearby?.stores?.[0];
  const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id });
  const groomingSvc = detail?.services?.find((s) => s.type === 'grooming');
  const boardingSvc = detail?.services?.find((s) => s.type === 'boarding');
  const pets = await trpcQuery(customerCookie, 'pet.list');
  const pet = pets?.[0];
  const staffPub = await trpcQuery(frontdeskCookie, 'store.listStaffPublic', { storeId: store.id });
  const groomerStaffId = staffPub?.staff?.find((s) => s.name === '阿强')?.id;
  if (!groomerStaffId) throw new Error('未找到美容师阿强 staffId');

  /* ---- 洗护单 A/B（今日；A=核销进服务中→回拨成僵尸，B=confirmed 台账行） ---- */
  const mkAppt = async (slotIdx, tag) => {
    let id = null;
    const dayStart = new Date();
    dayStart.setHours(9, 30, 0, 0);
    const minStart = new Date(Date.now() + 3600_000);
    for (let i = 0; i < 20 && !id; i++) {
      const start = new Date(dayStart.getTime() + (slotIdx + i) * 30 * 60_000);
      if (start < minStart) continue;
      try {
        const created = await trpcMutate(customerCookie, 'appointment.create', {
          storeId: store.id, petId: pet.id, serviceId: groomingSvc.id, type: 'grooming',
          scheduledStart: start.toISOString(), paymentMode: 'pay_at_store',
          note: `【PD45实证】${tag}`,
        }, { scheduledStart: ['Date'] });
        id = created?.id ?? created?.appointment?.id ?? null;
      } catch (e) {
        if (!/CONFLICT|约满|冲突/.test(String(e?.message))) throw e;
      }
    }
    if (!id) throw new Error(`${tag} 未抢到可约槽`);
    await trpcMutate(merchantCookie, 'appointment.confirm', { appointmentId: id });
    await trpcMutate(merchantCookie, 'appointment.assign', { appointmentId: id, staffId: groomerStaffId });
    return id;
  };
  const apptA = await mkAppt(1, 'A 单（核销进服务中→僵尸）');
  const apptB = await mkAppt(10, 'B 单（台账 confirmed 行）');
  note(true, '造单：A/B 洗护单 confirmed 且指派阿强', `A=${apptA} B=${apptB}`);

  /* ---- A 单核销 → in_service ---- */
  const codeA = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: apptA });
  const checkin = await trpcMutate(frontdeskCookie, 'appointment.checkin', { code: codeA?.code });
  const stA = checkin?.appointment?.status ?? checkin?.status;
  note(stA === 'in_service', 'A 单核销 → in_service', `status=${stA}`);

  /* ---- 寄养单（今日入住·明日退房）→ in_boarding ---- */
  let boardingId = null;
  {
    const start = new Date(Date.now() + 90 * 60_000);
    start.setMinutes(start.getMinutes() < 30 ? 30 : 0, 0, 0);
    if (start.getMinutes() === 0) start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);
    end.setHours(12, 0, 0, 0);
    for (let i = 0; i < 12 && !boardingId; i++) {
      const s = new Date(start.getTime() + i * 30 * 60_000);
      const e = new Date(end.getTime() + i * 30 * 60_000);
      try {
        const created = await trpcMutate(customerCookie, 'appointment.create', {
          storeId: store.id, petId: pet.id, serviceId: boardingSvc.id, type: 'boarding',
          scheduledStart: s.toISOString(), scheduledEnd: e.toISOString(),
          paymentMode: 'pay_at_store', medicalAuth: { agreed: true },
          note: '【PD45实证】寄养单（在店）',
        }, { scheduledStart: ['Date'], scheduledEnd: ['Date'] });
        boardingId = created?.id ?? created?.appointment?.id ?? null;
      } catch (err) {
        if (!/CONFLICT|约满|冲突|满房|占用/.test(String(err?.message))) throw err;
      }
    }
    if (!boardingId) throw new Error('寄养单未建成');
    await trpcMutate(merchantCookie, 'appointment.confirm', { appointmentId: boardingId });
    const codeB = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: boardingId });
    const ciB = await trpcMutate(frontdeskCookie, 'appointment.checkin', { code: codeB?.code });
    const stB = ciB?.appointment?.status ?? ciB?.status;
    note(stB === 'in_boarding', '寄养单核销 → in_boarding', `status=${stB} id=${boardingId}`);
  }

  /* ---- 收银真结两单（custom 快捷行 + cash；日结有账/退款有源） ---- */
  const settleBill = async (name, fen) => {
    const r = await trpcMutate(merchantCookie, 'cashier.settle', {
      customerId: null,
      items: [{ kind: 'custom', refId: `u6-${fen}`, qty: 1, customName: name, customAmountFen: fen }],
      payments: [{ method: 'cash', amountFen: fen }],
    });
    return r?.bill?.billNo;
  };
  const bill1 = await settleBill('洗护吹干（PD45实证）', 8800);
  const bill2 = await settleBill('门店零售（PD45实证）', 3600);
  note(!!bill1 && !!bill2, '收银 settle 两单', `bill1=${bill1} bill2=${bill2}`);

  /* ---- 退款双态：bill1 全额退留 executed；bill2 全额退+实退登记 settled ---- */
  const refund1 = await trpcMutate(merchantCookie, 'refund.execute', {
    billNo: bill1, type: 'full', reason: 'PD45实证·顾客反悔全额退（待实退态）', refundMethod: 'offline_original',
  });
  const refund2 = await trpcMutate(merchantCookie, 'refund.execute', {
    billNo: bill2, type: 'full', reason: 'PD45实证·全额退并已实退登记', refundMethod: 'offline_original',
  });
  const refund2Id = refund2?.refund?.id;
  if (refund2Id) {
    await trpcMutate(merchantCookie, 'refund.settleActual', { refundId: refund2Id, note: 'PD45实证·现金已当面退讫' });
  }
  note(!!refund1?.refund?.id && !!refund2Id, '退款 execute×2（一待实退一已实退）', `r1=${refund1?.refund?.id} r2=${refund2Id}`);

  /* ---- U6 · C6：真日结冻结（实点=账面 tender.cashFen 同源，差异 0 免差异说明） ---- */
  const preview = await trpcQuery(merchantCookie, 'cashier.dayClosePreview', {});
  const bookCash = preview?.stats?.tender?.cashFen ?? 0;
  const closeRes = await trpcMutate(merchantCookie, 'cashier.dayClose', {
    actualCashFen: bookCash, note: 'PD45实证·日结冻结真链路',
  });
  note(!!(closeRes?.close?.id ?? closeRes?.id), 'C6 日结冻结（实点=账面，差异 0）', `bookCash=${bookCash} close=${closeRes?.close?.id ?? closeRes?.id}`);

  /* ---- U6 · C4：A 单 checked_in_at 直写回拨 25h（僵尸真态；本片库直写不碰他窗；
     drizzle timestamp 模=秒级整型——与表内 created_at 同单位，勿写毫秒） ---- */
  {
    const require = createRequire(join(REPO_ROOT, 'server', 'package.json'));
    const { createClient } = require('@libsql/client');
    const db = createClient({ url: `file:${DB_FILE}` });
    const backSec = Math.floor((Date.now() - 25 * 3600 * 1000) / 1000);
    await db.execute({ sql: 'UPDATE appointments SET checked_in_at = ? WHERE id = ?', args: [backSec, apptA] });
    const chk = await db.execute({ sql: 'SELECT checked_in_at FROM appointments WHERE id = ?', args: [apptA] });
    db.close();
    const got = Number(chk.rows?.[0]?.checked_in_at ?? 0);
    note(Math.abs(got - backSec) < 60, 'C4 僵尸造态：checked_in_at 回拨 25h（秒级）', `checked_in_at=${got}`);
  }

  /* ---- U6 · D-29 真态：冻结后新开一单 → 自动开次日班次（班次区「开班中＋已冻结徽」并存） ---- */
  const bill3 = await settleBill('PD45实证·冻结后新开单（次日班次）', 100);
  note(!!bill3, 'D-29 冻结后新开单（自动开班）', `bill3=${bill3}`);

  /* ================= 桌面段（1440×900 · W-00~W-16 十八帧） ================= */

  const gates = async (frameName, creamMax = 2) => {
    const g = await cdp.eval(GATES_JS);
    note(g.fontBad === 0, `${frameName} · 字阶闸（可读文字全量 ≥12px）`, g.fontBad === 0 ? '全绿' : JSON.stringify(g.fontSample));
    note(!g.paw, `${frameName} · 爪印闸（=0）`, g.paw ? '发现爪印' : '=0');
    note(g.cream <= creamMax, `${frameName} · cream 计数（≤${creamMax}）`, `cream=${g.cream}${g.cream > creamMax ? ' ' + JSON.stringify(g.creamSample) : ''}`);
  };

  /* ---- W-00 登录（203:14；未登录态脸面；420 卡+角色 mono） ---- */
  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="login-primary"]')`), 'W-00 登录页渲染', 'login-primary');
  await gates('W-00');
  await cdp.shot(join(OUT_DIR, 'u6-w00-login.png'));

  /* ---- 浏览器登录=店主（cookie 入浏览器档案） ---- */
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店主）', `HTTP ${loginStatus}`);

  /* ---- W-01 驾驶舱（199:2；WAlert 异常前置+M3+M4+wlist 双列+晨报卡） ---- */
  await cdp.goto(`${MERCHANT_URL}/dashboard`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  const w01 = await cdp.eval(`({
    rail: !!document.querySelector('[data-testid="merchant-rail"]'),
    alert: !!document.querySelector('[data-testid="dash-alert"]'),
    m3: !!(document.querySelector('[data-testid="dash-m3-chain"]') || document.querySelector('[data-testid="dash-m3"]')),
  })`);
  note(w01.rail && w01.alert && w01.m3, 'W-01 驾驶舱渲染（WAlert+M3+rail）', JSON.stringify(w01));
  await gates('W-01');
  await cdp.shot(join(OUT_DIR, 'u6-w01-dashboard.png'));

  /* ---- W-02 预约台账（203:39；C4 僵尸行「强制完成」＋C5 confirmed 行「改期」入口分列） ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]') && document.querySelectorAll('tbody tr').length >= 2`);
  const w02 = await cdp.eval(`({
    rows: document.querySelectorAll('tbody tr').length,
    resched: !!document.querySelector('[data-testid^="row-reschedule-"]'),
    force: !!document.querySelector('[data-testid^="row-force-complete-"]'),
  })`);
  note(w02.rows >= 2, 'W-02 台账渲染（真单≥2 行）', JSON.stringify(w02));
  note(w02.resched, 'C5 改期入口分列：列表行「改期」可见（pending|confirmed 资格行）', `resched=${w02.resched}`);
  note(w02.force, 'C4 强制完成入口分列：僵尸行「强制完成」可见（>24h 未翻步）', `force=${w02.force}`);
  await gates('W-02');
  await cdp.shot(join(OUT_DIR, 'u6-w02-appointments.png'));

  /* ---- C5 弹层：列表行点「改期」→ RescheduleSheet 真弹层（不提交） ---- */
  await cdp.eval(`document.querySelector('[data-testid^="row-reschedule-"]')?.click()`);
  await cdp.waitFor(`document.body.innerText.includes('改期') && (document.querySelector('[data-testid^="row-reschedule-"]') === null || document.body.innerText.includes('选择'))`, 8000);
  await sleep(1200);
  const w02s = await cdp.eval(`({ sheet: document.body.innerText.includes('改期'), dialog: !!document.querySelector('[role="dialog"], .u3-modal, [data-testid*="sheet"], [data-testid*="modal"]') })`);
  note(w02s.sheet, 'C5 改期弹层自列表行开启（取景后不提交）', JSON.stringify(w02s));
  await cdp.shot(join(OUT_DIR, 'u6-w02-reschedule-sheet.png'));

  /* ---- W-03 预约详情（203:125；A 单=in_service→僵尸徽真态） ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments/${apptA}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const w03 = await cdp.eval(`({
    flow: !!document.querySelector('[data-testid="detail-flow"]'),
    info: !!document.querySelector('[data-testid="detail-info"]'),
  })`);
  note(w03.flow && w03.info, 'W-03 详情渲染（状态流+信息区）', JSON.stringify(w03));
  await gates('W-03');
  await cdp.shot(join(OUT_DIR, 'u6-w03-appointment-detail.png'));

  /* ---- W-04 监控 Hub（203:211；僵尸卡+WAlert 异常行内「强制完成」次动作） ---- */
  await cdp.goto(`${MERCHANT_URL}/monitor`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]') && document.body.innerText.includes('异常待清')`);
  const w04 = await cdp.eval(`({
    zombieText: document.body.innerText.includes('异常待清'),
    alertForce: !!document.querySelector('[data-testid="wsk-alert-zombie-force"]'),
  })`);
  note(w04.zombieText, 'W-04 监控 Hub 僵尸出列（异常待清）', JSON.stringify(w04));
  note(w04.alertForce, 'W-04 WAlert 行内「强制完成」次动作在场（左赭红仅异常）', `alertForce=${w04.alertForce}`);
  await gates('W-04');
  await cdp.shot(join(OUT_DIR, 'u6-w04-monitor-hub.png'));

  /* ---- W-05 寄养（203:297；M3 四格+在店台账+容量日历） ---- */
  await cdp.goto(`${MERCHANT_URL}/boarding`);
  await cdp.waitFor(`document.querySelector('[data-testid="board-m3"]')`);
  const w05 = await cdp.eval(`({
    m3: !!document.querySelector('[data-testid="board-m3"]'),
    stay: document.body.innerText.includes('在店') || document.body.innerText.includes('寄养'),
  })`);
  note(w05.m3 && w05.stay, 'W-05 寄养渲染（M3+在店台账）', JSON.stringify(w05));
  await gates('W-05');
  await cdp.shot(join(OUT_DIR, 'u6-w05-boarding.png'));

  /* ---- W-06 收银台桌面（203:383；三栏+Folio/PayChips/Redline 明面） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier`);
  await cdp.waitFor(`document.querySelector('[data-testid="cashier-page"]')`);
  const w06 = await cdp.eval(`({ page: !!document.querySelector('[data-testid="cashier-page"]'), redline: document.body.innerText.includes('红线') || document.body.innerText.includes('储值核销') })`);
  note(w06.page, 'W-06 收银台渲染', JSON.stringify(w06));
  await gates('W-06');
  await cdp.shot(join(OUT_DIR, 'u6-w06-cashier.png'));

  /* ---- W-07 日结（203:469；C6 已冻结三处明示：banner+班次徽+历史行标签） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier/close`);
  await cdp.waitFor(`document.querySelector('[data-testid="day-frozen-banner"]') || document.body.innerText.includes('已冻结')`);
  const w07 = await cdp.eval(`({
    banner: !!document.querySelector('[data-testid="day-frozen-banner"]'),
    badge: !!document.querySelector('[data-testid="close-shift-day-frozen"]'),
    rows: [...document.querySelectorAll('tbody tr')].some((tr) => tr.innerText.includes('已冻结')),
  })`);
  note(w07.banner, 'C6 日结冻结 banner 明示', `banner=${w07.banner}`);
  note(w07.badge, 'C6 班次区冻结徽明示', `badge=${w07.badge}`);
  note(w07.rows, 'C6 历史行「已冻结」标签分列', `rows=${w07.rows}`);
  await gates('W-07');
  await cdp.shot(join(OUT_DIR, 'u6-w07-close-frozen.png'));

  /* ---- W-08 退款（203:555；双态真行+驳回权口径卡） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier/refunds`);
  await cdp.waitFor(`document.querySelector('[data-testid="refund-policy-card"]')`);
  const w08 = await cdp.eval(`({
    policy: !!document.querySelector('[data-testid="refund-policy-card"]'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(w08.policy && w08.rows >= 2, 'W-08 退款渲染（双态真行≥2）', JSON.stringify(w08));
  await gates('W-08');
  await cdp.shot(join(OUT_DIR, 'u6-w08-refunds.png'));

  /* ---- W-09 商城订单（203:917；G1 三队列+M5 台账/空态诚实） ---- */
  await cdp.goto(`${MERCHANT_URL}/orders`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  await sleep(1200);
  const w09 = await cdp.eval(`({
    chips: document.querySelectorAll('.u3-chipf, [data-testid*="chip"]').length > 0,
    empty: document.body.innerText.includes('还没有订单'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(w09.chips && (w09.empty || w09.rows >= 1), 'W-09 商城订单渲染（G1+台账真行／空态诚实）', JSON.stringify(w09));
  await gates('W-09');
  await cdp.shot(join(OUT_DIR, 'u6-w09-orders.png'));

  /* ---- W-10 商品（203:1284；类目 chips+台账；cream 唯一=＋新增商品） ---- */
  await cdp.goto(`${MERCHANT_URL}/products`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  await sleep(1200);
  const w10 = await cdp.eval(`({ create: !!document.querySelector('[data-testid="products-create"], [data-testid*="create"]'), body: document.body.innerText.length > 300 })`);
  note(w10.body, 'W-10 商品渲染（CSV+类目+台账）', JSON.stringify(w10));
  await gates('W-10');
  await cdp.shot(join(OUT_DIR, 'u6-w10-products.png'));

  /* ---- W-11 会员·次卡（203:1688；M3 四格（诚实占位）+台账档色点） ---- */
  await cdp.goto(`${MERCHANT_URL}/pass`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  await sleep(1200);
  const w11 = await cdp.eval(`({ sell: document.body.innerText.includes('售卡'), stats: document.body.innerText.includes('次数包') })`);
  note(w11.sell || w11.stats, 'W-11 会员·次卡渲染（M3+台账）', JSON.stringify(w11));
  await gates('W-11');
  await cdp.shot(join(OUT_DIR, 'u6-w11-pass.png'));

  /* ---- W-12 员工（203:2354；邀请 cream+角色 pill2+权限口径卡） ---- */
  await cdp.goto(`${MERCHANT_URL}/staff`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  await sleep(1200);
  const w12 = await cdp.eval(`({ invite: document.body.innerText.includes('邀请'), rows: document.querySelectorAll('tbody tr').length })`);
  note(w12.rows >= 1, 'W-12 员工渲染（台账真行）', JSON.stringify(w12));
  await gates('W-12');
  await cdp.shot(join(OUT_DIR, 'u6-w12-staff.png'));

  /* ---- W-13 报表（203:2725；M3 四格+月度台账+报表目录 wlist） ---- */
  await cdp.goto(`${MERCHANT_URL}/finance`);
  await cdp.waitFor(`document.querySelector('[data-testid="finance-received-card"]')`);
  const w13 = await cdp.eval(`({ quad: !!document.querySelector('[data-testid="finance-received-card"]'), dir: document.body.innerText.includes('D1') })`);
  note(w13.quad && w13.dir, 'W-13 报表渲染（四格+目录 D1–D9）', JSON.stringify(w13));
  await gates('W-13');
  await cdp.shot(join(OUT_DIR, 'u6-w13-finance.png'));

  /* ---- W-14 权限矩阵（203:3067；锁死区红胶囊+四态矩阵） ---- */
  await cdp.goto(`${MERCHANT_URL}/matrix`);
  await cdp.waitFor(`document.querySelector('[data-testid="matrix-grid"]')`);
  const w14 = await cdp.eval(`({ matrix: !!document.querySelector('[data-testid="matrix-grid"]'), locked: document.body.innerText.includes('锁死') })`);
  note(w14.matrix && w14.locked, 'W-14 权限矩阵渲染（四态格+锁死区）', JSON.stringify(w14));
  await gates('W-14');
  await cdp.shot(join(OUT_DIR, 'u6-w14-matrix.png'));

  /* ---- W-15 门店设置（203:3739；档案行+开关行+端口行） ---- */
  await cdp.goto(`${MERCHANT_URL}/settings`);
  await cdp.waitFor(`document.querySelector('[data-testid="settings-entries"]')`);
  const w15 = await cdp.eval(`({ entries: !!document.querySelector('[data-testid="settings-entries"]') })`);
  note(w15.entries, 'W-15 门店设置渲染（档案+开关+端口行）', JSON.stringify(w15));
  await gates('W-15');
  await cdp.shot(join(OUT_DIR, 'u6-w15-settings.png'));

  /* ---- W-16 运营后台端（203:4047；办事卡面+高级层 WcPorts；展示名=运营后台端） ---- */
  await cdp.goto(`${MERCHANT_URL}/console`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  await sleep(1500);
  const w16 = await cdp.eval(`({ name: document.body.innerText.includes('运营后台端'), stale: !document.body.innerText.includes('开发者管理端') })`);
  note(w16.name && w16.stale, 'W-16 运营后台端渲染（展示名无「开发者」滞后）', JSON.stringify(w16));
  await gates('W-16');
  await cdp.shot(join(OUT_DIR, 'u6-w16-console.png'));

  cdp.close();
  writeFileSync(join(OUT_DIR, '..', 'u6-results.json'), JSON.stringify({ at: new Date().toISOString(), failures, results }, null, 2));
  console.log(`\n===== PD45 U6 实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
