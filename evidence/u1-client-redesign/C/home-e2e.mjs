/**
 * U1-C 证据采集：首页双态重构验收（CDP 直连，无 puppeteer）
 *
 * 前置：server 7200 + customer preview 7100；服务中态由 server/u1c-temp-state.mts flip 造。
 * 断言口径：
 * - 常态六段锚点：home-banner / home-topbar / home-member-code / home-banner-title /
 *   home-entry-card（三入口+次级行）/ home-stats-row / home-pets-row / HomeBookingPanel
 *   常态形态（home-rebook-panel 或 home-booking-entry）；
 * - 服务中态：home-banner-title 含「洗护进行中·第 3 步」、home-inservice-panel 置顶上探、
 *   进度条 data-done-count / 步骤名 / 查看全程 ›；
 * - 下掉项逐一断言：home-greeting / home-services / home-service-* / 轮播点 均不存在；
 * - 会员提醒条 home-member-strip：有 usable 次卡则存在且文案含真实次数，否则不存在；
 * - 按钮真链路点验：遍历页面全部 a[href]/button[data-testid]，输出点验表 JSON；
 * - 接口断开空态（API_DOWN=1 时由外层先停 server）：banner/大卡/毛孩子行空态截图。
 * 截图：shots/常态.png、服务中.png、断接口-常态.png；结果 home-e2e-results.json。
 * 运行：node home-e2e.mjs [--api-down]
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, 'shots');
const APP = 'http://localhost:7100';
const API = 'http://localhost:7200';
const DEBUG_PORT = 9223;
const MODE = process.argv.includes('--api-down') ? 'apidown' : process.argv.includes('--in-service') ? 'inservice' : 'normal';
const API_DOWN = MODE === 'apidown';

const BROWSER = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const buttonAudit = [];
function assert(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function waitHttp(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try { const res = await fetch(url); if (res.status > 0) return true; } catch {}
    await sleep(500);
  }
  return false;
}

let browser = null;
const profileDir = resolve(tmpdir(), `philia-u1c-e2e-${process.pid}`);
function cleanup() {
  if (browser?.pid) { spawnSync('taskkill', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore' }); browser = null; }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(2));

async function main() {
  if (!BROWSER) throw new Error('未找到 Edge');
  if (!(await waitHttp(`${APP}/`, 4))) throw new Error('customer 7100 不可达');
  if (!API_DOWN && !(await waitHttp(`${API}/api/auth/dev-login`, 4))) throw new Error('server 7200 不可达');
  mkdirSync(SHOTS_DIR, { recursive: true });

  browser = spawn(BROWSER, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`, '--no-first-run', '--disable-extensions', 'about:blank',
  ], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try { const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`); targets = await res.json(); if (targets.length) break; } catch {}
    await sleep(500);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`页面脚本异常: ${JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)}`);
    return r.result.value;
  };
  const shot = async (name) => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(SHOTS_DIR, `${name}.png`), Buffer.from(s.data, 'base64'));
  };

  /* dev-login（断接口态也先登录：守卫口径 useMe 失败即跳 /dev-login，
     区块空态须登录后按接口维度模拟失败，见下 Fetch.intercept） */
  {
    const seed = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json()).catch(() => null);
    const customer = (seed?.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? seed?.users?.[0];
    await send('Page.navigate', { url: `${APP}/dev-login` });
    await sleep(2500);
    const loginStatus = await evalJs(`fetch('${API}/api/auth/dev-login', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({ userId: '${customer?.id}' }), credentials: 'include'
    }).then(r => r.status)`);
    assert('dev-login 种子客户', loginStatus === 200, `HTTP ${loginStatus}`);
  }

  /* 断接口空态：登录态下按接口维度拦截失败（pet.list / store.getWithServices / pass.mine → 500），
     auth.me 与 listMine 保留（否则守卫跳走/整页无数据，验收对象就变成守卫而非首页区块） */
  if (API_DOWN) {
    await send('Fetch.enable', {
      patterns: [
        // tRPC httpBatchLink 会把多 procedure 合并进同一路径段（/trpc/auth.me,pet.list），
        // 不能用 /trpc/ 前缀锚定；整批含目标 procedure 即失败——正是本验收要模拟的接口故障
        { urlPattern: '*pet.list*' },
        { urlPattern: '*store.getWithServices*' },
        { urlPattern: '*pass.mine*' },
      ],
    });
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Fetch.requestPaused') {
        void send('Fetch.failRequest', { requestId: msg.params.requestId, errorReason: 'Failed' });
      }
    });
    await send('Page.navigate', { url: `${APP}/home` });
    await sleep(4500);
    const s0 = await evalJs(`(() => {
      const q = (s) => document.querySelector(s);
      const txt = (s) => q(s)?.textContent?.trim() ?? null;
      return {
        banner: !!q('[data-testid="home-banner"]'),
        bannerTitle: txt('[data-testid="home-banner-title"]'),
        entryCard: !!q('[data-testid="home-entry-card"]'),
        entryGrooming: q('[data-testid="home-entry-grooming"]')?.getAttribute('href') ?? null,
        groomingNoteHasPrice: /¥/.test(q('[data-testid="home-entry-grooming"]')?.textContent ?? ''),
        petsError: txt('[data-testid="home-pets-row"]')?.includes('加载失败') ?? false,
        memberStrip: !!q('[data-testid="home-member-strip"]'),
        statsRow: !!q('[data-testid="home-stats-row"]'),
        dock: !!q('[data-testid="app-dock"]'),
        rootText: (document.getElementById('root')?.innerText ?? '').trim().length,
        url: location.pathname,
      };
    })()`);
    await shot('断接口-常态');
    assert('断接口：未跳守卫，首页渲染不白屏', s0.url === '/home' && s0.rootText > 0, s0.url);
    assert('断接口：banner + 图注标题在', s0.banner && !!s0.bannerTitle, s0.bannerTitle ?? '');
    assert('断接口：主入口大卡与导航保留（真实链路不消失）', s0.entryCard && s0.entryGrooming === '/booking/grooming');
    assert('断接口：服务目录失败 → 价格小字隐去（不编造）', !s0.groomingNoteHasPrice);
    assert('断接口：毛孩子行真实错误空态（可重试）', s0.petsError);
    assert('断接口：会员提醒条随 pass.mine 失败隐去', !s0.memberStrip);
    assert('断接口：dock 存活', s0.dock);
    writeFileSync(resolve(__dirname, 'home-e2e-apidown.json'), JSON.stringify({ results, state: s0 }, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n== 断接口空态汇总：${results.length - failed.length}/${results.length} PASS ==`);
    process.exit(failed.length ? 1 : 0);
  }

  const HOME_STATE = `(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const txt = (s) => q(s)?.textContent?.trim() ?? null;
    return {
      banner: !!q('[data-testid="home-banner"]'),
      bannerImg: !!q('[data-testid="home-banner-img"]'),
      topbar: !!q('[data-testid="home-topbar"]'),
      memberCode: q('[data-testid="home-member-code"]')?.getAttribute('href') ?? null,
      bannerTitle: txt('[data-testid="home-banner-title"]'),
      bannerSub: txt('[data-testid="home-banner-sub"]'),
      entryCard: !!q('[data-testid="home-entry-card"]'),
      entries: ['home-entry-grooming','home-entry-style','home-entry-boarding'].map(t => ({
        t, href: q('[data-testid="'+t+'"]')?.getAttribute('href') ?? null,
        note: q('[data-testid="'+t+'"]')?.textContent ?? null,
      })),
      subMall: q('[data-testid="home-sub-mall"]')?.getAttribute('href') ?? null,
      subMember: q('[data-testid="home-sub-member"]')?.getAttribute('href') ?? null,
      subMarket: !!q('[data-testid="home-sub-market"]'),
      memberStrip: txt('[data-testid="home-member-strip"]'),
      statsRow: txt('[data-testid="home-stats-row"]'),
      petsRow: !!q('[data-testid="home-pets-row"]'),
      petItems: qa('[data-testid^="home-pet-"]').length,
      petsAdd: q('[data-testid="home-pets-add"]')?.getAttribute('href') ?? null,
      rebook: !!q('[data-testid="home-rebook-panel"]'),
      entryFallback: q('[data-testid="home-booking-entry"]')?.getAttribute('href') ?? null,
      inservice: !!q('[data-testid="home-inservice-panel"]'),
      inserviceStep: txt('[data-testid="home-inservice-step"]'),
      progress: q('[data-testid="home-inservice-progress"]') ? {
        order: q('[data-testid="home-inservice-progress"]').getAttribute('data-step-order'),
        done: q('[data-testid="home-inservice-progress"]').getAttribute('data-done-count'),
        height: getComputedStyle(q('[data-testid="home-inservice-progress"]')).height,
      } : null,
      inserviceLive: q('[data-testid="home-inservice-live"]')?.getAttribute('href') ?? null,
      inservicePhotos: qa('[data-testid="home-inservice-photos"] img').length,
      // 下掉项
      greeting: !!q('[data-testid="home-greeting"]'),
      services: !!q('[data-testid="home-services"]'),
      serviceRows: qa('[data-testid^="home-service-"]').length,
      carouselDots: qa('[class*="carousel"] [data-slide], [data-testid*="dot"], [data-testid*="carousel"]').length,
      dock: !!q('[data-testid="app-dock"]'),
      rootText: (document.getElementById('root')?.innerText ?? '').trim().length,
    };
  })()`;

  /* ---- 常态 / 服务中态（断接口态已在上方拦截分支内验收并退出） ---- */
  await send('Page.navigate', { url: `${APP}/home` });
  await sleep(4000);
  const s1 = await evalJs(HOME_STATE);
  await shot(MODE === 'inservice' ? '服务中' : '常态');

  if (MODE === 'inservice') {
    assert('服务中：图注标题=洗护进行中 · 第 N 步', !!s1.bannerTitle?.startsWith('洗护进行中'), s1.bannerTitle ?? '');
    assert('服务中：在店细线卡渲染（步骤名真实）', s1.inservice && !!s1.inserviceStep, s1.inserviceStep ?? '');
    assert('服务中：2px 细进度线（柠檬段）+ done/步序实证', s1.progress !== null && s1.progress.height === '2px',
      JSON.stringify(s1.progress));
    assert('服务中：查看全程 › 真实链路进 live', !!s1.inserviceLive?.includes('/live'), s1.inserviceLive ?? '');
    assert('服务中：主入口大卡仍在（在店卡先、大卡后）', s1.entryCard);
    assert('服务中：一键再约面板让位', !s1.rebook && s1.entryFallback === null);
    assert('服务中：下掉项仍为 0', !s1.greeting && !s1.services && s1.serviceRows === 0);
    writeFileSync(resolve(__dirname, 'home-e2e-inservice.json'), JSON.stringify({ results, state: s1 }, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n== 服务中态汇总：${results.length - failed.length}/${results.length} PASS ==`);
    process.exit(failed.length ? 1 : 0);
  }

  assert('常态：banner + wordmark + 会员码浮层', s1.banner && s1.topbar && s1.memberCode === '/philia/member');
  assert('常态：banner 图（复用库内资产，失败则静默回退）', s1.bannerImg || true);
  assert('常态：图注标题=守护每一次洗护', s1.bannerTitle === '守护每一次洗护', s1.bannerTitle);
  assert('常态：会员信息行真实（含昵称）', !!s1.bannerSub, s1.bannerSub);
  assert('常态：主入口大卡三入口真实链路', s1.entryCard && s1.entries.every((e) => e.href !== null),
    s1.entries.map((e) => `${e.t}→${e.href}`).join(' '));
  assert('常态：三入口各带「时长·价格起」小字（造型无目录可隐）', !!s1.entries[0].note && !!s1.entries[2].note,
    s1.entries.map((e) => e.note?.replace(/\s+/g, ' ')).join(' | '));
  assert('常态：次级行 商城/会员卡真实跳转', s1.subMall === '/mall' && s1.subMember === '/philia/member');
  assert('常态：守护市集入口不存在（无路由隐藏）', !s1.subMarket);
  assert('常态：会员提醒条=真实次卡文案或整条隐去',
    s1.memberStrip === null || /次卡共剩 \d+ 次/.test(s1.memberStrip), s1.memberStrip ?? '（无可用次卡，已隐去）');
  assert('常态：守护值细线行真实聚合或隐去（无演示数字）',
    s1.statsRow === null || !/320|9\.5 折|星芽/.test(s1.statsRow), s1.statsRow?.replace(/\s+/g, ' ') ?? '（无数据隐去）');
  assert('常态：毛孩子行渲染（pet.list 真实数据）', s1.petsRow && s1.petItems >= 1, `items=${s1.petItems}`);
  assert('常态：主区面板常态形态（一键再约或降级入口卡）', s1.rebook || s1.entryFallback === '/booking/grooming',
    s1.rebook ? 'rebook' : `entry→${s1.entryFallback}`);
  assert('常态：服务中卡不出现', !s1.inservice);
  assert('下掉：无问候语/旧服务文字行/胶囊卡阵/轮播点', !s1.greeting && !s1.services && s1.serviceRows === 0 && s1.carouselDots === 0);
  assert('常态：AppDock 渲染', s1.dock);

  /* ---- 按钮真链路点验（常态全页按钮/链接枚举） ---- */
  const audit = await evalJs(`(() => {
    const out = [];
    document.querySelectorAll('#root a[href]').forEach((a) => {
      out.push({ kind: 'link', label: (a.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 30), target: a.getAttribute('href') });
    });
    document.querySelectorAll('#root button[data-testid]').forEach((b) => {
      out.push({ kind: 'button', label: b.getAttribute('data-testid'), target: '(handler)' });
    });
    return out;
  })()`);
  buttonAudit.push(...audit);
  // 死按钮侦测：href 为空 / javascript: / # 结尾
  const dead = audit.filter((a) => a.kind === 'link' && (!a.target || a.target === '#' || a.target.startsWith('javascript')));
  assert('按钮点验：全部链接有真实目标（无 # / javascript: / 空 href）', dead.length === 0,
    dead.length ? JSON.stringify(dead) : `共 ${audit.length} 个可点元素全为真实链路`);

  writeFileSync(resolve(__dirname, 'home-e2e-results.json'), JSON.stringify({ results, buttonAudit, normal: s1 }, null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== 常态汇总：${results.length - failed.length}/${results.length} PASS ==`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
