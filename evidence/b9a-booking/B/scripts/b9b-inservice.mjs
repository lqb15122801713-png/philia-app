/**
 * 自验 2（编排版 v2）：服务中面板四要素 + SSE 实时驱动 + 双态切换
 * 事件口径（与服务端一致）：addPhotos 不发事件；confirmStep 发 step_updated；
 * 第 6 步 confirm 三合一发 appointment.completed。
 * 场景：库内有 2 个 in_service 洗护单（A=面板当前选中，B=次选）。
 * 流程（页面停驻 /home 零导航）：
 *  1. 面板初态截图（step1 无照片）；
 *  2. 子进程对 A 的 disinfection addPhotos+confirm → SSE step_updated →
 *     面板应推进「预检 第 2 步」+ doneCount=1 + 缩略图出现（截图 = 四要素 + SSE 实证）；
 *  3. 子进程走完 A → completed → 面板切到 B（仍服务中，记录）；
 *  4. 子进程走完 B → completed → 面板切回常态 rebook（截图 = 双态切换 SSE 实证）。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const SERVER_DIR = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server';

const runWalk = (aid, onlyStep, confirm) => {
  const args = ['node_modules/tsx/dist/cli.mjs', 'scripts/b9b-walk-steps.mts', aid];
  if (onlyStep) args.push(onlyStep);
  if (confirm) args.push('--confirm');
  const r = spawnSync('node', args, { cwd: SERVER_DIR, encoding: 'utf8', timeout: 240000 });
  console.log(`[walk ${aid.slice(-6)} ${onlyStep ?? 'full'}${confirm ? ' --confirm' : ''}] exit=${r.status}`);
  if (r.status !== 0) {
    console.log(r.stdout, r.stderr);
    throw new Error('walk 脚本失败');
  }
  return r.stdout;
};

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);
await send('Page.navigate', { url: `${APP}/home` });

const ok = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-inservice-panel"]')`, 15000);
if (!ok) throw new Error('服务中面板未出现（预期库内尚有 in_service 单）');

const snap = () =>
  evalJs(`(()=>{
    const p = document.querySelector('[data-testid="home-inservice-panel"]');
    const prog = document.querySelector('[data-testid="home-inservice-progress"]');
    const live = document.querySelector('[data-testid="home-inservice-live"]');
    return {
      inserviceShown: !!p,
      stepName: document.querySelector('[data-testid="home-inservice-step"]')?.textContent ?? null,
      panelText: p?.innerText ?? null,
      liveHref: live?.getAttribute('href') ?? null,
      stepOrder: prog?.getAttribute('data-step-order') ?? null,
      doneCount: prog?.getAttribute('data-done-count') ?? null,
      photoCount: document.querySelectorAll('[data-testid="home-inservice-photos"] img').length,
      rebookShown: !!document.querySelector('[data-testid="home-rebook-panel"]'),
      entryShown: !!document.querySelector('[data-testid="home-booking-entry"]'),
    };
  })()`);

const s0 = await snap();
console.log('【1】初态', JSON.stringify(s0));
writeFileSync(`${OUT}/inservice-1-initial.json`, JSON.stringify(s0, null, 2));
await shot(send, `${OUT}/inservice-1-initial.png`);
const aidA = s0.liveHref?.match(/\/appointments\/([^/]+)\/live/)?.[1];
if (!aidA) throw new Error('未取到 A 单 aid');
console.log('A 单 =', aidA);

await sleep(2500); // SSE 订阅沉降

/* 【2】confirm disinfection → SSE → 面板推进第 2 步 + 缩略图出现 */
runWalk(aidA, 'disinfection', true);
const advOk = await waitFor(
  evalJs,
  `(document.querySelector('[data-testid="home-inservice-step"]')?.textContent ?? '').includes('预检')
   && document.querySelectorAll('[data-testid="home-inservice-photos"] img').length >= 1`,
  15000,
);
const s1 = await snap();
console.log('【2】SSE 步骤推进+照片缩略:', advOk ? 'OK' : 'TIMEOUT', JSON.stringify(s1));
writeFileSync(`${OUT}/inservice-2-step2-photo.json`, JSON.stringify({ sseDriven: advOk, ...s1 }, null, 2));
await shot(send, `${OUT}/inservice-2-step2-photo.png`);
if (!advOk) throw new Error('SSE 未驱动面板更新');

/* 【3】走完 A → 面板切到 B（仍服务中） */
runWalk(aidA);
const switchBOk = await waitFor(
  evalJs,
  `(()=>{ const h = document.querySelector('[data-testid="home-inservice-live"]')?.getAttribute('href') ?? '';
     return h.length > 0 && !h.includes('${aidA}'); })()`,
  20000,
);
const s2 = await snap();
console.log('【3】A 完成后切到 B 单:', switchBOk ? 'OK' : 'TIMEOUT', JSON.stringify(s2));
writeFileSync(`${OUT}/inservice-3-switch-b.json`, JSON.stringify({ sseDriven: switchBOk, ...s2 }, null, 2));
const aidB = s2.liveHref?.match(/\/appointments\/([^/]+)\/live/)?.[1];
console.log('B 单 =', aidB);
if (!aidB) throw new Error('未取到 B 单 aid');

/* 【4】走完 B → 面板切回常态 rebook（双态切换 SSE 实证） */
runWalk(aidB);
const rebookOk = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"]')`, 25000);
const s3 = await evalJs(`(()=>({
  rebookShown: !!document.querySelector('[data-testid="home-rebook-panel"]'),
  inserviceShown: !!document.querySelector('[data-testid="home-inservice-panel"]'),
  ctaText: document.querySelector('[data-testid="home-rebook-cta"]')?.textContent ?? null,
  panelText: document.querySelector('[data-testid="home-rebook-panel"]')?.innerText ?? null,
}))()`);
console.log('【4】全部完成后切回常态面板:', rebookOk ? 'OK' : 'TIMEOUT', JSON.stringify(s3));
writeFileSync(`${OUT}/inservice-4-switch-rebook.json`, JSON.stringify({ sseDriven: rebookOk, ...s3 }, null, 2));
await shot(send, `${OUT}/inservice-4-switch-rebook.png`);
if (!rebookOk) throw new Error('双态切换未发生');
console.log('DONE');
process.exit(0);
