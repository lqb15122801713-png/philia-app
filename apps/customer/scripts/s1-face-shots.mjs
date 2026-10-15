#!/usr/bin/env node
/**
 * 片1-客户端脸 · 实尺截图实证（产品-1015 换皮 · A1 首页两态 / A2 预约四态 / A3 会员码）
 *
 * 口径：
 * - 真实链路驱动，不画假态：dev-login 种子客户 → /home 空闲态 → /booking/grooming
 *   Default → 真点时段（已选态）→ 真点洗护师卡（选人态脸面）→ 真点「确认预约」走
 *   appointment.create 落库 → /booking/success 成功页；membership.openFree 免费档
 *   真实开档 → /me/card 会员码屏（真 token 码）；API 侧 create→confirm→checkin 造
 *   in_service 真实单 → /home 服务中态（LIVE 卡 + 窄行身份条）。
 * - 取景纪律：PWA 安装条经 localStorage 'philia.pwaInstallDismissed' 持久关闭（不遮
 *   吸底件）；已选态先滚时段栅格入镜；成功页先回顶；选人态真点轨内首张员工卡。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 指向本片 server 口）；
 *   与片0/CJ 窗在跑栈（7100-7102/7200/9223 与 7110-7112）错口：本片默认 7120/7201/9230。
 * - 零新依赖：Node 22+ 原生 fetch/WebSocket + Chrome/Edge CDP（headless=new，不弹窗）。
 * - 视口 390×844 mobile（实尺）；截图落 evidence/design-s1-client-face/shots/。
 * - 前置：本片 server（7201）+ customer preview（7120）已起；库建议跑前 seed 复位
 *   （01 空闲态要求无服务中单）。
 *
 * 用法：node apps/customer/scripts/s1-face-shots.mjs
 * 环境变量：CUSTOMER_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7120').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7201').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9230);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'design-s1-client-face', 'shots');
const NAV_WAIT = 3800;
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

/* ---- tRPC HTTP（batch=1 + superjson 线格式；与 scripts/smoke-deploy.mjs 同范式） ---- */
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
  const profile = join(tmpdir(), `s1-face-shots-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);

  // 等 CDP 起来后开页签
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  // 种子用户 + Node 侧三会话（浏览器登录走页内 fetch，cookie 进浏览器档案）
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (role) => seed.users.find((u) => u.roles.includes(role))?.id;
  const customerId = uidOf('customer');
  const merchantId = uidOf('merchant_owner');
  const staffId = uidOf('staff');
  const customerCookie = await devLogin(customerId);
  const merchantCookie = await devLogin(merchantId);
  const staffCookie = await devLogin(staffId);

  await cdp.goto(`${CUSTOMER_URL}/dev-login`, 2600);
  // PWA 安装条持久关闭（取景纪律：不遮吸底件；同源 localStorage 一次设置全场有效）
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${customerId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（种子客户）', `HTTP ${loginStatus}`);

  /* ---- A1 空闲态（先截；库已 seed 复位=无服务中单、无下单记忆=降级入口卡） ---- */
  await cdp.goto(`${CUSTOMER_URL}/home`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="home-idband"]')`), 'A1 首页空闲态渲染', 'home-idband');
  await cdp.shot(join(OUT_DIR, '01-customer-home-idle.png'));

  /* ---- A2 预约 Default（174:38） ---- */
  await cdp.goto(`${CUSTOMER_URL}/booking/grooming`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="grooming-single"]')`), 'A2 预约单屏渲染', 'grooming-single');
  // 多宠未直选时走真实选宠半屏（种子单宠自动直选则不触）
  await cdp.eval(`(() => {
    const bar = document.querySelector('[data-testid="gs-confirm-summary"]');
    if (bar && bar.textContent.includes('未选宠物')) {
      document.querySelector('[data-testid="gs-pet-card"]')?.click();
      return 'open-pet-sheet';
    }
    return 'pet-ready';
  })()`);
  await sleep(700);
  await cdp.eval(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    if (sheet) sheet.querySelector('.mt-3 button')?.click();
  })()`);
  await sleep(700);
  await cdp.shot(join(OUT_DIR, '02-customer-booking-default.png'));

  /* ---- A2 已选时段（174:138；真点首个可约槽，滚栅格入镜连摘要卡同框） ---- */
  const slotPicked = await cdp.eval(`(() => {
    const slot = document.querySelector('[data-testid^="gs-slot-"][data-available="true"]');
    if (slot) { slot.click(); return slot.getAttribute('data-testid'); }
    return null;
  })()`);
  note(!!slotPicked, 'A2 已选时段（真点可约槽）', slotPicked ?? '无可约槽');
  await sleep(900);
  await cdp.eval(`document.querySelector('[data-testid="gs-date-strip"]')?.scrollIntoView({ block: 'start' })`);
  await sleep(500);
  await cdp.shot(join(OUT_DIR, '03-customer-booking-selected.png'));

  /* ---- A2 选人态脸面（174:346 对照：既有 flat 卡轨；真点轨内首张员工卡） ---- */
  const staffPicked = await cdp.eval(`(() => {
    const rail = document.querySelector('[data-testid="gs-groomer-rail"]');
    if (!rail) return null;
    rail.scrollIntoView({ block: 'center' });
    const card = rail.querySelector('button'); /* 首卡=首位员工（随缘卡居末） */
    if (card) { card.click(); return card.getAttribute('data-testid'); }
    return null;
  })()`);
  note(!!staffPicked, 'A2 选人态（真点洗护师卡）', staffPicked ?? '无员工卡');
  await sleep(900);
  await cdp.shot(join(OUT_DIR, '04-customer-booking-staff.png'));

  /* ---- A2 成功（174:428；真点确认预约 → appointment.create 落库 → /booking/success 回顶） ---- */
  await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(400);
  const confirmState = await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.getAttribute('data-state') ?? null`);
  note(confirmState === 'ready', 'A2 确认钮可提交态', `data-state=${confirmState}`);
  await cdp.eval(`document.querySelector('[data-testid="gs-confirm"]')?.click()`);
  await sleep(3200);
  const onSuccess = await cdp.eval(`location.pathname === '/booking/success'`);
  note(!!onSuccess, 'A2 成功页（真单落库跳转）', await cdp.eval('location.pathname + location.search'));
  await cdp.eval(`window.scrollTo(0, 0)`);
  await sleep(500);
  await cdp.shot(join(OUT_DIR, '05-customer-booking-success.png'));

  /* ---- A3 会员码（174:608；openFree 免费档真实开档 → /me/card 真 token 码屏） ---- */
  try {
    await trpcMutate(customerCookie, 'membership.openFree', null);
  } catch (e) {
    console.log(`  ⚠️ openFree：${e.message}（幂等口径下多为已在册，继续）`);
  }
  await cdp.goto(`${CUSTOMER_URL}/me/card`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="member-card-page"]')`), 'A3 会员码屏渲染', 'member-card-page');
  const tokenShown = await cdp.eval(`!!document.querySelector('[data-testid="membercard-token"]')`);
  note(tokenShown, 'A3 真 token 码区', tokenShown ? 'membercard-token 在' : '未见码（非会员态?）');
  await cdp.shot(join(OUT_DIR, '06-customer-member-card.png'));

  /* ---- A1 服务中态（170:184；API 真造 in_service 单：create→confirm→getCode→checkin） ---- */
  let apptId = null;
  try {
    const nearby = await trpcQuery(customerCookie, 'store.listNearby', {});
    const store = nearby?.stores?.[0];
    const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id });
    const service = detail?.services?.find((s) => s.type === 'grooming');
    const pets = await trpcQuery(customerCookie, 'pet.list');
    const pet = pets?.[0];
    const dayStart = new Date(Date.now() + 24 * 3600 * 1000);
    dayStart.setHours(10, 0, 0, 0);
    for (let i = 0; i < 16 && !apptId; i++) {
      const start = new Date(dayStart.getTime() + i * 30 * 60_000);
      try {
        const created = await trpcMutate(customerCookie, 'appointment.create', {
          storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
          scheduledStart: start.toISOString(), paymentMode: 'pay_at_store',
          note: '【片1实证】服务中态截图单',
        }, { scheduledStart: ['Date'] });
        apptId = created?.id ?? created?.appointment?.id ?? null;
      } catch (e) {
        if (!/CONFLICT|约满/.test(String(e?.message))) throw e;
      }
    }
    if (!apptId) throw new Error('7 天窗口内未抢到可约槽');
    await trpcMutate(merchantCookie, 'appointment.confirm', { appointmentId: apptId });
    const codeRes = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: apptId });
    const checkin = await trpcMutate(staffCookie, 'appointment.checkin', { code: codeRes?.code });
    const st = checkin?.appointment?.status ?? checkin?.status;
    note(st === 'in_service', 'A1 服务中单造出（checkin → in_service）', `id=${apptId} status=${st}`);
  } catch (e) {
    note(false, 'A1 服务中单造出', String(e?.message ?? e));
  }
  await cdp.goto(`${CUSTOMER_URL}/home`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="home-live-card"]')`), 'A1 服务中态渲染', 'home-live-card');
  await cdp.shot(join(OUT_DIR, '07-customer-home-inservice.png'));

  cdp.close();
  console.log(`\n===== 片1 实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
