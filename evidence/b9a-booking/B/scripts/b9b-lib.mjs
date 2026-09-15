/**
 * B9a 任务 B 验收 CDP 工具库（连接已启动的 Edge :9223）。
 * 用法：import { connectCdp, loginAsCustomer, shot, dumpText } from './b9b-lib.mjs'
 */
import { writeFileSync } from 'node:fs';

const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9223);
export const API = process.env.API_BASE ?? 'http://localhost:7200';
export const APP = process.env.CUSTOMER_URL ?? 'http://localhost:7100';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectCdp() {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      targets = await res.json();
      // 特殊页（edge://sync-confirmation 等）不响应 CDP 命令，须选普通 http/about 页
      if (targets.some((t) => t.type === 'page' && /^(https?:|about:)/.test(t.url))) break;
    } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page' && /^(https?:|about:)/.test(t.url));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    events.push(msg);
  };
  await new Promise((r, rej) => {
    ws.onopen = r;
    ws.onerror = rej;
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.setBypassServiceWorker', { bypass: true });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    }
    return r.result.value;
  };
  return { send, evalJs, events, ws };
}

/** 登录种子客户（roles 含 customer 的首个用户）；需先导航到应用源（about:blank 不透明源跨域 fetch 被拦） */
export async function loginAsCustomer(evalJs, send) {
  if (send) {
    await send('Page.navigate', { url: `${APP}/dev-login` });
    await sleep(1500);
  }
  const users = await evalJs(
    `fetch('${API}/api/auth/dev-seed-users').then(r=>r.json()).then(d=>d.users)`,
  );
  const customer = users.find((u) => (u.roles ?? []).includes('customer')) ?? users[0];
  const status = await evalJs(
    `fetch('${API}/api/auth/dev-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:'${customer.id}'}),credentials:'include'}).then(r=>r.status)`,
  );
  if (status !== 200) throw new Error(`dev-login HTTP ${status}`);
  return customer;
}

export async function shot(send, outfile) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(outfile, Buffer.from(s.data, 'base64'));
  console.log('saved', outfile);
}

/** 等待表达式为真（轮询） */
export async function waitFor(evalJs, expr, timeoutMs = 15000, step = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalJs(expr).catch(() => false);
    if (v) return true;
    await sleep(step);
  }
  return false;
}
