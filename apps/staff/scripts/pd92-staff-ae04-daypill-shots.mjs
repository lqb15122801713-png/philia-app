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

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const requireServer = createRequire(join(REPO_ROOT, 'server', 'package.json'));
const WSImpl = globalThis.WebSocket ?? requireServer('ws');
const { Jimp } = requireServer('jimp');
const DIST = join(REPO_ROOT, 'apps', 'staff', 'dist');
const PORT = Number(process.env.PORT ?? 7292);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9392);
const BASE = `http://127.0.0.1:${PORT}`;
const RUN_ID = `fixed-${Date.now()}`;
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd92-staff-ae04-daypill', 'shots', RUN_ID);
const REPORT = process.env.REPORT ?? join(REPO_ROOT, 'evidence', 'pd92-staff-ae04-daypill', `browser-report-${RUN_ID}.json`);
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
  window.__pd92UnreadMode = sessionStorage.getItem('pd92-unread-mode') ?? 'ready';
  window.__pd92SetUnreadMode = (mode) => {
    window.__pd92UnreadMode = mode;
    sessionStorage.setItem('pd92-unread-mode', mode);
  };
  window.__pd92MockSeen = [];
  window.__pd92MockUnknown = [];
  window.__pd92MockMutations = [];
  window.__pd92UnreadRequests = 0;
  const notificationItems = Array.from({ length: 15 }, (_, index) => ({
    id: 'pd92-notification-' + String(index + 1).padStart(2, '0'),
    type: 'boarding.care.reminder', category: 'service', title: '照护打卡提醒',
    body: '【旺财】mock 未读通知 ' + (index + 1), link: null, readAt: null,
    createdAt: new Date(Date.UTC(2026, 9, 24, 9, index)).toISOString(),
  }));
  const notificationDateMeta = Object.fromEntries(notificationItems.map((_, index) => ['items.' + index + '.createdAt', ['Date']]));
  const dataFor = (procedure) => {
    if (procedure === 'auth.me') return {
      user: { id: 'pd92-user', nickname: '小美', activePetId: null },
      roles: ['staff'],
      staff: { id: 'pd92-staff', storeId: 'pd92-store', role: 'frontdesk', schedule: {} },
      store: { id: 'pd92-store' },
    };
    if (procedure === 'config.activeCopyTexts') return { rows: [] };
    if (procedure === 'slotPort.liveMap') return { slots: [] };
    if (procedure === 'appointment.listForStaff') return [];
    if (procedure === 'push.listNotifications') return { items: notificationItems, nextCursor: null };
    if (procedure === 'push.unreadCount') return { total: 15, byCategory: { service: 15 } };
    window.__pd92MockUnknown.push(procedure);
    return {};
  };
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.includes('/trpc/')) return nativeFetch(input, init);
    const procedures = decodeURIComponent(url.pathname.split('/trpc/')[1]).split(',');
    const method = String(init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    window.__pd92MockSeen.push(...procedures);
    if (method !== 'GET') {
      window.__pd92MockMutations.push({ method, procedures });
      return new Response(JSON.stringify({ error: 'PD-92 mutation blocked' }), {
        status: 403, headers: { 'content-type': 'application/json' },
      });
    }
    if (procedures.includes('push.unreadCount')) window.__pd92UnreadRequests += 1;
    const body = procedures.map((procedure) => {
      if (procedure === 'push.unreadCount' && window.__pd92UnreadMode === 'error') {
        return { error: { json: { message: 'mock offline', code: -32603, data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 } } } };
      }
      const data = { json: dataFor(procedure) };
      if (procedure === 'push.listNotifications') data.meta = { values: notificationDateMeta, v: 1 };
      return { result: { data } };
    });
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
})()`;

const READ_PILLS = `(() => {
  const bar = document.querySelector('[data-testid="sk-daychip"]');
  if (!bar) return null;
  const rectOf = (node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  return {
    buttons: [...bar.querySelectorAll(':scope > button')].map((button) => {
      const style = getComputedStyle(button);
      return {
        key: button.getAttribute('data-testid').replace('sk-daychip-', ''),
        className: button.className,
        ariaSelected: button.getAttribute('aria-selected'),
        marker: !!button.querySelector('.sk-chip-selected-mark'),
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        color: style.color,
        rect: rectOf(button),
      };
    }),
    dateRect: rectOf(bar.querySelector('[data-testid="sk-datepick"]')),
    inputValue: bar.querySelector('[data-testid="sk-datepick"]').value,
    loading: !!document.querySelector('[aria-label="加载中"]'),
    pageReady: !!document.querySelector('[data-testid="sk-schedule"]'),
    mockUnknown: window.__pd92MockUnknown ?? [],
    mockMutations: window.__pd92MockMutations ?? [],
  };
})()`;

const READ_UNREAD = `(() => ({
  header: document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.trim() ?? null,
  retry: !!document.querySelector('[data-testid="ntf-unread-retry"]'),
  markAllDisabled: document.querySelector('[data-testid="ntf-mark-all"]')?.disabled ?? null,
  meText: document.querySelector('[data-testid="me-notifications"]')?.textContent.trim() ?? null,
  dockText: document.querySelector('[data-testid="dock-me-badge"]')?.textContent.trim() ?? null,
  dockAria: document.querySelector('[data-testid="dock-me-badge"]')?.getAttribute('aria-label') ?? null,
  unreadRequests: window.__pd92UnreadRequests ?? 0,
  mockUnknown: window.__pd92MockUnknown ?? [],
  mockMutations: window.__pd92MockMutations ?? [],
}))()`;

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
    if (response?.exceptionDetails) throw new Error(`页内 eval 异常：${JSON.stringify(response.exceptionDetails).slice(0, 500)}`);
    return response?.result?.value;
  }
  async waitFor(expression, timeoutMs = 30000) {
    const start = Date.now();
    for (;;) {
      const ready = await this.eval(`!!(${expression})`).catch(() => false);
      if (ready) return true;
      if (Date.now() - start > timeoutMs) return false;
      await sleep(150);
    }
  }
  async shot(file, clip) {
    const image = await this.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: true,
      ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
    });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(image.data, 'base64'));
  }
  close() { try { this.ws?.close(); } catch {} }
}

const roundedClip = (rect) => ({
  x: Math.max(0, Math.round(rect.x)), y: Math.max(0, Math.round(rect.y)),
  width: Math.round(rect.width), height: Math.round(rect.height),
});
const rawPixelMd5 = (image) => createHash('md5').update(image.bitmap.data).digest('hex');
async function pixelDiff(fileA, fileB) {
  const [a, b] = await Promise.all([Jimp.read(fileA), Jimp.read(fileB)]);
  if (a.bitmap.width !== b.bitmap.width || a.bitmap.height !== b.bitmap.height) {
    return { comparable: false, sizeA: [a.bitmap.width, a.bitmap.height], sizeB: [b.bitmap.width, b.bitmap.height] };
  }
  let absoluteSum = 0;
  let changedPixels = 0;
  for (let offset = 0; offset < a.bitmap.data.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(a.bitmap.data[offset + channel] - b.bitmap.data[offset + channel]);
      absoluteSum += delta;
      if (delta > 0) changed = true;
    }
    if (changed) changedPixels += 1;
  }
  const totalPixels = a.bitmap.width * a.bitmap.height;
  const md5A = rawPixelMd5(a);
  const md5B = rawPixelMd5(b);
  return {
    comparable: true, size: [a.bitmap.width, a.bitmap.height], md5A, md5B,
    md5Equal: md5A === md5B, meanAbs: absoluteSum / (totalPixels * 3), changedPixels, totalPixels,
  };
}

async function main() {
  if (!BROWSER) throw new Error('未探测到 Edge/Chrome');
  const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  const bundleName = indexHtml.match(/assets\/(index-[^/]+\.js)/)?.[1];
  if (!bundleName) throw new Error('员工 dist 主 bundle 未找到');
  const bundleSha256 = createHash('sha256').update(await readFile(join(DIST, 'assets', bundleName))).digest('hex');
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(403); res.end('PD-92 read-only mock'); return;
    }
    const url = new URL(req.url ?? '/', BASE);
    if (url.pathname.startsWith('/trpc/')) {
      res.writeHead(500); res.end('tRPC must be intercepted by the explicit mock'); return;
    }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    let file = resolve(DIST, relative);
    if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(content);
    } catch {
      if (extname(url.pathname)) {
        res.writeHead(404); res.end('missing asset'); return;
      }
      file = resolve(DIST, 'index.html');
      res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
      res.end(await readFile(file));
    }
  });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT), { recursive: true });
  const profile = join(tmpdir(), `pd92-staff-${Date.now()}`);
  const browser = spawn(BROWSER, [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--headless=new',
  ], { stdio: 'ignore' });
  let cdp = null;
  const cleanup = () => {
    try { cdp?.close(); } catch {}
    try { browser.kill(); } catch {}
    try { server.close(); } catch {}
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
    if (!target?.webSocketDebuggerUrl) throw new Error('CDP 页签创建失败');
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SOURCE });
    await cdp.send('Page.navigate', { url: `${BASE}/schedule` });
    note(await cdp.waitFor(`(() => { const state = ${READ_PILLS}; return state?.pageReady && !state.loading && state.buttons.length === 3; })()`), '真实 /schedule 完成加载，非加载壳');

    const states = {};
    const capture = async (key, expectedSelected) => {
      await cdp.eval('window.scrollTo(0, 0)');
      await sleep(200);
      const state = await cdp.eval(READ_PILLS);
      note(state?.pageReady && !state.loading && state.mockUnknown.length === 0, `${key} 查询完成且 mock 过程全已知`, state?.mockUnknown ?? []);
      note(state.mockMutations.length === 0, `${key} 只读查询零 mutation`, state.mockMutations);
      const selected = state.buttons.filter((button) => button.className.split(/\s+/).includes('on'));
      note(selected.length === 1 && selected[0].key === expectedSelected && selected[0].ariaSelected === 'true', `${key} 唯一选中 pill=${expectedSelected}`, selected.map((button) => button.key));
      note(selected[0]?.marker && state.buttons.filter((button) => button.key !== expectedSelected).every((button) => !button.marker), `${key} 选中勾标唯一且随态移动`);
      const rects = [...state.buttons.map((button) => button.rect), state.dateRect];
      const stripClip = roundedClip({
        x: Math.min(...rects.map((rect) => rect.x)) - 6,
        y: Math.min(...rects.map((rect) => rect.y)) - 6,
        width: Math.max(...rects.map((rect) => rect.x + rect.width)) - Math.min(...rects.map((rect) => rect.x)) + 12,
        height: Math.max(...rects.map((rect) => rect.y + rect.height)) - Math.min(...rects.map((rect) => rect.y)) + 12,
      });
      const containsPills = state.buttons.every((button) =>
        button.rect.x >= stripClip.x && button.rect.y >= stripClip.y
        && button.rect.x + button.rect.width <= stripClip.x + stripClip.width + 1
        && button.rect.y + button.rect.height <= stripClip.y + stripClip.height + 1);
      note(containsPills, `${key} 专裁帧完整包含三颗 pill 本体`, stripClip);
      const files = { page: join(OUT_DIR, `${key}-page.png`), strip: join(OUT_DIR, `${key}-pills.png`), pills: {}, samples: {} };
      await cdp.shot(files.page);
      await cdp.shot(files.strip, stripClip);
      for (const button of state.buttons.filter((item) => item.key === 'today' || item.key === 'tomorrow')) {
        const file = join(OUT_DIR, `${key}-pill-${button.key}.png`);
        await cdp.shot(file, roundedClip({
          x: button.rect.x + button.rect.width / 2 - 56,
          y: button.rect.y - 6, width: 112, height: 48,
        }));
        files.pills[button.key] = file;
        const sample = join(OUT_DIR, `${key}-sample-${button.key}.png`);
        await cdp.shot(sample, roundedClip({
          x: button.rect.x + button.rect.width / 2 - 28,
          y: button.rect.y - 6, width: 56, height: 48,
        }));
        files.samples[button.key] = sample;
      }
      states[key] = { ...state, selected: selected[0], stripClip, containsPills, files };
    };
    const click = async (selector) => {
      const point = await cdp.eval(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()`);
      if (!point) throw new Error(`找不到点击目标 ${selector}`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      await sleep(250);
    };

    await capture('01-today', 'today');
    await click('[data-testid="sk-daychip-tomorrow"]');
    note(await cdp.waitFor(`document.querySelector('[data-testid="sk-daychip-tomorrow"]')?.getAttribute('aria-selected') === 'true'`), '真鼠标点击明天后 aria-selected 随点切换');
    await capture('02-tomorrow', 'tomorrow');
    await click('[data-testid="sk-daychip-today"]');
    note(await cdp.waitFor(`document.querySelector('[data-testid="sk-daychip-today"]')?.getAttribute('aria-selected') === 'true'`), '真鼠标再点回今天可撤可回');
    await capture('03-return-today', 'today');
    note(states['03-return-today'].inputValue === states['01-today'].inputValue, '点回今天恢复原日期', {
      before: states['01-today'].inputValue, returned: states['03-return-today'].inputValue,
    });

    const comparisons = {};
    for (const [pill, selectedState, unselectedState] of [
      ['today', '01-today', '02-tomorrow'],
      ['tomorrow', '02-tomorrow', '01-today'],
    ]) {
      const diff = await pixelDiff(states[selectedState].files.samples[pill], states[unselectedState].files.samples[pill]);
      const selected = states[selectedState].buttons.find((button) => button.key === pill);
      const unselected = states[unselectedState].buttons.find((button) => button.key === pill);
      const styleChanged = selected.backgroundColor !== unselected.backgroundColor
        || selected.borderColor !== unselected.borderColor || selected.borderWidth !== unselected.borderWidth;
      const borderChanged = selected.borderWidth === '2px' && unselected.borderWidth === '1px';
      comparisons[pill] = { ...diff, selected, unselected, styleChanged, borderChanged };
      note(diff.comparable && !diff.md5Equal && diff.meanAbs > 0 && styleChanged && borderChanged,
        `同一 ${pill} pill 目标内像素差＋选中 2px／未选 1px（非正文差）`, {
          meanAbs: diff.meanAbs, changedPixels: diff.changedPixels, styleChanged, borderChanged,
          selected: { backgroundColor: selected.backgroundColor, borderColor: selected.borderColor, borderWidth: selected.borderWidth },
          unselected: { backgroundColor: unselected.backgroundColor, borderColor: unselected.borderColor, borderWidth: unselected.borderWidth },
        });
    }

    await cdp.eval(`window.__pd92SetUnreadMode('ready')`);
    await cdp.send('Page.navigate', { url: `${BASE}/me` });
    note(await cdp.waitFor(`document.querySelector('[data-testid="me-notifications"]')?.textContent.includes('15') && document.querySelector('[data-testid="dock-me-badge"]')?.getAttribute('aria-label') === '15 条未读'`), 'AE-04「我的」与 dock 同源 15');
    const meBefore = await cdp.eval(READ_UNREAD);
    await cdp.shot(join(OUT_DIR, '04-ae04-me-before.png'));
    note(meBefore.mockUnknown.length === 0 && meBefore.mockMutations.length === 0, 'AE-04 我的页 mock 全已知且零 mutation', meBefore);

    const unreadStaleAt = Date.now() + 10_100;
    note(await cdp.waitFor(`Date.now() >= ${unreadStaleAt}`, 15000), 'AE-04 未读缓存已超过全局 staleTime 10s');
    await cdp.eval(`window.__pd92SetUnreadMode('error')`);
    await click('[data-testid="me-notifications"]');
    note(await cdp.waitFor(`location.pathname === '/notifications'`), 'AE-04 Me→通知使用真实 SPA 导航并保留查询缓存');
    note(await cdp.waitFor(`document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.includes('未读暂不可用') && !!document.querySelector('[data-testid="ntf-unread-retry"]')`, 45000), 'AE-04 缓存正数重取失败后显示不可用与重新对齐，不沿用旧值');
    const errorState = await cdp.eval(READ_UNREAD);
    await cdp.shot(join(OUT_DIR, '05-ae04-unavailable.png'));
    note(errorState.header === '未读暂不可用' && errorState.retry && errorState.markAllDisabled, 'AE-04 失败态可解释，全部已读保持未点', errorState);

    const requestsBeforeRetry = errorState.unreadRequests;
    await cdp.eval(`window.__pd92SetUnreadMode('ready')`);
    await click('[data-testid="ntf-unread-retry"]');
    note(await cdp.waitFor(`document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.includes('未读 15 条')`), 'AE-04 点重新对齐后同源恢复 15');
    const aligned = await cdp.eval(READ_UNREAD);
    await cdp.shot(join(OUT_DIR, '06-ae04-realaligned.png'));
    note(aligned.header === '未读 15 条' && aligned.unreadRequests > requestsBeforeRetry && aligned.mockMutations.length === 0,
      'AE-04 自救来自 unreadCount 重取而非全部已读／业务写', aligned);

    await cdp.send('Page.navigate', { url: `${BASE}/me` });
    note(await cdp.waitFor(`document.querySelector('[data-testid="me-notifications"]')?.textContent.includes('15') && document.querySelector('[data-testid="dock-me-badge"]')?.getAttribute('aria-label') === '15 条未读'`), 'AE-04 自救后我的行与 dock 同步 15');
    const meAfter = await cdp.eval(READ_UNREAD);
    await cdp.shot(join(OUT_DIR, '07-ae04-me-after.png'));
    note(meAfter.meText.includes('15') && meAfter.dockText === '15' && meAfter.dockAria === '15 条未读' && meAfter.mockMutations.length === 0,
      'AE-04 通知头／我的行／dock 三处对齐 15', { notificationHeader: aligned.header, meAfter });

    const report = {
      runId: RUN_ID,
      at: new Date().toISOString(),
      scope: '真实员工 dist＋只读 tRPC mock 的功能／像素验证；不是现网合部 HIT',
      bundle: { name: bundleName, sha256: bundleSha256, nameDiffersFromControl: bundleName !== 'index-CWgjxsIP.js' },
      viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
      states,
      comparisons,
      ae04: { meBefore, errorState, aligned, meAfter, markAllClicked: false },
      results,
      failures,
    };
    writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`报告：${REPORT}`);
    console.log(`帧目录：${OUT_DIR}`);
    process.exitCode = failures === 0 ? 0 : 1;
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
