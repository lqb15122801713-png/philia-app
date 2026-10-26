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
const DIST = join(REPO_ROOT, 'apps', 'staff', 'dist');
const PHASE = process.env.PD98_PHASE ?? 'candidate';
const PORT = Number(process.env.PORT ?? 7298);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9398);
const BASE = `http://127.0.0.1:${PORT}`;
const EVIDENCE = join(REPO_ROOT, 'evidence', 'pd98-staff-locale-notif-dedupe');
const OUT_DIR = process.env.OUT_DIR ?? join(EVIDENCE, 'shots', PHASE);
const REPORT = process.env.REPORT ?? join(EVIDENCE, `browser-${PHASE}.json`);
const CONTROL_BUNDLE = 'index-DcDp2v-Y.js';
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
  window.__pd98Unknown = [];
  window.__pd98Mutations = [];
  window.__pd98ReadIds = [];
  window.__pd98MarkAllClicks = 0;
  const notificationItems = [
    { id: 'care-1637-a', createdAt: '2026-10-26T08:37:00.100Z' },
    { id: 'care-1637-b', createdAt: '2026-10-26T08:37:00.900Z' },
    { id: 'care-1229-a', createdAt: '2026-10-26T04:29:00.000Z' },
    { id: 'care-1229-b', createdAt: '2026-10-26T04:29:00.500Z' },
    { id: 'care-0802-a', createdAt: '2026-10-26T00:02:00.000Z' },
    { id: 'care-0802-b', createdAt: '2026-10-26T00:02:30.000Z' },
  ].map((row) => ({
    ...row, type: 'boarding.careRemind', category: 'service', title: '照护打卡提醒',
    body: '【旺财】在住寄养已超过 4 小时未打卡，请及时完成照护记录', link: null,
  }));
  const rowsWithReadState = () => notificationItems.map((row) => ({
    ...row, readAt: window.__pd98ReadIds.includes(row.id) ? '2026-10-26T09:00:00.000Z' : null,
  }));
  const notificationDateMeta = Object.fromEntries(notificationItems.map((_, index) => ['items.' + index + '.createdAt', ['Date']]));
  const dataFor = (procedure) => {
    if (procedure === 'auth.me') return {
      user: { id: 'pd98-user', nickname: '小美', activePetId: null }, roles: ['staff'],
      staff: { id: 'pd98-staff', name: '小美', storeId: 'pd98-store', role: 'frontdesk', schedule: {}, createdAt: '2026-01-01T00:00:00.000Z' },
      store: { id: 'pd98-store', name: '测试门店' },
    };
    if (procedure === 'config.activeCopyTexts') return { rows: [
      { key: 'sk.apptNo', text: 'SCHEDULE' }, { key: 'sk.meNo', text: 'ME' },
      { key: 'sched.no', text: 'MY SCHEDULE' }, { key: 'snt.no', text: 'NOTIFICATIONS' },
    ] };
    if (procedure === 'slotPort.liveMap') return { slots: [] };
    if (procedure === 'appointment.listForStaff') return [];
    if (procedure === 'schedule.weekView') return { assignments: [], staff: [] };
    if (procedure === 'schedule.myAvailability') return { availability: [
      { id: 'avail-1', weekday: 1, startMin: 540, endMin: 1080, note: null },
    ] };
    if (procedure === 'schedule.myLeaves') return { leaves: [
      { id: 'leave-1', kind: 'leave', startDate: '2026-10-26', endDate: '2026-10-26', reason: '家中有事', status: 'pending', decideNote: null },
    ] };
    if (procedure === 'schedule.compOffBalance') return { balanceMinutes: 0, logs: [] };
    if (procedure === 'push.listNotifications') return { items: rowsWithReadState(), nextCursor: null };
    if (procedure === 'push.unreadCount') {
      const total = notificationItems.filter((row) => !window.__pd98ReadIds.includes(row.id)).length;
      return { total, byCategory: { service: total } };
    }
    window.__pd98Unknown.push(procedure);
    return {};
  };
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.includes('/trpc/')) return nativeFetch(input, init);
    const procedures = decodeURIComponent(url.pathname.split('/trpc/')[1]).split(',');
    const method = String(init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    if (method !== 'GET') {
      window.__pd98Mutations.push({ procedures, body: bodyText });
      if (procedures.length === 1 && procedures[0] === 'push.markRead') {
        const ids = [...bodyText.matchAll(/"(care-[^"]+)"/g)].map((match) => match[1]);
        window.__pd98ReadIds = [...new Set([...window.__pd98ReadIds, ...ids])];
        return new Response(JSON.stringify([{ result: { data: { json: { marked: ids.length } } } }]), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      if (procedures.includes('push.markAllRead')) window.__pd98MarkAllClicks += 1;
      return new Response(JSON.stringify([{ error: { json: { message: 'PD-98 mutation blocked', code: -32603, data: { code: 'FORBIDDEN', httpStatus: 403 } } } }]), {
        status: 403, headers: { 'content-type': 'application/json' },
      });
    }
    const body = procedures.map((procedure) => {
      const data = { json: dataFor(procedure) };
      if (procedure === 'push.listNotifications') data.meta = { values: notificationDateMeta, v: 1 };
      if (procedure === 'auth.me') data.meta = { values: { 'staff.createdAt': ['Date'] }, v: 1 };
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
    if (response?.exceptionDetails) throw new Error(`页内 eval 异常：${JSON.stringify(response.exceptionDetails).slice(0, 500)}`);
    return response?.result?.value;
  }
  async waitFor(expression, timeoutMs = 15000) {
    const start = Date.now();
    for (;;) {
      const ready = await this.eval(`!!(${expression})`).catch(() => false);
      if (ready) return true;
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
  if (!BROWSER) throw new Error('未探测到 Edge/Chrome');
  const indexHtml = await readFile(join(DIST, 'index.html'), 'utf8');
  const bundleName = indexHtml.match(/assets\/(index-[^/]+\.js)/)?.[1];
  if (!bundleName) throw new Error('员工 dist 主 bundle 未找到');
  const bundleSha256 = createHash('sha256').update(await readFile(join(DIST, 'assets', bundleName))).digest('hex');
  const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  };
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(403); res.end('PD-98 read-only mock'); return; }
    const url = new URL(req.url ?? '/', BASE);
    if (url.pathname.startsWith('/trpc/')) { res.writeHead(500); res.end('tRPC must be intercepted'); return; }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    let file = resolve(DIST, relative);
    if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) { res.writeHead(403); res.end('forbidden'); return; }
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(content);
    } catch {
      if (extname(url.pathname)) { res.writeHead(404); res.end('missing asset'); return; }
      res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
      res.end(await readFile(join(DIST, 'index.html')));
    }
  });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT), { recursive: true });
  const profile = join(tmpdir(), `pd98-staff-${Date.now()}`);
  const browser = spawn(BROWSER, [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--lang=en-US',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--headless=new',
  ], { stdio: 'ignore' });
  let cdp = null;
  const cleanup = () => {
    try { cdp?.close(); } catch {}
    try { browser.kill(); } catch {}
    try { server.close(); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  const screenshots = {};
  const capture = async (name) => {
    const file = join(OUT_DIR, `${name}.png`);
    screenshots[name] = { file, sha256: await cdp.shot(file) };
  };
  const click = async (selector) => {
    await cdp.eval(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })`);
    await sleep(250);
    const point = await cdp.eval(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    if (!point) throw new Error(`找不到点击目标 ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await sleep(500);
  };
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
    await cdp.send('Emulation.setLocaleOverride', { locale: 'en-US' });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SOURCE });

    await cdp.send('Page.navigate', { url: `${BASE}/my-schedule` });
    note(await cdp.waitFor(`document.body.innerText.includes('家中有事') && !!document.querySelector('[data-testid="mysched-avail-list"]')`), '真 /my-schedule 排班请假数据完成加载');
    const schedule = await cdp.eval(`(() => ({
      body: document.body.innerText,
      subtitle: document.querySelector('.sk-backbar .no')?.textContent ?? null,
      inputs: ['mysched-avail-start','mysched-avail-end','mysched-leave-start','mysched-leave-end'].map((id) => {
        const input = document.querySelector('[data-testid="' + id + '"]');
        return { id, type: input?.type, value: input?.value };
      }),
    }))()`);
    note(schedule.inputs.every((input) => input.type === 'text'), '09 可用时间与请假使用区域设置无关的文本控件', schedule.inputs);
    note(schedule.inputs.map((input) => input.value).join('|') === '09:00|18:00|2026-10-26|2026-10-26', '09 时间与请假日值保持 24h 与 YYYY-MM-DD', schedule.inputs.map((input) => input.value));
    note(schedule.subtitle === null && !schedule.body.includes('MY SCHEDULE'), '我的排班不渲染 MY SCHEDULE 英文编号', schedule.subtitle);
    await capture('my-schedule-top');
    await cdp.eval(`document.querySelector('[data-testid="mysched-avail"]').scrollIntoView(); window.scrollBy(0, -60)`);
    await sleep(200);
    await capture('my-schedule-locale');

    await cdp.send('Page.navigate', { url: `${BASE}/schedule` });
    note(await cdp.waitFor(`!!document.querySelector('[data-testid="sk-schedule"] .sk-apphead') && !document.querySelector('[aria-label="加载中"]')`), '真 /schedule 完成加载');
    const appointment = await cdp.eval(`(() => {
      const input = document.querySelector('[data-testid="sk-datepick"]');
      return {
        body: document.body.innerText,
        subtitle: document.querySelector('.sk-apphead .no')?.textContent ?? null,
        dateInput: { type: input?.type, value: input?.value },
      };
    })()`);
    note(appointment.subtitle === null && !appointment.body.includes('SCHEDULE'), '预约页不渲染 SCHEDULE 英文编号', appointment.subtitle);
    note(appointment.dateInput.type === 'text' && appointment.dateInput.value === '2026-10-26', '预约日期芯片不受英文区域设置影响并保持 YYYY-MM-DD', appointment.dateInput);
    await capture('schedule');

    await cdp.send('Page.navigate', { url: `${BASE}/me` });
    note(await cdp.waitFor(`document.querySelector('[data-testid="me-user-card"]')?.textContent.includes('小美')`), '真 /me 员工身份卡完成加载');
    const me = await cdp.eval(`({ body: document.body.innerText, subtitle: document.querySelector('.sk-apphead .no')?.textContent ?? null })`);
    note(me.subtitle === null && !/\\bME\\b/.test(me.body) && !me.body.includes('frontdesk') && !me.body.includes('groomer'), '我的页不渲染 ME／frontdesk／groomer 英文字样', { subtitle: me.subtitle });
    await capture('me');

    await cdp.send('Page.navigate', { url: `${BASE}/notifications` });
    note(await cdp.waitFor(`document.querySelectorAll('[data-testid^="ntf-row-"]').length > 0 && document.querySelector('[data-testid="ntf-unread-count"]')?.textContent.includes('未读 6 条')`), '真 /notifications 六条 mock 通知与未读计数完成加载');
    const before = await cdp.eval(`(() => ({
      body: document.body.innerText,
      subtitle: document.querySelector('.sk-backbar .no')?.textContent ?? null,
      rows: [...document.querySelectorAll('[data-testid^="ntf-row-"]')].map((row) => row.getAttribute('data-testid')),
      unread: document.querySelector('[data-testid="ntf-unread-count"]')?.textContent,
    }))()`);
    note(before.rows.length === 4, '两组同秒重复与两组独立提醒收口为四行', before.rows);
    note(before.subtitle === null && !before.body.includes('NOTIFICATIONS'), '通知页不渲染 NOTIFICATIONS 英文编号', before.subtitle);
    await capture('notifications-before');

    await click('[data-testid="ntf-row-care-1637-a"]');
    const after = await cdp.eval(`(() => ({
      rows: document.querySelectorAll('[data-testid^="ntf-row-"]').length,
      unread: document.querySelector('[data-testid="ntf-unread-count"]')?.textContent,
      mutations: window.__pd98Mutations,
      markAllClicks: window.__pd98MarkAllClicks,
      unknown: window.__pd98Unknown,
      href: location.href,
      body: document.body.innerText,
      disabled: [...document.querySelectorAll('[data-testid^="ntf-row-"]')].map((row) => row.disabled),
    }))()`);
    const markReadBodies = after.mutations.filter((mutation) => mutation.procedures.includes('push.markRead')).map((mutation) => mutation.body).join('\\n');
    note(markReadBodies.includes('care-1637-a') && markReadBodies.includes('care-1637-b'), '点一组重复通知时同组两个 ID 一起已读', after.mutations);
    note(after.unread?.includes('未读 4 条') && after.rows === 4, '同组已读后未读数减二且不重新冒出重复行', { rows: after.rows, unread: after.unread });
    note(after.markAllClicks === 0, '全程未点全部已读', after.markAllClicks);
    note(after.unknown.length === 0, 'tRPC mock 过程全部已知', after.unknown);
    await capture('notifications-after');

    const report = {
      phase: PHASE,
      at: new Date().toISOString(),
      scope: '真实员工 dist＋英文区域设置＋tRPC mock；不是现网 tip 包，不冒领合部结论',
      bundle: { name: bundleName, sha256: bundleSha256, differsFromControl: bundleName !== CONTROL_BUNDLE },
      controlBundle: CONTROL_BUNDLE,
      schedule, appointment, me, notifications: { before, after },
      screenshots, results, failures,
    };
    writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`报告：${REPORT}`);
    console.log(`帧目录：${OUT_DIR}`);
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
