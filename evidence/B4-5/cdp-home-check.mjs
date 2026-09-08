/**
 * B4-5 首页复购提醒卡 · CDP 断言/截图辅助（无 puppeteer 依赖）
 *
 * 前置：server dev 已监听 7200、customer dev 已监听 7100（脚本只做可达性检查，不自起服务）。
 * 用法：node cdp-home-check.mjs <mode> <tag> [expectCard]
 *   mode=home  —— 登录种子客户 → /home → 断言提醒卡存在与否 + 全页截图
 *                 expectCard: yes（应出现）/ no（应不出现）
 *   mode=click —— 登录 → /home → 点提醒卡 → 断言落 /booking/grooming 且三参预填 + 截图
 * 输出：evidence/B4-5/<tag>.png + <tag>.txt（断言明细）；全部 PASS exit 0，否则 exit 1
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const [mode, tag, expectCard = 'no'] = process.argv.slice(2);
if (!mode || !tag) {
  console.error('usage: node cdp-home-check.mjs <home|click> <tag> [yes|no]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function waitHttp(url, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return true;
    } catch {}
    await sleep(500);
  }
  return false;
}

let edge = null;
const profileDir = resolve(tmpdir(), `b45-cdp-${process.pid}`);
function cleanup() {
  if (edge?.pid) {
    spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
    edge = null;
  }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

async function main() {
  if (!(await waitHttp(`${API}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  if (!(await waitHttp(`${APP}/`, 4))) throw new Error('customer 7100 不可达');

  // 种子客户（动态取，禁止硬编码 ULID）
  const seedRes = await fetch(`${API}/api/auth/dev-seed-users`);
  const seedData = await seedRes.json();
  const customer = (seedData.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seedData.users?.[0];
  if (!customer) throw new Error('dev-seed-users 未取到种子客户');

  edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
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

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面内脚本异常: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  };
  const shot = async (file) => {
    // 视口拉高到整页内容高，一次截全页
    const h = Math.min(await evalJs('document.documentElement.scrollHeight'), 2600);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: h, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  };
  const poll = async (expr, tries = 20, gap = 400) => {
    for (let i = 0; i < tries; i++) {
      if (await evalJs(expr)) return true;
      await sleep(gap);
    }
    return false;
  };

  /* ---------- dev-login ---------- */
  await send('Page.navigate', { url: `${APP}/dev-login` });
  await sleep(1500);
  const loginStatus = await evalJs(`fetch('${API}/api/auth/dev-login', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include'
  }).then(r => r.status)`);
  assert('dev-login 种子客户登录', loginStatus === 200, `HTTP ${loginStatus}`);

  /* ---------- 首页 ---------- */
  await send('Page.navigate', { url: `${APP}/home` });
  const homeReady = await poll(`(document.body.textContent||'').includes('推荐服务')`, 20, 500);
  assert('首页渲染（推荐服务模块出现）', homeReady);
  const sectionFlags = await evalJs(`(() => {
    const t = document.body.textContent || '';
    return { stores: t.includes('附近好店'), services: t.includes('推荐服务'), banner: !!document.querySelector('header img') };
  })()`);
  assert('首页既有模块在位（品牌头/附近好店/推荐服务）', sectionFlags.stores && sectionFlags.services && sectionFlags.banner, JSON.stringify(sectionFlags));

  // 给 listMine 查询留出到达时间：轮询等卡出现，最多 5s
  const cardFound = await poll(`!!document.querySelector('[data-testid="grooming-reminder"]')`, 12, 400);
  const cardInfo = await evalJs(`(() => {
    const el = document.querySelector('[data-testid="grooming-reminder"]');
    if (!el) return null;
    return { text: (el.textContent || '').replace(/\\s+/g, ' ').trim(), href: el.getAttribute('href') };
  })()`);
  const bodyHasPhrase = await evalJs(`(document.body.textContent||'').includes('该洗澡啦')`);

  if (mode === 'home') {
    if (expectCard === 'yes') {
      assert('提醒卡渲染（data-testid=grooming-reminder）', cardFound);
      assert('卡片文案含「该洗澡啦 ▸ 一键预约」', !!cardInfo && cardInfo.text.includes('该洗澡啦') && cardInfo.text.includes('▸ 一键预约'), cardInfo?.text ?? '(无卡)');
      assert('卡片链接带三参预填（serviceId+storeId+petId）',
        !!cardInfo && /\/booking\/grooming\?/.test(cardInfo.href ?? '') && ['serviceId=', 'storeId=', 'petId='].every((k) => (cardInfo.href ?? '').includes(k)),
        cardInfo?.href ?? '(无卡)');
    } else {
      assert('提醒卡不渲染（data-testid=grooming-reminder 不存在）', !cardFound);
      assert('页面无「该洗澡啦」文案', !bodyHasPhrase);
    }
    await shot(resolve(__dirname, `${tag}.png`));
  } else if (mode === 'click') {
    assert('前置：提醒卡已渲染', cardFound, cardInfo?.text ?? '(无卡)');
    if (!cardFound) throw new Error('无提醒卡可点，click 模式中止');
    await evalJs(`document.querySelector('[data-testid="grooming-reminder"]').click()`);
    const singleReady = await poll(`!!document.querySelector('[data-testid="grooming-single"]')`, 20, 400);
    assert('点击后落在洗护单屏（/booking/grooming）', singleReady, await evalJs('location.pathname + location.search'));
    const urlInfo = await evalJs(`(() => {
      const p = new URLSearchParams(location.search);
      return { path: location.pathname, serviceId: p.get('serviceId'), storeId: p.get('storeId'), petId: p.get('petId') };
    })()`);
    assert('URL 三参齐全（serviceId/storeId/petId）', urlInfo.path === '/booking/grooming' && !!urlInfo.serviceId && !!urlInfo.storeId && !!urlInfo.petId, JSON.stringify(urlInfo));
    // 等单屏数据解析（门店/服务/宠物就绪后确认条才会从缺项态变成「请选择时间」）
    const prefilled = await poll(`(() => {
      const b = document.querySelector('[data-testid="gs-confirm"]');
      return !!b && (b.textContent || '').includes('请选择时间');
    })()`, 25, 400);
    const confirmText = await evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.textContent?.trim() ?? ''`);
    assert('三参预填生效（确认条仅剩「请选择时间」，宠物/门店/服务已预填）', prefilled, confirmText);
    const petShown = await poll(`(document.querySelector('[data-testid="grooming-single"]')?.textContent || '').includes('旺财')`, 15, 400);
    assert('单屏宠物卡显示旺财（URL petId 预填）', petShown);
    await shot(resolve(__dirname, `${tag}.png`));
  }

  ws.close();
  const failed = results.filter((r) => !r.ok);
  const txt = [
    `B4-5 cdp-home-check  mode=${mode} tag=${tag} expectCard=${expectCard}`,
    `time=${new Date().toISOString()}`,
    ...results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`),
    `SUMMARY: ${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED`}`,
  ].join('\n');
  writeFileSync(resolve(__dirname, `${tag}.txt`), txt + '\n');
  console.log(`SUMMARY: ${failed.length === 0 ? 'ALL PASS' : `${failed.length} FAILED`} → ${tag}.png/.txt`);
  process.exit(failed.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
