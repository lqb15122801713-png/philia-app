/**
 * 录屏预热（B4 录屏前置）：以固定 profile 自起 Edge（脚本退出后 Edge 存活），
 * 登录种子客户，并通过真实 UI 走完一单 → 自然写入 localStorage「上次成功下单」记忆，
 * 使随后的录屏呈现「老客预填已齐」的真实状态。
 */
import { spawn } from 'node:child_process';
import { connect, loginAsSeedCustomer, waitFor, sleep, APP } from '../cdp-lib.mjs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = resolve(tmpdir(), 'b4-rec-profile');

// detached + unref：本脚本退出后 Edge 继续存活，供 record-cdp.mjs 连接
const proc = spawn(EDGE, [
  '--headless=new',
  '--remote-debugging-port=9223',
  `--user-data-dir=${PROFILE}`,
  '--no-first-run',
  '--disable-extensions',
  'about:blank',
], { stdio: 'ignore', detached: true });
proc.unref();
console.log('edge pid:', proc.pid, 'profile:', PROFILE);

const cdp = await connect();
await loginAsSeedCustomer(cdp);

// 检查是否已有记忆（重复预热则跳过下单）
await cdp.nav(`${APP}/booking/grooming`);
await waitFor(cdp, `!!document.querySelector('[data-testid="grooming-single"]')`);
await sleep(1200);
const hasMemory = await cdp.evalJs(`!!localStorage.getItem('philia:lastBooking')`);
if (!hasMemory) {
  // 真实 UI 下单：选宠物 → 选第一个可约槽 → 确认 → 成功页（写入 lastBooking 记忆）
  await cdp.evalJs(`document.querySelector('[data-testid="gs-pet-card"]').click()`);
  await sleep(700);
  await cdp.evalJs(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    Array.from(sheet.querySelectorAll('button')).find(b => b.textContent.includes('旺财'))?.click();
  })()`);
  await sleep(700);
  await cdp.evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true')?.click()`);
  await sleep(600);
  const ready = await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.getAttribute('data-state')`);
  if (ready !== 'ready') throw new Error('预热下单前按钮非可点态: ' + ready);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
  let landed = '';
  for (let i = 0; i < 20; i++) {
    landed = await cdp.evalJs(`location.pathname`);
    if (landed === '/booking/success') break;
    await sleep(600);
  }
  if (landed !== '/booking/success') throw new Error('预热下单未达成功页: ' + landed);
  console.log('预热下单完成（成功页），lastBooking 已写入');
} else {
  console.log('已有 lastBooking 记忆，跳过预热下单');
}
const mem = await cdp.evalJs(`localStorage.getItem('philia:lastBooking')`);
console.log('lastBooking =', mem);
cdp.close();
console.log('PREP OK（Edge 保持运行）');
