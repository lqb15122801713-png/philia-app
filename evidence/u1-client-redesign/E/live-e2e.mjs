/**
 * U1-E 证据采集：服务全程页六步 stepper 换肤验收 + SSE 推进实证（CDP 直连）
 *
 * 流程：
 * 1. 外层已 flip 种子单 → in_service（步骤 1/2 done、3 active、4-6 locked）；
 * 2. 客户态打开 live 页 → 三态断言（done=薄荷圆+墨✓ / active=柠檬圆+墨芯+「进行中」
 *    小签深棕墨字 / locked=墨灰描边+锁）+ 截图「01-三态」；
 * 3. Node 侧 staff dev-login → tRPC serviceStep.confirmStep 推进第 3 步（真实事件链
 *    event_outbox → SSE）；
 * 4. 不刷新页面轮询 DOM：第 3 步变 done、第 4 步变 active（SSE 推进实证）→ 截图「02-推进后」；
 * 5. 外层 restore 后 --completed 模式：全完成态（全薄荷✓）+ 前后对比区保留断言 → 截图「03-全完成」。
 * 运行：node live-e2e.mjs [--completed]
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
const APPT_ID = process.env.SMOKE_APPT_ID ?? '01M256D240E19GWNG2QMFV3Q8V';
const COMPLETED_MODE = process.argv.includes('--completed');
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
const profileDir = resolve(tmpdir(), `philia-u1e-e2e-${process.pid}`);
function cleanup() {
  if (browser?.pid) { spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); browser = null; }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

/** Node 侧：dev-login 取 cookie（role 匹配的种子用户） */
async function devLogin(role) {
  const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json());
  const user = (seed?.users ?? []).find((u) => (u.roles ?? []).includes(role));
  if (!user) throw new Error(`无 ${role} 种子用户`);
  const res = await fetch(`${API}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  });
  if (!res.ok) throw new Error(`dev-login ${role} HTTP ${res.status}`);
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

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

  /* 客户登录态（浏览器侧 cookie） */
  const cookie = await devLogin('customer');
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2000);
  await evalJs(`document.cookie = ${JSON.stringify(cookie + '; path=/')}; true`);

  /* 打开 live 页 */
  await send('Page.navigate', { url: `${APP}/appointments/${APPT_ID}/live` });
  await sleep(5000);

  const STATE = `(() => {
    const qa = (s) => [...document.querySelectorAll(s)];
    const steps = qa('[data-testid="live-stepper"] [data-step-key]').map((li) => {
      const status = li.getAttribute('data-step-status');
      const node = li.querySelector('.flex.w-6 > span:first-child');
      const cls = node ? getComputedStyle(node).backgroundColor : null;
      const tag = li.querySelector('.rounded-chip')?.textContent ?? null;
      return { key: li.getAttribute('data-step-key'), status, bg: cls, tag, name: li.querySelector('span')?.textContent ?? '' };
    });
    const check = document.querySelector('[data-step-status="done"] svg');
    return {
      steps,
      checkColor: check ? getComputedStyle(check).color : null,
      photos: qa('[data-testid="live-stepper"] img').length,
      beforeAfter: (document.getElementById('root')?.innerText ?? '').includes('服务前') && (document.getElementById('root')?.innerText ?? '').includes('服务后'),
      rootText: (document.getElementById('root')?.innerText ?? '').trim().length,
      dock: !!document.querySelector('[data-testid="app-dock"]'),
    };
  })()`;

  if (COMPLETED_MODE) {
    const s = await evalJs(STATE);
    await shot('03-全完成');
    const allDoneMint = s.steps.length === 6 && s.steps.every((x) => x.status === 'done' && x.bg === 'rgb(127, 216, 190)');
    assert('全完成：六步全 done 薄荷圆（#7FD8BE）', allDoneMint, JSON.stringify(s.steps.map((x) => [x.key, x.bg])));
    assert('全完成：✓ 为深棕墨（品牌面文字一律深棕墨）', s.checkColor === 'rgb(74, 59, 46)', s.checkColor ?? '');
    assert('全完成：前后对比区保留（服务前/服务后）', s.beforeAfter);
    writeFileSync(resolve(__dirname, 'live-e2e-completed.json'), JSON.stringify({ results, state: s }, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n== 全完成态汇总：${results.length - failed.length}/${results.length} PASS ==`);
    process.exit(failed.length ? 1 : 0);
  }

  /* 1. 三态（flip 后：1/2 done、3 active、4-6 locked） */
  const s1 = await evalJs(STATE);
  await shot('01-三态');
  const byKey = Object.fromEntries(s1.steps.map((x) => [x.key, x]));
  assert('三态：六步 stepper 渲染', s1.steps.length === 6, JSON.stringify(s1.steps.map((x) => [x.key, x.status])));
  assert('三态：done=薄荷圆 #7FD8BE + 深棕墨✓',
    byKey.disinfection?.bg === 'rgb(127, 216, 190)' && byKey.precheck?.bg === 'rgb(127, 216, 190)' && s1.checkColor === 'rgb(74, 59, 46)',
    `${byKey.disinfection?.bg} / check=${s1.checkColor}`);
  assert('三态：active=柠檬圆 #FDC830 + 「进行中」小签（深棕墨字）',
    byKey.grooming?.bg === 'rgb(253, 200, 48)' && byKey.grooming?.tag === '进行中',
    `${byKey.grooming?.bg} / tag=${byKey.grooming?.tag}`);
  assert('三态：locked=墨灰未到（detail/before_after/confirm）',
    byKey.detail?.status === 'locked' && byKey.confirm?.status === 'locked');
  assert('三态：步骤挂过程照（既有 PhotoWall 链路）', s1.photos >= 1, `photos=${s1.photos}`);
  assert('三态：详情级无 dock', !s1.dock);

  /* 2. SSE 推进实证：staff confirmStep（真实事件链），页面不刷新等 DOM 变化 */
  const staffCookie = await devLogin('staff');
  const confirmRes = await fetch(`${API}/trpc/serviceStep.confirmStep?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: staffCookie },
    body: JSON.stringify({ '0': { json: { appointmentId: APPT_ID, stepKey: 'grooming' } } }),
  });
  const confirmBody = await confirmRes.text();
  assert('推进：staff confirmStep 第 3 步 HTTP 200（真实事件链）', confirmRes.ok, `HTTP ${confirmRes.status} ${confirmBody.slice(0, 120)}`);

  let s2 = null;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    s2 = await evalJs(STATE);
    const b2 = Object.fromEntries(s2.steps.map((x) => [x.key, x]));
    if (b2.grooming?.status === 'done' && b2.detail?.status === 'active') break;
  }
  await shot('02-推进后');
  const byKey2 = Object.fromEntries((s2?.steps ?? []).map((x) => [x.key, x]));
  assert('SSE：页面不刷新，第 3 步 done（薄荷）+ 第 4 步 active（柠檬）',
    byKey2.grooming?.status === 'done' && byKey2.grooming?.bg === 'rgb(127, 216, 190)' && byKey2.detail?.status === 'active' && byKey2.detail?.bg === 'rgb(253, 200, 48)',
    JSON.stringify([byKey2.grooming?.status, byKey2.detail?.status]));

  writeFileSync(resolve(__dirname, 'live-e2e-results.json'), JSON.stringify({ results, before: s1, after: s2 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
