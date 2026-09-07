/**
 * B3-4 寄养改期 · CDP 证据脚本（不入库）
 *
 * 用法：node b34-e2e.mjs <mode> <appointmentId>
 *   mode=repro   修复前复现：详情页断言无「改期」入口 + 截图
 *   mode=verify  修复后验证：改期按钮 → 两阶段重选面板（预填当前区间）
 *                → 重选入住/退房 → 确认 → toast + 列表回「待确认」截图
 *
 * 前置：server:7200 与 customer:7100 已在运行（脚本只做可达性检查）。
 * 登录：GET /api/auth/dev-seed-users 动态取客户（禁硬编码 ULID）→ dev-login。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname; // 截图直接落在 evidence/B3-4/
const APP_PORT = 7100;
const API_PORT = 7200;
const DEBUG_PORT = 9223;
const BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const BROWSER = BROWSER_CANDIDATES.find((p) => existsSync(p));

const [mode, aid, targetLabel = '9月26日', expectedNights = '4'] = process.argv.slice(2);
if (!mode || !aid) throw new Error('usage: node b34-e2e.mjs <repro|verify> <appointmentId> [targetCheckoutLabel expectedNights]');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function waitHttp(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

let browser = null;
const profileDir = resolve(tmpdir(), `philia-b34-cdp-${process.pid}`);
function cleanup() {
  if (browser?.pid) {
    spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    browser = null;
  }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);

async function main() {
  if (!BROWSER) throw new Error('未找到 Chrome/Edge');
  if (!(await waitHttp(`http://localhost:${API_PORT}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  if (!(await waitHttp(`http://localhost:${APP_PORT}/`, 4))) throw new Error('customer 7100 不可达');

  browser = spawn(BROWSER, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-extensions',
    'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let mid = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++mid;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r?.exceptionDetails) throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r?.result?.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(OUT_DIR, name), Buffer.from(s.data, 'base64'));
    console.log('saved', name);
  };

  /* 登录（动态取种子客户） */
  const seeds = await (await fetch(`http://localhost:${API_PORT}/api/auth/dev-seed-users`)).json();
  const customer = seeds.users.find((u) => (u.roles ?? []).includes('customer'));
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/` });
  await sleep(1500);
  await evaluate(
    `fetch('http://localhost:${API_PORT}/api/auth/dev-login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({userId:'${customer.id}'})}).then(r=>r.ok)`,
  );

  /* 打开寄养单详情页 */
  await send('Page.navigate', { url: `http://localhost:${APP_PORT}/appointments/${aid}` });
  await sleep(2500);

  const hasRescheduleBtn = await evaluate(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='改期')`,
  );
  const pageText = await evaluate(`document.body.innerText.slice(0,120)`);

  if (mode === 'repro') {
    assert('寄养单详情页无「改期」按钮（修复前复现）', hasRescheduleBtn === false);
    await shot('repro-detail-no-reschedule.png');
    console.log('--- 页面首部 ---\n' + pageText);
  } else {
    assert('寄养单详情页出现「改期」按钮', hasRescheduleBtn === true);
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await sleep(400);
    await shot('fix-detail-reschedule-btn.png');
    await evaluate(`window.scrollTo(0, 0)`);

    // 点开改期面板：应为两阶段日期重选（入住 chip 摘要 + 退房网格），预填当前区间
    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='改期')?.click()`);
    await sleep(800);
    const panel = await evaluate(`({
      hasChip: [...document.querySelectorAll('button')].some(b=>b.textContent.includes('点击修改')),
      hasCheckoutGrid: document.body.innerText.includes('退房日期'),
      nightsText: (document.body.innerText.match(/共\\s*\\d+\\s*晚/)||[])[0] ?? null,
    })`);
    assert('改期面板：入住日收起为摘要 chip（两阶段组件，预填当前区间）', panel.hasChip === true, JSON.stringify(panel));
    assert('改期面板：显示退房日期网格', panel.hasCheckoutGrid === true);
    assert('改期面板：预填当前区间并即时显示「共 N 晚」', panel.nightsText !== null, String(panel.nightsText));
    await evaluate(`document.querySelector('button[class*="bg-brand-primary"][class*="h-11"]')?.scrollIntoView({block:'end'})`);
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await sleep(400);
    await shot('fix-reschedule-panel.png');

    // 改选退房日 → 确认改期
    await evaluate(
      `[...document.querySelectorAll('button')].find(b=>!b.disabled && b.textContent.includes('${targetLabel}'))?.click()`,
    );
    await sleep(500);
    const nights2 = await evaluate(`(document.body.innerText.match(/共\\s*(\\d+)\\s*晚/)||[])[1] ?? null`);
    assert(`重选退房 ${targetLabel} 后即时显示「共 ${expectedNights} 晚」`, nights2 === expectedNights, String(nights2));
    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await sleep(300);
    await shot('fix-reschedule-repicked.png');

    await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='确认改期')?.click()`);
    await sleep(2500);
    const toastText = await evaluate(`document.body.innerText.includes('改期已提交，等待商家重新确认')`);
    assert('toast「改期已提交，等待商家重新确认」（沿用洗护口径）', toastText === true);
    const pillPending = await evaluate(
      `[...document.querySelectorAll('span')].some(s=>s.textContent.trim()==='待确认')`,
    );
    assert('详情页状态胶囊回「待确认」（status 回退 pending）', pillPending === true);
    await evaluate(`window.scrollTo(0, 0)`);
    await sleep(300);
    await shot('fix-reschedule-toast.png');

    // 列表回「待确认」
    await send('Page.navigate', { url: `http://localhost:${APP_PORT}/appointments` });
    await sleep(2000);
    const listOk = await evaluate(
      `document.body.innerText.includes('待确认') && document.body.innerText.includes('标准间寄养')`,
    );
    assert('我的预约列表：改期后单回「待确认」Tab/列表且服务项可见', listOk === true);
    await shot('fix-list-pending.png');
  }

  ws.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? 'PASS ALL' : `${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
