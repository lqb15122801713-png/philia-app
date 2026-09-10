// B8 证据驱动通用 CDP 封装（Edge headless，9223）—— 证据脚本，不入库
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9223;
export const API = 'http://localhost:7200';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cdp {
  constructor() { this.browser = null; this.ws = null; this.id = 0; this.pending = new Map(); this.consoleLogs = []; this.netFails = []; }

  async launch(width = 390, height = 844, mobile = true) {
    this.profileDir = resolve(tmpdir(), `b8-cdp-${process.pid}`);
    this.browser = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${this.profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });
    let targets = null;
    for (let i = 0; i < 40; i++) {
      try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
      await sleep(500);
    }
    const page = targets.find((t) => t.type === 'page');
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { const p = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ');
        this.consoleLogs.push(`[${msg.params.type}] ${text}`);
      }
      if (msg.method === 'Network.loadingFailed') this.netFails.push(JSON.stringify(msg.params));
      if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400) {
        this.consoleLogs.push(`[net ${msg.params.response.status}] ${msg.params.response.url}`);
      }
    };
    await new Promise((r) => (this.ws.onopen = r));
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const mid = ++this.id;
      this.pending.set(mid, { res, rej });
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面内脚本异常: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  }

  async nav(url, waitMs = 2500) { await this.send('Page.navigate', { url }); await sleep(waitMs); }

  async shot(file) {
    mkdirSync(resolve(file, '..'), { recursive: true });
    const s = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(s.data, 'base64'));
    console.log('saved', file);
  }

  /** 等选择器出现 */
  async waitFor(sel, tries = 20) {
    for (let i = 0; i < tries; i++) {
      const ok = await this.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
      if (ok) return true;
      await sleep(500);
    }
    return false;
  }

  async loginAs(userId) {
    return this.eval(`fetch('${API}/api/auth/dev-login', { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({ userId: '${userId}' }), credentials: 'include' }).then(r => r.status)`);
  }

  async seedUsers() {
    const res = await fetch(`${API}/api/auth/dev-seed-users`);
    return (await res.json()).users;
  }

  close() {
    try { this.ws?.close(); } catch {}
    if (this.browser?.pid) spawnSync('taskkill', ['/PID', String(this.browser.pid), '/T', '/F'], { stdio: 'ignore' });
    try { rmSync(this.profileDir, { recursive: true, force: true }); } catch {}
  }
}
