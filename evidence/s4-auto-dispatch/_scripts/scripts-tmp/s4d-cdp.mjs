/**
 * 批次 S4 · 任务 D 证据驱动：HTTP 造单（自动派单 + 商家改派）+ CDP 截图商家端呈现
 * 前置：server dev(7200) + merchant vite(7101) 已起；Edge --remote-debugging-port=9223 已起
 * 运行：node scripts-tmp/s4d-cdp.mjs <evidenceDir>
 * 产出：d2-dashboard-auto-accept.png / d2-list-source-tags.png / d2-detail-merchant-reassign.png
 *       + d2-cdp-driver.log（造单与改派的服务端断言输出）
 */
import { writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import superjson from 'superjson';

const API = 'http://localhost:7200';
const MERCHANT = 'http://localhost:7101';
const OUT = process.argv[2] ?? '.';
const LOG = join(OUT, 'd2-cdp-driver.log');
const log = (s) => { console.log(s); appendFileSync(LOG, s + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- HTTP tRPC（superjson） ---------------- */
async function trpcMutate(path, cookie, input) {
  const res = await fetch(`${API}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ 0: superjson.serialize(input) }),
  });
  const env = (await res.json())?.[0];
  if (env?.error) throw new Error(`${path}: ${JSON.stringify(env.error).slice(0, 300)}`);
  return superjson.deserialize(env?.result?.data);
}
async function trpcQuery(path, cookie, input) {
  const url = `${API}/trpc/${path}?batch=1&input=${encodeURIComponent(JSON.stringify({ 0: superjson.serialize(input ?? null) }))}`;
  const res = await fetch(url, { headers: cookie ? { cookie } : {} });
  const env = (await res.json())?.[0];
  if (env?.error) throw new Error(`${path}: ${JSON.stringify(env.error).slice(0, 300)}`);
  return superjson.deserialize(env?.result?.data);
}
async function devLogin(userId) {
  const res = await fetch(`${API}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const setCookies = res.headers.getSetCookie();
  const hit = setCookies.find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error('dev-login 未签发 cookie');
  return hit.split(';')[0];
}
async function seedUsers() {
  const res = await fetch(`${API}/api/auth/dev-seed-users`);
  const body = await res.json();
  return body.users ?? body;
}

/* ---------------- CDP ---------------- */
const DEBUG_PORT = 9223;
let ws, msgId = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
async function cdpConnect() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r?.result?.value;
}
async function shot(url, file, waitMs = 4000) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(waitMs);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(s.data, 'base64'));
  log(`saved ${file}`);
}

/* ---------------- 主流程 ---------------- */
writeFileSync(LOG, '');
const users = await seedUsers();
const pick = (pred) => users.find(pred);
const customer = pick((u) => (u.roles ?? []).includes('customer'));
const owner = pick((u) => (u.roles ?? []).includes('merchant_owner'));
log(`种子用户：customer=${customer.id} owner=${owner.id}`);
const customerCookie = await devLogin(customer.id);
const ownerCookie = await devLogin(owner.id);

const me = await trpcQuery('auth.me', ownerCookie);
const storeId = me.store.id;
const pets = await trpcQuery('pet.list', customerCookie);
const petId = pets[0].id;
const cat = await trpcQuery('store.getWithServices', customerCookie, { storeId });
const svc = cat.services.find((s) => s.type === 'grooming');
const staffList = await trpcQuery('store.staffList', ownerCookie);
const aqiang = staffList.staff.find((s) => s.name === '阿强');
const lili = staffList.staff.find((s) => s.name === '丽丽');

// 明天 10:00 / 11:00（排班与营业时间双覆盖；自动派单 A1→负荷并列先入职，A2→负荷均衡）
const at = (dOff, h) => { const d = new Date(); d.setDate(d.getDate() + dOff); d.setHours(h, 0, 0, 0); return d; };
const a1 = await trpcMutate('appointment.create', customerCookie, {
  storeId, petId, serviceId: svc.id, type: 'grooming',
  scheduledStart: at(1, 10), paymentMode: 'pay_at_store', note: 'S4-D 证据单（自动派单）',
});
log(`A1 自动派单：id=${a1.id} status=${a1.status} staffId=${a1.staffId} assignSource=${a1.assignSource}`);
if (a1.status !== 'confirmed' || a1.assignSource !== 'auto') throw new Error('A1 断言失败');

const a2 = await trpcMutate('appointment.create', customerCookie, {
  storeId, petId, serviceId: svc.id, type: 'grooming',
  scheduledStart: at(1, 11), paymentMode: 'pay_at_store', note: 'S4-D 证据单（改派前自动派单）',
});
log(`A2 自动派单：id=${a2.id} status=${a2.status} staffId=${a2.staffId} assignSource=${a2.assignSource}`);
// 改派到另一位 groomer
const target = a2.staffId === aqiang.id ? lili : aqiang;
const re = await trpcMutate('appointment.assign', ownerCookie, { appointmentId: a2.id, staffId: target.id });
log(`A2 商家改派 → ${target.name}：staffId=${re.staffId} assignSource=${re.assignSource}`);
if (re.assignSource !== 'merchant') throw new Error('A2 改派断言失败');
writeFileSync(join(OUT, 'd2-ids.json'), JSON.stringify({ a1: a1.id, a2: a2.id }, null, 2));

/* ---------------- CDP 截图 ---------------- */
await cdpConnect();
// 商家登录（页面内 fetch，credentials include）
await send('Page.navigate', { url: `${MERCHANT}/dashboard` });
await sleep(2500);
const loginOk = await evalJs(`(async()=>{
  const us = await (await fetch('${API}/api/auth/dev-seed-users')).json();
  const list = us.users ?? us;
  const owner = list.find(u => (u.roles ?? []).includes('merchant_owner'));
  const r = await fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, credentials:'include', body: JSON.stringify({ userId: owner.id }) });
  return r.ok;
})()`);
log(`页面内商家登录：${loginOk}`);
await shot(`${MERCHANT}/dashboard`, join(OUT, 'd2-dashboard-auto-accept.png'), 5000);
await shot(`${MERCHANT}/appointments?date=all`, join(OUT, 'd2-list-source-tags.png'), 5000);
await shot(`${MERCHANT}/appointments/${a2.id}`, join(OUT, 'd2-detail-merchant-reassign.png'), 5000);
ws.close();
log('CDP 截图完成');
process.exit(0);
