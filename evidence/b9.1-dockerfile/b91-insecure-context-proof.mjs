#!/usr/bin/env node
/**
 * 批次 9a.1 任务 D 实证驱动：HTTP 非 localhost（非安全上下文）打开客户端 /home
 * 验证 crypto.randomUUID 崩溃已修复（safeUuid 兜底）。
 *
 * 前置：customer dev server --host 0.0.0.0:7100、server:7200、Edge CDP 9223 已起。
 * 用法：node b91-insecure-context-proof.mjs <lanIp> <outPng>
 * 输出：JSON 结果行（console.error 收集、异常事件、页面状态断言）+ 截图。
 */
import { writeFileSync } from 'node:fs';

const [lanIp, outPng] = process.argv.slice(2);
// 走 server 静态托管（SERVE_STATIC=1）同源部署形态——与 VPS 完全一致：
// 页面与 /api、/trpc 同 host:port，无跨域/跨站 cookie 问题
const BASE = `http://${lanIp}:7200`;
const API = ''; // 同源相对路径
const DEBUG_PORT = 9223;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exceptions = [];
const consoleErrors = [];

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
  const r = await send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(`evalJs 异常: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
  return r.result?.value;
}

async function main() {
  // 连 Edge CDP
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
      exceptions.push(JSON.stringify(msg.params.exceptionDetails).slice(0, 400));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  // 0) 安全上下文确认：http://<LAN-IP> 下 crypto.randomUUID 应为 undefined（非安全上下文实证前提）
  await send('Page.navigate', { url: `${BASE}/dev-login` });
  await sleep(3000);
  const ctx = await evalJs(`({
    href: location.href,
    isSecureContext: window.isSecureContext,
    hasRandomUUID: typeof window.crypto?.randomUUID === 'function',
  })`);
  console.log('CONTEXT', JSON.stringify(ctx));

  // 1) dev-login（同源相对路径，cookie 落在部署域）
  const login = await evalJs(`(async () => {
    const seeds = await (await fetch('${API}/api/auth/dev-seed-users')).json();
    const cust = seeds.users.find(u => u.roles.includes('customer'));
    const res = await fetch('${API}/api/auth/dev-login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: cust.id }),
    });
    return { status: res.status, user: cust.nickname };
  })()`);
  console.log('LOGIN', JSON.stringify(login));

  // 2) 导航 /home（批次 9a 崩溃现场路由）
  await send('Page.navigate', { url: `${BASE}/home` });
  await sleep(6000);
  const state = await evalJs(`({
    href: location.href,
    rootTextLen: document.querySelector('#root')?.innerText?.length ?? 0,
    hitErrorBoundary: /出错了|ErrorBoundary|应用发生错误|randomUUID is not a function/i.test(document.body?.innerText ?? ''),
    hasRandomUUIDNow: typeof window.crypto?.randomUUID === 'function',
    clientIdStored: window.localStorage.getItem('philia.sseClientId'),
    bodySnippet: (document.body?.innerText ?? '').slice(0, 200),
  })`);
  console.log('HOME_STATE', JSON.stringify(state, null, 2));

  // 3) 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outPng, Buffer.from(shot.data, 'base64'));

  const uuidCrash = exceptions.some((e) => /randomUUID/i.test(e)) || consoleErrors.some((e) => /randomUUID/i.test(e));
  const pass =
    ctx.isSecureContext === false &&
    ctx.hasRandomUUID === false &&
    login.status === 200 &&
    !state.hitErrorBoundary &&
    state.rootTextLen > 50 &&
    !uuidCrash &&
    typeof state.clientIdStored === 'string' &&
    state.clientIdStored.length === 36;
  console.log('EXCEPTIONS', JSON.stringify(exceptions));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  console.log(pass ? 'RESULT PASS ✅ 非安全上下文 /home 不崩（safeUuid 兜底生效）' : 'RESULT FAIL ❌');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('DRIVER ERROR', e);
  process.exit(2);
});
