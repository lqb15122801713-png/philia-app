/**
 * B2 批次验收共享库：HTTP tRPC（superjson）+ dev 登录 + Edge CDP 封装。
 * 仅用于 evidence 脚本，不入库。
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

export const API = 'http://localhost:7200';
export const DEBUG_PORT = 9223;
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
export const EDGE = EDGE_CANDIDATES.find((p) => existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- dev 登录（roles 动态匹配，禁止硬编码 ULID） ---------------- */

export async function seedUsers() {
  const res = await fetch(`${API}/api/auth/dev-seed-users`);
  if (!res.ok) throw new Error(`dev-seed-users HTTP ${res.status}`);
  return (await res.json()).users ?? [];
}

export async function findUser(role) {
  const users = await seedUsers();
  const u = users.find((x) => (x.roles ?? []).includes(role));
  if (!u) throw new Error(`dev-seed-users 中无 roles 含 ${role} 的用户: ${JSON.stringify(users)}`);
  return u;
}

/** 返回 cookie 头（name=value） */
export async function login(userId) {
  const res = await fetch(`${API}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (res.status !== 200) throw new Error(`dev-login HTTP ${res.status}`);
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
}

/* ---------------- tRPC over superjson ---------------- */

function unwrap(body, proc) {
  const first = Array.isArray(body) ? body[0] : body;
  if (first?.error) throw new Error(`${proc} -> ${JSON.stringify(first.error)}`);
  return first?.result?.data?.json;
}

export async function trpcQuery(proc, input, cookie) {
  const q = encodeURIComponent(JSON.stringify({ '0': { json: input ?? null } }));
  const res = await fetch(`${API}/trpc/${proc}?batch=1&input=${q}`, {
    headers: cookie ? { cookie } : {},
  });
  return unwrap(await res.json(), proc);
}

/** dateKeys: 需要 superjson Date meta 的字段名 */
export async function trpcMutate(proc, input, cookie, dateKeys = []) {
  const cell = { json: input };
  if (dateKeys.length) {
    cell.meta = { values: Object.fromEntries(dateKeys.map((k) => [k, ['Date']])) };
  }
  const res = await fetch(`${API}/trpc/${proc}?batch=1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ '0': cell }),
  });
  return unwrap(await res.json(), proc);
}

/* ---------------- Edge CDP ---------------- */

export class Browser {
  constructor() {
    this.chrome = null;
    this.profileDir = resolve(tmpdir(), `philia-b2-cdp-${process.pid}`);
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async launch() {
    if (!EDGE) throw new Error('未找到 Edge 可执行文件');
    this.chrome = spawn(EDGE, [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${this.profileDir}`,
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
    if (!targets?.length) throw new Error('Edge CDP 未就绪');
    const page = targets.find((t) => t.type === 'page');
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      }
    };
    await new Promise((r) => (this.ws.onopen = r));
    await this.send('Page.enable');
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const mid = ++this.id;
      this.pending.set(mid, { res, rej });
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }

  async viewport(w, h, mobile = true) {
    await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  }

  async goto(url, waitMs = 3000) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`页面内脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
    }
    return r.result.value;
  }

  /** 页面内 dev-login（带 cookie 会话） */
  async loginInPage(userId) {
    return this.eval(`fetch('${API}/api/auth/dev-login', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ userId: '${userId}' }), credentials: 'include'
    }).then(r => r.status)`);
  }

  async shot(outfile) {
    mkdirSync(dirname(outfile), { recursive: true });
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log('saved', outfile);
  }

  close() {
    try { this.ws?.close(); } catch {}
    if (this.chrome?.pid) {
      spawnSync('taskkill', ['/PID', String(this.chrome.pid), '/T', '/F'], { stdio: 'ignore' });
      this.chrome = null;
    }
    try { rmSync(this.profileDir, { recursive: true, force: true }); } catch {}
  }
}
