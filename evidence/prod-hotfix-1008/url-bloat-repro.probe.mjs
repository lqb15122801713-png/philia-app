/* 轮询 URL 膨胀复现探针 v2：owner 手机直登 + CDP 拦 /api/events（SSE 断=生产 CORS 形态）
 * → 兜底轮询全开，75s 盯全部 trpc/api 请求 URL 长度/段数演化。
 * 用法：node url-bloat-repro2.mjs */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CDP_PORT = 9346;
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profileDir = join(tmpdir(), `philia-bloat2-${process.pid}`);
let browser = null;
process.on('exit', () => {
  if (browser?.pid) spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
});

browser = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  try { const t = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json(); wsUrl = t.find((x) => x.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(500);
}
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const urls = [];
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent') {
    const u = m.params.request?.url ?? '';
    if (u.includes('/trpc') || u.includes('/api/')) urls.push({ t: Date.now(), len: u.length, url: u.slice(0, 400) });
  }
};
await new Promise((r) => (ws.onopen = r));
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
/* SSE 断=生产形态：/api/events 拦死（CORS/404 等价物） */
await send('Network.setBlockedURLs', { urls: ['*://localhost:7200/api/events*'] });
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

await send('Page.navigate', { url: 'http://localhost:7101/' });
await sleep(1500);
const loginStatus = await evalJs(`fetch('http://localhost:7200/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '13900000001' }), credentials: 'include' }).then((r) => r.status).catch(() => 0)`);
console.log('login status=', loginStatus);
await send('Page.navigate', { url: 'http://localhost:7101/dashboard' });
await sleep(3000);
const who = await evalJs(`fetch('http://localhost:7200/trpc/auth.me', { credentials: 'include' }).then((r) => r.status).catch(() => 0)`);
console.log('auth.me status=', who);
console.log('盯 75s（SSE 拦死，兜底轮询全开）…');
await sleep(75000);
const series = [];
for (const u of urls) if (u.url.includes('/trpc/')) series.push({ len: u.len, path: u.url.split('?')[0] });
writeFileSync('E:/KIMI code/tmp/url-bloat.json', JSON.stringify({ total: urls.length, series }, null, 2));
console.log(`total=${urls.length} trpc=${series.length}`);
const lens = series.map((s) => s.len);
console.log('len min/max:', Math.min(...lens), Math.max(...lens));
console.log('last 3:', series.slice(-3).map((s) => `${s.len} ${s.path.slice(0, 200)}`).join('\n'));
process.exit(0);
