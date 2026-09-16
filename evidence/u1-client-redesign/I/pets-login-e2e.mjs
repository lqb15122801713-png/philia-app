/**
 * U1-I 证据采集：宠物档案 / 登录页 / 空态统一验收（CDP 直连）
 * 断言：
 * - /philia/pets：双细线环头图 + 疫苗徽标（薄荷正常或柠檬到期，真实 vaccineValidUntil）
 *   + 洗护史时间线「同款再约」真实预填链（storeId/serviceId/petId 三参齐）；
 * - /dev-login：细线圆爪印 + 衬线宣言 + 柠檬细线 + 逻辑保留（种子列表渲染）；
 * - 空态统一：/mall/cart 空态走统一组件（u1-card + 插画 + 一句话 + 一行动）；
 * - 死链点验。
 * 运行：node pets-login-e2e.mjs
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
const profileDir = resolve(tmpdir(), `philia-u1i-e2e-${process.pid}`);
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
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  };

  /* 登录页（未登录态直拍） */
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(3500);
  const d1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const text = document.getElementById('root')?.innerText ?? '';
    const paw = q('header .ring-1.ring-line-ring.rounded-full');
    const lemon = q('header .bg-brand-primary.h-0\\\\.5, header span.bg-brand-primary');
    return {
      paw: !!paw,
      serifTitle: text.includes('守护每一次洗护'),
      lemonLine: !!q('header span.bg-brand-primary'),
      seeds: qa('ul li button').length,
      logic: text.includes('选择种子用户登录'),
    };
  })()`);
  await shot('01-dev-login');
  assert('登录页：细线圆爪印 + 衬线宣言 + 柠檬细线', d1.paw && d1.serifTitle && d1.lemonLine);
  assert('登录页：种子列表逻辑保留（真实渲染）', d1.logic && d1.seeds >= 1, `seeds=${d1.seeds}`);

  /* 登录 */
  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  /* 宠物档案 */
  await send('Page.navigate', { url: `${APP}/philia/pets` });
  await sleep(4500);
  const p1 = await evalJs(`(() => {
    const qa = (s) => [...document.querySelectorAll(s)];
    const q = (s) => document.querySelector(s);
    const text = document.getElementById('root')?.innerText ?? '';
    const badge = [...document.querySelectorAll('article span')].find((s) => (s.textContent ?? '').includes('疫苗有效至') || (s.textContent ?? '').includes('天后到期'));
    const rebook = q('[data-testid^="pet-rebook-"]');
    return {
      rings: qa('article .rounded-full.ring-1.ring-line-ring').length,
      badgeText: badge?.textContent?.trim() ?? null,
      badgeBg: badge ? getComputedStyle(badge).backgroundColor : null,
      history: qa('[data-testid^="pet-history-"]').length,
      rebookHref: rebook?.getAttribute('href') ?? null,
      dock: !!q('[data-testid="app-dock"]'),
      backBtn: !!q('button[aria-label="返回"]'),
      rootText: text.length,
    };
  })()`);
  await shot('02-pets');
  assert('档案：头图圆形双细线环（pet.list 真实数据）', p1.rings >= 2, `rings=${p1.rings}`);
  assert('档案：疫苗徽标真实驱动（薄荷 #D3EEE6 正常 或 柠檬浅底到期）',
    !!p1.badgeText && (p1.badgeBg === 'rgb(211, 238, 230)' || p1.badgeBg === 'rgb(252, 243, 217)'),
    `${p1.badgeText} ${p1.badgeBg}`);
  assert('档案：洗护史时间线存在（真实完成单）', p1.history >= 1, `history=${p1.history}`);
  assert('档案：同款再约=真实预填链（storeId/serviceId/petId 三参齐）',
    !!p1.rebookHref && /\/booking\/grooming\?storeId=[^&]+&serviceId=[^&]+&petId=[^&]+/.test(p1.rebookHref ?? ''),
    p1.rebookHref ?? '');
  assert('档案：详情级无 dock + 返回圆钮', !p1.dock && p1.backBtn);

  /* 空态统一（购物车空态走统一组件） */
  await evalJs(`localStorage.removeItem('philia.cart'); true`);
  await send('Page.navigate', { url: `${APP}/mall/cart` });
  await sleep(3500);
  const e1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const card = q('.u1-card img[alt=""]')?.closest('.u1-card');
    return {
      unified: !!card && card.querySelector('img')?.getAttribute('src') === '/brand/empty-appointments-800.png',
      action: card?.querySelector('a[href="/mall"]')?.textContent?.trim() ?? null,
    };
  })()`);
  await shot('03-cart-empty');
  assert('空态：购物车空态走统一组件（插画+一句话+一行动）', e1.unified && e1.action === '去逛逛', e1.action ?? '');

  const dead = await evalJs(`(() => {
    const out = [];
    document.querySelectorAll('#root a[href]').forEach((a) => { const h = a.getAttribute('href'); if (!h || h === '#' || h.startsWith('javascript')) out.push(h); });
    return out;
  })()`);
  assert('点验：无死链', dead.length === 0);

  writeFileSync(resolve(__dirname, 'pets-login-e2e-results.json'), JSON.stringify({ results, d1, p1, e1 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
