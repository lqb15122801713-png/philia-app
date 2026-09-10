// 批次 7.1 任务 C：H5 四页真实数据截图（Edge CDP，连 9223）
// 流程：开 H5 → 页面内 dev-login 拿会话 → 依次导航四页截图
// 用法：node c-h5-shots.mjs <outdir>
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEBUG_PORT = 9223;
const OUT = process.argv[2] ?? '.';
const H5 = 'http://localhost:7103';
const API = 'http://localhost:7200';
const STORE_ID = '01M20EDD8FQ5K9X22WACHWSXN4';
const PRODUCT_ID = '01M20EDD8GG8B9DM30FRF0A7T8';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r?.result?.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, name), Buffer.from(s.data, 'base64'));
    console.log('saved', name);
  };

  // 1. 打开 H5（此时未登录，守卫会 reLaunch 登录页）
  await send('Page.navigate', { url: `${H5}/` });
  await sleep(3500);

  // 2. 页面内 dev-login（种子用户第一顺位 customer）——H5 降级登录链路实证
  const loginResult = await evalJs(`(async () => {
    const seeds = await (await fetch('${API}/api/auth/dev-seed-users')).json();
    const customer = seeds.users.find((u) => u.roles.includes('customer')) ?? seeds.users[0];
    const res = await (await fetch('${API}/api/auth/dev-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ userId: customer.id }),
    })).json();
    return { seed: customer, login: res };
  })()`);
  console.log('dev-login:', JSON.stringify(loginResult));

  // 3. 四页截图（每次整页导航，cookie 已在 jar）
  const pages = [
    ['c-h5-1-home.png', `${H5}/#/pages/home/index`, 4200],
    ['c-h5-2-store.png', `${H5}/#/pages/store/index?id=${STORE_ID}`, 4200],
    ['c-h5-3-mall.png', `${H5}/#/pages/mall/index`, 4200],
    ['c-h5-4-product.png', `${H5}/#/pages/product/index?id=${PRODUCT_ID}`, 4200],
  ];
  for (const [name, url, wait] of pages) {
    await send('Page.navigate', { url });
    await sleep(wait);
    await shot(name);
  }
  ws.close();
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
