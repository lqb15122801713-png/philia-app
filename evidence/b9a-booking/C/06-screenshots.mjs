/**
 * 任务 C 验收④：单屏确认条 + 首页一键面板「约 N 分钟」随时长引擎联动截图。
 *
 * 对比组（同一服务「造型修剪」durationMin=120）：
 *   旺财 = 大型长毛犬（金毛 28.5kg）→ 引擎 240min（90×2.0×1.25=225 取整）
 *   咪咪 = 小型短毛猫（英短 4.2kg）→ 引擎 120min
 *
 * 产出：evidence/b9a-booking/C/06-single-wangcai.png / 06-single-mimi.png /
 *   06-home-rebook-wangcai.png / 06-home-rebook-mimi.png + 本脚本控制台断言日志。
 *
 * 前置：server 7200 + customer 7100 已在运行（脚本不自起服务，只做可达性检查）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const OUT = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/C';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.error(`  ✗ ${name} ${extra}`); }
};

/* ---- tRPC（node 侧取 id；anon 足够，pet/store 公开） ---- */
async function trpcGet(path, cookie, input) {
  const url = `${API}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ '0': { json: input } }))}`;
  const res = await fetch(url, { headers: cookie ? { cookie } : {} });
  const body = await res.json();
  if (body?.[0]?.error) throw new Error(`${path} → ${JSON.stringify(body[0].error).slice(0, 200)}`);
  return body[0].result.data.json;
}

/* ---- 服务可达 ---- */
for (const u of [`${API}/api/health`, `${APP}/`]) {
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) { ok = await fetch(u).then((r) => r.status > 0).catch(() => false); if (!ok) await sleep(500); }
  if (!ok) throw new Error(`不可达: ${u}`);
}
mkdirSync(OUT, { recursive: true });

/* ---- 登录（node 侧拿 cookie 供 tRPC；页面内另行 dev-login） ---- */
const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json());
const customer = seed.users.find((u) => (u.roles ?? []).includes('customer'));
const loginRes = await fetch(`${API}/api/auth/dev-login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: customer.id }),
});
const cookie = loginRes.headers.getSetCookie().find((s) => s.startsWith('philia_session=')).split(';')[0];

const pets = await trpcGet('pet.list', cookie);
const wangcai = pets.find((p) => p.name === '旺财');
const mimi = pets.find((p) => p.name === '咪咪');
const nearby = await trpcGet('store.listNearby', cookie, {});
const storeId = nearby.stores[0].id;
const cat0 = await trpcGet('store.getWithServices', cookie, { storeId });
const service = cat0.services.find((s) => s.name === '造型修剪');
console.log(`[数据] store=${storeId} service=${service.name}(${service.id}) 旺财=${wangcai.id} 咪咪=${mimi.id}`);

/* ---- 起 Edge headless ---- */
const profileDir = resolve(tmpdir(), `philia-c-shots-${process.pid}`);
const browser = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);

let targets = null;
for (let i = 0; i < 40 && !targets?.length; i++) {
  targets = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`).then((r) => r.json()).catch(() => null);
  if (!targets?.length) await sleep(500);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++msgId;
  pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
};
await new Promise((r) => (ws.onopen = r));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`页面内脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
  return r.result.value;
};
const shot = async (file) => {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
  console.log(`  saved ${file}`);
};
const waitFor = async (expr, tries = 24) => {
  for (let i = 0; i < tries; i++) { if (await evalJs(expr)) return true; await sleep(500); }
  return false;
};

/* ---- 页面内 dev-login ---- */
await send('Page.navigate', { url: `${APP}/dev-login` });
await sleep(2000);
const loginStatus = await evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userId:'${customer.id}'}), credentials:'include' }).then(r=>r.status)`);
check('页面内 dev-login 种子客户', loginStatus === 200, `HTTP ${loginStatus}`);

/* ---------- A. 单屏确认条联动（两宠物对比） ---------- */
async function singleScreen(pet, expectMin, outfile) {
  await send('Page.navigate', { url: `${APP}/booking/grooming?storeId=${storeId}&serviceId=${service.id}&petId=${pet.id}` });
  const gridReady = await waitFor(`!!document.querySelector('[data-testid="gs-time-grid"] [data-testid^="gs-slot-"]')`);
  check(`单屏(${pet.name}) 时段栅格就绪`, gridReady);
  // 点击首个「可约」槽（栅格含灰显禁用格，须按 data-available 过滤；确认条进入 ready 态）
  await evalJs(`document.querySelector('[data-testid="gs-time-grid"] [data-available="true"]')?.click()`);
  const ready = await waitFor(`document.querySelector('[data-testid="gs-confirm"]')?.getAttribute('data-state') === 'ready'`);
  check(`单屏(${pet.name}) 确认条进入 ready`, ready);
  const label = await evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.textContent ?? ''`);
  console.log(`  [单屏·${pet.name}] 确认条文案：${label}`);
  check(`单屏(${pet.name}) 确认条含「约 ${expectMin} 分钟」（引擎联动）`, label.includes(`约 ${expectMin} 分钟`), label);
  // 服务 chips 联动（同屏「造型修剪」chip 的时长文案）
  const chipText = await evalJs(`document.querySelector('[data-testid="gs-service-chip-${service.id}"]')?.textContent ?? ''`);
  console.log(`  [单屏·${pet.name}] 服务 chip 文案：${chipText}`);
  check(`单屏(${pet.name}) 服务 chip 含「约 ${expectMin} 分钟」`, chipText.includes(`约 ${expectMin} 分钟`), chipText);
  await sleep(600);
  await shot(outfile);
}
await singleScreen(wangcai, 240, `${OUT}/06-single-wangcai.png`);
await singleScreen(mimi, 120, `${OUT}/06-single-mimi.png`);

/* ---------- B. 首页一键面板联动（两宠物对比） ---------- */
async function homePanel(pet, expectMin, outfile) {
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(1200);
  await evalJs(`window.localStorage.setItem('philia:lastBooking', JSON.stringify({ storeId: '${storeId}', serviceId: '${service.id}', petId: '${pet.id}' }))`);
  await send('Page.navigate', { url: `${APP}/` });
  const panelReady = await waitFor(`!!document.querySelector('[data-testid="home-rebook-panel"]')`);
  check(`一键面板(${pet.name}) rebook 态渲染`, panelReady);
  const svcText = await evalJs(`document.querySelector('[data-testid="home-rebook-service"]')?.textContent ?? ''`);
  const slotText = await evalJs(`document.querySelector('[data-testid="home-rebook-slot"]')?.textContent ?? ''`);
  console.log(`  [一键·${pet.name}] 服务行：${svcText} ｜ 时间行：${slotText}`);
  check(`一键面板(${pet.name}) 服务行含「约 ${expectMin} 分钟」（引擎联动）`, svcText.includes(`约 ${expectMin} 分钟`), svcText);
  await sleep(600);
  await shot(outfile);
}
await homePanel(wangcai, 240, `${OUT}/06-home-rebook-wangcai.png`);
await homePanel(mimi, 120, `${OUT}/06-home-rebook-mimi.png`);

ws.close();
cleanup();
console.log(failures === 0 ? '\n联动截图断言全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
