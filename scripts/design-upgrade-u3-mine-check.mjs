#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODE = process.argv[2];
if (!['me', 'card'].includes(MODE)) {
  console.error('用法：node scripts/design-upgrade-u3-mine-check.mjs me|card');
  process.exit(2);
}

const CUSTOMER_URL = (process.env.CUSTOMER_URL ?? 'http://localhost:7173').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7243').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9253);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(REPO_ROOT, 'evidence', 'design-upgrade-u3-mine');
const SHOTS_DIR = join(OUT_DIR, 'shots');
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const note = (ok, name, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const error = first.error.json ?? first.error;
    throw new Error(`${name}：${error?.message ?? JSON.stringify(error)}`);
  }
  return first?.result?.data?.json;
}

async function trpcQuery(cookie, path, input = null) {
  const payload = encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return unwrap(await res.json(), `trpc ${path}`);
}

async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) return null;
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function findExistingMember() {
  const res = await fetch(`${API_BASE}/api/auth/dev-seed-users`);
  if (!res.ok) throw new Error(`dev-seed-users HTTP ${res.status}`);
  const seed = await res.json();
  const candidates = (seed.users ?? []).filter((user) => (user.roles ?? []).includes('customer'));
  for (const user of candidates) {
    const cookie = await devLogin(user.id);
    if (!cookie) continue;
    const my = await trpcQuery(cookie, 'membership.my');
    if (my?.membership) return { user, cookie };
  }
  throw new Error('既有种子用户中没有可用会员；本脚本不会开会员');
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      this.pending.get(msg.id)(msg);
      this.pending.delete(msg.id);
    };
    await new Promise((resolve) => { this.ws.onopen = resolve; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result?.result?.value;
  }
  async goto(url, waitMs = 3200) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }
  async waitFor(expression, timeoutMs = 30000) {
    const started = Date.now();
    for (;;) {
      if (await this.eval(`!!(${expression})`)) return true;
      if (Date.now() - started > timeoutMs) return false;
      await sleep(400);
    }
  }
  async click(selector) {
    const point = await this.eval(`(() => {
      const el = document.querySelector('${selector}');
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    if (!point) return false;
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    return true;
  }
  async shot(path) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
  }
  close() {
    try { this.ws?.close(); } catch {}
  }
}

async function main() {
  if (!BROWSER) throw new Error('未探测到 Chrome/Edge');
  for (const [name, url] of [['customer', CUSTOMER_URL], ['api', `${API_BASE}/api/auth/dev-seed-users`]]) {
    let reachable = false;
    for (let i = 0; i < 5 && !reachable; i += 1) {
      try { reachable = (await fetch(url)).status > 0; } catch { await sleep(400); }
    }
    if (!reachable) throw new Error(`${name} 不可达：${url}`);
  }

  const member = await findExistingMember();
  const profile = join(tmpdir(), `pd42-u3-${MODE}-${process.pid}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  const cleanup = () => {
    if (browser.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);

  let target = null;
  for (let i = 0; i < 40 && !target; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      target = await res.json();
    } catch { await sleep(400); }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('CDP 页签创建失败');

  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  const height = MODE === 'me' ? 900 : 844;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Browser.grantPermissions', {
    origin: CUSTOMER_URL,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  }).catch(() => undefined);
  await cdp.goto(`${CUSTOMER_URL}/dev-login`);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${member.user.id}' }), credentials: 'include',
  }).then((res) => res.status).catch(() => 0)`);
  note(loginStatus === 200, '既有会员浏览器登录', `HTTP ${loginStatus}`);

  if (MODE === 'me') {
    await cdp.goto(`${CUSTOMER_URL}/me`);
    await cdp.waitFor(`document.querySelector('[data-testid="me-hero"]')`);
    const quick = await cdp.eval(`Array.from(document.querySelectorAll('[data-testid="me-orderrow"] a')).map((a) => [a.textContent.trim(), a.getAttribute('href')])`) ?? [];
    const expectedQuick = ['/appointments?tab=all', '/booking/grooming', '/philia/pets', '/settings/addresses'];
    note(quick.length === 4 && expectedQuick.every((href) => quick.some((item) => item[1] === href)), '我的页定稿四入口', JSON.stringify(quick));
    const links = await cdp.eval(`Array.from(document.querySelectorAll('[data-testid="me-grid8"] a')).map((a) => [a.textContent.trim(), a.getAttribute('href')])`) ?? [];
    const expectedLinks = ['/member/rebate', '/me/coupons', '/me/coupons?tab=favs', '/support/new', '/me/settings'];
    note(links.length === 5 && expectedLinks.every((href) => links.some((item) => item[1] === href)), '我的页定稿五列表', JSON.stringify(links));
    const cells = await cdp.eval(`['me-qrrow','me-rebate-cell','me-coupon-cell','me-pet-cell'].every((id) => !!document.querySelector('[data-testid="'+id+'"]'))`);
    note(cells, '顶码与回馈金／券／毛孩子三格');
    const fontGate = await cdp.eval(`(() => {
      const nodes = Array.from(document.querySelectorAll('[data-u3-secondary]'));
      return { count: nodes.length, tooSmall: nodes.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => [el.textContent.trim(), getComputedStyle(el).fontSize]) };
    })()`);
    note((fontGate?.count ?? 0) >= 4 && fontGate.tooSmall.length === 0, '我的页副文不小于 12px', JSON.stringify(fontGate));
    await cdp.shot(join(SHOTS_DIR, 'me-390x900.png'));
  } else {
    await cdp.goto(`${CUSTOMER_URL}/me`);
    await cdp.waitFor(`document.querySelector('[data-testid="me-qrrow"]')`);
    const qrEntry = await cdp.eval(`!!document.querySelector('[data-testid="me-qrrow"]')`);
    note(qrEntry, '顶码入口存在');
    if (qrEntry) {
      await cdp.eval(`document.querySelector('[data-testid="me-qrrow"]').click()`);
      await cdp.waitFor(`location.pathname === '/me/card' && document.querySelector('[data-testid="membercard-token"]')`);
    }
    note(await cdp.eval(`location.pathname === '/me/card'`), '顶码进入会员码全屏');
    const qrReady = qrEntry ? await cdp.waitFor(`document.querySelector('[data-testid="membercard-qr-image"]')`, 8000) : false;
    note(qrReady && await cdp.eval(`document.querySelector('[data-testid="membercard-qr-image"]')?.src.startsWith('data:image/png')`), '真实 QR data URL');
    const sameToken = await cdp.eval(`(() => {
      const token = (document.querySelector('[data-testid="membercard-token"]')?.textContent ?? '').replace(/\\s/g, '');
      const qr = document.querySelector('[data-testid="membercard-qr-image"]');
      const barcode = document.querySelector('[data-testid="membercard-barcode"]');
      return { length: token.length, same: token.length > 40 && qr?.dataset.token === token && barcode?.dataset.token === token };
    })()`);
    note(sameToken?.same, 'QR／条码／人工码同一原始 token', JSON.stringify(sameToken));
    const surface = await cdp.eval(`(() => {
      const page = document.querySelector('[data-testid="member-card-page"]');
      return {
        background: page ? getComputedStyle(page).backgroundColor : null,
        panel: !!document.querySelector('[data-testid="membercard-panel"]'),
        close: !!document.querySelector('[data-testid="membercard-close"]'),
        copy: !!document.querySelector('[data-testid="membercard-copy"]'),
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      };
    })()`);
    note(surface?.background === 'rgb(92, 80, 64)' && surface.panel, '会员码深底白卡', JSON.stringify(surface));
    note(surface?.close && surface?.copy, '关闭与复制兜底');
    note(surface?.scrollHeight <= surface?.innerHeight + 2, '会员码单屏无额外滚动', `${surface?.scrollHeight}/${surface?.innerHeight}`);
    if (surface?.copy) {
      await cdp.click('[data-testid="membercard-copy"]');
      await sleep(500);
      const copyText = await cdp.eval(`document.querySelector('[data-testid="membercard-copy-status"]')?.textContent ?? ''`);
      note(copyText.includes('已复制'), '条码保留复制反馈', copyText);
    }
    await cdp.shot(join(SHOTS_DIR, 'member-card-390x844.png'));
    if (surface?.close) {
      await cdp.eval(`document.querySelector('[data-testid="membercard-close"]').click()`);
      await cdp.waitFor(`location.pathname === '/me'`, 5000);
      note(await cdp.eval(`location.pathname === '/me'`), '关闭返回我的页');
    }
  }

  cdp.close();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `results-${MODE}.json`), `${JSON.stringify({ mode: MODE, results }, null, 2)}\n`);
  const failures = results.filter((result) => !result.ok).length;
  console.log(`${MODE}: ${results.length - failures}/${results.length} PASS`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
