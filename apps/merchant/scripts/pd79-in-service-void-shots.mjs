#!/usr/bin/env node
/**
 * PD-79（服务中撤单／撤核销入口）实尺截图 + 接口实证
 *
 * 口径（学 pd66-void-checkin-shots.mjs）：
 * - 真实链路：pd79EvidenceFixture.ts 经 router 造三张 in_service 夹具（A=撤核销正例 /
 *   B=撤单正例 / C=涉钱 mock paidAt）；浏览器内 dev-login 店主（敏慧人设=种子「菲丽亚店主」）
 *   → 预约详情页真渲染真点击。
 * - 断言：A/B 详情动作区「撤核销」「撤单」双入口可见；点开=二次确认弹层（Modal），
 *   原因空=确认钮禁用（必填闸）；填原因确认后 A→confirmed（可再核销）、B→cancelled
 *   （取消信息行透出「商家撤单：原因」）；C（涉钱）双入口同隐。
 * - 员工端反证（潘婧人设=前台种子「小美」）：staff app 订单视图渲染，全屏无撤单/撤核销
 *   入口（testid 缺席 + 文案缺席）；server 侧 staff 角色调双端点 403（api-check 留痕）。
 * - api-check.json：缺 reason 400 / 涉钱 400×2 / staff 403×2 / 重复撤单 400 / 再核销后
 *   voidCheckin 接口撤回 200 全留痕。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。视口 1280×800。
 * - 前置：本窗 server（7200）+ merchant vite（7101）+ staff vite（7102）已起；夹具已造。
 *
 * 用法：APPT_VOID=.. APPT_CANCEL=.. APPT_MONEY=.. node apps/merchant/scripts/pd79-in-service-void-shots.mjs
 * 环境变量：MERCHANT_URL / STAFF_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=截图落盘且断言全绿；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MERCHANT_URL = (process.env.MERCHANT_URL ?? 'http://localhost:7101').replace(/\/$/, '');
const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7102').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7200').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9267);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_DIR = process.env.OUT_DIR ?? join(REPO_ROOT, 'evidence', 'pd79-in-service-void-entry');
const APPT_VOID = process.env.APPT_VOID ?? '';
const APPT_CANCEL = process.env.APPT_CANCEL ?? '';
const APPT_MONEY = process.env.APPT_MONEY ?? '';
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
const errOf = (raw) => {
  const e = raw.body?.[0]?.error?.json ?? raw.body?.[0]?.error;
  return { httpStatus: raw.httpStatus, code: e?.data?.code ?? e?.code, message: e?.message };
};
async function devLogin(userId) {
  const res = await fetch(`${API_BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

/* ---- CDP 最小幅（导航/求值/截图） ---- */
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
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
    if (r?.exceptionDetails) throw new Error(`eval 失败：${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
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

/** React 受控 textarea 填值（native setter + input 事件） */
const fillReason = (text) => `(() => {
  const ta = document.querySelector('[data-testid="void-reason-input"]');
  if (!ta) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, ${JSON.stringify(text)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  if (!APPT_VOID || !APPT_CANCEL || !APPT_MONEY) { console.error('缺 APPT_VOID / APPT_CANCEL / APPT_MONEY 夹具 id'); process.exit(2); }
  const profile = join(tmpdir(), `pd79-void-entry-${Date.now()}`);
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

  /* ---- 种子账号（人设映射：敏慧=merchant_owner 种子「菲丽亚店主」；潘婧=前台种子「小美」） ---- */
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
  note(loginStatus === 200, '浏览器 dev-login（店主·敏慧人设）', `HTTP ${loginStatus}`);

  /* ---- ① A 单（撤核销正例）：双入口可见 → 弹层必填闸 → 撤核销 → confirmed ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_VOID}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const entryA = await cdp.eval(`({
    voidEntry: !!document.querySelector('[data-testid="detail-void-checkin"]'),
    cancelEntry: !!document.querySelector('[data-testid="detail-merchant-cancel"]'),
    serving: document.body.innerText.includes('服务中'),
  })`);
  note(entryA.voidEntry && entryA.cancelEntry && entryA.serving, 'A：in_service 详情「撤核销」「撤单」双入口可见', JSON.stringify(entryA));
  await cdp.shot(join(OUT_DIR, 'after', 'detail-A-entries.png'));

  await cdp.eval(`document.querySelector('[data-testid="detail-void-checkin"]')?.click()`);
  await sleep(1200);
  const modalA = await cdp.eval(`({
    reasonInput: !!document.querySelector('[data-testid="void-reason-input"]'),
    confirmDisabled: document.querySelector('[data-testid="void-confirm"]')?.disabled ?? null,
    bodyHasReasonLabel: document.body.innerText.includes('原因（必填'),
  })`);
  note(modalA.reasonInput && modalA.confirmDisabled === true && modalA.bodyHasReasonLabel,
    'A：撤核销二次确认弹层（原因空=确认钮禁用·必填闸）', JSON.stringify(modalA));
  await cdp.shot(join(OUT_DIR, 'after', 'detail-A-void-modal-empty.png'));

  await cdp.eval(fillReason('误核销，客户实际未到店'));
  await sleep(600);
  const modalA2 = await cdp.eval(`({
    confirmEnabled: document.querySelector('[data-testid="void-confirm"]')?.disabled === false,
  })`);
  note(modalA2.confirmEnabled, 'A：填原因后确认钮解禁', JSON.stringify(modalA2));
  await cdp.shot(join(OUT_DIR, 'after', 'detail-A-void-modal-filled.png'));
  await cdp.eval(`document.querySelector('[data-testid="void-confirm"]')?.click()`);
  await cdp.waitFor(`!document.querySelector('[data-testid="detail-void-checkin"]')`, 15000);
  const afterA = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_VOID }))?.appointment;
  note(
    afterA?.status === 'confirmed' && afterA?.checkedInAt === null,
    'A：撤核销执行 → confirmed + checkedInAt 清空（可再核销）',
    JSON.stringify({ status: afterA?.status, checkedInAt: afterA?.checkedInAt }),
  );
  await cdp.shot(join(OUT_DIR, 'after', 'detail-A-voided-confirmed.png'));

  /* ---- ② B 单（撤单正例）：弹层 → 撤单 → cancelled + 来源透出 ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_CANCEL}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const entryB = await cdp.eval(`({
    voidEntry: !!document.querySelector('[data-testid="detail-void-checkin"]'),
    cancelEntry: !!document.querySelector('[data-testid="detail-merchant-cancel"]'),
  })`);
  note(entryB.voidEntry && entryB.cancelEntry, 'B：in_service 详情双入口可见', JSON.stringify(entryB));
  await cdp.eval(`document.querySelector('[data-testid="detail-merchant-cancel"]')?.click()`);
  await sleep(1200);
  await cdp.eval(fillReason('客户爽约，门店主动撤单'));
  await sleep(600);
  await cdp.shot(join(OUT_DIR, 'after', 'detail-B-cancel-modal-filled.png'));
  await cdp.eval(`document.querySelector('[data-testid="void-confirm"]')?.click()`);
  // 轮询 API 等终态（UI  invalidate/SSE 有延迟，正文探测不稳），再截 cancelled 实尺
  let afterB = null;
  for (let i = 0; i < 40; i++) {
    afterB = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_CANCEL }))?.appointment;
    if (afterB?.status === 'cancelled') break;
    await sleep(500);
  }
  await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_CANCEL}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const cancelRowShown = await cdp.eval(`document.body.innerText.includes('商家撤单')`);
  note(
    afterB?.status === 'cancelled' && afterB?.cancelSource === 'merchant' && afterB?.cancelReason === '客户爽约，门店主动撤单' && cancelRowShown,
    'B：撤单执行 → cancelled（cancelSource=merchant）+ 详情透出「商家撤单：原因」',
    JSON.stringify({ status: afterB?.status, cancelSource: afterB?.cancelSource, cancelReason: afterB?.cancelReason, cancelRowShown }),
  );
  await cdp.shot(join(OUT_DIR, 'after', 'detail-B-cancelled.png'));

  /* ---- ③ C 单（涉钱 mock）：双入口同隐 ---- */
  await cdp.goto(`${MERCHANT_URL}/appointments/${APPT_MONEY}`);
  await cdp.waitFor(`document.querySelector('[data-testid="detail-flow"]')`);
  const entryC = await cdp.eval(`({
    voidEntry: !!document.querySelector('[data-testid="detail-void-checkin"]'),
    cancelEntry: !!document.querySelector('[data-testid="detail-merchant-cancel"]'),
    serving: document.body.innerText.includes('服务中'),
  })`);
  note(entryC.serving && !entryC.voidEntry && !entryC.cancelEntry, 'C：涉钱（已收银标记）in_service 单双入口同隐（另闸不放开）', JSON.stringify(entryC));
  await cdp.shot(join(OUT_DIR, 'after', 'detail-C-money-gated.png'));

  /* ---- ④ 员工端反证（潘婧人设·前台账号）：订单视图无撤单/撤核销入口 ---- */
  await cdp.goto(`${STAFF_URL}/dev-login`, 3200);
  await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
  const staffLogin = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: '${frontdeskUserId}' }), credentials: 'include',
  }).then((r) => r.status).catch(() => 0)`);
  note(staffLogin === 200, '员工端 dev-login（前台·潘婧人设）', `HTTP ${staffLogin}`);
  await cdp.goto(`${STAFF_URL}/today`);
  await sleep(2500);
  const staffView = await cdp.eval(`({
    voidTestid: !!document.querySelector('[data-testid="detail-void-checkin"]'),
    cancelTestid: !!document.querySelector('[data-testid="detail-merchant-cancel"]'),
    bodyHasVoidCopy: document.body.innerText.includes('撤核销') || document.body.innerText.includes('撤单'),
  })`);
  note(!staffView.voidTestid && !staffView.cancelTestid && !staffView.bodyHasVoidCopy,
    '员工端（潘婧）订单视图：撤单/撤核销入口零渲染（testid+文案双缺席）', JSON.stringify(staffView));
  await cdp.shot(join(OUT_DIR, 'after', 'staff-today-no-entry.png'));

  /* ---- ⑤ api-check：必填/涉钱/越权/重复 全留痕 + 再核销接口撤回 ---- */
  const noReason = await trpcMutateRaw(merchantCookie, 'appointment.merchantCancel', { appointmentId: APPT_VOID });
  const moneyVoid = await trpcMutateRaw(merchantCookie, 'appointment.voidCheckin', { appointmentId: APPT_MONEY, reason: '涉钱探测' });
  const moneyCancel = await trpcMutateRaw(merchantCookie, 'appointment.merchantCancel', { appointmentId: APPT_MONEY, reason: '涉钱探测' });
  const staffVoid = await trpcMutateRaw(frontdeskCookie, 'appointment.voidCheckin', { appointmentId: APPT_MONEY, reason: '越权探测' });
  const staffCancel = await trpcMutateRaw(frontdeskCookie, 'appointment.merchantCancel', { appointmentId: APPT_MONEY, reason: '越权探测' });
  const dupCancel = await trpcMutateRaw(merchantCookie, 'appointment.merchantCancel', { appointmentId: APPT_CANCEL, reason: '重复撤单探测' });
  // 再核销 A → voidCheckin 接口撤回（接口正例）
  const codeRes = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: APPT_VOID });
  const recheckin = await trpcMutateRaw(frontdeskCookie, 'appointment.checkin', { code: codeRes?.code });
  const reSt = recheckin.body?.[0]?.result?.data?.json?.appointment?.status;
  const voidApi = await trpcMutateRaw(merchantCookie, 'appointment.voidCheckin', { appointmentId: APPT_VOID, reason: 'api-check 接口撤回留痕' });
  const voidJson = voidApi.body?.[0]?.result?.data?.json;
  const afterApi = (await trpcQuery(merchantCookie, 'appointment.get', { appointmentId: APPT_VOID }))?.appointment;

  note(errOf(noReason).httpStatus === 400, 'api：merchantCancel 缺 reason → 400', JSON.stringify(errOf(noReason)));
  note(errOf(moneyVoid).httpStatus === 400 && /涉钱/.test(errOf(moneyVoid).message ?? ''), 'api：涉钱单 voidCheckin → 400 另闸', JSON.stringify(errOf(moneyVoid)));
  note(errOf(moneyCancel).httpStatus === 400 && /涉钱/.test(errOf(moneyCancel).message ?? ''), 'api：涉钱单 merchantCancel → 400 另闸', JSON.stringify(errOf(moneyCancel)));
  note(errOf(staffVoid).httpStatus === 403, 'api：员工（潘婧）voidCheckin → 403', JSON.stringify(errOf(staffVoid)));
  note(errOf(staffCancel).httpStatus === 403, 'api：员工（潘婧）merchantCancel → 403', JSON.stringify(errOf(staffCancel)));
  note(errOf(dupCancel).httpStatus === 400 && /不可撤单/.test(errOf(dupCancel).message ?? ''), 'api：重复撤单 → 400「不可撤单」', JSON.stringify(errOf(dupCancel)));
  note(reSt === 'in_service' && voidJson?.appointment?.status === 'confirmed' && afterApi?.status === 'confirmed',
    'api：再核销 → voidCheckin（带 reason）→ confirmed', JSON.stringify({ reSt, voidStatus: voidJson?.appointment?.status }));

  writeFileSync(
    join(OUT_DIR, 'api-check.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        source: 'pd79-in-service-void-shots.mjs（本窗 server:7200 + dev 库真链路）',
        personas: { merchant: '敏慧=种子「菲丽亚店主」(merchant_owner)', staff: '潘婧=前台种子「小美」(staff/frontdesk)' },
        fixtures: { voidTarget: APPT_VOID, cancelTarget: APPT_CANCEL, moneyMock: APPT_MONEY },
        steps: {
          A_voidedViaUi: { status: afterA?.status, checkedInAt: afterA?.checkedInAt },
          B_cancelledViaUi: { status: afterB?.status, cancelSource: afterB?.cancelSource, cancelReason: afterB?.cancelReason },
          api: {
            noReason400: errOf(noReason),
            moneyVoid400: errOf(moneyVoid),
            moneyCancel400: errOf(moneyCancel),
            staffVoid403: errOf(staffVoid),
            staffCancel403: errOf(staffCancel),
            dupCancel400: errOf(dupCancel),
            reCheckinThenVoid: { reStatus: reSt, voidStatus: voidJson?.appointment?.status, after: afterApi?.status },
          },
        },
        checks: Object.fromEntries(results.map((r) => [r.name, r.ok])),
      },
      null,
      2,
    ),
  );
  console.log(`  🧾 ${join(OUT_DIR, 'api-check.json')}`);

  writeFileSync(
    join(OUT_DIR, 'after', 'pd79-gate.log.json'),
    JSON.stringify({ at: new Date().toISOString(), results }, null, 2),
  );
  cdp.close();
  console.log(failures === 0 ? `\nPD-79 截图+断言全绿 ✅` : `\n${failures} 项失败 ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
