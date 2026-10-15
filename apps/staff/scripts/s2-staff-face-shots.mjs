#!/usr/bin/env node
/**
 * 片2-员工服务 · 实尺截图实证（产品-1015 换皮 · A1 S-00 / A2 S-01 / A3 S-02 三态 / A4 S-03 / A5 S-04）
 *
 * 口径（学 片1 s1-face-shots.mjs）：
 * - 真实链路驱动，不画假态：dev-seed-users 取种子 → 客户真下单 appointment.create（洗护，
 *   今日）→ 店主 appointment.confirm + assign 钉到美容师「阿强」→ 前台「小美」人工码
 *   appointment.checkin → in_service（六步初始化）。两单同日：A 单走核销进服务中，
 *   B 单保持 confirmed（待接）——S-02 互斥（开始 pill 停用）与三态对照由此成真。
 * - 渲染对象=本片分支构建产物（vite preview，VITE_API_BASE 构建期指向本片 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口 390×844 mobile（实尺）；截图落 evidence/design-s2-staff-face/shots/。
 * - 前置：本片 server（7231）+ staff preview（7152）已起；库跑前 seed 复位。
 * - 错口：片0/CJ/片1 旧栈 7100-7122/7200-7201/9223-9230 一概不碰；本片 7152/7231/9232。
 *
 * 用法：node apps/staff/scripts/s2-staff-face-shots.mjs
 * 环境变量：STAFF_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全部截图落盘且页面锚点在；1=存在失败项。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7152').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7231').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9232);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'design-s2-staff-face', 'shots');
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

/* ---- tRPC HTTP（batch=1 + superjson 线格式；与片1/ smoke-deploy 同范式） ---- */
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
  const profile = join(tmpdir(), `s2-staff-face-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
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
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  /* ---- 种子账号（按昵称钉角色：小美=前台 / 阿强=美容师 / 示例客户 / 菲丽亚店主） ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const customerCookie = await devLogin(uidOf('示例客户'));
  const merchantCookie = await devLogin(uidOf('菲丽亚店主'));
  const frontdeskCookie = await devLogin(uidOf('小美'));
  const groomerCookie = await devLogin(uidOf('阿强'));
  const groomerUserId = uidOf('阿强');

  /* ---- 造单：今日两单洗护钉给阿强（A=核销进服务中；B=保持 confirmed 待接） ---- */
  const nearby = await trpcQuery(customerCookie, 'store.listNearby', {});
  const store = nearby?.stores?.[0];
  const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId: store.id });
  const service = detail?.services?.find((s) => s.type === 'grooming');
  const pets = await trpcQuery(customerCookie, 'pet.list');
  const pet = pets?.[0];
  const staffPub = await trpcQuery(frontdeskCookie, 'store.listStaffPublic', { storeId: store.id });
  const groomerStaffId = staffPub?.staff?.find((s) => s.name === '阿强')?.id;
  if (!groomerStaffId) throw new Error('未找到美容师阿强 staffId');

  /* 营业窗 09:00-20:00 + 30min 粒度 + now+1h 缓冲（server 硬校验）：取今日窗内可约格。
     凌晨跑批场景：落今日 09:30 起的格子（当日记工位/预约轴皆今日可见）。 */
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
          storeId: store.id, petId: pet.id, serviceId: service.id, type: 'grooming',
          scheduledStart: start.toISOString(), paymentMode: 'pay_at_store',
          note: `【片2实证】${tag}`,
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
  const apptB = await mkAppt(9, 'B 单（保持待接）');
  note(true, '造单：A/B 两单 confirmed 且指派阿强', `A=${apptA} B=${apptB}`);

  /* ---- A1 · S-00 登录（203:883；未登录态脸面） ---- */
  await cdp.goto(`${STAFF_URL}/dev-login`, 3000);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="login-primary"]')`), 'A1 S-00 登录页渲染', 'login-primary');
  await cdp.shot(join(OUT_DIR, '01-s00-login.png'));

  /* ---- 浏览器登录=美容师阿强（页内 fetch，cookie 入浏览器档案） ---- */
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${groomerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（阿强）', `HTTP ${loginStatus}`);

  /* ---- A2 · S-01 工位台·待接态（198:15：大卡=最近 confirmed，六步全 future，主钮「开始执行」） ---- */
  await cdp.goto(`${STAFF_URL}/today`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="sk-workcard"]')`), 'A2 工位大卡渲染', 'sk-workcard');
  const gridOk = await cdp.eval(`document.querySelectorAll('[data-testid="sk-stepgrid"] .st').length`);
  note(gridOk === 6, 'A2 六步硬序可视（stepgrid 六列）', `列数=${gridOk}`);
  await cdp.shot(join(OUT_DIR, '02-s01-today-pending.png'));

  /* ---- A3 · S-02 全薄（202:2；无服务中单：全列薄行，待接行内「开始执行」pill 可用） ---- */
  await cdp.goto(`${STAFF_URL}/schedule`);
  await sleep(1200);
  const thinLevel = await cdp.eval(`(() => {
    const a = document.querySelector('[data-testid="sk-appt-${apptA}"]');
    const b = document.querySelector('[data-testid="sk-appt-${apptB}"]');
    const bBtn = document.querySelector('[data-testid="appt-start-${apptB}"]');
    return { a: a?.getAttribute('data-level'), b: b?.getAttribute('data-level'), bBtn: !!bBtn && !bBtn.disabled };
  })()`);
  note(thinLevel.a === 'thin' && thinLevel.b === 'thin' && thinLevel.bBtn, 'A3 全薄态（202:2）＋待接开始 pill 可用', JSON.stringify(thinLevel));
  await cdp.shot(join(OUT_DIR, '04-s02-thin.png'));

  /* ---- 核销 A 单（前台小美人工码 → in_service，六步初始化） ---- */
  const codeA = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: apptA });
  const checkin = await trpcMutate(frontdeskCookie, 'appointment.checkin', { code: codeA?.code });
  const stA = checkin?.appointment?.status ?? checkin?.status;
  note(stA === 'in_service', 'A 单核销 → in_service', `status=${stA}`);

  /* ---- A2 · S-01 服务中态（六步 stepgrid：now=①消毒工具确认） ---- */
  await cdp.goto(`${STAFF_URL}/today`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="sk-stepgrid"] .st.now')`), 'A2 服务中 stepgrid now 态', 'st.now 在');
  await cdp.shot(join(OUT_DIR, '03-s01-today-inservice.png'));

  /* ---- A3 · S-02 半展（202:137=dock 默认：服务中卡半展摘要+继续执行；B 单开始 pill 互斥停用） ---- */
  await cdp.goto(`${STAFF_URL}/schedule`);
  await sleep(1500);
  const halfLevel = await cdp.eval(`(() => {
    const a = document.querySelector('[data-testid="sk-appt-${apptA}"]');
    const bBtn = document.querySelector('[data-testid="appt-start-${apptB}"]');
    return {
      a: a?.getAttribute('data-level'),
      half: !!document.querySelector('[data-testid="sk-aphalf"]'),
      cta: !!document.querySelector('[data-testid="appt-continue-${apptA}"]'),
      bDisabled: bBtn ? bBtn.disabled : null,
    };
  })()`);
  note(halfLevel.a === 'half' && halfLevel.half && halfLevel.cta, 'A3 半展默认（202:137）＋继续执行主钮', JSON.stringify(halfLevel));
  note(halfLevel.bDisabled === true, 'A3 待接「开始」互斥（在途一单 → B 单开始停用）', `bDisabled=${halfLevel.bDisabled}`);
  await cdp.shot(join(OUT_DIR, '05-s02-half.png'));

  /* ---- A3 · S-02 全展（202:272；caret 切全展=六步只读全表） ---- */
  await cdp.eval(`(() => {
    const card = document.querySelector('[data-testid="sk-appt-${apptA}"]');
    card?.querySelector('.caret')?.click();
  })()`);
  await sleep(1200);
  const fullLevel = await cdp.eval(`(() => {
    const a = document.querySelector('[data-testid="sk-appt-${apptA}"]');
    return { a: a?.getAttribute('data-level'), steps: a?.querySelectorAll('.sk-opstep').length ?? 0 };
  })()`);
  note(fullLevel.a === 'full' && fullLevel.steps === 6, 'A3 全展六步全表（202:272）', JSON.stringify(fullLevel));
  await cdp.shot(join(OUT_DIR, '06-s02-full.png'));

  /* ---- 旅程 2 · 六步执行页（过程可走通；硬序+拍照门槛面） ---- */
  await cdp.goto(`${STAFF_URL}/execute/${apptA}`);
  await sleep(1500);
  note(await cdp.eval(`!!document.querySelector('[data-testid="execute-summary"]')`), '执行页渲染（in_service 直通）', 'execute-summary');
  await cdp.shot(join(OUT_DIR, '09-execute-sixsteps.png'));

  /* ---- A4 · S-03 打卡（198:244：大钟+围栏+主钮+本周记录） ---- */
  await cdp.goto(`${STAFF_URL}/attendance`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="sk-punch"]')`), 'A4 打卡卡渲染', 'sk-punch');
  await cdp.shot(join(OUT_DIR, '07-s03-attendance.png'));

  /* ---- A5 · S-04 我的（198:296：身份卡+三格账+行组） ---- */
  await cdp.goto(`${STAFF_URL}/me`);
  note(await cdp.eval(`!!document.querySelector('[data-testid="sk-idcard"]')`), 'A5 身份卡渲染', 'sk-idcard');
  await cdp.shot(join(OUT_DIR, '08-s04-me.png'));

  cdp.close();
  console.log(`\n===== 片2 实尺截图汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
