#!/usr/bin/env node
/**
 * 壳层实尺截图（产品-1015 换皮 片0-三端壳 · 卷宗实证工具）：node scripts/capture-shell-shots.mjs
 *
 * 用途：对三端壳旅程做真机实尺截图，供「对照 Ready 壳＋现网（基线）壳不回退怪跳」验收。
 * 同一脚本对「本片构建产物」与「基线 a84397cc 构建产物」各跑一遍，同名文件分目录落盘，
 * 人工/产品侧逐对目检。
 *
 * 口径：
 * - 零依赖（Node 20+ 原生 fetch/WebSocket + Edge/Chrome CDP），口径学 smoke-routes.mjs；
 * - dev-login 取种子用户（cookie 按域共享，跨口无碍）；登录失败仍截图（守卫跳转态亦入卷）；
 * - 视口：手机 390×844（客户/员工/商家手机五槽）、桌面 1440×900（商家 rail ≥xl 显形）；
 * - SSE 拦截同 smoke-routes（防长连接饿死后段路由）。
 *
 * 环境变量：
 * - CUSTOMER_URL / MERCHANT_URL / STAFF_URL（默认 7100/7101/7102；基线对照跑时传 7110/7111/7112）
 * - API_BASE（默认 http://localhost:7200）
 * - SHOT_DIR（默认 evidence/design-s0-shell/shots）
 * - CDP_PORT（默认 9225，避开 smoke-routes 9223 / check-nav-closure 9224）
 *
 * 退出码：0=全部截到；2=环境不可用。
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP_URLS = {
  customer: (process.env.CUSTOMER_URL ?? 'http://localhost:7100').replace(/\/$/, ''),
  merchant: (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, ''),
  staff: (process.env.STAFF_URL ?? 'http://localhost:7102').replace(/\/$/, ''),
};
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9225);
const SHOT_DIR = process.env.SHOT_DIR ?? 'evidence/design-s0-shell/shots';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const MOBILE = { width: 390, height: 844, mobile: true };
const DESKTOP = { width: 1440, height: 900, mobile: false };

/** 壳旅程镜头表（片0 令围：A1 客户端五 Tab / A2 员工 Dock / A3 商家 Rail+五槽） */
const SHOTS = [
  /* A1 客户端五 Tab 壳（主级四路 + PHILIA；dock 仅主级渲染） */
  { app: 'customer', path: '/home', vp: MOBILE, name: 'customer-home' },
  { app: 'customer', path: '/mall', vp: MOBILE, name: 'customer-mall' },
  { app: 'customer', path: '/philia', vp: MOBILE, name: 'customer-philia' },
  { app: 'customer', path: '/me', vp: MOBILE, name: 'customer-me' },
  /* A2 员工 Dock 壳（/today 自渲染 SkDock；/schedule /attendance /me 走 App 壳 StaffDock） */
  { app: 'staff', path: '/today', vp: MOBILE, name: 'staff-today' },
  { app: 'staff', path: '/schedule', vp: MOBILE, name: 'staff-schedule' },
  { app: 'staff', path: '/attendance', vp: MOBILE, name: 'staff-attendance' },
  { app: 'staff', path: '/me', vp: MOBILE, name: 'staff-me' },
  /* A3 商家桌面 rail（≥xl 显形） */
  { app: 'merchant', path: '/dashboard', vp: DESKTOP, name: 'merchant-desk-dashboard' },
  { app: 'merchant', path: '/monitor', vp: DESKTOP, name: 'merchant-desk-monitor' },
  { app: 'merchant', path: '/finance', vp: DESKTOP, name: 'merchant-desk-finance' },
  /* A3 商家手机五槽（<xl 显形） */
  { app: 'merchant', path: '/dashboard', vp: MOBILE, name: 'merchant-phone-dashboard' },
  { app: 'merchant', path: '/cashier', vp: MOBILE, name: 'merchant-phone-cashier' },
  { app: 'merchant', path: '/settings', vp: MOBILE, name: 'merchant-phone-me' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser = null;
const profileDir = join(tmpdir(), `philia-shell-shots-${process.pid}`);

async function launchBrowser() {
  if (!BROWSER) throw new Error('未找到 Edge/Chrome 可执行文件');
  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(500);
  }
  throw new Error(`CDP 端口 ${CDP_PORT} 未就绪`);
}
function cleanup() {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  browser = null;
  try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

class Cdp {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        p(msg.result);
      }
    };
    await new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; });
    await this.send('Page.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true });
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/events*', requestStage: 'Request' }] });
  }
  send(method, params = {}) {
    return new Promise((res) => {
      const mid = ++this.id;
      this.pending.set(mid, res);
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.enable').then(() =>
      this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }));
    return r.result?.value;
  }
  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

const APP_ROLE = { customer: 'customer', merchant: 'merchant_owner', staff: 'staff' };
async function seedUserId(role) {
  const res = await fetch(`${API_BASE}/api/auth/dev-seed-users`);
  if (!res.ok) return null;
  const users = (await res.json())?.users ?? [];
  return (users.find((u) => (u.roles ?? []).includes(role)) ?? users[0])?.id ?? null;
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const manifest = [];
  const apps = [...new Set(SHOTS.map((s) => s.app))];
  for (const app of apps) {
    const wsUrl = await launchBrowser();
    const cdp = new Cdp(wsUrl);
    await cdp.open();
    /* 登录本端（cookie 按域共享；失败则该端按守卫跳转态截图入卷） */
    const uid = await seedUserId(APP_ROLE[app]).catch(() => null);
    let logged = false;
    if (uid) {
      await cdp.send('Page.navigate', { url: `${APP_URLS[app]}/dev-login` });
      await sleep(2000);
      const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: '${uid}' }), credentials: 'include',
      }).then((r) => r.status).catch(() => 0)`);
      logged = status === 200;
    }
    console.log(`[${app}] dev-login ${logged ? '✓' : '✗（按守卫态截图）'}`);

    for (const s of SHOTS.filter((x) => x.app === app)) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: s.vp.width, height: s.vp.height, deviceScaleFactor: 1, mobile: s.vp.mobile,
      });
      await cdp.send('Page.navigate', { url: APP_URLS[app] + s.path });
      await sleep(3500);
      const state = await cdp.eval(`JSON.stringify({ path: location.pathname,
        hasDock: !!document.querySelector('[data-testid="app-dock"],[data-testid="staff-dock"],[data-testid="merchant-rail"],[data-testid="merchant-dock"]'),
        textLen: (document.body?.innerText ?? '').length })`).catch(() => null);
      const file = join(SHOT_DIR, `${s.name}.png`);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      manifest.push({ ...s, vp: `${s.vp.width}x${s.vp.height}`, logged, state: state ? JSON.parse(state) : null, file });
      console.log(`  ✓ ${s.name}.png（${s.vp.width}×${s.vp.height}，落点 ${state ? JSON.parse(state).path : '?'}）`);
    }
    cdp.close();
    cleanup();
  }
  writeFileSync(join(SHOT_DIR, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), env: { ...APP_URLS, API_BASE }, shots: manifest }, null, 2));
  console.log(`\n截图 ${manifest.length} 张 + manifest.json → ${SHOT_DIR}`);
  process.exit(0);
}
main().catch((e) => { console.error('capture-shell-shots 环境异常：', e?.message ?? e); cleanup(); process.exit(2); });
