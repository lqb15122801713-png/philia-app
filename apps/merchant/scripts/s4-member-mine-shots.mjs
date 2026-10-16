#!/usr/bin/env node
/**
 * 片4-运营商城 · 商家桌面实尺截图实证（产品-1015 换皮 · A1 W-09~W-11 / A2 W-12~W-14 / A3 W-15~W-16）
 *
 * 口径（学 片3 s3-merchant-face-shots.mjs）：
 * - 真实链路驱动，不画假态：客户商城真下单（mall.createOrder pickup）→ pay.createOrder
 *   + /api/pay/orders/mock-callback success 真支付（mock 通道既有演示链路）→ 商家 /orders
 *   待发货真行；店主 pass.topUp 真售卡（次卡台账+流水）；cashier.settle 真结一单（财务有今日已收）。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期指向本片 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口=桌面 1440×900 实尺（deviceScaleFactor:1）。
 * - 前置：本片 server（7242）+ merchant preview（7164）已起；库跑前 seed 复位。
 * - 错口：他窗栈一概不碰；本片只用 7164/7242/9242。
 *
 * 用法：node apps/merchant/scripts/s4-member-mine-shots.mjs
 * 环境变量：MERCHANT_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7164').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7242').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9242);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'design-s4-member-mine', 'shots');
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

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  const profile = join(tmpdir(), `s4-member-mine-${Date.now()}`);
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

  /* ---- 种子账号（菲丽亚店主=owner / 示例客户） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const customerCookie = await devLogin(uidOf('示例客户'));
  const merchantCookie = await devLogin(uidOf('菲丽亚店主'));
  const customerUserId = uidOf('示例客户');
  const ownerUserId = uidOf('菲丽亚店主');

  /* ---- 商城真下单 + mock 真支付（/orders 待发货真行） ---- */
  const prods = await trpcQuery(customerCookie, 'mall.listProducts', { page: 1, pageSize: 1 });
  const prod = prods?.items?.[0];
  if (!prod) throw new Error('种子无商品');
  const order = await trpcMutate(customerCookie, 'mall.createOrder', {
    items: [{ productId: prod.id, qty: 1 }],
    deliveryMethod: 'pickup',
  });
  const orderId = order?.order?.id ?? order?.id;
  note(!!orderId, '商城真下单（pickup）', `orderId=${orderId}`);
  if (orderId) {
    const payOrder = await trpcMutate(customerCookie, 'pay.createOrder', { bizDomain: 'mall', orderId });
    const payOrderId = payOrder?.order?.id ?? payOrder?.id ?? payOrder?.payOrderId;
    if (payOrderId) {
      const cb = await fetch(`${API_BASE}/api/pay/orders/mock-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
        body: JSON.stringify({ orderId: payOrderId, scenario: 'success' }),
      });
      note(cb.ok, 'mock 真支付（既有演示链路）', `HTTP ${cb.status}`);
    } else {
      note(false, 'pay.createOrder 未返支付单', JSON.stringify(payOrder)?.slice(0, 120));
    }
  }
  const storeOrders = await trpcQuery(merchantCookie, 'mall.listStoreOrders');
  note((storeOrders?.groups?.paid?.length ?? 0) >= 1, '商家待发货队列真行≥1', `paid=${storeOrders?.groups?.paid?.length}`);

  /* ---- 预约记录前置（pass.listCustomers 口径：本店有预约或已持本店卡才可售卡） ---- */
  const nearby = await trpcQuery(customerCookie, 'store.listNearby', {});
  const store = nearby?.stores?.[0];
  const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id });
  const groomingSvc = detail?.services?.find((s) => s.type === 'grooming');
  const pets = await trpcQuery(customerCookie, 'pet.list');
  const pet = pets?.[0];
  {
    let apptId = null;
    /* 预约落次日早班窗（当日尾盘易撞打烊闸；本前置只需「本店有预约」记录，明日单同效） */
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() + 1);
    dayStart.setHours(9, 30, 0, 0);
    for (let i = 0; i < 20 && !apptId; i++) {
      const start = new Date(dayStart.getTime() + i * 30 * 60_000);
      try {
        const created = await trpcMutate(customerCookie, 'appointment.create', {
          storeId: store.id, petId: pet.id, serviceId: groomingSvc.id, type: 'grooming',
          scheduledStart: start.toISOString(), paymentMode: 'pay_at_store',
          note: '【片4实证】预约（售卡前置）',
        }, { scheduledStart: ['Date'] });
        apptId = created?.id ?? created?.appointment?.id ?? null;
      } catch (e) {
        if (!/CONFLICT|约满|冲突/.test(String(e?.message))) throw e;
      }
    }
    if (!apptId) throw new Error('预约未建成（售卡前置）');
    await trpcMutate(merchantCookie, 'appointment.confirm', { appointmentId: apptId });
    note(true, '预约建成并 confirm（售卡前置口径）', `appt=${apptId}`);
  }

  /* ---- 次卡真售卡（/pass 台账+流水） ---- */
  const topUp = await trpcMutate(merchantCookie, 'pass.topUp', { userId: customerUserId, times: 10 });
  note(!!topUp?.pass?.id, '售卡 topUp×10 次', `remain=${topUp?.pass?.remainTimes}`);

  /* ---- 收银真结一单（/finance 今日已收真值） ---- */
  const settle = await trpcMutate(merchantCookie, 'cashier.settle', {
    customerId: null,
    items: [{ kind: 'custom', refId: 's4-finance-1', qty: 1, customName: '门店零售（片4实证）', customAmountFen: 6800 }],
    payments: [{ method: 'cash', amountFen: 6800 }],
  });
  note(!!settle?.bill?.billNo, '收银 settle 一单', `billNo=${settle?.bill?.billNo}`);

  /* ---- 浏览器登录=店主（页内 fetch，cookie 入浏览器档案） ---- */
  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店主）', `HTTP ${loginStatus}`);

  /* ---- A1 · W-09 商城订单（203:917；待发货真行） ---- */
  await cdp.goto(`${MERCHANT_URL}/orders`);
  await cdp.waitFor(`document.querySelector('[data-testid="orders-page"]')`);
  const d01 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="orders-page"]'),
    rows: document.querySelectorAll('tbody tr').length,
    note: !!document.querySelector('[data-testid="orders-rebate-note"]'),
  })`);
  note(d01.page && d01.rows >= 1, 'A1 W-09 商城订单渲染（待发货真行）', JSON.stringify(d01));
  await cdp.shot(join(OUT_DIR, 'd01-w09-orders.png'));

  /* ---- A1 · W-10 商品（203:1284；台账真行+成本列 owner 视界） ---- */
  await cdp.goto(`${MERCHANT_URL}/products`);
  await cdp.waitFor(`document.querySelector('[data-testid="products-page"]')`);
  const d02 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="products-page"]'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(d02.page && d02.rows >= 1, 'A1 W-10 商品渲染（台账真行）', JSON.stringify(d02));
  await cdp.shot(join(OUT_DIR, 'd02-w10-products.png'));

  /* ---- A1 · W-11 会员·次卡（203:1688；售卡真行+流水） ---- */
  await cdp.goto(`${MERCHANT_URL}/pass`);
  await cdp.waitFor(`document.querySelector('[data-testid="pass-page"]')`);
  const d03 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="pass-page"]'),
    stats: !!document.querySelector('[data-testid="pass-stats"]'),
    rows: document.querySelectorAll('tbody tr').length,
  })`);
  note(d03.page && d03.stats && d03.rows >= 1, 'A1 W-11 会员·次卡渲染（真卡+流水）', JSON.stringify(d03));
  await cdp.shot(join(OUT_DIR, 'd03-w11-pass.png'));

  /* ---- A2 · W-12 员工（203:2354；种子员工台账） ---- */
  await cdp.goto(`${MERCHANT_URL}/staff`);
  await cdp.waitFor(`document.querySelector('[data-testid="staff-page"]')`);
  const d04 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="staff-page"]'),
    rows: document.querySelectorAll('tbody tr').length,
    perm: !!document.querySelector('[data-testid="staff-perm-card"]'),
  })`);
  note(d04.page && d04.rows >= 2 && d04.perm, 'A2 W-12 员工渲染（台账+权限口径卡）', JSON.stringify(d04));
  await cdp.shot(join(OUT_DIR, 'd04-w12-staff.png'));

  /* ---- A2 · W-13 报表（203:2725 总览；今日已收真值） ---- */
  await cdp.goto(`${MERCHANT_URL}/finance`);
  await cdp.waitFor(`document.querySelector('[data-testid="finance-received-card"]')`);
  const d05 = await cdp.eval(`({
    received: !!document.querySelector('[data-testid="finance-received-card"]'),
    body: document.body.innerText.length > 400,
  })`);
  note(d05.received && d05.body, 'A2 W-13 财务总览渲染（今日真结在账）', JSON.stringify(d05));
  await cdp.shot(join(OUT_DIR, 'd05-w13-finance.png'));

  /* ---- A2 · W-13 报表详情（203:2725 族 · d1 代表行） ---- */
  await cdp.goto(`${MERCHANT_URL}/finance/report/d1`);
  await cdp.waitFor(`document.body.innerText.includes('导出') || document.querySelector('tbody') || document.body.innerText.length > 200`);
  const d06 = await cdp.eval(`({
    body: document.body.innerText.length > 200,
    tbl: !!document.querySelector('tbody'),
    month: document.body.innerText.includes('月') || document.body.innerText.includes('导出'),
  })`);
  note(d06.body || d06.month, 'A2 W-13 报表详情 d1 渲染', JSON.stringify(d06));
  await cdp.shot(join(OUT_DIR, 'd06-w13-report-d1.png'));

  /* ---- A2 · W-14 权限矩阵（203:3067；静态四态只读） ---- */
  await cdp.goto(`${MERCHANT_URL}/matrix`);
  await cdp.waitFor(`document.body.innerText.includes('权限矩阵')`);
  const d07 = await cdp.eval(`({
    text: document.body.innerText.includes('权限矩阵'),
    lock: document.body.innerText.includes('锁死'),
  })`);
  note(d07.text, 'A2 W-14 权限矩阵渲染', JSON.stringify(d07));
  await cdp.shot(join(OUT_DIR, 'd07-w14-matrix.png'));

  /* ---- A3 · W-15 门店设置（203:3739） ---- */
  await cdp.goto(`${MERCHANT_URL}/settings`);
  await cdp.waitFor(`document.querySelector('[data-testid="settings-page"]')`);
  const d08 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="settings-page"]'),
    name: document.body.innerText.includes('门店名称'),
  })`);
  note(d08.page && d08.name, 'A3 W-15 门店设置渲染', JSON.stringify(d08));
  await cdp.shot(join(OUT_DIR, 'd08-w15-settings.png'));

  /* ---- A3 · W-16 运营后台端（203:4047；展示名不回退 PD-25） ---- */
  await cdp.goto(`${MERCHANT_URL}/console`);
  await cdp.waitFor(`document.querySelector('[data-testid="console-home"]') || document.body.innerText.includes('运营后台端')`);
  const d09 = await cdp.eval(`({
    home: !!document.querySelector('[data-testid="console-home"]'),
    named: document.body.innerText.includes('运营后台端'),
  })`);
  note(d09.home || d09.named, 'A3 W-16 运营后台端渲染（展示名不回退）', JSON.stringify(d09));
  await cdp.shot(join(OUT_DIR, 'd09-w16-console.png'));

  cdp.close();
  console.log(`\n===== 片4 商家桌面实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
