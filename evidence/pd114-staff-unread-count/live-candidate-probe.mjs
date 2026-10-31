import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE = join(ROOT, 'evidence', 'pd114-staff-unread-count');
const DIST = join(ROOT, 'apps', 'staff', 'dist');
const BASE = 'http://120.53.102.45:7203';
const STAFF_ID = '01M25M44KWJ10KVSTRWCD18M66';
const PASSCODE = 'Philia2026';
const PORT = 9414;
const requireServer = createRequire(join(ROOT, 'server', 'package.json'));
const WebSocketImpl = globalThis.WebSocket ?? requireServer('ws');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((path) => existsSync(path));

class Cdp {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.requests = new Map();
    this.listResponses = [];
    this.procedures = [];
    this.authResponses = [];
    this.navigations = [];
    this.candidateServed = false;
    this.eventError = null;
  }

  async open(candidate) {
    this.candidate = candidate;
    this.ws = new WebSocketImpl(this.url);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === 'Fetch.requestPaused') {
        void this.send('Fetch.fulfillRequest', {
          requestId: message.params.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'content-type', value: 'text/javascript; charset=utf-8' },
            { name: 'cache-control', value: 'no-store' },
          ],
          body: this.candidate.base64,
        }).then(() => { this.candidateServed = true; }).catch((error) => { this.eventError = error; });
      }
      if (message.method === 'Page.frameNavigated') this.navigations.push(message.params.frame.url);
      if (message.method === 'Network.requestWillBeSent') {
        const { requestId, request } = message.params;
        this.requests.set(requestId, request.url);
        if (request.url.includes('/trpc/')) this.procedures.push({ method: request.method, url: request.url });
      }
      if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/auth/dev-login')) {
        this.authResponses.push({ status: message.params.response.status, url: message.params.response.url });
      }
      if (message.method === 'Network.loadingFinished') {
        const url = this.requests.get(message.params.requestId) ?? '';
        if (!url.includes('/trpc/push.listNotifications')) return;
        void this.send('Network.getResponseBody', { requestId: message.params.requestId }).then((body) => {
          const payload = JSON.parse(body.body);
          const data = payload[0]?.result?.data?.json;
          if (data?.items) this.listResponses.push(data);
        }).catch((error) => { this.eventError = error; });
      }
    };
    await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true });
    await this.send('ServiceWorker.disable');
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*/assets/index-DDB3TYul.js*' }] });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response?.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails).slice(0, 800));
    return response?.result?.value;
  }

  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    for (;;) {
      if (this.eventError) throw this.eventError;
      if (await this.eval(`!!(${expression})`).catch(() => false)) return true;
      if (Date.now() - start > timeoutMs) return false;
      await sleep(150);
    }
  }

  async shot(file) {
    const image = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(image.data, 'base64'));
    return sha256(readFileSync(file));
  }

  close() { try { this.ws?.close(); } catch {} }
}

function expectedFromRaw(data) {
  const groups = new Map();
  for (const row of data.items) {
    const key = JSON.stringify([row.type, row.title, row.body, String(row.createdAt).slice(0, 16)]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return {
    rawRows: data.items.length,
    groupedRows: groups.size,
    unreadGroups: [...groups.values()].filter((group) => group.some((row) => row.readAt === null)).length,
    unreadIds: data.items.filter((row) => row.readAt === null).length,
  };
}

async function main() {
  if (!BROWSER) throw new Error('Edge/Chrome not found');
  const liveHtml = await (await fetch(`${BASE}/staff/`)).text();
  if (!liveHtml.includes('/assets/index-DDB3TYul.js')) throw new Error('live staff dist drifted from frozen baseline');
  const candidateHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  const bundleName = candidateHtml.match(/assets\/(index-[^/]+\.js)/)?.[1];
  if (!bundleName || bundleName === 'index-DDB3TYul.js') throw new Error('candidate staff bundle missing or unchanged');
  const candidateBytes = await readFile(join(DIST, 'assets', bundleName));
  const candidate = { base64: candidateBytes.toString('base64'), sha256: sha256(candidateBytes) };
  const profile = join(tmpdir(), `pd114-${Date.now()}`);
  const browser = spawn(BROWSER, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--lang=zh-CN',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--headless=new',
  ], { stdio: 'ignore' });
  let cdp = null;
  const cleanup = () => {
    try { cdp?.close(); } catch {}
    try { browser.kill(); } catch {}
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  };
  process.on('exit', cleanup);
  try {
    let target = null;
    for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
        target = await response.json();
      } catch { await sleep(200); }
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('CDP target creation failed');
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open(candidate);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `${BASE}/login` });
    if (!await cdp.waitFor(`document.querySelector('#staff-account')`)) throw new Error('login form missing');
    await cdp.eval(`document.querySelector('[data-testid="login-gate"]')?.click()`);
    await cdp.waitFor(`document.querySelector('#staff-gate-code')`);
    await cdp.eval(`(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [selector, value] of [['#staff-account', ${JSON.stringify(STAFF_ID)}], ['#staff-gate-code', ${JSON.stringify(PASSCODE)}]]) {
        const input = document.querySelector(selector);
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await cdp.waitFor(`document.querySelector('#staff-account')?.value === ${JSON.stringify(STAFF_ID)} && !document.querySelector('#staff-account')?.form?.querySelector('button[type="submit"]')?.disabled`);
    await cdp.eval(`document.querySelector('#staff-account')?.form?.requestSubmit()`);
    const reachedToday = await cdp.waitFor(`location.pathname === '/today'`, 5000);
    if (!reachedToday && cdp.authResponses.at(-1)?.status !== 200) {
      const debug = await cdp.eval(`(() => ({
        url: location.href,
        body: (document.body?.innerText ?? '').slice(0, 3000),
        inputs: [...document.querySelectorAll('input')].map((input) => ({ type: input.type, value: input.type === 'password' ? '[masked]' : input.value })),
        buttons: [...document.querySelectorAll('button')].map((button) => ({ text: button.textContent.trim(), disabled: button.disabled })),
      }))()`);
      const debugShot = join(EVIDENCE, 'probe-login-debug.png');
      const debugShotSha256 = await cdp.shot(debugShot);
      const debugReport = { debug, candidateServed: cdp.candidateServed, procedures: cdp.procedures, authResponses: cdp.authResponses, navigations: cdp.navigations, eventError: cdp.eventError?.message ?? null, screenshot: { file: debugShot, sha256: debugShotSha256 } };
      writeFileSync(join(EVIDENCE, 'probe-login-debug.json'), `${JSON.stringify(debugReport, null, 2)}\n`);
      throw new Error(`staff login failed: ${JSON.stringify({ ...debug, authResponses: cdp.authResponses, navigations: cdp.navigations })}`);
    }
    await cdp.send('Page.navigate', { url: `${BASE}/notifications` });
    const loaded = await cdp.waitFor(`document.querySelectorAll('[data-testid^="ntf-row-"]').length > 0 && !document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.includes('同步')`);
    if (!loaded) throw new Error('notifications did not reach steady state');
    await sleep(500);
    const notifications = await cdp.eval(`(() => {
      const text = (node) => (node?.textContent ?? '').replace(/\\s+/g, ' ').trim();
      const rows = [...document.querySelectorAll('[data-testid^="ntf-row-"]')].map((node) => ({
        title: text(node.querySelector('.truncate')),
        time: text(node.querySelector('.sk-mono')),
        body: text(node.querySelector('p')),
        unread: !!node.querySelector('.bg-danger'),
      }));
      const groups = {};
      for (const row of rows) {
        const key = [row.title, row.time, row.body].join('|');
        groups[key] = (groups[key] ?? 0) + 1;
      }
      return {
        url: location.href,
        unreadTop: Number(text(document.querySelector('[data-testid="ntf-unread-count"]')).match(/\\d+/)?.[0]),
        rowCount: rows.length,
        unreadRows: rows.filter((row) => row.unread).length,
        dupPairGroups: Object.values(groups).filter((count) => count === 2).length,
        markAllVisible: !!document.querySelector('[data-testid="ntf-mark-all"]'),
      };
    })()`);
    const notificationsShot = join(EVIDENCE, 'candidate-notifications.png');
    const notificationsShotSha256 = await cdp.shot(notificationsShot);
    await cdp.send('Page.navigate', { url: `${BASE}/me` });
    if (!await cdp.waitFor(`document.querySelector('[data-testid="me-notifications"]') && document.querySelector('[data-testid="dock-me-badge"]')`)) throw new Error('me badges missing');
    const me = await cdp.eval(`(() => {
      const text = (node) => (node?.textContent ?? '').replace(/\\s+/g, ' ').trim();
      return {
        url: location.href,
        notificationRowUnread: Number(text(document.querySelector('[data-testid="me-notifications"]')).match(/\\d+/)?.[0]),
        dockMeBadge: Number((document.querySelector('[data-testid="dock-me-badge"]')?.getAttribute('aria-label') ?? '').match(/\\d+/)?.[0]),
      };
    })()`);
    const meShot = join(EVIDENCE, 'candidate-me.png');
    const meShotSha256 = await cdp.shot(meShot);
    await sleep(300);
    if (cdp.eventError) throw cdp.eventError;
    const raw = cdp.listResponses.at(-1);
    if (!raw) throw new Error('real push.listNotifications response not captured');
    const expected = expectedFromRaw(raw);
    const pushWrites = cdp.procedures.filter((request) => /push\.(markRead|markAllRead)/.test(request.url));
    const legacyUnreadCalls = cdp.procedures.filter((request) => request.url.includes('push.unreadCount'));
    const checks = {
      candidateServed: cdp.candidateServed,
      candidateHashDiffers: bundleName !== 'index-DDB3TYul.js',
      topEqualsListRows: notifications.unreadTop === notifications.rowCount,
      topEqualsDock: notifications.unreadTop === me.dockMeBadge,
      meRowEqualsDock: me.notificationRowUnread === me.dockMeBadge,
      rawGroupCountMatches: notifications.rowCount === expected.groupedRows,
      rawUnreadGroupCountMatches: notifications.unreadTop === expected.unreadGroups,
      dupPairGroupsAbsent: notifications.dupPairGroups === 0,
      allRowsUnreadAsBaseline: notifications.unreadRows === notifications.rowCount,
      noLegacyUnreadCountCall: legacyUnreadCalls.length === 0,
      noReadMutation: pushWrites.length === 0,
      allReadNotClicked: notifications.markAllVisible,
    };
    const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
    const report = {
      capturedAt: new Date().toISOString(),
      scope: '候选生产 JS 在真实员工端 origin 的本地请求替换探针；真实登录与真实只读 API；非 localhost preview；非 tip 部署包',
      isTipPackage: false,
      baseline: { liveDist: 'index-DDB3TYul.js', tip: 'c3d17f3343b7af21b76b872cf143b7e20f2b534c', deploy: '20261031112230' },
      candidate: { name: bundleName, sha256: candidate.sha256 },
      notifications,
      me,
      expected,
      checks,
      failures,
      legacyUnreadCalls,
      pushWrites,
      clickedAllRead: false,
      clickedNotificationRow: false,
      screenshots: [
        { file: notificationsShot, sha256: notificationsShotSha256 },
        { file: meShot, sha256: meShotSha256 },
      ],
    };
    const reportPath = join(EVIDENCE, 'live-candidate-report.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ checks, failures, notifications, me, expected, candidate: report.candidate, reportPath }, null, 2));
    process.exitCode = failures.length === 0 ? 0 : 1;
  } finally {
    if (cdp) await Promise.race([cdp.send('Browser.close').catch(() => {}), sleep(1000)]);
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
