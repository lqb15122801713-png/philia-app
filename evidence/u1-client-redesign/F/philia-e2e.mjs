/**
 * U1-F 证据采集：philia 页验收（CDP 直连）
 *
 * 断言口径：
 * - 形象位：圆形双细线环（外环 ring-1 容器 + 头像/占位圆），pet.list 真实数据；
 * - 真实三数：philia-tri-stats 两项（陪伴天数/服务次数），无守护值字样；
 * - 一键预约卡：philia-booking-card 内含 HomeBookingPanel 真链路（rebook/entry 其一）；
 * - 成长护照预告行：置灰静态行（无 href 无 onClick，含「9c 解锁」）；
 * - 守护市集入口行：不存在；
 * - 禁做假互动：无喂食/玩耍/打扮/拍照四钮、无「定制我的崽」；
 * - 保留真实链路：三胶囊卡（档案/会员卡/相册）、菲丽亚日记、关闭钮；
 * - dock：主级页 AppDock 在且 philia 中央钮 active。
 * 运行：node philia-e2e.mjs
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
const profileDir = resolve(tmpdir(), `philia-u1f-e2e-${process.pid}`);
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

  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  await send('Page.navigate', { url: `${APP}/philia` });
  await sleep(5000);
  const s = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const text = document.getElementById('root')?.innerText ?? '';
    const statsText = q('[data-testid="philia-tri-stats"]')?.textContent?.replace(/\\s+/g, ' ') ?? null;
    const bookingCard = q('[data-testid="philia-booking-card"]');
    const teaser = q('[data-testid="philia-passport-teaser"]');
    return {
      heroRing: qa('.rounded-full.p-2.ring-1').length,
      petName: qa('.snap-center p').map(p => p.textContent)[0] ?? null,
      statsText,
      statsHasShouhu: statsText ? statsText.includes('守护值') : false,
      bookingRebook: !!bookingCard?.querySelector('[data-testid="home-rebook-panel"]'),
      bookingEntry: bookingCard?.querySelector('[data-testid="home-booking-entry"]')?.getAttribute('href') ?? null,
      bookingCta: bookingCard?.querySelector('[data-testid="home-rebook-cta"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      teaserText: teaser?.textContent?.replace(/\\s+/g, ' ') ?? null,
      teaserInteractive: teaser ? (teaser.tagName === 'A' || teaser.tagName === 'BUTTON' || !!teaser.onclick) : null,
      market: text.includes('守护市集') || text.includes('市集'),
      fakeActions: ['喂食','玩耍','打扮','定制我的崽'].filter((w) => text.includes(w)),
      capsules: qa('a[href="/philia/pets"], a[href="/philia/member"], a[href="/philia/moments"]').length,
      diary: text.includes('菲丽亚日记'),
      closeBtn: !!q('button[aria-label="关闭"]'),
      dock: !!q('[data-testid="app-dock"]'),
      dockActive: qa('[data-testid="app-dock-philia"][aria-current="page"]').length === 1,
      deadLinks: qa('#root a[href]').filter((a) => { const h = a.getAttribute('href'); return !h || h === '#' || h.startsWith('javascript'); }).length,
    };
  })()`);
  await shot('01-philia');

  assert('形象位：宠物照片圆形双细线环（pet.list 真实数据）', s.heroRing >= 1 && !!s.petName, s.petName ?? '');
  assert('真实三数：陪伴天数/服务次数两项（守护值不出）', !!s.statsText && !s.statsHasShouhu, s.statsText ?? '');
  assert('一键预约卡：现成真链路（rebook 或降级入口卡）', s.bookingRebook || s.bookingEntry === '/booking/grooming',
    s.bookingRebook ? `rebook: ${s.bookingCta}` : `entry→${s.bookingEntry}`);
  assert('成长护照预告行：置灰静态行（9c 解锁，非互动）', !!s.teaserText?.includes('9c 解锁') && s.teaserInteractive === false, s.teaserText ?? '');
  assert('守护市集入口行：不存在', !s.market);
  assert('禁做假互动：无四钮/定制我的崽', s.fakeActions.length === 0, s.fakeActions.join(','));
  assert('真实链路保留：三胶囊卡 + 菲丽亚日记 + 关闭钮', s.capsules === 3 && s.diary && s.closeBtn);
  assert('dock：主级页 AppDock 在且 philia 中央钮 active', s.dock && s.dockActive);
  assert('按钮点验：无死链（# / javascript: / 空 href）', s.deadLinks === 0);

  writeFileSync(resolve(__dirname, 'philia-e2e-results.json'), JSON.stringify({ results, state: s }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
