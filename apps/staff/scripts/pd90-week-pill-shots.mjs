#!/usr/bin/env node
/**
 * PD-90 周排班 pill 选中态：真实 React 页面 + 只读 tRPC mock + CDP 实尺像素闸门。
 * strip 裁片只含「上周／本周／下周」三钮，明确排除区间正文；pill 裁片用于填色／描边双证。
 * 用法：PHASE=baseline|fixed node apps/staff/scripts/pd90-week-pill-shots.mjs
 * 环境：STAFF_URL（默认 7190）/ CDP_PORT（默认 9290）/ OUT_DIR / HEADFUL=1。
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const WSImpl = globalThis.WebSocket ?? createRequire(join(REPO_ROOT, 'server', 'package.json'))('ws');
const { Jimp } = createRequire(join(REPO_ROOT, 'server', 'package.json'))('jimp');
const STAFF_URL = (process.env.STAFF_URL ?? 'http://127.0.0.1:7190').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9290);
const PHASE = process.env.PHASE ?? 'fixed';
if (!['baseline', 'fixed'].includes(PHASE)) throw new Error('PHASE 仅可为 baseline 或 fixed');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd90-staff-pill-selected-state', 'shots');
const REPORT = join(REPO_ROOT, 'evidence', 'pd90-staff-pill-selected-state', `${PHASE}-pixel-report.json`);
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
  window.__pd90MockSeen = [];
  window.__pd90MockUnknown = [];
  const dataFor = (procedure) => {
    if (procedure === 'auth.me') return {
      user: { id: 'pd90-user', nickname: '小美', activePetId: null },
      roles: ['staff'],
      staff: { id: 'pd90-staff', storeId: 'pd90-store', role: 'frontdesk', schedule: {} },
      store: { id: 'pd90-store' },
    };
    if (procedure === 'config.activeCopyTexts') return { rows: [] };
    if (procedure === 'slotPort.liveMap') return { slots: [] };
    if (procedure === 'schedule.weekView') return {
      staff: [{ id: 'pd90-staff', name: '小美' }], assignments: [],
    };
    if (procedure === 'schedule.myAvailability') return { availability: [] };
    if (procedure === 'schedule.myLeaves') return { leaves: [] };
    if (procedure === 'schedule.compOffBalance') return { balanceMinutes: 0, logs: [] };
    if (procedure === 'push.unreadCount') return { total: 0, byCategory: {} };
    window.__pd90MockUnknown.push(procedure);
    return {};
  };
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (!url.pathname.includes('/trpc/')) return nativeFetch(input, init);
    const procedures = decodeURIComponent(url.pathname.split('/trpc/')[1]).split(',');
    window.__pd90MockSeen.push(...procedures);
    const body = procedures.map((procedure) => ({ result: { data: { json: dataFor(procedure) } } }));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
})()`;

const READ_PILLS = `(() => {
  const thisButton = document.querySelector('[data-testid="mysched-week-this"]');
  if (!thisButton) return null;
  const bar = thisButton.parentElement;
  const buttons = [...bar.querySelectorAll(':scope > button')].map((button) => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      text: button.textContent.trim(),
      className: button.className,
      ariaPressed: button.getAttribute('aria-pressed'),
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      color: style.color,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
  const range = bar.querySelector('[data-testid="mysched-week-pill"]');
  const rangeRect = range?.getBoundingClientRect();
  const right = Math.max(...buttons.map((button) => button.rect.x + button.rect.width));
  return {
    buttons,
    rangeText: range?.textContent.trim() ?? '',
    rangeOutsideStrip: !!rangeRect && rangeRect.left >= right,
    loading: !!document.querySelector('[aria-label="加载中"]'),
    pageReady: !!document.querySelector('[data-testid="mysched-page"]') && document.querySelectorAll('[data-testid^="mysched-day-"]').length === 7,
    mockUnknown: window.__pd90MockUnknown ?? [],
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
  x: Math.round(rect.x), y: Math.round(rect.y),
  width: Math.round(rect.width), height: Math.round(rect.height),
});
const pillName = (text) => text === '本周' ? 'this' : text.includes('上周') ? 'previous' : 'next';
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
    comparable: true,
    size: [a.bitmap.width, a.bitmap.height],
    md5A, md5B, md5Equal: md5A === md5B,
    meanAbs: absoluteSum / (totalPixels * 3),
    changedPixels, totalPixels,
  };
}

async function main() {
  if (!BROWSER) throw new Error('未探测到 Edge/Chrome');
  const preview = await fetch(`${STAFF_URL}/my-schedule`).then((res) => res.ok).catch(() => false);
  if (!preview) throw new Error(`员工 preview 未就绪：${STAFF_URL}`);
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(REPORT), { recursive: true });

  const profile = join(tmpdir(), `pd90-week-pill-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  const cleanup = () => {
    try { browser.kill(); } catch {}
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);

  let target = null;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      target = await response.json();
    } catch { await sleep(200); }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('CDP 页签创建失败');
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 512, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: MOCK_SOURCE });
  await cdp.send('Page.navigate', { url: `${STAFF_URL}/my-schedule` });
  const loaded = await cdp.waitFor(`(() => { const state = ${READ_PILLS}; return state?.pageReady && !state.loading; })()`);
  note(loaded, '真实 /my-schedule 页面加载完成（非加载壳）');

  const states = {};
  let geometry = null;
  const capture = async (key, expectedSelected) => {
    await cdp.eval('window.scrollTo(0, 0)');
    await sleep(350);
    const state = await cdp.eval(READ_PILLS);
    note(!!state?.pageReady && !state.loading && state.mockUnknown.length === 0, `${key} 查询完成且 mock 过程全已知`, state?.mockUnknown ?? []);
    note(!!state?.rangeOutsideStrip, `${key} strip 裁片排除区间正文`);
    const selected = state.buttons.filter((button) => button.className.split(/\s+/).includes('on'));
    note(selected.length === 1 && selected[0].text === expectedSelected, `${key} 唯一选中 pill=${expectedSelected}`, selected.map((button) => button.text));
    const pressed = state.buttons.filter((button) => button.ariaPressed === 'true');
    note(pressed.length === 1 && pressed[0].text === expectedSelected, `${key} aria-pressed 与真实区间一致`, pressed.map((button) => button.text));

    const first = state.buttons[0].rect;
    const last = state.buttons[state.buttons.length - 1].rect;
    const stripRect = {
      x: first.x, y: Math.min(...state.buttons.map((button) => button.rect.y)),
      width: last.x + last.width - first.x,
      height: Math.max(...state.buttons.map((button) => button.rect.y + button.rect.height)) - Math.min(...state.buttons.map((button) => button.rect.y)),
    };
    if (!geometry) {
      geometry = {
        strip: { x: stripRect.x, width: Math.ceil(stripRect.width) + 6, height: Math.ceil(stripRect.height) },
        pills: Object.fromEntries(state.buttons.map((button) => [pillName(button.text), {
          width: Math.ceil(button.rect.width) + 2, height: Math.ceil(button.rect.height),
        }])),
      };
    }
    const files = { pills: {} };
    files.strip = join(OUT_DIR, `${PHASE}-${key}-strip.png`);
    files.page = join(OUT_DIR, `${PHASE}-${key}-page.png`);
    await cdp.shot(files.strip, roundedClip({ x: geometry.strip.x, y: stripRect.y, width: geometry.strip.width, height: geometry.strip.height }));
    await cdp.shot(files.page);
    for (const button of state.buttons) {
      const name = pillName(button.text);
      const file = join(OUT_DIR, `${PHASE}-${key}-pill-${name}.png`);
      const fixed = geometry.pills[name];
      await cdp.shot(file, roundedClip({
        x: button.rect.x + button.rect.width / 2 - fixed.width / 2,
        y: button.rect.y, width: fixed.width, height: fixed.height,
      }));
      files.pills[name] = file;
    }
    states[key] = { ...state, files, expectedSelected };
  };

  const click = async (label) => {
    const state = await cdp.eval(READ_PILLS);
    const button = state.buttons.find((item) => item.text === label);
    if (!button) throw new Error(`找不到按钮 ${label}`);
    const x = button.rect.x + button.rect.width / 2;
    const y = button.rect.y + button.rect.height / 2;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(450);
  };

  await capture('this', '本周');
  await click('‹ 上周');
  await capture('previous', '‹ 上周');
  await click('本周');
  await capture('returned-from-previous', '本周');
  await click('下周 ›');
  await capture('next', '下周 ›');
  await click('本周');
  await capture('returned-from-next', '本周');

  const comparisons = { strip: {}, selectedPill: {}, returns: {} };
  for (const [a, b] of [['this', 'previous'], ['this', 'next'], ['previous', 'next']]) {
    const diff = await pixelDiff(states[a].files.strip, states[b].files.strip);
    comparisons.strip[`${a}-vs-${b}`] = diff;
    note(diff.comparable && !diff.md5Equal && diff.meanAbs > 0, `strip 整体像素双态可辨：${a} vs ${b}`, diff);
  }
  for (const [name, selectedState, unselectedState] of [
    ['previous', 'previous', 'this'],
    ['this', 'this', 'previous'],
    ['next', 'next', 'this'],
  ]) {
    const diff = await pixelDiff(states[selectedState].files.pills[name], states[unselectedState].files.pills[name]);
    const selectedButton = states[selectedState].buttons.find((button) => pillName(button.text) === name);
    const unselectedButton = states[unselectedState].buttons.find((button) => pillName(button.text) === name);
    const styleChanged = selectedButton.backgroundColor !== unselectedButton.backgroundColor || selectedButton.borderColor !== unselectedButton.borderColor;
    const detail = { ...diff, selected: { backgroundColor: selectedButton.backgroundColor, borderColor: selectedButton.borderColor }, unselected: { backgroundColor: unselectedButton.backgroundColor, borderColor: unselectedButton.borderColor }, styleChanged };
    comparisons.selectedPill[name] = detail;
    note(diff.comparable && !diff.md5Equal && diff.meanAbs > 0 && styleChanged, `同一 pill 选中／未选中填色或描边像素可辨：${name}`, detail);
  }
  for (const key of ['returned-from-previous', 'returned-from-next']) {
    const diff = await pixelDiff(states.this.files.strip, states[key].files.strip);
    comparisons.returns[key] = diff;
    note(diff.comparable && diff.md5Equal && states[key].rangeText === states.this.rangeText, `点回本周恢复原 strip 与真实区间：${key}`, diff);
  }

  const mockSeen = await cdp.eval('window.__pd90MockSeen');
  writeFileSync(REPORT, JSON.stringify({
    phase: PHASE,
    at: new Date().toISOString(),
    staffUrl: STAFF_URL,
    viewport: { width: 512, height: 844, deviceScaleFactor: 1 },
    mock: { readOnlyQueries: true, mutations: 0, seen: [...new Set(mockSeen)] },
    states,
    comparisons,
    results,
    failures,
  }, null, 2));
  void cdp.send('Browser.close').catch(() => {});
  await sleep(300);
  cdp.close();
  console.log(`报告：${REPORT}`);
  console.log(failures === 0 ? 'PD-90 像素闸门全绿' : `PD-90 像素闸门失败 ${failures} 项`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
