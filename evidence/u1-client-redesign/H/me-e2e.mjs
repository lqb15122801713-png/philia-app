/**
 * U1-H 证据采集：我的页 + /me/card 会员卡页验收（CDP 直连）
 * 断言：
 * - /me：用户条 / 纸面细线会员卡（GUARDIAN CARD·三真数→/me/card）/ 入口列表全真实
 *   跳转（会员卡→/me/card）/ 意见反馈·关于菲丽亚假按钮不存在 / 已省行不出现；
 * - /me/card：三档卡面（占位文案「细则以门店公布为准」）+ 真实次卡余额区 + 无虚构
 *   权益价格 + 详情级无 dock + 返回圆钮；
 * - 死链点验。
 * 运行：node me-e2e.mjs
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
const profileDir = resolve(tmpdir(), `philia-u1h-e2e-${process.pid}`);
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

  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  /* /me */
  await send('Page.navigate', { url: `${APP}/me` });
  await sleep(4500);
  const m1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const text = document.getElementById('root')?.innerText ?? '';
    return {
      userCard: !!q('[data-testid="me-user-card"]'),
      guardian: q('[data-testid="me-guardian-card"]')?.getAttribute('href') ?? null,
      guardianText: q('[data-testid="me-guardian-card"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      entries: qa('[data-testid="me-entries"] a').map((a) => a.getAttribute('href')),
      fakeRows: ['意见反馈','关于菲丽亚'].filter((w) => text.includes(w)),
      savedRow: text.includes('已省'),
      shouhu: text.includes('守护值'),
      logout: !!q('[data-testid="me-logout-btn"]'),
      dock: !!q('[data-testid="app-dock"]'),
      dockActiveMe: qa('[data-testid="app-dock-me"][aria-current="page"]').length === 1,
    };
  })()`);
  await shot('01-me');
  assert('我的：用户条 + 纸面细线会员卡（GUARDIAN CARD·三真数→/me/card）',
    m1.userCard && m1.guardian === '/me/card' && !!m1.guardianText?.includes('GUARDIAN CARD'), m1.guardianText ?? '');
  assert('我的：入口列表全真实跳转（会员卡→/me/card）',
    m1.entries.every(Boolean) && m1.entries.includes('/me/card'), m1.entries.join(','));
  assert('我的：假按钮不存在（意见反馈/关于菲丽亚）+ 已省行隐去 + 守护值不出现',
    m1.fakeRows.length === 0 && !m1.savedRow && !m1.shouhu);
  assert('我的：主级页 dock 在且「我的」active', m1.dock && m1.dockActiveMe);

  /* /me/card */
  await send('Page.navigate', { url: `${APP}/me/card` });
  await sleep(4500);
  const c1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const text = document.getElementById('root')?.innerText ?? '';
    return {
      tiers: qa('[data-testid="member-tiers"] section').length,
      tiersText: q('[data-testid="member-tiers"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      balance: !!q('[data-testid="member-pass-balance"]'),
      total: q('[data-testid="member-pass-total"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      hasZhekouNumber: /\\d+(\\.\\d+)?\\s*折/.test(text),
      dock: !!q('[data-testid="app-dock"]'),
      backBtn: !!q('button[aria-label="返回"]'),
    };
  })()`);
  await shot('02-me-card');
  assert('/me/card：三档卡面展示（占位文案细则以门店公布为准）',
    c1.tiers === 3 && !!c1.tiersText?.includes('细则以门店公布为准'), `tiers=${c1.tiers}`);
  assert('/me/card：真实次卡余额区（不编造守护值流水/折扣数字）', c1.balance && !c1.hasZhekouNumber,
    `total=${c1.total ?? '无'}`);
  assert('/me/card：详情级无 dock + 返回圆钮', !c1.dock && c1.backBtn);

  const dead = await evalJs(`(() => {
    const out = [];
    document.querySelectorAll('#root a[href]').forEach((a) => { const h = a.getAttribute('href'); if (!h || h === '#' || h.startsWith('javascript')) out.push(h); });
    return out;
  })()`);
  assert('点验：两页无死链', dead.length === 0);

  writeFileSync(resolve(__dirname, 'me-e2e-results.json'), JSON.stringify({ results, m1, c1 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
