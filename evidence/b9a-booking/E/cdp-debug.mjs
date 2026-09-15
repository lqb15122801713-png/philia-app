// 调试2：登录后导航 crash 页，捕获 console/异常
const DEBUG_PORT = 9223;
const API = 'http://localhost:7200';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  let targets;
  for (let i = 0; i < 30; i++) {
    try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const logs = [];
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    if (msg.method === 'Runtime.consoleAPICalled') logs.push(msg.params.type + ': ' + msg.params.args.map(a => (a.value ?? a.description ?? '') + '').join(' ').slice(0, 300));
    if (msg.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text ?? '').slice(0, 500));
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Runtime.enable'); await send('Page.enable');
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    return r.exceptionDetails ? { __err: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text } : r.result?.value;
  };
  await send('Page.navigate', { url: 'http://localhost:7100/dev-login' });
  await sleep(2500);
  const login = await evalJs(`(async () => {
    const seed = await fetch('${API}/api/auth/dev-seed-users').then(r => r.json());
    const users = seed.users ?? seed;
    const u = users.find(x => (x.roles ?? []).includes('customer')) ?? users[0];
    const res = await fetch('${API}/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ userId: u.id }) });
    return res.status;
  })()`);
  console.log('LOGIN:', login);
  logs.length = 0;
  await send('Page.navigate', { url: 'http://localhost:7100/appointments?crash=1' });
  await sleep(4500);
  const state = await evalJs(`JSON.stringify({path: location.pathname + location.search, rootLen: document.getElementById('root')?.innerHTML.length ?? -1, txt: document.body.innerText.slice(0,120)})`);
  console.log('STATE:', state);
  console.log('LOGS:', JSON.stringify(logs.slice(0, 25), null, 1));
  ws.close(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
