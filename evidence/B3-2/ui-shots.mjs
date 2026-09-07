/**
 * B3-2 UI 证据脚本（CDP 直连 Edge，无 puppeteer）——不入库
 *
 * 前置：server:7200 / customer:7100 已在运行；开发库已建「B3-2证据店B（周二休）」。
 * 流程：
 *   1. dev-seed-users 动态取客户 → dev-login（页面内 fetch，credentials include）；
 *   2. /booking/boarding → 屏1 选入住 D+1（周二）、退房 D+3 → 下一步到屏2；
 *   3. 截图1：已选区间，房型卡显示「剩余 N 间」（标准间 D+1/D+2 晚已被单C占 1 间 → 剩余 1 间）；
 *   4. 屏2 顶部切换到「B3-2证据店B（周二休）」→ 入住日（周二）为门店休息日 → 日期被清空
 *      → 房型卡改显「今晚剩余 N 间」；截图2。
 * 产出：evidence/B3-2/ui-range-selected.png / ui-no-date-tonight.png + 控制台断言。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9223;
const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(EDGE)) throw new Error('Edge not found');
const profileDir = resolve(tmpdir(), `philia-b32-ui-${process.pid}`);
mkdirSync(profileDir, { recursive: true });
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profileDir}`, '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

let ws;
let mid = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++mid;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
}
async function shot(file) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(resolve(__dirname, file), Buffer.from(s.data, 'base64'));
  console.log('saved', file);
}
/** 在指定 h2 小节下点击文本包含 label 的按钮 */
async function clickBtn(sectionTitle, label) {
  return evaluate(`(() => {
    const hs = [...document.querySelectorAll('h2')];
    const h = hs.find(x => x.textContent.includes(${JSON.stringify(sectionTitle)}));
    if (!h) return 'no-h2:' + ${JSON.stringify(sectionTitle)};
    let box = h.nextElementSibling;
    const btns = [...(box?.querySelectorAll('button') ?? [])];
    const b = btns.find(x => x.textContent.includes(${JSON.stringify(label)}));
    if (!b) return 'no-btn:' + ${JSON.stringify(label)};
    b.click();
    return 'ok';
  })()`);
}

try {
  // 等 CDP
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      if (m.error) pending.get(m.id).rej(new Error(m.error.message));
      else pending.get(m.id).res(m.result);
      pending.delete(m.id);
    }
  };
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  // 登录（动态取种子客户，禁止硬编码 ULID）
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(2500);
  const login = await evaluate(`(async () => {
    const u = await fetch('${API}/api/auth/dev-seed-users').then(r => r.json());
    const c = u.users.find(x => (x.roles ?? []).includes('customer'));
    const r = await fetch('${API}/api/auth/dev-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ userId: c.id }),
    }).then(r => r.json());
    return r.ok === true ? 'ok' : JSON.stringify(r);
  })()`);
  console.log('login:', login);

  // 进入寄养向导
  await send('Page.navigate', { url: `${APP}/booking/boarding` });
  await sleep(3000);

  // 屏1：入住 = 明天（周二 9/8），退房 = 9/10（fmtMD 渲染为「M月D日」）
  const md = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  console.log('pick checkin:', await clickBtn('入住日期', md(1)));
  await sleep(600);
  console.log('pick checkout:', await clickBtn('退房日期', md(3)));
  await sleep(600);
  console.log('next:', await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '下一步');
    if (!b || b.disabled) return 'no-next'; b.click(); return 'ok';
  })()`));
  await sleep(2500); // 等服务项 + 余量查询

  const state1 = await evaluate(`(() => {
    const txt = document.body.innerText;
    return {
      hasRemain: txt.includes('剩余') && /剩余 \\d+ 间/.test(txt),
      bz: (txt.match(/标准间[\\s\\S]{0,80}/) ?? [''])[0].replace(/\\n/g, '|'),
      tonight: txt.includes('今晚剩余'),
    };
  })()`);
  console.log('state1:', JSON.stringify(state1));
  await shot('ui-range-selected.png');

  // 屏2：切到「B3-2证据店B（周二休）」→ 入住日（周二）休息 → 日期清空 → 「今晚剩余」
  console.log('switch store:', await clickBtn('寄养门店', '证据店B'));
  await sleep(2500);
  const state2 = await evaluate(`(() => {
    const txt = document.body.innerText;
    return {
      tonight: (txt.match(/今晚剩余 \\d+ 间/g) ?? []),
      summaryDateChipGone: !txt.includes('点击修改'),
    };
  })()`);
  console.log('state2:', JSON.stringify(state2));
  await shot('ui-no-date-tonight.png');
} finally {
  try { ws?.close(); } catch {}
  if (edge.pid) {
    spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
    await sleep(800);
  }
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
console.log('done');
process.exit(0);
