#!/usr/bin/env node
/**
 * 批次 9a.2 实证驱动：HTTP LAN（非安全上下文）逐端逐页渲染不崩验证。
 * 前置：SERVE_STATIC=1 的 server:7200（三端 dist 按 Host 分发）、Edge CDP 9223 已起。
 * 用法：node b92-insecure-context-proof.mjs
 * 输出：逐页断言行 + 截图到 ./shots-b92/；末尾 RESULT PASS/FAIL。
 *
 * 形态：与 VPS 内测完全同源——页面与 /api、/trpc、/api/events 同 host:port；
 * customer 走裸 IP（Host 兜底），merchant/staff 走 nip.io 子域（m 段/s 段分发）。
 * 三端 dist 已按端注入各自 VITE_API_BASE=同源 origin。
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const LAN = '192.168.18.84';
const ORIGINS = {
  customer: `http://${LAN}:7200`,
  merchant: `http://m.${LAN}.nip.io:7200`,
  staff: `http://s.${LAN}.nip.io:7200`,
};
const ROLE = { customer: 'customer', merchant: 'merchant_owner', staff: 'staff' };
const APPT = '01M256D240E19GWNG2QMFV3Q8V'; // grooming·completed，属种子客户（smoke-routes 在卷数据）
const BOARDING = '01M2HMSBZVPQ04HJSSGF3X4T7Z'; // boarding（寄养单页渲染入住登记段）
const PAGES = [
  { app: 'customer', path: '/home', anchors: ['菲丽亚', '预约', '商城'], shot: 'customer-home' },
  { app: 'customer', path: `/appointments/${APPT}`, anchors: ['预约', '核销'], shot: 'customer-appt-detail' },
  { app: 'customer', path: `/appointments/${APPT}/live`, anchors: ['服务', '步骤', '完成', '评价', '进度'], shot: 'customer-appt-live' },
  { app: 'customer', path: '/mall/orders', anchors: ['订单'], shot: 'customer-mall-orders' },
  { app: 'merchant', path: '/dashboard', anchors: ['今日', '仪表', '预约'], shot: 'merchant-dashboard' },
  { app: 'staff', path: '/today', anchors: ['今日任务'], shot: 'staff-today' },
  { app: 'staff', path: `/execute/${APPT}`, anchors: ['第', '步', '核销'], shot: 'staff-execute' },
  { app: 'staff', path: `/boarding/${BOARDING}/checkin`, anchors: ['寄养', '入住', '宠物', '打卡'], shot: 'staff-boarding-checkin' },
];

const DEBUG_PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync('shots-b92', { recursive: true });

const exceptions = [];
const consoleErrors = [];
let currentPage = '(init)';

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`evalJs 异常: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
  return r.result?.value;
}

let passCount = 0;
let failCount = 0;

async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      if (targets.length) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(`[${currentPage}] ${JSON.stringify(msg.params.exceptionDetails).slice(0, 400)}`);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(`[${currentPage}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)}`);
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  // Edge 启动期内部噪声（appAnon cookie/PCS 配置日志等，tag=(init)）不计入页面断言：
  // 连接后、首次导航前清空两条收集数组；页面级断言另按导航前后增量计。
  exceptions.length = 0;
  consoleErrors.length = 0;

  for (const app of ['customer', 'merchant', 'staff']) {
    const base = ORIGINS[app];
    // 0) 非安全上下文前提（逐端）：isSecureContext=false 且 crypto.randomUUID 不存在
    currentPage = `${app}/dev-login(premise)`;
    await send('Page.navigate', { url: `${base}/dev-login` });
    await sleep(3000);
    const ctx = await evalJs(`({
      href: location.href,
      isSecureContext: window.isSecureContext,
      hasRandomUUID: typeof window.crypto?.randomUUID === 'function',
    })`);
    console.log(`CONTEXT[${app}]`, JSON.stringify(ctx));
    if (app === 'customer') {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync('shots-b92/premise-insecure-context.png', Buffer.from(shot.data, 'base64'));
    }

    // 1) dev-login（同源相对路径，cookie 落在各自 origin）
    const login = await evalJs(`(async () => {
      const seeds = await (await fetch('/api/auth/dev-seed-users')).json();
      const u = seeds.users.find((x) => x.roles.includes('${ROLE[app]}'));
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id }),
      });
      return { status: res.status, user: u.nickname, roles: u.roles };
    })()`);
    console.log(`LOGIN[${app}]`, JSON.stringify(login));

    // 2) 逐页验证
    for (const p of PAGES.filter((x) => x.app === app)) {
      currentPage = `${app}${p.path}`;
      const exBefore = exceptions.length;
      const ceBefore = consoleErrors.length;
      await send('Page.navigate', { url: `${base}${p.path}` });
      await sleep(6000);
      const state = await evalJs(`({
        href: location.href,
        rootTextLen: document.querySelector('#root')?.innerText?.length ?? 0,
        hitErrorBoundary: /出错了|ErrorBoundary|应用发生错误|randomUUID is not a function/i.test(document.body?.innerText ?? ''),
        anchorsHit: ${JSON.stringify(p.anchors)}.filter((a) => (document.body?.innerText ?? '').includes(a)),
        clientId: window.localStorage.getItem('philia.sseClientId'),
        bodySnippet: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 160),
      })`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`shots-b92/${p.shot}.png`, Buffer.from(shot.data, 'base64'));
      const newEx = exceptions.length - exBefore;
      const newCe = consoleErrors.length - ceBefore;
      const ok =
        ctx.isSecureContext === false &&
        ctx.hasRandomUUID === false &&
        login.status === 200 &&
        !state.hitErrorBoundary &&
        state.rootTextLen > 30 &&
        state.anchorsHit.length > 0 &&
        typeof state.clientId === 'string' &&
        state.clientId.length === 36 &&
        newEx === 0 &&
        newCe === 0;
      ok ? passCount++ : failCount++;
      console.log(`${ok ? 'PAGE ✅' : 'PAGE ❌'} [${app}] ${p.path}`, JSON.stringify({ ...state, newExceptions: newEx, newConsoleErrors: newCe }));
    }
  }

  console.log('EXCEPTIONS', JSON.stringify(exceptions));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  const pass = failCount === 0 && exceptions.length === 0 && consoleErrors.length === 0;
  console.log(pass ? `RESULT PASS ✅ 非安全上下文 8/8 页渲染不崩（safeUuid 全量兜底生效）` : `RESULT FAIL ❌ pass=${passCount} fail=${failCount}`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('DRIVER ERROR', e);
  process.exit(2);
});
