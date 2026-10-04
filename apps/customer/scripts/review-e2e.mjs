/**
 * review-e2e.mjs · 评价区 UI 实证（修复包 PR-2 A1/A2 · PD-02 闸门件）
 *
 * 范围：预约详情页评价区（复用 ReviewPanel 合规件后）——
 * ① 默认 0 星（五钮均未选中，历史默认 5 星已铲除）；
 * ② 未选星时提交钮 disabled（未选禁提交）；
 * ③ 星钮触控面 ≥44px（触控纪律）；
 * ④ 选 2 星 → 提交放开 → 提交成功转「我的评价」展示（含 ★2）。
 *
 * 夹具自足（Y11「smoke-deploy 先跑造夹具」的内部化）：boarding 预约
 * （客户建单→员工核销→退房 completed，全程 tRPC HTTP），不依赖 smoke-deploy 状态。
 *
 * 用法：先起 server(7200)+customer dev(7100)，然后
 *   node apps/customer/scripts/review-e2e.mjs
 * 环境变量：BASE（默认 http://localhost:7200）、CUSTOMER_URL（默认 http://localhost:7100）、
 *   CDP_PORT（默认 9339）、GATE_CODE（BETA_GATE_CODE 设置时透传）。
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';

const BASE = (process.env.BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9339);
const GATE = process.env.GATE_CODE ?? '';
const OUT = process.env.SHOT_DIR ?? '/tmp';
const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- tRPC HTTP（batch=1 + superjson 线格式，同 smoke-deploy） ---- */
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
  const res = await fetch(`${BASE}/trpc/${path}?batch=1&input=${payload}`, { headers: cookie ? { Cookie: cookie } : {} });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutate(cookie, path, input, metaValues) {
  const body = { '0': { json: input } };
  if (metaValues) body['0'].meta = { values: metaValues };
  const res = await fetch(`${BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return unwrap(await res.json(), `trpc ${path}`);
}

const gateQs = (code) => (code ? `?code=${encodeURIComponent(code)}` : '');
async function devLogin(userId) {
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(GATE ? { userId, code: GATE } : { userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return { cookie: setCookies.map((c) => c.split(';')[0]).join('; '), status: res.status };
}

/* ---- CDP（Chrome headless · 390×844） ---- */
async function launchCdp() {
  const exe = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  const profile = `C:/Users/lqb15/AppData/Local/Temp/review-e2e-profile-${process.pid}`;
  const chrome = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=390,844', '--hide-scrollbars', '--mute-audio',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`); if (r.ok) break; } catch { /* retry */ }
    await sleep(400);
  }
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? rej(new Error(method + ':' + JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { chrome, send };
}

async function main() {
  /* ---- 登录与夹具：completed 未评价寄养单 ---- */
  const seeds = await (await fetch(`${BASE}/api/auth/dev-seed-users${gateQs(GATE)}`)).json();
  const customerSeed = seeds.users.find((u) => u.roles.includes('customer'));
  const staffSeed = seeds.users.find((u) => u.roles.includes('staff'));
  const customer = (await devLogin(customerSeed.id)).cookie;
  const staff = (await devLogin(staffSeed.id)).cookie;
  check('夹具前置：dev-login 客户+员工', !!customer && !!staff);

  const nearby = await trpcQuery(customer, 'store.listNearby', { lat: 30.2741, lng: 120.1551 });
  const store = nearby?.stores?.[0];
  const detail = store ? await trpcQuery(customer, 'store.getWithServices', { storeId: store.id }) : null;
  const boardingSvc = detail?.services?.find((s) => s.type === 'boarding');
  const pet = (await trpcQuery(customer, 'pet.list'))?.[0];
  check('夹具前置：门店/寄养服务/宠物', !!(store?.id && boardingSvc?.id && pet?.id),
    `store=${store?.id} svc=${boardingSvc?.id} pet=${pet?.id}`);

  const STORE_TZ = 8 * 60 * 60 * 1000;
  const nowW = new Date(Date.now() + STORE_TZ);
  const bStart = new Date(Date.UTC(nowW.getUTCFullYear(), nowW.getUTCMonth(), nowW.getUTCDate() + 1, 15, 0, 0, 0) - STORE_TZ);
  const bEnd = new Date(bStart.getTime() + 2 * 86400_000);
  const appt = await trpcMutate(customer, 'appointment.create', {
    storeId: store.id, petId: pet.id, serviceId: boardingSvc.id, type: 'boarding',
    scheduledStart: bStart.toISOString(), scheduledEnd: bEnd.toISOString(),
    paymentMode: 'pay_at_store', note: 'review-e2e 寄养夹具单', medicalAuth: { agreed: true }, // 片 2 硬闸机械适配（寄养缺授权=400）
  }, { scheduledStart: ['Date'], scheduledEnd: ['Date'] });
  check('夹具：寄养预约创建（2 晚）', !!appt?.id, `id=${appt?.id}`);

  const codeRes = await trpcQuery(customer, 'appointment.getCode', { appointmentId: appt.id });
  const checkedIn = await trpcMutate(staff, 'appointment.checkin', { code: codeRes.code });
  check('夹具：员工核销（confirmed → in_boarding）', checkedIn?.appointment?.status === 'in_boarding',
    `status=${checkedIn?.appointment?.status}`);

  /* 退房：checkout 需寄养负责人本人操作（PR-2 A5 口径）——首选核销员工，403 则轮询其余种子员工 */
  let checkoutErr = null;
  let checkedOut = false;
  for (const s of [staffSeed, ...seeds.users.filter((u) => u.roles.includes('staff') && u.id !== staffSeed.id)]) {
    const c = (await devLogin(s.id)).cookie;
    try {
      await trpcMutate(c, 'boarding.checkout', { appointmentId: appt.id });
      checkedOut = true;
      break;
    } catch (e) {
      checkoutErr = e;
    }
  }
  check('夹具：退房 checkout（负责人本人）', checkedOut, checkedOut ? '' : String(checkoutErr).slice(0, 120));
  const done = await trpcQuery(customer, 'appointment.get', { appointmentId: appt.id });  check('夹具：退房 completed 且未评价', done?.appointment?.status === 'completed' && done?.appointment?.rating === null,
    `status=${done?.appointment?.status} rating=${done?.appointment?.rating}`);

  /* ---- CDP：详情页评价区 UI 断言 ---- */
  const { chrome, send } = await launchCdp();
  process.on('exit', () => { try { chrome.kill(); } catch { /* ignore */ } });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await send('Page.navigate', { url: `${CUSTOMER_URL}/dev-login` });
  await sleep(1500);
  await evalJs(`fetch('${BASE}/api/auth/dev-login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'${customerSeed.id}'${GATE ? `,code:'${GATE}'` : ''}})}).then(r=>r.json())`);
  await send('Page.navigate', { url: `${CUSTOMER_URL}/appointments/${appt.id}` });
  await sleep(2500);

  const ui = await evalJs(`(() => {
    const section = [...document.querySelectorAll('section')].find(s => s.textContent.includes('服务还满意吗'));
    if (!section) return { found: false, text: document.body.innerText.slice(0, 200) };
    const stars = [...section.querySelectorAll('button[aria-label$="星"]')];
    const activeCount = stars.filter(b => b.querySelector('svg')?.classList.contains('fill-brand-primary')).length;
    const submit = [...section.querySelectorAll('button')].find(b => b.textContent.includes('提交评价'));
    const rect = stars[0]?.getBoundingClientRect();
    return { found: true, starCount: stars.length, activeCount, submitDisabled: submit?.disabled, w: rect?.width, h: rect?.height };
  })()`);
  check('UI① 评价区渲染（复用 ReviewPanel 合规件）', ui.found === true, JSON.stringify(ui).slice(0, 160));
  check('UI② 默认 0 星（五钮均未选中，历史默认 5 星已铲除）', ui.found && ui.starCount === 5 && ui.activeCount === 0,
    `stars=${ui.starCount} active=${ui.activeCount}`);
  check('UI③ 未选星时提交钮 disabled（未选禁提交）', ui.submitDisabled === true);
  check('UI④ 星钮触控面 ≥44px', ui.found && ui.w >= 44 && ui.h >= 44, `${ui.w}×${ui.h}`);

  /* 选 2 星 → 提交放开 → 提交 → 我的评价 */
  await evalJs(`(() => {
    const section = [...document.querySelectorAll('section')].find(s => s.textContent.includes('服务还满意吗'));
    section.querySelector('button[aria-label="2 星"]')?.click();
  })()`);
  await sleep(400);
  const after2 = await evalJs(`(() => {
    const section = [...document.querySelectorAll('section')].find(s => s.textContent.includes('服务还满意吗'));
    const stars = [...section.querySelectorAll('button[aria-label$="星"]')];
    const submit = [...section.querySelectorAll('button')].find(b => b.textContent.includes('提交评价'));
    return {
      active: stars.filter(b => b.querySelector('svg')?.classList.contains('fill-brand-primary')).length,
      disabled: submit?.disabled,
    };
  })()`);
  check('UI⑤ 选 2 星后提交钮放开（active=2）', after2.active === 2 && after2.disabled === false, JSON.stringify(after2));
  await evalJs(`(() => {
    const section = [...document.querySelectorAll('section')].find(s => s.textContent.includes('服务还满意吗'));
    [...section.querySelectorAll('button')].find(b => b.textContent.includes('提交评价'))?.click();
  })()`);
  await sleep(2000);
  const reviewed = await evalJs(`document.body.innerText.includes('我的评价')`);
  check('UI⑥ 提交成功 → 转「我的评价」展示', reviewed === true);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/review-e2e-detail.png`, Buffer.from(shot.data, 'base64'));
  console.log(`截图：${OUT}/review-e2e-detail.png`);

  chrome.kill();
  console.log(failures === 0 ? '\nreview-e2e 全绿 ✅' : `\nreview-e2e ${failures} 项失败 ❌`);
  if (failures > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1) });
