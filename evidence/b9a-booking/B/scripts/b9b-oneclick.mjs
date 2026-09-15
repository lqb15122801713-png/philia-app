/**
 * 自验 3：一键下单（全程 1 次点击）+ 与单屏同参数建单 DB 对比
 *  A. DB 快照（前）→ 首页 rebook 面板截图 → 单次点击 CTA → /booking/success 截图链；
 *  B. 取新单 aid1，DB 快照；
 *  C. 单屏 /booking/grooming?storeId&serviceId&petId（同三元组）→ 栅格点同一槽 →
 *     确认条提交 → aid2，DB 快照；
 *  D. 六字段对比（storeId/serviceId/petId/scheduledStart/paymentMode/priceFen）。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';

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

/* ---- 确保 B4-3 记忆就位（同复现三元组：示例店 / 基础洗护（小型犬）/ 旺财） ---- */
await send('Page.navigate', { url: `${APP}/home` });
await sleep(1200);
const triple = await evalJs(`(async()=>{
  const r = await fetch('${API}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const store = (await r.json())[0].result.data.json.stores[0];
  const r2 = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const svc = (await r2.json())[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${API}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const pet = (await r3.json())[0].result.data.json[0];
  return { storeId: store.id, serviceId: svc.id, petId: pet.id };
})()`);
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(triple)}))`);
console.log('记忆三元组', triple);

/* ---- A. 一键下单（1 次点击） ---- */
const before = dbSnap();
writeFileSync(`${OUT}/oneclick-db-before.json`, JSON.stringify(before, null, 2));
console.log('建单前客户单总数:', before.total);

await send('Page.navigate', { url: `${APP}/home` });
const panelOk = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"]')`, 15000);
if (!panelOk) throw new Error('rebook 面板未出现');
await sleep(600);
await shot(send, `${OUT}/oneclick-1-home-before-click.png`);

const cta = await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  return { text: el.textContent, slotStart: Number(el.getAttribute('data-slot-start')), paymentMode: el.getAttribute('data-payment-mode') };
})()`);
console.log('CTA:', JSON.stringify(cta), 'slotIso=', new Date(cta.slotStart).toISOString());

// 全程唯一一次点击
await evalJs(`document.querySelector('[data-testid="home-rebook-cta"]').click()`);
const succOk = await waitFor(evalJs, `location.pathname === '/booking/success' && document.body.innerText.includes('预约成功')`, 15000);
if (!succOk) throw new Error('未落入成功页');
await sleep(800);
await shot(send, `${OUT}/oneclick-2-success.png`);
const aid1 = await evalJs(`new URLSearchParams(location.search).get('aid')`);
console.log('一键建单 aid1 =', aid1, '（全程 1 次点击 → 成功页 OK）');

const row1 = dbSnap(aid1);
writeFileSync(`${OUT}/oneclick-db-row-panel.json`, JSON.stringify(row1, null, 2));

/* ---- C. 单屏同参数下单 ---- */
await send('Page.navigate', {
  url: `${APP}/booking/grooming?storeId=${triple.storeId}&serviceId=${triple.serviceId}&petId=${triple.petId}`,
});
const gridOk = await waitFor(evalJs, `!!document.querySelector('[data-testid="gs-time-grid"]')`, 15000);
if (!gridOk) throw new Error('单屏栅格未出现');
// 等自动选日/栅格稳定，点同一 epoch 的槽
const pickOk = await waitFor(
  evalJs,
  `(()=>{ const b = document.querySelector('[data-slot-start="${cta.slotStart}"][data-available="true"]');
    if (!b) return false; b.click(); return true; })()`,
  8000,
);
if (!pickOk) throw new Error('单屏栅格中同一槽不可点');
await sleep(400);
await shot(send, `${OUT}/oneclick-3-single-same-slot.png`);
const confirmBtn = await evalJs(`(()=>{
  const b = document.querySelector('[data-testid="gs-confirm"]');
  return { state: b?.getAttribute('data-state'), text: b?.textContent };
})()`);
console.log('单屏确认条:', JSON.stringify(confirmBtn));
await evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
const succ2 = await waitFor(evalJs, `location.pathname === '/booking/success' && document.body.innerText.includes('预约成功')`, 15000);
if (!succ2) throw new Error('单屏下单未成功');
const aid2 = await evalJs(`new URLSearchParams(location.search).get('aid')`);
console.log('单屏建单 aid2 =', aid2);
const row2 = dbSnap(aid2);
writeFileSync(`${OUT}/oneclick-db-row-single.json`, JSON.stringify(row2, null, 2));

/* ---- D. 六字段对比 ---- */
const cmp = {};
for (const f of ['storeId', 'serviceId', 'petId', 'scheduledStart', 'paymentMode', 'priceFen']) {
  const a = f === 'scheduledStart' ? new Date(row1[f]).toISOString() : row1[f];
  const b = f === 'scheduledStart' ? new Date(row2[f]).toISOString() : row2[f];
  cmp[f] = { panel: a, single: b, equal: a === b };
}
cmp.__allEqual = Object.values(cmp).every((v) => v.equal);
writeFileSync(`${OUT}/oneclick-db-compare.json`, JSON.stringify(cmp, null, 2));
console.log('六字段对比:', JSON.stringify(cmp, null, 2));

const after = dbSnap();
writeFileSync(`${OUT}/oneclick-db-after.json`, JSON.stringify(after, null, 2));
console.log('建单后客户单总数:', after.total, '（+2：面板 1 单 + 单屏 1 单，各自单次点击）');
console.log(cmp.__allEqual ? 'PASS: 面板建单与单屏同参数建单六字段一致' : 'FAIL: 字段不一致');
process.exit(cmp.__allEqual ? 0 : 1);
