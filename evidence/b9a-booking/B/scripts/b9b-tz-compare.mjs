/**
 * 自验 7：最早可约槽 vs 单屏栅格 · 双环境（服务端 TZ）一致性
 * 用法：node b9b-tz-compare.mjs <envName> <browserTz>
 * 每环境同帧取证：首页面板 CTA data-slot-start（最早可约槽）vs
 * 单屏 /booking/grooming 栅格首个 data-available=true 单元格 data-slot-start，
 * 并附 tRPC getWithServices slots[0] 作第三方基准。三者 epoch 应全等。
 * 附信息项：浏览器切 UTC 后面板 epoch 是否保持（面板用服务端槽，应 TZ 无关）。
 */
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const [envName, browserTz] = process.argv.slice(2);
if (!envName || !browserTz) throw new Error('用法: node b9b-tz-compare.mjs <envName> <browserTz>');

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await send('Emulation.setTimezoneOverride', { timezoneId: browserTz });
await loginAsCustomer(evalJs, send);

// 确保记忆就位
await send('Page.navigate', { url: `${APP}/home` });
await sleep(1200);
const triple = await evalJs(`(async()=>{
  const r = await fetch('${API}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const store = (await r.json())[0].result.data.json.stores[0];
  const r2 = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const svc = (await r2.json())[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${API}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const pets = (await r3.json())[0].result.data.json;
  return { storeId: store.id, serviceId: svc.id, petId: pets[0].id };
})()`);
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(triple)}))`);

// tRPC 基准：时长连续过滤后首个可约槽
const baseline = await evalJs(`(async()=>{
  const input = {"0":{"json":{"storeId":"${triple.storeId}","serviceId":"${triple.serviceId}"}}};
  const r = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify(input)),{credentials:'include'});
  const d = await r.json();
  const slots = d[0].result.data.json.slots;
  const first = slots[0]?.slotStart ?? null;
  return { count: slots.length, firstEpoch: first ? new Date(first).getTime() : null };
})()`);

/* ---- 面板最早可约槽 ---- */
await send('Page.navigate', { url: `${APP}/home` });
const panelOk = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"]')`, 15000);
if (!panelOk) throw new Error('rebook 面板未出现');
const panel = await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  const row = document.querySelector('[data-testid="home-rebook-slot"]');
  return { epoch: Number(el.getAttribute('data-slot-start')), text: row?.textContent ?? null };
})()`);
await sleep(300);
await shot(send, `${OUT}/tz-${envName}-panel.png`);

/* ---- 单屏栅格首个可约格 ---- */
await send('Page.navigate', {
  url: `${APP}/booking/grooming?storeId=${triple.storeId}&serviceId=${triple.serviceId}&petId=${triple.petId}`,
});
const gridOk = await waitFor(evalJs, `!!document.querySelector('[data-testid="gs-time-grid"]')`, 15000);
if (!gridOk) throw new Error('单屏栅格未出现');
await waitFor(evalJs, `!!document.querySelector('[data-available="true"]')`, 8000);
const grid = await evalJs(`(()=>{
  const cell = document.querySelector('[data-available="true"]');
  return {
    epoch: cell ? Number(cell.getAttribute('data-slot-start')) : null,
    testid: cell?.getAttribute('data-testid') ?? null,
    cellText: cell?.textContent ?? null,
  };
})()`);
await sleep(300);
await shot(send, `${OUT}/tz-${envName}-single.png`);

const result = {
  env: envName,
  browserTz,
  serverTz: process.env.SERVER_TZ_LABEL ?? 'unknown',
  trpcBaseline: baseline,
  panel,
  grid,
  panelIso: new Date(panel.epoch).toISOString(),
  gridIso: grid.epoch !== null ? new Date(grid.epoch).toISOString() : null,
  equal: panel.epoch === grid.epoch && grid.epoch === baseline.firstEpoch,
};
writeFileSync(`${OUT}/tz-${envName}-compare.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(result.equal ? `PASS[${envName}]: 面板=栅格=tRPC基准` : `FAIL[${envName}]: 三者不一致`);
process.exit(result.equal ? 0 : 1);
