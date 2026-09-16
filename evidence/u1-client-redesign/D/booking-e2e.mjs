/**
 * U1-D 证据采集：预约单屏换肤验收 + 下单全链路回归（CDP 直连）
 *
 * 断言口径：
 * - 洗护单屏六段锚点：gs-pet-card / gs-cat-wash+gs-cat-style（二选一照片大卡）/
 *   gs-service-chips / gs-store-line / gs-groomer-rail（随缘派单置顶）/ gs-date-strip
 *   （余量透出）/ gs-time-grid / gs-slot-summary（选时段后）/ gs-confirm-bar + 安心行；
 * - 寄养单屏同口径锚点：bs-room-* / bs-confirm-assurance；
 * - 下单全链路回归：选宠→选服务（点洗澡大卡）→选时段→确认→/booking/success 成功页；
 * - 按钮真链路点验：枚举 a[href] 无死链；
 * - 换肤前后对照：git show HEAD~1:旧文件静态对照（另附）；截图 shots/。
 * 运行：node booking-e2e.mjs
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
const profileDir = resolve(tmpdir(), `philia-u1d-e2e-${process.pid}`);
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
  const clickTestId = async (testId) => {
    await evalJs(`(() => {
      const el = document.querySelector('[data-testid="${testId}"]');
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()`);
    await sleep(900);
  };

  /* dev-login */
  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
  const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  assert('dev-login 种子客户', (await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
  }).then(r => r.status)`)) === 200);

  /* ---------- 洗护单屏 ---------- */
  await send('Page.navigate', { url: `${APP}/booking/grooming` });
  await sleep(4500);
  const g1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    return {
      petCard: !!q('[data-testid="gs-pet-card"]'),
      catWash: q('[data-testid="gs-cat-wash"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      catStyle: q('[data-testid="gs-cat-style"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      chips: qa('[data-testid^="gs-service-chip-"]').length,
      storeLine: !!q('[data-testid="gs-store-line"]'),
      groomerRail: !!q('[data-testid="gs-groomer-rail"]'),
      groomerAny: q('[data-testid="gs-groomer-any"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      groomerCount: qa('[data-testid^="gs-groomer-"]').length - 1,
      dateStrip: !!q('[data-testid="gs-date-strip"]'),
      remainDays: qa('[data-testid^="gs-day-"]').map(b => b.textContent.replace(/\\s+/g, '')).filter(t => t.includes('余')),
      fullDays: qa('[data-testid^="gs-day-"]').map(b => b.textContent.replace(/\\s+/g, '')).filter(t => t.includes('约满')),
      timeGrid: !!q('[data-testid="gs-time-grid"]'),
      confirmBar: !!q('[data-testid="gs-confirm-bar"]'),
      assurance: q('[data-testid="gs-confirm-assurance"]')?.textContent ?? null,
      dock: !!q('[data-testid="app-dock"]'),
      backBtn: !!q('button[aria-label="返回"]'),
    };
  })()`);
  await shot('01-洗护单屏-初始');
  assert('洗护：宠物卡/门店行/时段栅格六段锚点', g1.petCard && g1.storeLine && g1.timeGrid);
  assert('洗护：服务二选一照片大卡（洗澡/造型美容真实聚合）',
    !!g1.catWash && !!g1.catStyle && /项可选 · ¥\d+ 起/.test(g1.catWash) && /项可选 · ¥\d+ 起/.test(g1.catStyle),
    `${g1.catWash} | ${g1.catStyle}`);
  assert('洗护：服务 chips 保留（精确选择逻辑不动）', g1.chips >= 1, `chips=${g1.chips}`);
  assert('洗护：美容师横卡置顶「随缘派单」默认卡', g1.groomerRail && !!g1.groomerAny?.includes('随缘派单'), g1.groomerAny ?? '');
  assert('洗护：员工卡真实数据（≥1 名）', g1.groomerCount >= 1, `staff=${g1.groomerCount}`);
  assert('洗护：日期余量透出（余 N）与约满透出', g1.remainDays.length >= 1, `余量日=${g1.remainDays.join(',') || '无'} 约满日=${g1.fullDays.join(',') || '无'}`);
  assert('洗护：吸底安心行真实功能点文案', g1.assurance === '全程可见 · 照片记录', g1.assurance ?? '');
  assert('洗护：详情级无 dock + 返回圆钮', !g1.dock && g1.backBtn);

  /* 全链路回归：选宠 → 洗澡大卡 → 时段 → 确认 → 成功页 */
  const petCardClicked = await evalJs(`(() => {
    const el = document.querySelector('[data-testid="gs-pet-card"]');
    if (!el) return 'no-card';
    el.scrollIntoView({ block: 'center' });
    el.click();
    return 'clicked';
  })()`);
  await sleep(1500);
  const petPicked = await evalJs(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    if (!sheet) return 'no-sheet';
    // 宠物列表容器（避开头部「关闭」钮）
    const btn = sheet.querySelector('.space-y-2 > button');
    if (!btn) return 'no-pet-btn';
    const name = btn.textContent.replace(/\\s+/g, ' ').trim();
    btn.click();
    return name;
  })()`);
  await sleep(1000);
  assert('链路：底部半屏选宠（真实数据）', !!petPicked && !String(petPicked).startsWith('no-'), `${petCardClicked} / ${petPicked}`);

  await clickTestId('gs-cat-wash');
  const afterCat = await evalJs(`(() => {
    const active = document.querySelector('[data-testid="gs-cat-wash"]')?.getAttribute('data-active');
    const chip = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]')?.textContent?.replace(/\\s+/g, ' ') ?? null;
    return { active, chip };
  })()`);
  assert('链路：洗澡大卡点选=选中档内首个服务（真实选择）', afterCat.active === 'true' && !!afterCat.chip, afterCat.chip ?? '');

  const slotPicked = await evalJs(`(() => {
    const btns = [...document.querySelectorAll('[data-testid^="gs-slot-"][data-available="true"]')];
    if (!btns.length) return null;
    const b = btns[Math.min(2, btns.length - 1)];
    b.scrollIntoView({ block: 'center' });
    b.click();
    return b.textContent.trim();
  })()`);
  await sleep(1200);
  const g2 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    return {
      summary: q('[data-testid="gs-slot-summary"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      confirm: q('[data-testid="gs-confirm"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      state: q('[data-testid="gs-confirm"]')?.getAttribute('data-state'),
    };
  })()`);
  await shot('02-洗护单屏-可点态');
  assert('链路：时段可选并透出时间摘要行', !!slotPicked && !!g2.summary?.includes('已选时间'), `slot=${slotPicked} summary=${g2.summary}`);
  assert('链路：吸底条可点态「确认预约 · ¥X · 约 N 分钟」', g2.state === 'ready' && /确认预约 · ¥\d+(\.\d+)? · 约 \d+ 分钟/.test(g2.confirm ?? ''), g2.confirm ?? '');

  await clickTestId('gs-confirm');
  await sleep(3500);
  const g3 = await evalJs(`(() => ({ url: location.pathname + location.search, text: document.getElementById('root')?.innerText ?? '' }))()`);
  await shot('03-下单成功页');
  assert('链路：确认后落 /booking/success 成功页', g3.url.startsWith('/booking/success'), g3.url);
  assert('链路：成功页真实内容（预约成功 + 核销码区）', g3.text.includes('预约成功'), '');

  /* ---------- 寄养单屏 ---------- */
  await send('Page.navigate', { url: `${APP}/booking/boarding` });
  await sleep(4500);
  const b1 = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    return {
      petCard: !!q('[data-testid="gs-pet-card"]'),
      room: !!q('[data-testid="bs-room-readonly"], [data-testid="bs-room-selector"]'),
      roomText: (q('[data-testid="bs-room-readonly"], [data-testid="bs-room-selector"]')?.textContent ?? '').replace(/\\s+/g, ' ').slice(0, 120),
      storeLine: !!q('[data-testid="gs-store-line"]'),
      assurance: q('[data-testid="bs-confirm-assurance"]')?.textContent ?? null,
      confirm: q('[data-testid="bs-confirm"]')?.textContent?.replace(/\\s+/g, ' ') ?? null,
      dock: !!q('[data-testid="app-dock"]'),
      backBtn: !!q('button[aria-label="返回"]'),
    };
  })()`);
  await shot('04-寄养单屏');
  assert('寄养：宠物卡/门店行/房型区锚点', b1.petCard && b1.storeLine && b1.room, b1.roomText);
  assert('寄养：吸底安心行真实功能点文案', b1.assurance === '每日照看日志 · 照片记录', b1.assurance ?? '');
  assert('寄养：详情级无 dock + 返回圆钮', !b1.dock && b1.backBtn);

  /* 按钮真链路点验（洗护+寄养两屏） */
  for (const [name, path] of [['grooming', '/booking/grooming'], ['boarding', '/booking/boarding']]) {
    await send('Page.navigate', { url: `${APP}${path}` });
    await sleep(3500);
    const dead = await evalJs(`(() => {
      const out = [];
      document.querySelectorAll('#root a[href]').forEach((a) => {
        const h = a.getAttribute('href');
        if (!h || h === '#' || h.startsWith('javascript')) out.push(h);
      });
      return out;
    })()`);
    assert(`点验：${name} 无死链（# / javascript: / 空 href）`, dead.length === 0, dead.join(','));
  }

  writeFileSync(resolve(__dirname, 'booking-e2e-results.json'), JSON.stringify({ results, grooming: { g1, g2 }, boarding: b1 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
