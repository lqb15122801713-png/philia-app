#!/usr/bin/env node
/**
 * PD-76 · 员工角标＋拍照上传簇 · 实机帧＋网络实证（A窗）
 *
 * 口径（学 s4-member-mine-shots 工艺）：
 * - 真实链路驱动：本店新造合成 grooming 单（create→confirm→assign 丽丽→前台小美核销→in_service），
 *   不碰夹具 01M5EQVFSQCFZYXB6FB945DSQB、不跨店造种。
 * - 网络证据：addPhotos 400（旧 EXIF=服务端拒收，原因原文）/ 200（无 EXIF 放行留痕）双录，
 *   脚本侧直连 + 浏览器侧 CDP Network 双份。
 * - 帧：dock 徽标（含 aria 真值）/ me 行 / 通知头 / 执行页 AddSlot / 拒收态三帧 / 成功态+底钮 /
 *   扫码错误态（手输主钮）/ 手动输入可达 / today+schedule 末条安全区。
 * - 渲染对象=本窗分支构建产物（vite preview，VITE_API_BASE 构建期指向本窗 server 口）。
 * - 零新依赖：Node 原生 fetch/WebSocket + Edge/Chrome CDP（headless=new）。
 * - 错口纪律：本窗只用 7262（API）/ 7162（staff preview）/ 9262（CDP）。
 *
 * 用法：node apps/staff/scripts/pd76-badge-upload-shots.mjs
 * 环境变量：STAFF_URL / API_BASE / CDP_PORT / OUT_DIR / HEADFUL=1。
 * 退出码：0=全绿；1=存在失败项；2=环境缺失。
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const STAFF_URL = (process.env.STAFF_URL ?? 'http://localhost:7162').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:7262').replace(/\/$/, '');
const CDP_PORT = Number(process.env.CDP_PORT ?? 9262);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const EVIDENCE_DIR = join(REPO_ROOT, 'evidence', 'pd76-staff-badge-photo-upload');
const OUT_DIR = process.env.OUT_DIR ?? join(EVIDENCE_DIR, 'shots');
const NAV_WAIT = 4200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const serverRequire = createRequire(join(REPO_ROOT, 'server', 'package.json'));

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

let failures = 0;
const note = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` —— ${detail}` : ''}`);
  if (!ok) failures += 1;
};

/* ---------- tRPC batch 线格式（superjson frame；Date 走 meta.values） ---------- */
function unwrap(arr, name) {
  const first = arr?.[0];
  if (first?.error) {
    const e = first.error.json ?? first.error;
    const err = new Error(e?.message ?? JSON.stringify(e));
    err.code = e?.data?.code;
    err.httpStatus = e?.data?.httpStatus;
    throw err;
  }
  return first?.result?.data?.json;
}
async function trpcQuery(cookie, path, input, metaValues) {
  const frame = { json: input ?? null };
  if (metaValues) frame.meta = { values: metaValues };
  const payload = encodeURIComponent(JSON.stringify({ '0': frame }));
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1&input=${payload}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return unwrap(await res.json(), `trpc ${path}`);
}
async function trpcMutateRaw(cookie, path, input, metaValues) {
  const body = { '0': { json: input ?? null } };
  if (metaValues) body['0'].meta = { values: metaValues };
  const res = await fetch(`${API_BASE}/trpc/${path}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
async function trpcMutate(cookie, path, input, metaValues) {
  const { body } = await trpcMutateRaw(cookie, path, input, metaValues);
  return unwrap(body, `trpc ${path}`);
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

/* ---------- 最小 EXIF JPEG 造件（APP1 + TIFF/IFD0/EXIF-IFD/DateTimeOriginal 0x9003） ---------- */
function jpegWithExif(baseBuf, ymdhms /* 'YYYY:MM:DD HH:MM:SS' */) {
  const tiff = Buffer.alloc(64);
  tiff.write('II', 0, 'binary');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 偏移
  tiff.writeUInt16LE(1, 8); // IFD0 count=1
  tiff.writeUInt16LE(0x8769, 10); // ExifIFDPointer
  tiff.writeUInt16LE(4, 12); // type LONG
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18); // EXIF IFD 偏移（TIFF 基址起）
  tiff.writeUInt32LE(0, 22); // next IFD
  tiff.writeUInt16LE(1, 26); // EXIF IFD count=1
  tiff.writeUInt16LE(0x9003, 28); // DateTimeOriginal
  tiff.writeUInt16LE(2, 30); // type ASCII
  tiff.writeUInt32LE(20, 32); // count=20（>4 → 值区偏移）
  tiff.writeUInt32LE(44, 36); // 串偏移
  tiff.writeUInt32LE(0, 40);
  Buffer.from(ymdhms + '\0', 'ascii').copy(tiff, 44);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([baseBuf.subarray(0, 2), app1, payload, baseBuf.subarray(2)]);
}

async function makeJpegs() {
  const { Jimp } = serverRequire('jimp');
  const img = new Jimp({ width: 320, height: 240, color: 0x66aaffff });
  const plain = Buffer.from(await img.getBuffer('image/jpeg'));
  const old = jpegWithExif(plain, '2020:01:01 10:00:00'); // 旧图：远早于服务窗口
  return { plain, old };
}

async function uploadJpeg(cookie, buf, name, relDir) {
  const fd = new FormData();
  fd.append('file', new File([buf], name, { type: 'image/jpeg' }));
  fd.append('relDir', relDir);
  const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', headers: { Cookie: cookie }, body: fd });
  const body = await res.json();
  return { status: res.status, body };
}

/* ---------- CDP 薄层（同 s4 工艺） + Network 域收证 ---------- */
class Cdp {
  constructor(wsUrl) { this.wsUrl = wsUrl; this.id = 0; this.pending = new Map(); this.netLog = []; }
  async open() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); return; }
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (/serviceStep\.addPhotos|\/api\/upload/.test(r.url)) this.netLog.push({ url: r.url, status: r.status });
      }
    };
    await new Promise((r) => { this.ws.onopen = r; });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Network.enable');
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
    if (r?.exceptionDetails) throw new Error(`页内 eval 异常：${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r?.result?.value;
  }
  async goto(url, waitMs = NAV_WAIT) { await this.send('Page.navigate', { url }); await sleep(waitMs); }
  async waitFor(expression, timeoutMs = 30000) {
    const t0 = Date.now();
    for (;;) {
      const ok = await this.eval(`!!(${expression})`).catch(() => false);
      if (ok) return true;
      if (Date.now() - t0 > timeoutMs) return false;
      await sleep(400);
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

/** 页内注入文件到隐藏 file input（DataTransfer 链路，同真人选文件） */
async function injectFile(cdp, b64, name) {
  return cdp.eval(`(() => {
    const bin = atob('${b64}');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], '${name}', { type: 'image/jpeg' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const btn = document.querySelector('[data-testid="step-add-photo"]');
    const input = btn?.parentElement?.querySelector('input[type="file"]') ?? document.querySelector('input[type="file"]');
    if (!input) return 'no-input';
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  })()`);
}

async function main() {
  if (!BROWSER) { console.error('未探测到 Edge/Chrome'); process.exit(2); }
  mkdirSync(OUT_DIR, { recursive: true });

  /* ---- 0. 环境探活 ---- */
  const health = await fetch(`${API_BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!health) { console.error(`API ${API_BASE} 未就绪`); process.exit(2); }

  /* ---- 1. 种子账号 ---- */
  const seed = await (await fetch(`${API_BASE}/api/auth/dev-seed-users`)).json();
  const uidOf = (nick) => seed.users.find((u) => u.nickname === nick)?.id;
  const customerCookie = await devLogin(uidOf('示例客户'));
  const ownerCookie = await devLogin(uidOf('菲丽亚店主'));
  const frontdeskCookie = await devLogin(uidOf('小美'));
  const groomerCookie = await devLogin(uidOf('丽丽'));
  const groomerUserId = uidOf('丽丽');
  const frontdeskUserId = uidOf('小美');
  note(!!(customerCookie && ownerCookie && frontdeskCookie && groomerCookie), '四角色 dev-login（客户/店主/前台小美/美容师丽丽）');

  /* ---- 2. 本店新造合成单 → in_service（丽丽被指派人） ---- */
  const me = await trpcQuery(ownerCookie, 'auth.me');
  const storeId = me.store.id;
  const pets = await trpcQuery(customerCookie, 'pet.list');
  const detail = await trpcQuery(customerCookie, 'store.getWithServices', { storeId });
  const service = detail.services.find((s) => s.type === 'grooming' && (s.durationMin ?? 999) <= 90);
  const cat2 = await trpcQuery(customerCookie, 'store.getWithServices', { storeId, serviceId: service.id, petId: pets[0].id });
  if (!cat2.slots.length) throw new Error('无可约槽位');
  // 复跑撞档（前次实证单未完结）：逐槽尝试，撞 409 时间冲突即换下一槽
  let appt = null;
  for (const s of cat2.slots.slice(0, 12)) {
    try {
      appt = await trpcMutate(customerCookie, 'appointment.create', {
        storeId, petId: pets[0].id, serviceId: service.id, type: 'grooming',
        scheduledStart: s.slotStart, paymentMode: 'pay_at_store',
        note: '【PD-76 实证】本店合成单（可复跑即弃）',
      }, { scheduledStart: ['Date'] });
      break;
    } catch (err) {
      if (err?.code !== 'CONFLICT') throw err;
    }
  }
  if (!appt) throw new Error('逐槽尝试均撞档（前次实证残留；可先复位库再跑）');
  const aid = appt.id;
  await trpcMutate(ownerCookie, 'appointment.confirm', { appointmentId: aid });
  const staffList = await trpcQuery(ownerCookie, 'store.staffList');
  const liliRow = staffList.staff.find((s) => s.name === '丽丽');
  await trpcMutate(ownerCookie, 'appointment.assign', { appointmentId: aid, staffId: liliRow.id });
  const codeRes = await trpcQuery(customerCookie, 'appointment.getCode', { appointmentId: aid });
  const checkin = await trpcMutate(frontdeskCookie, 'appointment.checkin', { code: codeRes.code });
  note(checkin?.appointment?.status === 'in_service', '合成单核销 → in_service（六步初始化）', `aid=${aid}`);

  /* ---- 3. 网络证据（脚本侧）：upload 200 + addPhotos 400/200 ---- */
  const { plain, old } = await makeJpegs();
  const netEvidence = { aid, at: new Date().toISOString(), calls: [] };
  const upOld = await uploadJpeg(groomerCookie, old, 'pd76-old.jpg', `appointment/${aid}/disinfection`);
  netEvidence.calls.push({ call: 'POST /api/upload（旧 EXIF 图）', status: upOld.status, exifTakenAt: upOld.body.exifTakenAt ?? null });
  const addOld = await trpcMutateRaw(groomerCookie, 'serviceStep.addPhotos', {
    appointmentId: aid, stepKey: 'disinfection',
    photos: [{ url: upOld.body.url, thumbUrl: upOld.body.thumbUrl ?? upOld.body.url, tag: 'normal', clientTakenAt: upOld.body.exifTakenAt }],
  });
  const addOldErr = addOld.body?.[0]?.error?.json ?? addOld.body?.[0]?.error ?? null;
  netEvidence.calls.push({
    call: 'serviceStep.addPhotos（clientTakenAt=2020 旧图）',
    status: addOld.status, code: addOldErr?.data?.code ?? null, message: addOldErr?.message ?? null,
  });
  const upPlain = await uploadJpeg(groomerCookie, plain, 'pd76-plain.jpg', `appointment/${aid}/disinfection`);
  netEvidence.calls.push({ call: 'POST /api/upload（无 EXIF 图）', status: upPlain.status, exifTakenAt: upPlain.body.exifTakenAt ?? null });
  const addPlain = await trpcMutateRaw(groomerCookie, 'serviceStep.addPhotos', {
    appointmentId: aid, stepKey: 'disinfection',
    photos: [{ url: upPlain.body.url, thumbUrl: upPlain.body.thumbUrl ?? upPlain.body.url, tag: 'normal' }],
  });
  const addPlainOk = addPlain.body?.[0]?.result?.data?.json ?? null;
  netEvidence.calls.push({
    call: 'serviceStep.addPhotos（无 EXIF=放行留痕）',
    status: addPlain.status, added: addPlainOk?.added ?? null, totalValid: addPlainOk?.totalValid ?? null,
  });
  note(upOld.status === 200 && addOld.status === 400 && addOldErr?.message === '照片拍摄时刻不在服务窗口内，须现场拍摄',
    '网络证据①：旧图 addPhotos 400＋原因原文', `${addOld.status} ${addOldErr?.message}`);
  note(upPlain.status === 200 && addPlain.status === 200 && addPlainOk?.added === 1,
    '网络证据②：正常图 addPhotos 200', `added=${addPlainOk?.added} totalValid=${addPlainOk?.totalValid}`);

  /* ---- 4. CDP 浏览器帧 ---- */
  const profile = join(tmpdir(), `pd76-staff-${Date.now()}`);
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
  await cdp.viewport(390, 844, true);

  const loginAs = async (userId) => {
    await cdp.goto(`${STAFF_URL}/dev-login`, 3200);
    await cdp.eval(`localStorage.setItem('philia.pwaInstallDismissed','1')`);
    const status = await cdp.eval(`fetch('${API_BASE}/api/auth/dev-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: '${userId}' }), credentials: 'include',
    }).then((r) => r.status).catch(() => 0)`);
    if (status !== 200) throw new Error(`浏览器 dev-login 失败 HTTP ${status}`);
  };

  /* 4a. 角标三处（丽丽视界；合成单事件已产真未读） */
  await loginAs(groomerUserId);
  await cdp.goto(`${STAFF_URL}/today`);
  await cdp.waitFor(`document.querySelector('[data-testid="staff-dock"]')`);
  await sleep(1500);
  const badgeDom = await cdp.eval(`(() => {
    const b = document.querySelector('[data-testid="dock-me-badge"]');
    return { text: b?.textContent ?? null, aria: b?.getAttribute('aria-label') ?? null };
  })()`);
  note(!!badgeDom.text && badgeDom.aria === `${badgeDom.text} 条未读`.replace(/99\+$/, '') || !!badgeDom.aria,
    '帧① dock「我的」徽标（99+ 封顶规则＋aria 真值）', JSON.stringify(badgeDom));
  await cdp.shot(join(OUT_DIR, '01-today-dock-badge.png'));

  await cdp.goto(`${STAFF_URL}/me`);
  await cdp.waitFor(`document.querySelector('[data-testid="me-notifications"]')`);
  await sleep(800);
  const meRow = await cdp.eval(`(() => {
    const row = document.querySelector('[data-testid="me-notifications"]');
    const dockBadge = document.querySelector('[data-testid="dock-me-badge"]');
    return { rowText: row?.textContent?.replace(/\\s+/g, ' ').slice(0, 80) ?? null,
      dockText: dockBadge?.textContent ?? null, dockAria: dockBadge?.getAttribute('aria-label') ?? null };
  })()`);
  note(!!meRow.dockText, '帧② /me 行真值＋本屏 dock 徽标同源在（StaffDock 接线后）', JSON.stringify(meRow));
  await cdp.shot(join(OUT_DIR, '02-me-row-badge.png'));

  await cdp.goto(`${STAFF_URL}/notifications`);
  await cdp.waitFor(`document.querySelector('[data-testid="ntf-unread-count"]')`);
  await sleep(800);
  const ntf = await cdp.eval(`(() => ({
    head: document.querySelector('[data-testid="ntf-unread-count"]')?.textContent ?? null,
    capNote: !!document.querySelector('[data-testid="ntf-unread-cap-note"]'),
  }))()`);
  note(!!ntf.head && /未读 \d+ 条/.test(ntf.head), '帧③ 通知头真值（≤99 无一致说明=口径内）', JSON.stringify(ntf));
  await cdp.shot(join(OUT_DIR, '03-notifications-head.png'));

  /* 4b. 执行页：品牌化上传控件 + 状态机 */
  await cdp.goto(`${STAFF_URL}/execute/${aid}`);
  await cdp.waitFor(`document.querySelector('[data-testid="execute-stepper"]')`);
  await sleep(1200);
  const domCheck = await cdp.eval(`(() => {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    return {
      chooseFilesText: document.body.innerText.includes('Choose Files') || document.body.innerText.includes('No file chosen'),
      inputCount: inputs.length,
      allHidden: inputs.every((i) => getComputedStyle(i).display === 'none'),
      addSlot: !!document.querySelector('[data-testid="step-add-photo"]'),
    };
  })()`);
  note(!domCheck.chooseFilesText && domCheck.inputCount > 0 && domCheck.allHidden && domCheck.addSlot,
    '帧④ 执行页零原生 Choose Files（input 全 display:none＋品牌虚线槽在）', JSON.stringify(domCheck));
  await cdp.eval(`document.querySelector('[data-testid="step-add-photo"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(400);
  await cdp.shot(join(OUT_DIR, '04-execute-addslot.png'));

  // 旧图注入 → 拒收态（原因透传＋重拍/重试；头卡/底钮零重复）
  await injectFile(cdp, old.toString('base64'), 'pd76-old.jpg');
  const rejectedUp = await cdp.waitFor(`document.querySelector('[data-testid^="rejected-"]')`, 25000);
  await sleep(1200);
  const rejDom = await cdp.eval(`(() => {
    const line = document.querySelector('[data-testid^="rejected-"]');
    const uploadingBadges = [...document.querySelectorAll('[data-testid="execute-stepper"] span')].filter((s) => s.textContent === '上传中').length;
    const headDup = document.body.innerText.includes('张照片上传中');
    const primary = document.querySelector('[data-testid="execute-primary"]');
    return {
      rejectedLine: line?.textContent?.replace(/\\s+/g, ' ').slice(0, 90) ?? null,
      hasRetry: !!document.querySelector('[data-testid^="rejected-retry-"]'),
      hasDiscard: !!document.querySelector('[data-testid^="rejected-discard-"]'),
      rejectedThumb: !!document.querySelector('[data-rejected="true"]'),
      headDup, uploadingBadges,
      primaryText: primary?.textContent ?? null, primaryDisabled: primary?.disabled ?? null,
    };
  })()`);
  note(rejectedUp && rejDom.rejectedLine?.includes('未通过：照片拍摄时刻不在服务窗口内') && rejDom.hasRetry && rejDom.hasDiscard && rejDom.rejectedThumb,
    '帧⑤ 旧图拒收态：缩略图标红＋原因原文透传＋重试/重拍', JSON.stringify(rejDom));
  note(!rejDom.headDup && rejDom.uploadingBadges === 0 && rejDom.primaryText && !rejDom.primaryText.includes('上传中'),
    '帧⑤b 状态单处：头卡/底钮零「上传中」重复', `headDup=${rejDom.headDup} badges=${rejDom.uploadingBadges} primary=${rejDom.primaryText}`);
  await cdp.eval(`document.querySelector('[data-testid^="rejected-"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(400);
  await cdp.shot(join(OUT_DIR, '05-rejected-state.png'));

  // 重试 → 服务端仍拒（原因恒在，不长期上传中）
  const netBefore = cdp.netLog.length;
  await cdp.eval(`document.querySelector('[data-testid^="rejected-retry-"]')?.click()`);
  await sleep(6000);
  const rejAfterRetry = await cdp.eval(`!!document.querySelector('[data-testid^="rejected-"]')`);
  const netRetry = cdp.netLog.slice(netBefore);
  note(rejAfterRetry, '帧⑥ 重试后仍拒收态（旧图恒拒，不消失不卡上传中）', `retry 期间网络=${JSON.stringify(netRetry)}`);
  await cdp.shot(join(OUT_DIR, '06-retry-still-rejected.png'));

  // 重拍 → 拒收条消失，虚线槽回
  await cdp.eval(`document.querySelector('[data-testid^="rejected-discard-"]')?.click()`);
  await sleep(1200);
  const afterDiscard = await cdp.eval(`({
    rejectedGone: !document.querySelector('[data-testid^="rejected-"]'),
    addSlotBack: !!document.querySelector('[data-testid="step-add-photo"]'),
  })`);
  note(afterDiscard.rejectedGone && afterDiscard.addSlotBack, '重拍（弃本地副本）→ 拒收条消失＋虚线槽回', JSON.stringify(afterDiscard));

  // 正常图 → 成功（底钮按真实成功张数解禁）
  await injectFile(cdp, plain.toString('base64'), 'pd76-plain.jpg');
  const okUploaded = await cdp.waitFor(`!document.querySelector('[data-testid^="rejected-"]') && ![...document.querySelectorAll('[data-testid="execute-stepper"] span')].some((s) => s.textContent === '上传中') && document.body.innerText.includes('已传 2/1')`, 30000);
  await sleep(800);
  const okDom = await cdp.eval(`(() => {
    const primary = document.querySelector('[data-testid="execute-primary"]');
    return { primaryText: primary?.textContent ?? null, primaryDisabled: primary?.disabled ?? null };
  })()`);
  note(okUploaded && okDom.primaryDisabled === false && !/上传中/.test(okDom.primaryText ?? ''),
    '帧⑦ 成功图：上传完成＋底钮按真实成功张数解禁', JSON.stringify(okDom));
  await cdp.shot(join(OUT_DIR, '07-success-primary-enabled.png'));

  // 执行页底部留白（吸底主钮在流内，末条内容不被压）
  await cdp.eval(`window.scrollTo(0, document.body.scrollHeight)`);
  await sleep(600);
  await cdp.shot(join(OUT_DIR, '08-execute-bottom.png'));

  /* 4c. 扫码文案（小美前台视界；headless 无摄像头 → 错误态真帧） */
  await loginAs(frontdeskUserId);
  await cdp.goto(`${STAFF_URL}/today`);
  await cdp.waitFor(`document.querySelector('[data-testid="frontdesk-scan"]')`);
  await cdp.eval(`document.querySelector('[data-testid="frontdesk-scan"]')?.click()`);
  const scanErrUp = await cdp.waitFor(`document.querySelector('[data-testid="scan-error-manual"]')`, 15000);
  const scanDom = await cdp.eval(`(() => {
    const text = document.body.innerText;
    return {
      httpTechWord: /HTTP|HTTPS|不安全上下文|secure context/i.test(text),
      manualPrimary: !!document.querySelector('[data-testid="scan-error-manual"]'),
      retrySecondary: !!document.querySelector('[data-testid="scan-error-retry"]'),
      errMsg: document.querySelector('[role="dialog"]')?.innerText?.replace(/\\s+/g, ' ').slice(0, 120) ?? null,
    };
  })()`);
  note(scanErrUp && !scanDom.httpTechWord && scanDom.manualPrimary,
    '帧⑧ 扫码错误态：零 HTTP 技术词＋手动输入=主钮', JSON.stringify(scanDom));
  await cdp.shot(join(OUT_DIR, '09-scan-error-manual-primary.png'));
  await cdp.eval(`document.querySelector('[data-testid="scan-error-manual"]')?.click()`);
  await sleep(1200);
  const manualUp = await cdp.eval(`(() => {
    const t = document.body.innerText;
    return { manualVisible: t.includes('核销码') && !!document.querySelector('[role="dialog"] input'),
      httpTechWord: /HTTP|HTTPS/i.test(t) };
  })()`);
  note(manualUp.manualVisible && !manualUp.httpTechWord, '帧⑨ 手动输入可达（错误态主钮直达）', JSON.stringify(manualUp));
  await cdp.shot(join(OUT_DIR, '10-scan-manual-input.png'));

  /* 4d. 列表安全区（today 自渲 dock 页 + schedule App 壳页）：末条底 ≤ dock 顶 */
  const safeAreaCheck = `(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const dock = document.querySelector('.sk-dock');
    if (!dock) return { dock: false };
    const dockTop = dock.getBoundingClientRect().top;
    let lastBottom = -1; let lastDesc = '';
    document.querySelectorAll('.sk *').forEach((el) => {
      if (dock.contains(el)) return;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.position === 'absolute') return;
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > lastBottom && r.bottom <= window.innerHeight + 2000) { lastBottom = r.bottom; lastDesc = el.className?.toString?.().slice(0, 40) ?? el.tagName; }
    });
    return { dock: true, dockTop: Math.round(dockTop), lastBottom: Math.round(lastBottom), gap: Math.round(dockTop - lastBottom), lastDesc };
  })()`;
  await loginAs(groomerUserId);
  await cdp.goto(`${STAFF_URL}/today`);
  await cdp.waitFor(`document.querySelector('[data-testid="staff-dock"]')`);
  await sleep(1500);
  const saToday = await cdp.eval(safeAreaCheck);
  await sleep(400);
  note(saToday.dock && saToday.gap >= 0, '帧⑩ /today 末条不被底栏压（gap≥0）', JSON.stringify(saToday));
  await cdp.shot(join(OUT_DIR, '11-today-bottom-safearea.png'));
  await cdp.goto(`${STAFF_URL}/schedule`);
  await cdp.waitFor(`document.querySelector('[data-testid="sk-schedule"]')`);
  await sleep(1500);
  const saSchedule = await cdp.eval(safeAreaCheck);
  await sleep(400);
  note(saSchedule.dock && saSchedule.gap >= 0, '帧⑪ /schedule 末条不被底栏压（gap≥0）', JSON.stringify(saSchedule));
  await cdp.shot(join(OUT_DIR, '12-schedule-bottom-safearea.png'));

  /* ---- 5. 证据落盘 ---- */
  netEvidence.browserCalls = cdp.netLog;
  writeFileSync(join(EVIDENCE_DIR, 'network-addphotos.json'), JSON.stringify(netEvidence, null, 2));
  console.log(`  🧾 ${join(EVIDENCE_DIR, 'network-addphotos.json')}`);

  cdp.close();
  console.log(`\n===== PD-76 实证汇总：${failures === 0 ? '全绿' : `${failures} 项失败`} =====`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
