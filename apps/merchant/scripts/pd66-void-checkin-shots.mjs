#!/usr/bin/env node
/**
 * PD-66（NO-VOID-ENTRY-ON-MERCHANT-UI）撤核销入口 · 实尺截图 + 接口实证
 *
 * 口径（学 u6-merchant-desk-shots.mjs）：
 * - 真实链路：dev 库既有 in_service 夹具（pd66EvidenceFixture.ts 造，create→checkin 真核销）；
 *   浏览器内 dev-login 店主（cookie 入浏览器档案）→ 预约详情页真渲染。
 * - MODE=before：基线 UI（无撤核销入口）——详情页 in_service 动作区仅「服务监视」，
 *   断言 [data-testid="detail-void-checkin"] 缺席（缺陷实尺）。
 * - MODE=after：修后 UI——入口可见；真点「撤核销」→ window.confirm 二次闸自动接受 →
 *   断言状态离开 in_service 回 confirmed + 入口消失（幂等，confirmed 态不再显示）。
 * - api-check.json：tRPC appointment.voidCheckin 实测（再核销后二次撤回），
 *   请求/响应/前后状态全留痕。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 视口 1280×800（对齐 pd62 卷宗帧）。前置：本窗 server（7200）+ merchant vite（7101）已起。
 *
 * 用法：
 *   MODE=before node apps/merchant/scripts/pd66-void-checkin-shots.mjs
 *   MODE=after  node apps/merchant/scripts/pd66-void-checkin-shots.mjs
 * 环境变量：MERCHANT_URL / API_BASE / CDP_PORT / OUT_DIR / APPT_ID / HEADFUL=1。
 * 退出码：0=截图落盘且断言全绿；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODE = process.env.MODE ?? 'after';
const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9266);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd66-void-redeem-entry');
const APPT_ID = process.env.APPT_ID ?? '01M5F37SZF3PR97XZ5Z5GCHTZM';
const NAV_WAIT = 4200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

let failures = 0;
const results = [];
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  results.push({ ok, name, detail });
  if (!ok) failures += 1;
};

/* ---- tRPC HTTP（batch=1 + superjson 线格式） ---- */
function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    throw new Error(`${name} 失败：${e?.message ?? JSON.stringify(e)}`);
  }
  return first?.result?.data?.json;
}
async function trpcQuery(cookie, path, input) {
  const payload = encodeURIComponent(JSON.stringify({ '0': { json: input ?? null } }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutateRaw(cookie, path, input) {
  const body = { '0': { json: input ?? null } };
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { httpStatus: res.status, body: await res.json() };
}
async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

/* ---- CDP 最小幅（导航/求值/截图 + JS 对话框自动接受） ---- */
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.dialogSeen = 0; }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); return; }
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.dialogSeen += 1;
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
    };
    await new Promise((r) => { this.ws.onopen = r; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const mid = ++this.id;
      this.pending.set(mid, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
      this.ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r?.result?.value;
  }
  async goto(url, waitMs = NAV_WAIT) {
    await this.send('Page.navigate', { url });
    await sleep(waitMs);
  }
  async waitFor(expression, timeoutMs = 60000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(500);
    }
  }
  async viewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }
  async shot(outfile) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(outfile), { recursive: true });
    writeFileSync(outfile, Buffer.from(shot.data, 'base64'));
    console.log(`  📸 ${outfile}`);
  }
  close() { try { this.ws?.close(); } catch {} }
}

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  const profile = join(tmpdir(), `pd66-void-checkin-${Date.now()}`);
  const args = [
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ];
  if (process.env.HEADFUL !== '1') args.push('--headless=new');
  const browser = spawn(BROWSER, args, { stdio: 'ignore' });
  const cleanup = () => { try { browser.kill(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} };
  process.on('exit', cleanup);

  let pageTarget = null;
  for (let i = 0; i < 40 && !pageTarget; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
      pageTarget = await res.json();
    } catch { await sleep(400); }
  }
  if (!pageTarget?.webSocketDebuggerUrl) { console.error('CDP 页签创建失败'); process.exit(2); }

  const cdp = new Cdp(pageTarget.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.viewport(1280, 800, false);

  /* ---- 种子账号 + 浏览器内登录店主 ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const ownerUserId = seed.users.find((u) => u.nickname === '菲丽亚店主')?.id;
  const frontdeskUserId = seed.users.find((u) => u.nickname === '小美')?.id;
  const customerUserId = seed.users.find((u) => u.roles?.includes('customer'))?.id;
  if (!ownerUserId || !frontdeskUserId || !customerUserId) { console.error('种子账号不全'); process.exit(2); }
  const merchantCookie = await devLogin(ownerUserId);
  const frontdeskCookie = await devLogin(frontdeskUserId);
  const customerCookie = await devLogin(customerUserId);

  await cdp.goto(`${MERCHANT_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const loginStatus = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${ownerUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(loginStatus === 200, '浏览器 dev-login（店主）', `HTTP ${loginStatus}`);

  if (MODE === 'before') {
    /* ---- before：基线 UI——in_service 详情动作区无撤核销入口（缺陷实尺） ---- */
    await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_ID}`);
    await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
    const before = await cdp.eval(`({
      monitor: !!document.querySelector('[data-testid="detail-monitor"]'),
      voidEntry: !!document.querySelector('[data-testid="detail-void-checkin"]'),
      statusText: document.body.innerText.includes('服务中'),
    })`);
    note(before.monitor && before.statusText, 'before：in_service 详情渲染（服务监视可见）', JSON.stringify(before));
    note(before.voidEntry === false, 'before：无撤核销入口（NO-VOID-ENTRY-ON-MERCHANT-UI 缺陷实尺）', `voidEntry=${before.voidEntry}`);
    await cdp.shot(join(OUT_DIR, 'before', 'detail-1280x800.png'));
  } else {
    /* ---- after①：入口可见（构造 in_service 夹具，断言入口可见） ---- */
    await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_ID}`);
    await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
    const after1 = await cdp.eval(`({
      voidEntry: !!document.querySelector('[data-testid="detail-void-checkin"]'),
      voidText: document.body.innerText.includes('撤核销'),
    })`);
    note(after1.voidEntry && after1.voidText, 'after：in_service 详情「撤核销」入口可见', JSON.stringify(after1));
    await cdp.shot(join(OUT_DIR, 'after', 'detail-1280x800-entry.png'));

    /* ---- after②：真点入口 → confirm 二次闸（自动接受）→ 状态离开 in_service ---- */
    const statusBefore = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_ID }))?.appointment?.status;
    await cdp.eval(`document.querySelector('[data-testid="detail-void-checkin"]')?.click()`);
    await sleep(2500);
    await cdp.waitFor(`!document.querySelector('[data-testid="detail-void-checkin"]')`, 15000);
    const after2 = await cdp.eval(`({
      voidEntryGone: !document.querySelector('[data-testid="detail-void-checkin"]'),
      confirmedText: document.body.innerText.includes('已确认'),
    })`);
    const apptAfter = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_ID }))?.appointment;
    note(cdp.dialogSeen >= 1, 'after：二次确认闸出现并已接受（window.confirm）', `dialogSeen=${cdp.dialogSeen}`);
    note(
      after2.voidEntryGone && apptAfter?.status === 'confirmed' && apptAfter?.checkedInAt === null,
      'after：执行后状态离开 in_service → confirmed（入口随之消失）',
      JSON.stringify({ statusBefore, statusAfter: apptAfter?.status, checkedInAt: apptAfter?.checkedInAt, ...after2 }),
    );
    await cdp.shot(join(OUT_DIR, 'after', 'detail-1280x800-voided.png'));

    /* ---- api-check：再核销 → tRPC voidCheckin 二次撤回（接口证） ---- */
    const codeRes = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: APPT_ID });
    const recheckin = await trpcMutateRaw(frontdeskCookie, 'appointment.checkin', { code: codeRes?.code });
    const st2 = recheckin.body?.[0]?.result?.data?.json?.appointment?.status;
    const before2 = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_ID }))?.appointment;
    const voidRes = await trpcMutateRaw(merchantCookie, 'appointment.voidCheckin', { appointmentId: APPT_ID });
    const afterApi = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_ID }))?.appointment;
    const voidJson = voidRes.body?.[0]?.result?.data?.json;
    note(
      st2 === 'in_service' && voidJson?.appointment?.status === 'confirmed' && afterApi?.status === 'confirmed',
      'api-check：再核销 → voidCheckin → confirmed（接口实测）',
      JSON.stringify({ reCheckin: st2, voidStatus: voidJson?.appointment?.status, idempotent: voidJson?.idempotent }),
    );
    writeFileSync(
      join(OUT_DIR, 'api-check.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          source: 'pd66-void-checkin-shots.mjs（本窗 server:7200 + dev 库真链路）',
          appointmentId: APPT_ID,
          steps: {
            reCheckin: { httpStatus: recheckin.httpStatus, status: st2 },
            before: { status: before2?.status, checkedInAt: before2?.checkedInAt },
            voidCheckin: { httpStatus: voidRes.httpStatus, response: voidJson ?? voidRes.body },
            after: { status: afterApi?.status, checkedInAt: afterApi?.checkedInAt },
          },
          checks: {
            entryVisible: after1.voidEntry === true,
            confirmDialog: cdp.dialogSeen >= 1,
            leftInService: apptAfter?.status === 'confirmed' && afterApi?.status === 'confirmed',
            checkedInAtCleared: afterApi?.checkedInAt === null,
          },
        },
        null,
        2,
      ),
    );
    console.log(`  🧾 ${join(OUT_DIR, 'api-check.json')}`);
  }

  writeFileSync(
    join(OUT_DIR, MODE === 'before' ? 'before' : 'after', `pd66-${MODE}-gate.log.json`),
    JSON.stringify({ mode: MODE, at: new Date().toISOString(), results }, null, 2),
  );
  cdp.close();
  console.log(failures === 0 ? `\nPD-66 ${MODE} 截图+断言全绿 ✅` : `\n${failures} 项失败 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
