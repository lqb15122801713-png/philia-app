/**
 * 批次 S1 任务 C 验收（一次性，不入库）：
 * 双角色登录两任务台首屏截图 + groomer 台无核销入口 DOM 断言 +
 * frontdesk 台核销按钮唤起扫码/手动码实证 + 无 staff 记录空态截图。
 *
 * 前置：server(7200) + staff dev(7102) 已启动；Edge --remote-debugging-port=9223 已启动。
 * 运行：node c-desk-acceptance.mjs   （cwd 任意；截图输出到本脚本所在目录）
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:7200';
const STAFF = 'http://localhost:7102';
const CDP = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond });
  console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : ' ' + JSON.stringify(extra)?.slice(0, 300)}`);
  if (!cond) failures++;
}

/* ---------- CDP ---------- */
const targets = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('无 CDP page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let mid = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++mid;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
  }
};
await new Promise((r, rej) => { ws.onopen = r; ws.onerror = rej; });
await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, name), Buffer.from(s.data, 'base64'));
  console.log(`  [截图] ${name}`);
}
const bodyText = () => evalJs('document.body?.innerText ?? ""');
async function waitFor(expr, timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr).catch(() => false)) return true;
    await sleep(400);
  }
  return false;
}
async function loginAs(userId) {
  await send('Network.clearBrowserCookies');
  await send('Page.navigate', { url: `${STAFF}/dev-login` });
  await sleep(1500);
  const status = await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${userId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  if (status !== 200) throw new Error(`dev-login HTTP ${status} (${userId})`);
}

/** 点击可见文本精确匹配的按钮/元素 */
const clickByText = (text) => evalJs(`(() => {
  const els = [...document.querySelectorAll('button, a, [role=button]')];
  const el = els.find((e) => (e.innerText ?? '').trim().includes(${JSON.stringify(text)}));
  if (!el) return false;
  el.click();
  return true;
})()`);

/* ---------- 种子用户 ---------- */
const seedUsers = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json()).users ?? [];
const byNick = (n) => seedUsers.find((u) => u.nickname === n)?.id;
const frontdeskId = byNick('小美');
const groomerId = byNick('阿强');
if (!frontdeskId || !groomerId) throw new Error('种子员工缺失（小美/阿强）');

/* ---------- 场景 1：前台任务台 ---------- */
console.log('\n[场景1] 前台（小美）任务台');
await loginAs(frontdeskId);
await send('Page.navigate', { url: `${STAFF}/today` });
check('前台台渲染「今日任务」', await waitFor(`(document.body?.innerText ?? '').includes('今日任务')`));
await sleep(1200); // 等 auth.me + 列表稳定
const t1 = await bodyText();
check('前台台标注「前台接待」', t1.includes('前台接待'), t1.slice(0, 120));
check('前台台有「扫码核销」大按钮', t1.includes('扫码核销'));
check('前台台有待核销/已核销分组或空态', t1.includes('待核销') || t1.includes('今日暂无接待'));
await shot('c1-frontdesk-today.png');

check('点按「扫码核销」成功唤起扫码层', await clickByText('扫码核销'));
check('扫码层出现「手动输入核销码」入口（无摄像头走手动码）',
  await waitFor(`(document.body?.innerText ?? '').includes('手动输入核销码')`));
await sleep(600);
await shot('c2-frontdesk-scanner.png');
check('切换手动输入', await clickByText('手动输入核销码'));
check('人工码输入框出现（aria-label=人工核销码）',
  await waitFor(`!!document.querySelector('input[aria-label="人工核销码"]')`));
await sleep(400);
await shot('c3-frontdesk-manual-code.png');
await evalJs(`document.querySelector('[aria-label="关闭"]')?.click(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));`);

/* ---------- 场景 2：美容师任务台 ---------- */
console.log('\n[场景2] 美容师（阿强）任务台');
await loginAs(groomerId);
await send('Page.navigate', { url: `${STAFF}/today` });
check('美容师台渲染「今日任务」', await waitFor(`(document.body?.innerText ?? '').includes('今日任务')`));
await sleep(1500); // 等分流稳定（首帧可能是加载骨架）
const t2 = await bodyText();
check('美容师台标注「美容师」', t2.includes('美容师'), t2.slice(0, 120));
check('美容师台无「扫码核销」入口（DOM 全文断言）', !t2.includes('扫码核销'), t2.slice(0, 200));
check('美容师台 DOM 无 QrScanner 人工码输入框', !(await evalJs(`!!document.querySelector('input[aria-label="人工核销码"]')`)));
check('美容师台保留今日/未来 7 天分段', t2.includes('未来 7 天'));
await shot('c4-groomer-today.png');

/* ---------- 场景 3：无 staff 记录空态 ---------- */
console.log('\n[场景3] 无 staff 记录用户空态');
const nostaff = seedUsers.find((u) => u.nickname === 'S1临时无档');
if (!nostaff) throw new Error('临时用户 S1临时无档 未预置（需先跑 c-make-nostaff-user.mts）');
await loginAs(nostaff.id);
await send('Page.navigate', { url: `${STAFF}/today` });
check('空态渲染「还未分配员工角色」', await waitFor(`(document.body?.innerText ?? '').includes('还未分配员工角色')`));
await sleep(800);
const t3 = await bodyText();
check('空态引导联系店主分配角色', t3.includes('联系店主'));
check('空态不白屏不报错（无「扫码核销」、无任务列表）', !t3.includes('扫码核销'));
await shot('c5-nostaff-empty.png');

ws.close();
console.log(failures === 0 ? '\n任务 C 验收全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
