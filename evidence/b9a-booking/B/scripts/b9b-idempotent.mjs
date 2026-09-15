/**
 * 自验 4：幂等——同一事件循环内三连击 CTA，仅产生一单（appointments 行数前后对比）。
 * 前端防线：submittingRef 同步锁（重渲染前禁用未到位的连击也吞掉）+ isPending 禁用。
 * 服务端 create 现状无幂等键（如实上报；本批不动服务端）。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const SERVER_DIR = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server';
const dbSnap = (aid) => {
  const args = ['node_modules/tsx/dist/cli.mjs', 'scripts/b9b-appt-snapshot.mts'];
  if (aid) args.push(aid);
  const r = spawnSync('node', args, { cwd: SERVER_DIR, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`快照失败: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);

await send('Page.navigate', { url: `${APP}/home` });
const ok = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"]')`, 15000);
if (!ok) throw new Error('rebook 面板未出现');
const cta = await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  return { text: el.textContent, slotStart: Number(el.getAttribute('data-slot-start')) };
})()`);
const slotIso = new Date(cta.slotStart).toISOString();
console.log('CTA:', JSON.stringify(cta), slotIso);

const before = dbSnap();
console.log('三连击前客户单总数:', before.total);

// 同一事件循环内三连击（双击/快速重试的最严苛形态）
await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  el.click(); el.click(); el.click();
  return el.getAttribute('data-state');
})()`);

const succOk = await waitFor(evalJs, `location.pathname === '/booking/success' && document.body.innerText.includes('预约成功')`, 15000);
if (!succOk) throw new Error('未落入成功页');
await sleep(600);
await shot(send, `${OUT}/idempotent-success.png`);
const aid = await evalJs(`new URLSearchParams(location.search).get('aid')`);

const after = dbSnap();
const delta = after.total - before.total;
// 同槽同服务单数（应恰好 1 单为本次三连击所建）
const sameSlot = after.recent.filter(
  (r) => new Date(r.scheduledStart).toISOString() === slotIso && r.status !== 'cancelled',
);
const verdict = {
  before: before.total,
  after: after.total,
  delta,
  newAid: aid,
  slotIso,
  sameSlotAppointments: sameSlot.map((r) => r.id),
  pass: delta === 1 && sameSlot.length === 1 && sameSlot[0].id === aid,
};
writeFileSync(`${OUT}/idempotent-compare.json`, JSON.stringify(verdict, null, 2));
console.log('幂等实证:', JSON.stringify(verdict, null, 2));
console.log(verdict.pass ? 'PASS: 三连击仅产生一单' : 'FAIL: 产生重复单');
process.exit(verdict.pass ? 0 : 1);
