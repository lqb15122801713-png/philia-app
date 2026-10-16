#!/usr/bin/env node
/**
 * 片4-运营商城 · 客户端实尺截图实证（产品-1015 换皮 · A4 商城/PHILIA/回馈金表面）
 *
 * 口径（学 片3 s3 工艺）：
 * - 真实链路驱动，不画假态：浏览器 dev-login 示例客户 → /mall 真商品流（种子商品
 *   createdAt 即种子时刻，新品角标真命中）→ 真点快加购（mall-quickadd-* 点击）→
 *   购物车真行 → 结算真单预览；/philia=PGC 杂志面（批C 槽位内容真读）；
 *   /me=山姆骨架身份大卡（真会员态）；/member/rebate=回馈金账本真值。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期指向本片 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口=390×844 mobile 实尺（deviceScaleFactor:1）。
 * - 前置：本片 server（7242）+ customer preview（7163）已起；库跑前 seed 复位。
 * - 错口：他窗栈一概不碰；本片只用 7163/7242/9243。
 *
 * 用法：node apps/customer/scripts/s4-member-mine-shots.mjs
 * 环境变量：CUSTOMER_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7163').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7242').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9243);
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
async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

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
  const profile = join(tmpdir(), `s4-member-mine-cust-${Date.now()}`);
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

  /* ---- 种子客户 + 浏览器登录 ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const customerCookie = await devLogin(uidOf('示例客户'));
  const customerUserId = uidOf('示例客户');
  const prods = await trpcQuery(customerCookie, 'mall.listProducts', { page: 1, pageSize: 5 });
  const firstProd = prods?.items?.[0];
  if (!firstProd) throw new Error('种子无商品');

  await cdp.goto(`${CUSTOMER_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（示例客户）', `HTTP ${loginStatus}`);

  /* ---- A4 · PHILIA 杂志（187:2；PGC 策展面 · 批C 槽位内容真读） ---- */
  await cdp.goto(`${CUSTOMER_URL}/philia`);
  await cdp.waitFor(`document.querySelector('[data-testid="philia-magazine"]')`);
  const c01 = await cdp.eval(`({
    page: !!document.querySelector('[data-testid="philia-magazine"]'),
    lead: !!document.querySelector('[data-testid="philia-mag-lead"]'),
    e2: !!document.querySelector('[data-testid="philia-mag-entry-2"]'),
    noteTxt: document.body.innerText.includes('编辑部出品'),
  })`);
  note(c01.page && c01.lead && c01.e2, 'A4 PHILIA 杂志渲染（主打+条目+PGC 注）', JSON.stringify(c01));
  await cdp.shot(join(OUT_DIR, 'c01-philia-magazine.png'));

  /* ---- A4 · 商城首页（188:2；mall.hero 槽位横幅+类目 chip+回馈金 hint+新品角标） ---- */
  await cdp.goto(`${CUSTOMER_URL}/mall`);
  await cdp.waitFor(`document.querySelector('[data-testid="mall-hero"]')`);
  const c02 = await cdp.eval(`({
    hero: !!document.querySelector('[data-testid="mall-hero"]'),
    cat: !!document.querySelector('[data-testid="mall-cat-全部"]'),
    cards: document.querySelectorAll('[data-testid^="mall-quickadd-"]').length,
    badge: document.querySelectorAll('[data-testid^="mall-badge-new-"]').length,
    dock: !!document.querySelector('[data-testid="app-dock"]') || document.body.innerText.includes('商城'),
  })`);
  note(c02.hero && c02.cat && c02.cards >= 1, 'A4 商城首页渲染（hero+chip+商品流）', JSON.stringify(c02));
  await cdp.shot(join(OUT_DIR, 'c02-mall-home.png'));

  /* ---- 真点快加购（第一件在售商品） → 购物车真行 ---- */
  await cdp.eval(`document.querySelector('[data-testid^="mall-quickadd-"]')?.click()`);
  await sleep(900);
  await cdp.goto(`${CUSTOMER_URL}/mall/cart`);
  await cdp.waitFor(`document.body.innerText.includes('购物袋')`);
  const c03 = await cdp.eval(`({
    title: document.body.innerText.includes('购物袋'),
    checkout: document.body.innerText.includes('去结算'),
    rebate: document.body.innerText.includes('回馈金'),
  })`);
  note(c03.title && c03.checkout, 'A4 购物车渲染（真行+结算入口）', JSON.stringify(c03));
  await cdp.shot(join(OUT_DIR, 'c03-mall-cart.png'));

  /* ---- A4 · 结算（189:56；费用明细+回馈金返显 sub） ---- */
  await cdp.goto(`${CUSTOMER_URL}/mall/checkout`);
  await cdp.waitFor(`document.body.innerText.includes('确认订单') || document.body.innerText.includes('没有待结算')`);
  const c04 = await cdp.eval(`({
    title: document.body.innerText.includes('确认订单'),
    submit: document.body.innerText.includes('提交订单'),
  })`);
  note(c04.title, 'A4 结算渲染（费用明细+提交闸）', JSON.stringify(c04));
  await cdp.shot(join(OUT_DIR, 'c04-mall-checkout.png'));

  /* ---- A4 · 商品详情（188:111；回馈金返显卡+CTA 令牌） ---- */
  await cdp.goto(`${CUSTOMER_URL}/mall/product/${firstProd.id}`);
  await cdp.waitFor(`document.querySelector('[data-testid="pdp-buy-now"]') || document.body.innerText.includes('立即购买')`);
  const c05 = await cdp.eval(`({
    buy: !!document.querySelector('[data-testid="pdp-buy-now"]'),
    add: !!document.querySelector('[data-testid="pdp-add-cart"]'),
  })`);
  note(c05.buy && c05.add, 'A4 商品详情渲染（吸底 CTA）', JSON.stringify(c05));
  await cdp.shot(join(OUT_DIR, 'c05-mall-product.png'));

  /* ---- A4 · 我的（189:104；山姆骨架身份大卡+回馈金格+顶码行） ---- */
  await cdp.goto(`${CUSTOMER_URL}/me`);
  await cdp.waitFor(`document.querySelector('[data-testid="me-hero"]')`);
  const c06 = await cdp.eval(`({
    hero: !!document.querySelector('[data-testid="me-hero"]'),
    rebate: !!document.querySelector('[data-testid="me-rebate-cell"]'),
    qr: !!document.querySelector('[data-testid="me-qrrow"]'),
    grid: !!document.querySelector('[data-testid="me-grid8"]'),
  })`);
  note(c06.hero && c06.rebate && c06.qr, 'A4 我的渲染（身份大卡+回馈金+顶码）', JSON.stringify(c06));
  await cdp.shot(join(OUT_DIR, 'c06-me.png'));

  /* ---- A4 · 回馈金账本（回馈金表面；真余额/明细） ---- */
  await cdp.goto(`${CUSTOMER_URL}/member/rebate`);
  await cdp.waitFor(`document.body.innerText.includes('回馈金')`);
  const c07 = await cdp.eval(`({
    text: document.body.innerText.includes('回馈金'),
    body: document.body.innerText.length > 200,
  })`);
  note(c07.text && c07.body, 'A4 回馈金账本渲染', JSON.stringify(c07));
  await cdp.shot(join(OUT_DIR, 'c07-member-rebate.png'));

  cdp.close();
  console.log(`\n===== 片4 客户端实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
