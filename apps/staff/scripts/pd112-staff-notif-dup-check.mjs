#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const requireServer = createRequire(join(ROOT, 'server', 'package.json'));
const WSImpl = globalThis.WebSocket ?? requireServer('ws');
const DIST = join(ROOT, 'apps', 'staff', 'dist');
const EVIDENCE = join(ROOT, 'evidence', 'pd112-staff-notif-dup');
const PHASE = process.env.PD112_PHASE ?? 'candidate';
const PORT = Number(process.env.PORT ?? 7312);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9412);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = process.env.OUT_DIR ?? join(EVIDENCE, 'shots', PHASE);
const REPORT = process.env.REPORT ?? join(EVIDENCE, `browser-${PHASE}.json`);
const sourceText = readFileSync(join(EVIDENCE, 'live-notification-fields.json'), 'utf8');
const source = JSON.parse(sourceText);
if (source.rowCount !== 50 || source.minuteDuplicateGroups !== 25) throw new Error('PD-112 source must contain 50 rows / 25 minute duplicate groups');
const sourceRows = source.rows;
const sourceSha256 = createHash('sha256').update(sourceText).digest('hex');
const expectedGroups = [...sourceRows.reduce((groups, row) => {
  const key = JSON.stringify([row.type, row.title, row.body, String(row.createdAt).slice(0, 16)]);
  groups.set(key, [...(groups.get(key) ?? []), row]);
  return groups;
}, new Map()).values()];
const expectedUnreadGroups = expectedGroups.filter((group) => group.some((row) => row.readAt === null)).length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((path) => existsSync(path));
const results = [];
let failures = 0;
const note = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
  if (!ok) failures += 1;
};

const MOCK_SOURCE = `(() => {
  const nativeFetch = window.fetch.bind(window);
  window.__pd112Unknown = [];
  window.__pd112Mutations = [];
  const notificationItems = ${JSON.stringify(sourceRows)};
  const unread = ${JSON.stringify(source.unread)};
  const dataFor = (procedure) => {
    if (procedure === 'auth.me') return {
      user: { id: 'pd112-user', nickname: '小美', activePetId: null }, roles: ['staff'],
      staff: { id: 'pd112-staff', storeId: 'pd112-store', role: 'frontdesk', schedule: {} },
      store: { id: 'pd112-store', name: '测试门店' },
    };
    if (procedure === 'config.activeCopyTexts') return { rows: [] };
    if (procedure === 'slotPort.liveMap') return { slots: [] };
    if (procedure === 'appointment.listForStaff') return [];
    if (procedure === 'push.listNotifications') return { items: notificationItems, nextCursor: null };
    if (procedure === 'push.unreadCount') return unread;
    window.__pd112Unknown.push(procedure);
    return {};
  };
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.includes('/trpc/')) return nativeFetch(input, init);
    const procedures = decodeURIComponent(url.pathname.split('/trpc/')[1]).split(',');
    const method = String(init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
      window.__pd112Mutations.push({ procedures, body: String(init?.body ?? '') });
      return new Response(JSON.stringify([{ error: { json: { message: 'PD-112 mutation blocked', code: -32603, data: { code: 'FORBIDDEN', httpStatus: 403 } } } }]), {
        status: 403, headers: { 'content-type': 'application/json' },
      });
    }
    const body = procedures.map((procedure) => {
      const data = { json: dataFor(procedure) };
      if (procedure === 'push.listNotifications') {
        data.meta = { values: Object.fromEntries(notificationItems.map((_, index) => ['items.' + index + '.createdAt', ['Date']])), v: 1 };
      }
      return { result: { data } };
    });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
})()`;

class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WSImpl(this.wsUrl);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    };
    await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Network.setBypassServiceWorker', { bypass: true });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response?.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails).slice(0, 600));
    return response?.result?.value;
  }
  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    for (;;) {
      if (await this.eval(`!!(${expression})`).catch(() => false)) return true;
      if (Date.now() - start > timeoutMs) return false;
      await sleep(150);
    }
  }
  async shot(file) {
    const image = await this.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(image.data, 'base64'));
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function main() {
  if (!BROWSER) throw new Error('Edge/Chrome not found');
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  const bundleName = html.match(/assets\/(index-[^/]+\.js)/)?.[1];
  if (!bundleName) throw new Error('staff bundle missing');
  const bundleSha256 = createHash('sha256').update(await readFile(join(DIST, 'assets', bundleName))).digest('hex');
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(403); res.end('blocked'); return; }
    const url = new URL(req.url ?? '/', BASE);
    if (url.pathname.startsWith('/trpc/')) { res.writeHead(500); res.end('tRPC must be intercepted'); return; }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    const file = resolve(DIST, relative);
    if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) { res.writeHead(403); res.end('forbidden'); return; }
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(content);
    } catch {
      if (extname(url.pathname)) { res.writeHead(404); res.end('missing'); return; }
      res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
      res.end(await readFile(join(DIST, 'index.html')));
    }
  });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  mkdirSync(OUT_DIR, { recursive: true });
  const profile = join(tmpdir(), `pd112-${Date.now()}`);
  const browser = spawn(BROWSER, [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--lang=en-US',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--headless=new',
  ], { stdio: 'ignore' });
  let cdp = null;
  const cleanup = () => {
    try { cdp?.close(); } catch {}
    try { browser.kill(); } catch {}
    try { server.closeAllConnections?.(); server.close(); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  try {
    let target = null;
    for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
        target = await response.json();
      } catch { await sleep(200); }
    }
    if (!target?.webSocketDebuggerUrl) throw new Error('CDP target creation failed');
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setLocaleOverride', { locale: 'en-US' });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SOURCE });
    await cdp.send('Page.navigate', { url: `${BASE}/notifications` });
    note(await cdp.waitFor(`document.querySelectorAll('[data-testid^="ntf-row-"]').length === ${expectedGroups.length} && document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.includes('未读 ${source.unread.total} 条')`), '真实通知列表与原未读数完成加载');
    const page = await cdp.eval(`(() => {
      const text = (node) => (node?.textContent ?? '').replace(/\\s+/g, ' ').trim();
      const rows = [...document.querySelectorAll('[data-testid^="ntf-row-"]')].map((node) => ({
        id: node.getAttribute('data-testid'),
        title: text(node.querySelector('.truncate')),
        time: text(node.querySelector('.sk-mono')),
        body: text(node.querySelector('p')),
        unread: !!node.querySelector('.bg-danger'),
      }));
      const counts = {};
      for (const row of rows) {
        const key = [row.title, row.time, row.body].join('|');
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return {
        rowCount: rows.length,
        dupPairGroups: Object.values(counts).filter((count) => count === 2).length,
        careTitleHits: rows.filter((row) => row.title === '照护打卡提醒').length,
        careDistinctKeys: Object.keys(counts).length,
        unreadVisibleGroups: rows.filter((row) => row.unread).length,
        unread: text(document.querySelector('[data-testid="ntf-unread-count"]')),
        allReadVisible: !!document.querySelector('[data-testid="ntf-mark-all"]'),
        mutations: window.__pd112Mutations,
        unknown: window.__pd112Unknown,
        rows,
      };
    })()`);
    note(page.rowCount === expectedGroups.length, `同分钟去重后 50 行收敛为 ${expectedGroups.length} 行`, page.rowCount);
    note(page.dupPairGroups === 0, '潘婧分组键 dupPairGroups=0', page.dupPairGroups);
    note(page.careTitleHits === expectedGroups.length && page.careDistinctKeys === expectedGroups.length, '不同分钟提醒各自保留，不做密度合并', { careTitleHits: page.careTitleHits, careDistinctKeys: page.careDistinctKeys });
    note(page.unread === `未读 ${source.unread.total} 条`, '未读角标保持原接口真实总数，未清未读或虚增', page.unread);
    note(page.unreadVisibleGroups === expectedUnreadGroups, '每个含未读 ID 的组均保留未读代表', { actual: page.unreadVisibleGroups, expected: expectedUnreadGroups });
    note(page.allReadVisible && page.mutations.length === 0, '全部已读可见但未点击，业务 mutation 为零', { allReadVisible: page.allReadVisible, mutations: page.mutations });
    note(page.unknown.length === 0, 'tRPC mock 过程全部已知', page.unknown);
    const screenshot = join(OUT_DIR, 'notifications.png');
    const screenshotSha256 = await cdp.shot(screenshot);
    const report = {
      phase: PHASE,
      at: new Date().toISOString(),
      scope: '候选员工 dist＋现网只读字段 mock 的本地辅助探针；非 tip 包；不作为 localhost preview 交付 HIT PASS',
      bundle: { name: bundleName, sha256: bundleSha256, forbiddenNames: ['index-STmHfnb4.js', 'index-B584Q7Xj.js'] },
      source: { file: 'live-notification-fields.json', sha256: sourceSha256, rowCount: 50, minuteDuplicateGroups: 25, actualDist: source.actualDist },
      unreadConsistency: { rawTotal: source.unread.total, sourceUnreadIds: sourceRows.filter((row) => row.readAt === null).length, expectedUnreadGroups },
      page,
      screenshot: { file: screenshot, sha256: screenshotSha256 },
      clickedAllRead: false,
      results,
      failures,
    };
    writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`报告：${REPORT}`);
    console.log(`帧：${screenshot}`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    if (cdp) await Promise.race([cdp.send('Browser.close').catch(() => {}), sleep(1000)]);
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
