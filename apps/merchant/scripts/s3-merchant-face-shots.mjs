#!/usr/bin/env node
/**
 * 片3-商家收银 · 实尺截图实证（产品-1015 换皮 · A1 W-00 / A2 W-02·W-03 / A3 W-04 /
 * A4 W-05 / A5 W-06·W-07·W-08 / A6 手机五槽）
 *
 * 口径（学 片2 s2-staff-face-shots.mjs）：
 * - 真实链路驱动，不画假态：dev-seed-users 取种子 → 客户真下单 appointment.create
 *   （洗护×2 今日）→ 店主 confirm+assign 钉美容师「阿强」→ 前台「小美」人工码 checkin
 *   A 单 → in_service（监控 Hub 真态）；寄养单 create（medicalAuth 签署）→ confirm →
 *   checkin → in_boarding（寄养屏真在店）；收银 settle 真结两单（custom 快捷行+cash），
 *   退款 execute 两笔（一笔留 executed 待实退、一笔 settleActual 实退登记）——
 *   日结有账、退款单列表双态皆真。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期指向本片 server 口）；
 *   开发期也可指 dev server（同口同源口径）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口双段：桌面 W 帧 1440×900；手机五槽帧 390×844 mobile（实尺）。
 * - 前置：本片 server（7241）+ merchant（7161）已起；库跑前 seed 复位。
 * - 错口：他窗栈 7100-7112/7150-7152/7200-7201/7231/9223-9235 一概不碰；本片 7161/7241/9236。
 *
 * 用法：node apps/merchant/scripts/s3-merchant-face-shots.mjs
 * 环境变量：MERCHANT_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7161').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7241').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9236);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'design-s3-merchant-face', 'shots');
const NAV_WAIT = 4200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

let failures = 0;
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/* ---- tRPC HTTP（batch=1 + superjson 线格式；与片2 同范式） ---- */
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
  /** 内容落定等候：表达式为真即返，超时返回 false（实证预算 60s：重构机高负载时
      headless 主线程解析大块 chunk 可卡顿十余秒，查询本身毫秒级——等真态不等死数） */
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

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  const profile = join(tmpdir(), `s3-merchant-face-${Date.now()}`);
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

  /* ---- 洗护单 A/B（今日；A=核销进服务中，B=保持 confirmed 台账行） ---- */
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
          note: `【片3实证】${tag}`,
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
  const apptA = await mkAppt(1, 'A 单（核销进服务中）');
  const apptB = await mkAppt(10, 'B 单（台账 confirmed 行）');
  note(true, '造单：A/B 洗护单 confirmed 且指派阿强', `A=${apptA} B=${apptB}`);

  /* ---- A 单核销 → in_service（监控 Hub 真服务中卡） ---- */
  const codeA = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: apptA });
  const checkin = await trpcMutate(frontdeskCookie, 'appointment.checkin', { code: codeA?.code });
  const stA = checkin?.appointment?.status ?? checkin?.status;
  note(stA === 'in_service', 'A 单核销 → in_service', `status=${stA}`);

  /* ---- 寄养单（今日入住·明日退房）→ confirm → checkin → in_boarding（寄养屏真在店） ---- */
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
          note: '【片3实证】寄养单（在店）',
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
      items: [{ kind: 'custom', refId: `s3-${fen}`, qty: 1, customName: name, customAmountFen: fen }],
      payments: [{ method: 'cash', amountFen: fen }],
    });
    return r?.bill?.billNo;
  };
  const bill1 = await settleBill('洗护吹干（片3实证）', 8800);
  const bill2 = await settleBill('门店零售（片3实证）', 3600);
  note(!!bill1 && !!bill2, '收银 settle 两单', `bill1=${bill1} bill2=${bill2}`);

  /* ---- 退款双态：bill1 全额退留 executed（待实退）；bill2 全额退+实退登记 settled ---- */
  const refund1 = await trpcMutate(merchantCookie, 'refund.execute', {
    billNo: bill1, type: 'full', reason: '片3实证·顾客反悔全额退（待实退态）', refundMethod: 'offline_original',
  });
  const refund2 = await trpcMutate(merchantCookie, 'refund.execute', {
    billNo: bill2, type: 'full', reason: '片3实证·全额退并已实退登记', refundMethod: 'offline_original',
  });
  const refund2Id = refund2?.refund?.id;
  if (refund2Id) {
    await trpcMutate(merchantCookie, 'refund.settleActual', { refundId: refund2Id, note: '片3实证·现金已当面退讫' });
  }
  note(!!refund1?.refund?.id && !!refund2Id, '退款 execute×2（一待实退一已实退）', `r1=${refund1?.refund?.id} r2=${refund2Id}`);

  /* ================= 桌面段（1440×900） ================= */

  /* ---- A1 · W-00 登录（203:14；未登录态脸面） ---- */
  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="login-primary"]')`), 'A1 W-00 登录页渲染', 'login-primary');
  await cdp.shot(join(OUT_DIR, 'd01-w00-login.png'));

  /* ---- 浏览器登录=店主（页内 fetch，cookie 入浏览器档案） ---- */
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店主）', `HTTP ${loginStatus}`);

  /* ---- A2 · W-02 预约台账（203:39） ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]')`);
  const d02 = await cdp.eval(`({
    rail: !!document.querySelector('[data-testid="merchant-rail"]'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(d02.rail && d02.rows >= 2, 'A2 W-02 台账渲染（真单≥2 行）', JSON.stringify(d02));
  await cdp.shot(join(OUT_DIR, 'd02-w02-appointments.png'));

  /* ---- A2 · W-03 预约详情（203:125；A 单=in_service 真态） ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments/${apptA}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const d03 = await cdp.eval(`({
    flow: !!document.querySelector('[data-testid="detail-flow"]'),
    info: !!document.querySelector('[data-testid="detail-info"]'),
  })`);
  note(d03.flow && d03.info, 'A2 W-03 详情渲染（状态流+信息区）', JSON.stringify(d03));
  await cdp.shot(join(OUT_DIR, 'd03-w03-appointment-detail.png'));

  /* ---- A3 · W-04 监控 Hub（203:211；A 单服务中真卡；不重做 IA） ---- */
  await cdp.goto(`${MERCHANT_URL}/monitor`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-rail"]') && document.body.innerText.includes('阿强')`);
  const d04 = await cdp.eval(`({
    rail: !!document.querySelector('[data-testid="merchant-rail"]'),
    cards: document.querySelectorAll('.mon-card').length,
    text: document.body.innerText.includes('阿强'),
  })`);
  note(d04.rail && (d04.cards >= 1 || d04.text), 'A3 W-04 监控 Hub 渲染（服务中真卡）', JSON.stringify(d04));
  await cdp.shot(join(OUT_DIR, 'd04-w04-monitor-hub.png'));

  /* ---- A4 · W-05 寄养（203:297；寄养单在店真态） ---- */
  await cdp.goto(`${MERCHANT_URL}/boarding`);
  await cdp.waitFor(`document.querySelector('[data-testid="board-m3"]')`);
  const d05 = await cdp.eval(`({
    m3: !!document.querySelector('[data-testid="board-m3"]'),
    stay: document.body.innerText.includes('在店') || document.body.innerText.includes('寄养'),
  })`);
  note(d05.m3 && d05.stay, 'A4 W-05 寄养渲染（M3+在店台账）', JSON.stringify(d05));
  await cdp.shot(join(OUT_DIR, 'd05-w05-boarding.png'));

  /* ---- A5 · W-06 收银台桌面（203:383；Folio/PayChips/Redline 族明面） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier`);
  await cdp.waitFor(`document.querySelector('[data-testid="cashier-page"]')`);
  const d06 = await cdp.eval(`!!document.querySelector('[data-testid="cashier-page"]')`);
  note(d06, 'A5 W-06 收银台渲染', 'cashier-page');
  await cdp.shot(join(OUT_DIR, 'd06-w06-cashier.png'));

  /* ---- A5 · W-07 日结（203:469；今日有真账；五查询页等候内容落定） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier/close`);
  await cdp.waitFor(`document.body.innerText.includes('今日账面四分列') || document.body.innerText.includes('交接班（闭班）')`);
  const d07 = await cdp.eval(`({
    body: document.body.innerText.length > 400,
    money: document.body.innerText.includes('今日账面四分列') || document.body.innerText.includes('日结'),
  })`);
  note(d07.body && d07.money, 'A5 W-07 日结渲染（今日真结两单在账）', JSON.stringify(d07));
  await cdp.shot(join(OUT_DIR, 'd07-w07-close.png'));

  /* ---- A5 · W-08 退款（203:555；executed 待实退+settled 双态真行） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier/refunds`);
  await cdp.waitFor(`document.querySelector('[data-testid="refund-policy-card"]')`);
  const d08 = await cdp.eval(`({
    policy: !!document.querySelector('[data-testid="refund-policy-card"]'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(d08.policy && d08.rows >= 2, 'A5 W-08 退款渲染（双态真行≥2）', JSON.stringify(d08));
  await cdp.shot(join(OUT_DIR, 'd08-w08-refunds.png'));

  /* ================= 手机段（390×844 mobile 实尺 · 五槽） ================= */
  await cdp.viewport(390, 844, true);

  const dockOk = async () => await cdp.eval(`({
    dock: !!document.querySelector('[data-testid="merchant-dock"]'),
    slots: document.querySelectorAll('[data-testid="merchant-dock"] a, [data-testid="merchant-dock"] button').length,
  })`);

  /* ---- A6 · 槽一 总览（198:374 → /dashboard；owner=连锁视图 dash-m3-chain，单店口径=dash-m3） ---- */
  await cdp.goto(`${MERCHANT_URL}/dashboard`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-dock"]')`);
  const p01 = await dockOk();
  p01.m3 = await cdp.eval(`!!(document.querySelector('[data-testid="dash-m3-chain"]') || document.querySelector('[data-testid="dash-m3"]'))`);
  note(p01.dock && p01.m3, 'A6 手机总览（198:374）', JSON.stringify(p01));
  await cdp.shot(join(OUT_DIR, 'p01-phone-overview.png'));

  /* ---- A6 · 槽二 门店（203:5219 → /appointments 含寄养） ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments`);
  await cdp.waitFor(`document.querySelector('[data-testid="merchant-dock"]')`);
  const p02 = await dockOk();
  p02.rows = await cdp.eval(`document.querySelectorAll('tbody tr').length`);
  note(p02.dock && p02.rows >= 2, 'A6 手机门店（203:5219）', JSON.stringify(p02));
  await cdp.shot(join(OUT_DIR, 'p02-phone-store.png'));

  /* ---- A6 · 槽三 收银（198:445 → /cashier） ---- */
  await cdp.goto(`${MERCHANT_URL}/cashier`);
  await cdp.waitFor(`document.querySelector('[data-testid="cashier-page"]')`);
  const p03 = await dockOk();
  p03.cashier = await cdp.eval(`!!document.querySelector('[data-testid="cashier-page"]')`);
  note(p03.dock && p03.cashier, 'A6 手机收银（198:445）', JSON.stringify(p03));
  await cdp.shot(join(OUT_DIR, 'p03-phone-cashier.png'));

  /* ---- A6 · 槽四 报表简（203:5365 → /finance） ---- */
  await cdp.goto(`${MERCHANT_URL}/finance`);
  await cdp.waitFor(`document.querySelector('[data-testid="finance-received-card"]')`);
  const p04 = await dockOk();
  p04.quad = await cdp.eval(`!!document.querySelector('[data-testid="finance-received-card"]')`);
  note(p04.dock && p04.quad, 'A6 手机报表简（203:5365）', JSON.stringify(p04));
  await cdp.shot(join(OUT_DIR, 'p04-phone-report.png'));

  /* ---- A6 · 槽五 我的（203:5480 → /settings 暂驻） ---- */
  await cdp.goto(`${MERCHANT_URL}/settings`);
  await cdp.waitFor(`document.querySelector('[data-testid="settings-entries"]')`);
  const p05 = await dockOk();
  p05.entries = await cdp.eval(`!!document.querySelector('[data-testid="settings-entries"]')`);
  note(p05.dock && p05.entries, 'A6 手机我的（203:5480）', JSON.stringify(p05));
  await cdp.shot(join(OUT_DIR, 'p05-phone-me.png'));

  cdp.close();
  console.log(`\n===== 片3 实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
