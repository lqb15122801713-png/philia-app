/**
 * 批次 S1 任务 D 验收（一次性，不入库）：商家端员工管理改角色/状态全程截图。
 * 流程：登录店主 → /staff（改前截图，角色列可见）→ 丽丽「编辑」→ 对话框截图 →
 * 角色改前台 + 停用 → 保存 → toast + staffList 刷新一致（改后截图 + DOM 断言）→
 * 改回 groomer/在职（恢复种子口径）→ 恢复后断言。
 *
 * 前置：server(7200) + merchant preview/dev(7101) + Edge CDP(9223)。
 * 运行：node d-staffpage-acceptance.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:7200';
const MERCHANT = 'http://localhost:7101';
const CDP = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, cond, extra) {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${cond ? '' : ' ' + JSON.stringify(extra)?.slice(0, 300)}`);
  if (!cond) failures++;
}

const targets = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
const page = targets.find((t) => t.type === 'page');
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
// 桌面视口：命中 lg 表格布局（角色列在表格中）
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });

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
async function waitFor(expr, timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(expr).catch(() => false)) return true;
    await sleep(400);
  }
  return false;
}

/** 丽丽所在表格行的文本 */
const liliRowText = `(() => {
  const tr = [...document.querySelectorAll('tr')].find((r) => (r.innerText ?? '').includes('丽丽'));
  return tr ? tr.innerText : '';
})()`;

const seedUsers = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json()).users ?? [];
const ownerId = seedUsers.find((u) => (u.roles ?? []).includes('merchant_owner'))?.id;
if (!ownerId) throw new Error('种子店主缺失');

await send('Network.clearBrowserCookies');
await send('Page.navigate', { url: `${MERCHANT}/dev-login` });
await sleep(1500);
const status = await evalJs(`fetch('${API}/api/auth/dev-login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ userId: '${ownerId}' }), credentials: 'include',
}).then((r) => r.status).catch(() => 0)`);
if (status !== 200) throw new Error(`dev-login HTTP ${status}`);

/* ---------- 改前 ---------- */
await send('Page.navigate', { url: `${MERCHANT}/staff` });
check('员工管理页渲染', await waitFor(`(document.body?.innerText ?? '').includes('员工管理')`));
await sleep(1200);
const before = await evalJs(liliRowText);
check('改前：丽丽行 = 美容师 / 在职', before.includes('美容师') && before.includes('在职'), before);
check('表格含「角色」列头', (await evalJs('document.body.innerText')).includes('角色'));
await shot('d1-staffpage-before.png');

/* ---------- 打开编辑对话框 ---------- */
const openDialog = await evalJs(`(() => {
  const tr = [...document.querySelectorAll('tr')].find((r) => (r.innerText ?? '').includes('丽丽'));
  const btn = tr ? [...tr.querySelectorAll('button')].find((b) => (b.innerText ?? '').includes('编辑')) : null;
  if (!btn) return false;
  btn.click();
  return true;
})()`);
check('点击丽丽行「编辑」', openDialog);
check('编辑对话框打开（标题 编辑员工 · 丽丽）', await waitFor(`(document.body?.innerText ?? '').includes('编辑员工 · 丽丽')`));
check('对话框注明技能标签只读（留 S4）', (await evalJs('document.body.innerText')).includes('技能标签暂为只读'));
await shot('d2-edit-dialog.png');

/* ---------- 改角色=前台 + 停用 → 保存 ---------- */
check('角色下拉切到「前台」', await evalJs(`(() => {
  const sel = document.querySelector('select[aria-label="岗位角色"]');
  if (!sel) return false;
  sel.value = 'frontdesk';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`));
check('在职开关关闭（停用）', await evalJs(`(() => {
  const sw = document.querySelector('[role="switch"]');
  if (!sw || sw.getAttribute('aria-checked') !== 'true') return false;
  sw.click();
  return true;
})()`));
await sleep(400);
await shot('d3-edit-dialog-modified.png');
check('点「保存」', await evalJs(`(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText ?? '').trim() === '保存');
  if (!btn) return false;
  btn.click();
  return true;
})()`));
check('保存成功 toast（已保存：丽丽 → 前台 · 已停用）',
  await waitFor(`(document.body?.innerText ?? '').includes('已保存：丽丽')`));
await shot('d4-save-toast.png');

/* ---------- 改后：staffList 刷新一致 ---------- */
check('改后：丽丽行 = 前台 / 已停用（列表刷新一致）',
  await waitFor(`(() => {
    const tr = [...document.querySelectorAll('tr')].find((r) => (r.innerText ?? '').includes('丽丽'));
    const t = tr ? tr.innerText : '';
    return t.includes('前台') && t.includes('已停用');
  })()`));
await sleep(600);
await shot('d5-staffpage-after.png');

/* ---------- 恢复种子口径（丽丽 → 美容师 / 在职） ---------- */
await evalJs(`(() => {
  const tr = [...document.querySelectorAll('tr')].find((r) => (r.innerText ?? '').includes('丽丽'));
  [...tr.querySelectorAll('button')].find((b) => (b.innerText ?? '').includes('编辑'))?.click();
})()`);
await waitFor(`(document.body?.innerText ?? '').includes('编辑员工 · 丽丽')`);
await evalJs(`(() => {
  const sel = document.querySelector('select[aria-label="岗位角色"]');
  sel.value = 'groomer';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  const sw = document.querySelector('[role="switch"]');
  if (sw.getAttribute('aria-checked') !== 'true') sw.click();
})()`);
await sleep(300);
await evalJs(`[...document.querySelectorAll('button')].find((b) => (b.innerText ?? '').trim() === '保存')?.click()`);
check('恢复：丽丽行回到 美容师 / 在职', await waitFor(`(() => {
  const tr = [...document.querySelectorAll('tr')].find((r) => (r.innerText ?? '').includes('丽丽'));
  const t = tr ? tr.innerText : '';
  return t.includes('美容师') && t.includes('在职');
})()`));

ws.close();
console.log(failures === 0 ? '\n任务 D UI 验收全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
