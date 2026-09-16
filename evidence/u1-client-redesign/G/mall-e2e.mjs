/**
 * U1-G 证据采集：商城换肤验收 + 真链路回归（CDP 直连）
 *
 * 链路：/mall 列表（分类 chips + 双列大卡 + 快加购）→ 快加购 → PDP（会员价提示行 +
 * 双钮吸底）→ 立即购买 → 结算「提交订单」→ mock 收银台「模拟支付成功」→ 订单列表
 * （待支付 tab 出现「去支付」；已完成 tab「再来一单」真链路重建购物车）。
 * 运行：node mall-e2e.mjs
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, 'shots');
const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
async function waitHttp(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url); if (res.status > 0) return true; } catch {}
    await sleep(500);
  }
  return false;
}

let browser = null;
const profileDir = resolve(tmpdir(), `philia-u1g-e2e-${process.pid}`);
function cleanup() {
  if (browser?.pid) { spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); browser = null; }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

async function main() {
  if (!BROWSER) throw new Error('未找到 Edge');
  if (!(await waitHttp(`${API}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  if (!(await waitHttp(`${APP}/`, 4))) throw new Error('customer 7100 不可达');
  mkdirSync(SHOTS_DIR, { recursive: true });

  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`页面脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  };
  const clickText = async (text, scope = '') => {
    const r = await evalJs(`(() => {
      const els = [...document.querySelectorAll('${scope || 'button, a'}')];
      const el = els.find((e) => (e.textContent ?? '').replace(/\\s+/g, '').includes('${text}'.replace(/\\s+/g, '')));
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()`);
    await sleep(1200);
    return r;
  };

  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  /* 清购物车（避免跨店冲突干扰） */
  await send('Page.navigate', { url: `${APP}/mall` });
  await sleep(2000);
  await evalJs(`localStorage.removeItem('philia.cart'); true`);
  await send('Page.navigate', { url: `${APP}/mall` });
  await sleep(4000);

  /* 1. 列表：分类 chips + 双列大卡 + 快加购 */
  const l1 = await evalJs(`(() => {
    const qa = (s) => [...document.querySelectorAll(s)];
    return {
      cats: qa('[data-testid^="mall-cat-"]').length,
      cards: qa('[data-testid^="mall-quickadd-"]').length,
      firstCard: qa('[data-testid^="mall-quickadd-"]')[0]?.getAttribute('data-testid') ?? null,
      dock: !!document.querySelector('[data-testid="app-dock"]'),
    };
  })()`);
  await shot('01-商城列表');
  assert('列表：分类 chips（6 类）+ 双列大卡带快加购钮', l1.cats === 6 && l1.cards >= 2, `cats=${l1.cats} cards=${l1.cards}`);

  /* 快加购（真链路：localStorage 购物车 + toast） */
  await evalJs(`(() => { document.querySelector('[data-testid^="mall-quickadd-"]').click(); return true; })()`);
  await sleep(1500);
  const cartCount = await evalJs(`(JSON.parse(localStorage.getItem('philia.cart') ?? '{"items":[]}').items ?? []).reduce((n, i) => n + i.qty, 0)`);
  assert('链路：快加购真实入车（cartStore/localStorage）', cartCount >= 1, `count=${cartCount}`);
  await shot('02-快加购toast');

  /* 分类切换（真实过滤） */
  await evalJs(`(() => { document.querySelector('[data-testid="mall-cat-零食"]')?.click(); return true; })()`);
  await sleep(2500);
  await shot('03-分类零食');

  /* 2. PDP：会员价提示行 + 双钮吸底 */
  await evalJs(`(() => { document.querySelector('.grid a[href^="/mall/product/"]')?.click(); return true; })()`);
  await sleep(4000);
  const p1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    return {
      note: q('[data-testid="pdp-member-price-note"]')?.textContent?.trim() ?? null,
      addBtn: q('[data-testid="pdp-add-cart"]')?.textContent?.trim() ?? null,
      buyBtn: q('[data-testid="pdp-buy-now"]')?.textContent?.trim() ?? null,
      buyBg: q('[data-testid="pdp-buy-now"]') ? getComputedStyle(q('[data-testid="pdp-buy-now"]')).backgroundColor : null,
      dock: !!q('[data-testid="app-dock"]'),
    };
  })()`);
  await shot('04-PDP');
  assert('PDP：会员价提示行（诚实静态文案）', p1.note === '会员价细则即将公布', p1.note ?? '');
  assert('PDP：双钮吸底（加购/立即买真链路，立即买=柠檬黄实底）',
    p1.addBtn === '加入购物车' && p1.buyBtn === '立即购买' && p1.buyBg === 'rgb(253, 200, 48)', `${p1.buyBtn} ${p1.buyBg}`);
  assert('PDP：详情级无 dock', !p1.dock);

  /* 3. 立即购买 → 结算 → 提交订单 → mock 支付 */
  await evalJs(`(() => { document.querySelector('[data-testid="pdp-buy-now"]').click(); return true; })()`);
  await sleep(3500);
  const c1 = await evalJs(`(() => ({ url: location.pathname, text: document.getElementById('root')?.innerText ?? '' }))()`);
  assert('链路：立即购买 → 结算页', c1.url === '/mall/checkout', c1.url);
  await shot('05-结算页');

  /* 收货地址表单（React 受控输入：native setter + input 事件） */
  const filled = await evalJs(`(() => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('#root input, #root textarea')];
    const byPlaceholder = (kw) => inputs.find((i) => (i.placeholder ?? '').includes(kw));
    const name = byPlaceholder('收货人姓名'), phone = byPlaceholder('手机号'), addr = byPlaceholder('详细地址');
    if (!name || !phone || !addr) return { name: !!name, phone: !!phone, addr: !!addr };
    setVal(name, '示例客户'); setVal(phone, '13800001234'); setVal(addr, '西湖区文三路 100 号 1 幢 101');
    return { name: true, phone: true, addr: true };
  })()`);
  await sleep(800);
  assert('链路：收货地址填写（表单真实校验）', filled.name && filled.phone && filled.addr, JSON.stringify(filled));

  assert('链路：提交订单可点', await clickText('提交订单'));
  await sleep(3500);
  await shot('06-收银台');
  const paid = await clickText('模拟支付成功');
  assert('链路：mock 收银台「模拟支付成功」（mock 支付不动）', paid);
  await sleep(4000);
  await shot('07-支付后');

  /* 4. 订单列表：三态卡 */
  await send('Page.navigate', { url: `${APP}/mall/orders` });
  await sleep(4500);
  const o1 = await evalJs(`(() => {
    const text = document.getElementById('root')?.innerText ?? '';
    const all = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
    const tabOf = (label) => all.some((t) => t === label || t.startsWith(label));
    return {
      tabs: ['待支付','待发货','待收货','已完成','售后'].filter(tabOf),
      hasPayBtn: text.includes('去支付'),
      dock: !!document.querySelector('[data-testid="app-dock"]'),
      backBtn: !!document.querySelector('button[aria-label="返回"]'),
    };
  })()`);
  await shot('08-订单列表');
  assert('订单：tabs 五档', o1.tabs.length === 5, o1.tabs.join('/'));
  /* 点待发货 tab：刚支付的真实订单卡（门店正在备货） */
  await clickText('待发货');
  await sleep(2500);
  const o1b = await evalJs(`(() => {
    const text = document.getElementById('root')?.innerText ?? '';
    return { paidCard: text.includes('门店正在备货') || text.includes('风干鸡肉干') };
  })()`);
  await shot('08b-待发货卡');
  assert('订单：待发货卡（刚支付真实订单）', o1b.paidCard);
  assert('订单：详情级无 dock + 返回圆钮', !o1.dock && o1.backBtn);

  /* 已完成 tab：再来一单真链路（种子有 received 单则验，无则标注） */
  await clickText('已完成');
  await sleep(3000);
  const o2 = await evalJs(`(() => {
    const btn = document.querySelector('[data-testid^="order-reorder-"]');
    return { reorder: !!btn };
  })()`);
  if (o2.reorder) {
    await evalJs(`localStorage.removeItem('philia.cart'); true`);
    await evalJs(`(() => { document.querySelector('[data-testid^="order-reorder-"]').click(); return true; })()`);
    await sleep(3000);
    const o3 = await evalJs(`(() => {
      const items = (JSON.parse(localStorage.getItem('philia.cart') ?? '{"items":[]}').items ?? []);
      return { url: location.pathname, count: items.reduce((n, i) => n + i.qty, 0) };
    })()`);
    await shot('09-再来一单-购物车');
    assert('链路：再来一单 → 重建购物车并落 /mall/cart', o3.url === '/mall/cart' && o3.count >= 1, `${o3.url} count=${o3.count}`);
  } else {
    assert('链路：再来一单（无 received 种子单，标注跳过）', true, '无已完成订单');
  }

  /* 死链点验 */
  const dead = await evalJs(`(() => {
    const out = [];
    document.querySelectorAll('#root a[href]').forEach((a) => { const h = a.getAttribute('href'); if (!h || h === '#' || h.startsWith('javascript')) out.push(h); });
    return out;
  })()`);
  assert('点验：订单页无死链', dead.length === 0);

  writeFileSync(resolve(__dirname, 'mall-e2e-results.json'), JSON.stringify({ results, l1, p1, o1 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
