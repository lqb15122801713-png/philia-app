// 批次 5.1 证据截图驱动：连 Edge CDP(9223)，dev-login 后逐端截图（light + dark）
import { writeFileSync } from 'node:fs';

const DEBUG_PORT = 9223;
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval fail: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result?.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, 'base64'));
  console.log('saved', name);
}

async function login(role) {
  return await evalJs(`(async () => {
    const seed = await fetch('http://localhost:7200/api/auth/dev-seed-users').then(r => r.json());
    const u = seed.users.find(x => x.roles.includes('${role}'));
    if (!u) return 'NO_USER';
    const r = await fetch('http://localhost:7200/api/auth/dev-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }), credentials: 'include',
    });
    return r.ok ? 'OK ' + u.nickname : 'FAIL ' + r.status;
  })()`);
}

async function nav(url, waitMs = 3500) {
  await send('Page.navigate', { url });
  await sleep(waitMs);
}

async function main() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
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

  /* ---------- staff：扫码模态（扫码态 + 手动输入态） ---------- */
  await nav('http://localhost:7102/');
  console.log('staff login:', await login('staff'));
  await nav('http://localhost:7102/');
  // 打开扫码模态
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('扫码核销'))?.click()`);
  await sleep(4500); // 等假摄像头起流进入 scanning
  console.log('staff scan status:', await evalJs(`document.body.innerText.includes('对准客户预约码') ? 'scanning' : (document.body.innerText.includes('重试摄像头') ? 'error' : 'unknown')`));
  await shot('staff-scan-light');
  // 切手动输入态
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('手动输入核销码'))?.click()`);
  await sleep(800);
  await shot('staff-manual-light');
  // dark：手动态截图后返回扫码态再截
  await evalJs(`document.documentElement.classList.add('dark')`);
  await sleep(400);
  await shot('staff-manual-dark');
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('返回扫码'))?.click()`);
  await sleep(4000);
  await shot('staff-scan-dark');

  /* ---------- merchant：财务空态 ---------- */
  await nav('http://localhost:7101/');
  console.log('merchant login:', await login('merchant_owner'));
  await nav('http://localhost:7101/finance');
  await evalJs(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '月')?.click()`);
  await sleep(600);
  // 往前翻 24 个月到无记录周期
  await evalJs(`(async () => { const prev = document.querySelector('button[aria-label="上一周期"]'); if (!prev) return 'NO_PREV'; for (let i = 0; i < 24; i++) { prev.click(); await new Promise(r => setTimeout(r, 120)); } return 'OK'; })()`);
  await sleep(2500);
  console.log('finance empty:', await evalJs(`document.body.innerText.includes('本周期暂无收款记录')`));
  await shot('merchant-finance-empty-light');
  await evalJs(`document.documentElement.classList.add('dark')`);
  await sleep(500);
  await shot('merchant-finance-empty-dark');

  /* ---------- customer：商城商品网格 ---------- */
  await nav('http://localhost:7100/');
  console.log('customer login:', await login('customer'));
  await nav('http://localhost:7100/mall', 4500);
  await shot('customer-mall-light');
  await evalJs(`document.documentElement.classList.add('dark')`);
  await sleep(500);
  await shot('customer-mall-dark');

  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
