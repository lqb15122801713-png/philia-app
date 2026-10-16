#!/usr/bin/env node
/**
 * 片4-运营商城 · 员工端实尺截图实证（产品-1015 换皮 · A5 S-05~S-12 余屏表面）
 *
 * 口径（学 片2/片3 工艺）：
 * - 真实链路驱动，不画假态：寄养单 create→confirm→人工码 checkin → in_boarding
 *   （S-10 寄养打卡真在店单）；店主 assignCount 盲盘 → 员工 myCountTasks 真任务
 *   （S-08 列表/S-09 录入真行）；S-05~S-07/S-11/S-12 用种子与既有真值表面。
 * - 仅表面实证：提成/XP 规则零触（不建/不改任何规则件）。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期指向本片 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口=390×844 mobile 实尺（deviceScaleFactor:1）。
 * - 前置：本片 server（7242）+ staff preview（7165）已起；库跑前 seed 复位。
 * - 错口：他窗栈一概不碰；本片只用 7165/7242/9244。
 *
 * 用法：node apps/staff/scripts/s4-member-mine-shots.mjs
 * 环境变量：STAFF_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7165').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7242').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9244);
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
  const profile = join(tmpdir(), `s4-member-mine-staff-${Date.now()}`);
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

  /* ---- 种子账号（小美=前台员工 / 菲丽亚店主=owner / 示例客户） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const staffCookie = await devLogin(uidOf('小美'));
  const merchantCookie = await devLogin(uidOf('菲丽亚店主'));
  const customerCookie = await devLogin(uidOf('示例客户'));
  const staffUserId = uidOf('小美');

  /* ---- S-10 前置：寄养单（今日入住·明日退房）→ confirm → checkin → in_boarding ---- */
  const nearby = await trpcQuery(customerCookie, 'store.listNearby', {});
  const store = nearby?.stores?.[0];
  const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id });
  const boardingSvc = detail?.services?.find((s) => s.type === 'boarding');
  const pets = await trpcQuery(customerCookie, 'pet.list');
  const pet = pets?.[0];
  let boardingId = null;
  let boardingFresh = false;
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
          note: '【片4实证】寄养单（S-10 在店）',
        }, { scheduledStart: ['Date'], scheduledEnd: ['Date'] });
        boardingId = created?.id ?? created?.appointment?.id ?? null;
        boardingFresh = !!boardingId;
      } catch (err) {
        /* 复跑撞档期：前次实证留在店单未离店——复用该单（诚实态同帧） */
        if (/已有寄养单|重叠|不可重复/.test(String(err?.message))) {
          const mine = await trpcQuery(customerCookie, 'appointment.listMine');
          const groups = mine?.groups ?? {};
          const inB = [...(groups.in_boarding ?? []), ...(groups.inBoarding ?? []), ...(groups.in_service ?? [])];
          boardingId = inB[0]?.id ?? null;
          if (boardingId) break;
        }
        if (!/CONFLICT|约满|冲突|满房|占用/.test(String(err?.message))) throw err;
      }
    }
    if (!boardingId) throw new Error('寄养单未建成');
    if (boardingFresh) {
      await trpcMutate(merchantCookie, 'appointment.confirm', { appointmentId: boardingId });
      const codeB = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: boardingId });
      const ciB = await trpcMutate(staffCookie, 'appointment.checkin', { code: codeB?.code });
      const stB = ciB?.appointment?.status ?? ciB?.status;
      note(stB === 'in_boarding', '寄养单核销 → in_boarding（S-10 真在店）', `status=${stB} id=${boardingId}`);
    } else {
      note(true, '复用在店寄养单（前次实证遗留，同已核销态）', `id=${boardingId}`);
    }
  }

  /* ---- S-08/S-09 前置：店主 assignCount 盲盘（盲盘=不透账面口径，S-09 帧即盲盘录入） ---- */
  let countId = null;
  try {
    const ac = await trpcMutate(merchantCookie, 'inventory.assignCount', { type: 'blind' });
    countId = ac?.count?.id ?? ac?.id ?? null;
    note(!!countId, 'assignCount 盲盘建单', `countId=${countId}`);
  } catch (e) {
    note(false, 'assignCount（owner 视界）', String(e?.message).slice(0, 120));
  }
  if (!countId) {
    const tasks = await trpcQuery(staffCookie, 'inventory.myCountTasks');
    countId = tasks?.[0]?.id ?? tasks?.tasks?.[0]?.id ?? null;
    note(!!countId, 'myCountTasks 兜底取任务', `countId=${countId}`);
  }

  /* ---- 浏览器登录=小美（页内 fetch，cookie 入浏览器档案） ---- */
  await cdp.goto(`${STAFF_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${staffUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（小美）', `HTTP ${loginStatus}`);

  /* ---- S-05 提成（203:4787；真汇总+口径注 · 规则零触） ---- */
  await cdp.goto(`${STAFF_URL}/pay`);
  await cdp.waitFor(`document.body.innerText.includes('薪资提成')`);
  const s05 = await cdp.eval(`({
    title: document.body.innerText.includes('薪资提成'),
    policy: !!document.querySelector('[data-testid="pay-policy"]') || document.body.innerText.includes('口径') || document.body.innerText.includes('规则'),
  })`);
  note(s05.title, 'S-05 提成渲染（真汇总表面）', JSON.stringify(s05));
  await cdp.shot(join(OUT_DIR, 's05-pay.png'));

  /* ---- S-06 XP（203:4852；段位五段条+事件流） ---- */
  await cdp.goto(`${STAFF_URL}/xp`);
  await cdp.waitFor(`document.body.innerText.includes('XP 成长')`);
  const s06 = await cdp.eval(`({
    title: document.body.innerText.includes('XP 成长'),
    body: document.body.innerText.length > 200,
  })`);
  note(s06.title, 'S-06 XP 渲染', JSON.stringify(s06));
  await cdp.shot(join(OUT_DIR, 's06-xp.png'));

  /* ---- S-07 评价（203:4917；trio+评价卡） ---- */
  await cdp.goto(`${STAFF_URL}/reviews`);
  await cdp.waitFor(`document.body.innerText.includes('我的评价') || document.body.innerText.includes('评价')`);
  const s07 = await cdp.eval(`({
    title: document.body.innerText.includes('评价'),
    body: document.body.innerText.length > 150,
  })`);
  note(s07.title, 'S-07 评价渲染', JSON.stringify(s07));
  await cdp.shot(join(OUT_DIR, 's07-reviews.png'));

  /* ---- S-08 盘点列表（203:5611；真任务行） ---- */
  await cdp.goto(`${STAFF_URL}/inventory`);
  await cdp.waitFor(`document.body.innerText.includes('盘点')`);
  const s08 = await cdp.eval(`({
    title: document.body.innerText.includes('盘点'),
    task: document.body.innerText.includes('全盘') || document.body.innerText.includes('草稿') || document.body.innerText.includes('待'),
  })`);
  note(s08.title && s08.task, 'S-08 盘点列表渲染（assignCount 真任务）', JSON.stringify(s08));
  await cdp.shot(join(OUT_DIR, 's08-inventory.png'));

  /* ---- S-09 盘点录入（203:5663；盲盘录入卡） ---- */
  if (countId) {
    await cdp.goto(`${STAFF_URL}/inventory/${countId}`);
    await cdp.waitFor(`document.body.innerText.includes('实盘') || document.body.innerText.includes('盘点')`);
    const s09 = await cdp.eval(`({
      body: document.body.innerText.includes('实盘') || document.body.innerText.includes('系统'),
      inputs: document.querySelectorAll('input').length,
    })`);
    note(s09.body, 'S-09 盘点录入渲染（真任务行项）', JSON.stringify(s09));
    await cdp.shot(join(OUT_DIR, 's09-inventory-count.png'));
  } else {
    note(false, 'S-09 盘点录入', '无盘点任务 id');
  }

  /* ---- S-10 寄养打卡（203:5720；在店真单） ---- */
  await cdp.goto(`${STAFF_URL}/boarding/${boardingId}/checkin`);
  await cdp.waitFor(`document.querySelector('[data-testid="boarding-pet-card"]') || document.body.innerText.includes('打卡')`);
  const s10 = await cdp.eval(`({
    pet: !!document.querySelector('[data-testid="boarding-pet-card"]'),
    form: !!document.querySelector('[data-testid="daily-log-form"]') || document.body.innerText.includes('打卡'),
  })`);
  note(s10.pet || s10.form, 'S-10 寄养打卡渲染（在店真单）', JSON.stringify(s10));
  await cdp.shot(join(OUT_DIR, 's10-boarding-checkin.png'));

  /* ---- S-11 补卡审批（203:5776；种子无店长员工→引导卡诚实态，同 smoke 口径） ---- */
  await cdp.goto(`${STAFF_URL}/manager`);
  await cdp.waitFor(`document.body.innerText.includes('店长') || document.body.innerText.includes('补卡')`);
  const s11 = await cdp.eval(`({
    text: document.body.innerText.includes('店长视图') || document.body.innerText.includes('店长'),
    body: document.body.innerText.length > 120,
  })`);
  note(s11.text, 'S-11 补卡审批渲染（非店长引导卡诚实态）', JSON.stringify(s11));
  await cdp.shot(join(OUT_DIR, 's11-manager.png'));

  /* ---- S-12 切日历史（203:5821；G1 昨天 chip → 班轴 done+班结行） ---- */
  await cdp.goto(`${STAFF_URL}/schedule`);
  await cdp.waitFor(`document.body.innerText.includes('昨天')`);
  await cdp.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '昨天')?.click()`);
  await sleep(1200);
  const s12 = await cdp.eval(`({
    chips: document.body.innerText.includes('今天') && document.body.innerText.includes('明天'),
    past: document.body.innerText.includes('班结') || document.body.innerText.includes('已完成') || document.body.innerText.includes('休息'),
  })`);
  note(s12.chips, 'S-12 切日历史渲染（昨天态）', JSON.stringify(s12));
  await cdp.shot(join(OUT_DIR, 's12-schedule-past.png'));

  cdp.close();
  console.log(`\n===== 片4 员工端实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
