// B9A 任务 E 取证脚本（临时，不入库）：
// 对三端执行 dev-login → 导航到注入页（?crash=1）→ 截图 + 抓取 #root 状态/页面文本。
// 用法：node cdp-crash-test.mjs <mode>   mode = repro | verify
// 前置：三端 vite dev + server dev 已起；Edge 以 --remote-debugging-port=9223 自起。
import { writeFileSync } from 'node:fs';

const DEBUG_PORT = 9223;
const API = 'http://localhost:7200';
const mode = process.argv[2] ?? 'repro';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { app: 'customer', base: 'http://localhost:7100', url: 'http://localhost:7100/appointments?crash=1', home: '/home', role: 'customer' },
  { app: 'merchant', base: 'http://localhost:7101', url: 'http://localhost:7101/appointments?crash=1', home: '/dashboard', role: 'merchant_owner' },
  { app: 'staff', base: 'http://localhost:7102', url: 'http://localhost:7102/execute/b9a-e-fake-appt?crash=1', home: '/today', role: 'staff' },
];

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
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params }));
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
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return { __error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? '') };
    return r.result?.value;
  };

  const report = {};
  for (const c of CASES) {
    // 1) 登录：取种子用户 → dev-login（cookie 为 localhost 域，跨端口共享）
    await send('Page.navigate', { url: c.base + '/dev-login' });
    await sleep(2000);
    const login = await evalJs(`(async () => {
      const seed = await fetch('${API}/api/auth/dev-seed-users').then(r => r.json());
      const users = seed.users ?? seed;
      const u = users.find(x => (x.roles ?? []).includes('${c.role}')) ?? users[0];
      const res = await fetch('${API}/api/auth/dev-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ userId: u.id }),
      });
      return { status: res.status, user: u.id, roles: u.roles };
    })()`);
    // 2) 导航到注入页
    await send('Page.navigate', { url: c.url });
    await sleep(3500);
    const state = await evalJs(`(() => {
      const root = document.getElementById('root');
      return {
        path: location.pathname + location.search,
        rootLen: root ? root.innerHTML.length : -1,
        bodyText: document.body.innerText.slice(0, 300),
      };
    })()`);
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`${mode}-${c.app}-crash.png`, Buffer.from(shot1.data, 'base64'));
    report[c.app] = { login, state };

    if (mode === 'verify') {
      // 3) 重试恢复：先用 history.replaceState 摘掉 crash 触发参数（模拟瞬时错误不再复现），
      //    再点「重试」→ 断言页面恢复正常渲染
      await evalJs(`history.replaceState(null, '', location.pathname)`);
      const retry = await evalJs(`(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find(x => x.textContent.includes('重试'));
        if (b) { b.click(); return true; }
        return false;
      })()`);
      await sleep(2500);
      const afterRetry = await evalJs(`(() => ({
        path: location.pathname + location.search,
        rootLen: document.getElementById('root')?.innerHTML.length ?? -1,
        bodyText: document.body.innerText.slice(0, 200),
      }))()`);
      const shot2 = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${mode}-${c.app}-retry.png`, Buffer.from(shot2.data, 'base64'));

      // 4) 再次导航带 crash=1 → 出错页再现 → 点「回首页」→ 断言落在首页路由
      await send('Page.navigate', { url: c.url });
      await sleep(3000);
      const homeBtn = await evalJs(`(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find(x => x.textContent.includes('回首页'));
        if (b) { b.click(); return 'clicked'; }
        return 'absent';
      })()`);
      await sleep(2500);
      const afterHome = await evalJs(`(() => ({ path: location.pathname + location.search }))()`);
      const shot3 = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${mode}-${c.app}-home.png`, Buffer.from(shot3.data, 'base64'));
      report[c.app].retry = { retry, afterRetry, homeBtn, afterHome, expectHome: c.home };
    }
  }
  writeFileSync(`${mode}-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
