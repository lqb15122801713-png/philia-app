import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DIST = join(ROOT, 'apps', 'customer', 'dist');
const PORT = 7315;
const CDP_PORT = 9415;
const BASE = `http://127.0.0.1:${PORT}`;
const seen = [];
const unknown = [];
const mutations = [];
const openHours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [day, { open: '09:00', close: '20:00' }]));
const store = {
  id: 'preview-store', name: '菲丽亚宠物·示例店', address: '杭州市西湖区文三路 100 号',
  lat: 30.2812, lng: 120.1489, openHours, status: 'active',
};
const services = [
  { id: 'wash-small', type: 'grooming', name: '基础洗护（小型犬）', durationMin: 60, priceFen: 8800 },
  { id: 'wash-medium', type: 'grooming', name: '基础洗护（中型犬）', durationMin: 90, priceFen: 12800 },
  { id: 'wash-cat', type: 'grooming', name: '猫咪精致洗护', durationMin: 90, priceFen: 16800 },
  { id: 'style-trim', type: 'grooming', name: '造型修剪', durationMin: 120, priceFen: 19800 },
];
const serviceDurations = Object.fromEntries(services.map((service) => [service.id, { durationMin: service.durationMin }]));
const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const bundleName = indexHtml.match(/assets\/(index-[^/]+\.js)/)?.[1] ?? null;
const bundleSha256 = bundleName ? createHash('sha256').update(readFileSync(join(DIST, 'assets', bundleName))).digest('hex') : null;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function dataFor(procedure) {
  if (procedure === 'auth.me') return {
    user: { id: 'preview-customer', nickname: '客户', activePetId: 'preview-pet' },
    roles: ['customer'], staff: null, store: null,
  };
  if (procedure === 'store.listNearby') return { stores: [store] };
  if (procedure === 'pet.list') return [{ id: 'preview-pet', name: '豆豆', species: 'dog', breed: '比熊', weightKg: 6.4, avatarUrl: null }];
  if (procedure === 'store.getWithServices') return { store, services, slots: [], advanceDays: 7, serviceDurations };
  if (procedure === 'store.listStaffPublic') return { staff: [{ id: 'preview-staff', name: '丽丽', skills: ['wash', 'groom'] }] };
  if (procedure === 'appointment.listMine') return { groups: { pending: [], confirmed: [], in_service: [], in_boarding: [], completed: [], cancel_requested: [], cancelled: [] } };
  if (procedure === 'config.activeCopyTexts') return { rows: [] };
  if (procedure === 'slotPort.liveMap') return { slots: [] };
  if (procedure === 'canvas.liveLayout') return { blocks: [] };
  if (procedure === 'canvas.blocks') return { items: [] };
  if (procedure === 'push.unreadCount') return { total: 0, byCategory: {} };
  unknown.push(procedure);
  return {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', BASE);
  if (url.pathname === '/__pd105/state') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ base: BASE, bundleName, bundleSha256, seen, unknown, mutations }, null, 2));
    return;
  }
  if (url.pathname.startsWith('/trpc/') || url.pathname.startsWith('/api/')) {
    const method = String(req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' || !url.pathname.startsWith('/trpc/')) {
      mutations.push({ method, path: url.pathname });
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'PD-105 read-only preview: mutation blocked' }));
      return;
    }
    const procedures = decodeURIComponent(url.pathname.slice('/trpc/'.length)).split(',');
    seen.push(...procedures);
    const body = procedures.map((procedure) => ({ result: { data: { json: dataFor(procedure) } } }));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    mutations.push({ method: req.method, path: url.pathname });
    res.writeHead(403); res.end('PD-105 read-only preview'); return;
  }
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
  let file = resolve(DIST, relative);
  if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    if (extname(url.pathname)) {
      res.writeHead(404); res.end('missing asset'); return;
    }
    file = resolve(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
    res.end(await readFile(file));
  }
});

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    };
    await new Promise((resolveOpen) => { this.ws.onopen = resolveOpen; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolveSend, reject) => {
      const id = ++this.id;
      this.pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolveSend(message.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result?.exceptionDetails) throw new Error(`eval failed: ${result.exceptionDetails.text}`);
    return result?.result?.value;
  }
  async goto(url, waitMs = 4500) { await this.send('Page.navigate', { url }); await sleep(waitMs); }
  async waitFor(expression, timeoutMs = 30000) {
    const started = Date.now();
    for (;;) {
      if (await this.eval(`!!(${expression})`)) return true;
      if (Date.now() - started > timeoutMs) return false;
      await sleep(300);
    }
  }
  close() { try { this.ws?.close(); } catch {} }
}

const browserPath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((path) => existsSync(path));
if (!browserPath) throw new Error('No local Edge/Chrome executable');

let browser;
let profile;
let cdp;
try {
  await new Promise((resolveListen) => server.listen(PORT, '127.0.0.1', resolveListen));
  profile = join(tmpdir(), `pd105-visible-${Date.now()}`);
  browser = spawn(browserPath, [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--headless=new', '--window-size=430,932', '--force-device-scale-factor=1',
  ], { stdio: 'ignore' });
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      target = await response.json();
    } catch { await sleep(300); }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('CDP target unavailable');
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await cdp.goto(`${BASE}/booking/grooming`);
  const pageReady = await cdp.waitFor(`document.querySelector('[data-testid="u2-chip-service"]') && document.body.innerText.includes('想换门店、毛孩子或服务？点一下就好')`);
  if (!pageReady) throw new Error(`Grooming page not ready: ${await cdp.eval('document.body.innerText')}`);
  await cdp.eval(`document.querySelector('[data-testid="u2-chip-service"]')?.click()`);
  const sheetReady = await cdp.waitFor(`document.querySelector('[data-testid="u2-service-sheet"][open]') && document.querySelector('[data-testid="u2-service-sheet"]').innerText.includes('细节到店看宠再定')`);
  if (!sheetReady) throw new Error(`Service sheet not ready: ${await cdp.eval('document.body.innerText')}`);
  await sleep(500);
  const visible = await cdp.eval(`(() => {
    const body = document.body.innerText;
    const sheet = document.querySelector('[data-testid="u2-service-sheet"]')?.innerText ?? '';
    const hint = document.querySelector('[data-copy-key="booking.groomingHint"]')?.textContent ?? '';
    return {
      hint,
      hasHint: body.includes('想换门店、毛孩子或服务？点一下就好'),
      noMachineHint: !body.includes('默认已填'),
      hasWash: sheet.includes('洗澡'),
      hasStyle: sheet.includes('美容'),
      hasDetailNote: sheet.includes('细节到店看宠再定'),
      noSeedDetailNames: !['基础洗护（小型犬）', '基础洗护（中型犬）', '猫咪精致洗护', '造型修剪'].some((name) => sheet.includes(name)),
      sheetText: sheet,
    };
  })()`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const pngPath = join(HERE, 'visible-grooming-r2.png');
  writeFileSync(pngPath, Buffer.from(screenshot.data, 'base64'));
  const state = await fetch(`${BASE}/__pd105/state`).then((response) => response.json());
  const checks = { ...visible, noMutations: state.mutations.length === 0, noUnknownProcedures: state.unknown.length === 0 };
  const failed = Object.entries(checks).filter(([key, value]) => key !== 'sheetText' && key !== 'hint' && value !== true);
  const evidence = { pngPath, bundleName: state.bundleName, bundleSha256: state.bundleSha256, checks, unknown: state.unknown, mutations: state.mutations, seen: state.seen };
  writeFileSync(join(HERE, 'visible-grooming-r2.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
  if (failed.length > 0) throw new Error(`Visible checks failed: ${failed.map(([key]) => key).join(', ')}`);
} finally {
  if (cdp) await Promise.race([cdp.send('Browser.close').catch(() => undefined), sleep(1500)]);
  cdp?.close();
  if (browser) {
    const exited = browser.exitCode !== null ? Promise.resolve() : new Promise((resolveExit) => browser.once('exit', resolveExit));
    await Promise.race([exited, sleep(5000)]);
    if (browser.exitCode === null && process.platform === 'win32' && browser.pid) {
      await new Promise((resolveKill) => {
        const killer = spawn('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.on('exit', resolveKill);
      });
    } else if (browser.exitCode === null) browser.kill();
  }
  server.closeAllConnections();
  await new Promise((resolveClose) => server.close(resolveClose));
  if (profile) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await rm(profile, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 19) throw error;
        await sleep(250);
      }
    }
  }
}
