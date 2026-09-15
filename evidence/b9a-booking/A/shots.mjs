// b9a 任务 A 证据截图驱动（临时脚本，不入库）
// 用法：node shots.mjs <tag>   —— 需 Edge CDP 9223 已起、server:7200 / customer:7100 已起
// 产出：同目录 <tag>-*.png
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = process.argv[2] ?? 'shot';
const OUT_DIR = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:7200';
const APP = 'http://localhost:7100';
const PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT_DIR, `${TAG}-${name}.png`), Buffer.from(s.data, 'base64'));
  console.log('saved', `${TAG}-${name}.png`);
}
async function nav(path, wait = 2600) {
  await send('Page.navigate', { url: APP + path });
  await sleep(wait);
}
// 等 testid 出现
async function waitFor(sel, timeout = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await evalJs(`!!document.querySelector('[data-testid="${sel}"]')`).catch(() => false);
    if (ok) return true;
    await sleep(400);
  }
  return false;
}
const click = (testid) => evalJs(`(() => { const el = document.querySelector('[data-testid="${testid}"]'); if (!el) return 'MISSING:' + '${testid}'; el.click(); return 'ok'; })()`);

async function main() {
  // 连 CDP
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result); pending.delete(msg.id); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  // 登录（种子 customer）
  const users = (await (await fetch(`${API}/api/auth/dev-seed-users`)).json())?.users ?? [];
  const cust = users.find((u) => (u.roles ?? []).includes('customer')) ?? users[0];
  await nav('/dev-login', 1800);
  const st = await evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ userId: '${cust.id}' }), credentials:'include' }).then(r=>r.status)`);
  console.log('dev-login', st, cust.id);
  // 清掉上次下单记忆，保证「缺项态」可复现
  await evalJs(`Object.keys(localStorage).filter(k=>k.includes('booking')||k.includes('philia')).forEach(k=>localStorage.removeItem(k)); 'cleared'`);

  // 选第一只宠物（多宠用户不替选，需手动）
  async function pickFirstPet() {
    await click('gs-pet-card');
    await waitFor('gs-pet-sheet');
    await sleep(600);
    const r = await evalJs(`(() => { const b = [...document.querySelectorAll('[data-testid="gs-pet-sheet"] button')].find(x => x.getAttribute('aria-label') !== '关闭'); if (!b) return 'none'; b.click(); return 'ok'; })()`);
    await sleep(600);
    return r;
  }

  /* ---------- 洗护单屏 ---------- */
  await nav('/booking/grooming');
  await waitFor('grooming-single');
  await sleep(1600);
  await shot('grooming-missing'); // 缺项态：请选择时间（预填后缺 slot）

  console.log('pet picked:', await pickFirstPet());
  // 选一个可约时段 → 可点态
  const picked = await evalJs(`(() => {
    const btns = [...document.querySelectorAll('[data-testid^="gs-slot-"]')].filter(b => b.dataset.available === 'true');
    if (!btns.length) return 'none';
    btns[Math.min(2, btns.length - 1)].click();
    return btns[Math.min(2, btns.length - 1)].dataset.testid;
  })()`);
  console.log('slot picked:', picked);
  await sleep(700);
  await shot('grooming-ready'); // 可点态
  // 时段栅格与日期横条区域版式证据（滚动到日期区）
  await evalJs(`document.querySelector('[data-testid="gs-date-strip"]')?.scrollIntoView({block:'start'}); 'ok'`);
  await sleep(500);
  await shot('grooming-date-time');
  // 折叠区展开态（版式参考）
  await click('gs-payment-toggle'); await click('gs-note-toggle'); await click('gs-staff-toggle');
  await evalJs(`document.querySelector('[data-testid="gs-extras"]')?.scrollIntoView({block:'center'}); 'ok'`);
  await sleep(600);
  await shot('grooming-extras-open');

  /* ---------- 寄养单屏 ---------- */
  await nav('/booking/boarding');
  await waitFor('boarding-single');
  await sleep(1600);
  await shot('boarding-missing'); // 缺项态：请选择入住日期

  // 选入住/退房 → 可点态
  console.log('pet picked(boarding):', await pickFirstPet());
  await click('bs-checkin-cell');
  await waitFor('bs-range-sheet');
  await sleep(800);
  await shot('boarding-range-sheet');
  const twoDays = await evalJs(`(() => {
    const days = [...document.querySelectorAll('[data-testid^="bs-day-"]')].filter(b => b.dataset.disabled !== 'true');
    if (days.length < 3) return 'not-enough:' + days.length;
    days[1].click();
    return new Promise(res => setTimeout(() => {
      const rest = [...document.querySelectorAll('[data-testid^="bs-day-"]')].filter(b => b.dataset.disabled !== 'true');
      if (rest.length < 4) return res('rest-not-enough');
      rest[3].click();
      res('ok');
    }, 400));
  })()`);
  console.log('range pick:', twoDays);
  await sleep(900);
  await shot('boarding-ready'); // 可点态（若疫苗阻断则体现红条）

  /* ---------- 回归基线：旧向导 + 首页 ---------- */
  await nav('/booking/grooming/wizard');
  await sleep(2200);
  await shot('wizard-grooming');
  await nav('/home');
  await sleep(2200);
  await shot('home');

  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
