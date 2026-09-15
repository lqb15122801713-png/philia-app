/** 信息项：浏览器 TZ=UTC（服务端 UTC）下面板与单屏栅格行为观察（非闸门） */
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';
const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const cdp = await connectCdp();
const { send, evalJs } = cdp;
await send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
await loginAsCustomer(evalJs, send);
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
await send('Page.navigate', { url: `${APP}/home` });
await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"],[data-testid="home-booking-entry"]')`, 15000);
const panel = await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  const row = document.querySelector('[data-testid="home-rebook-slot"]');
  const entry = document.querySelector('[data-testid="home-booking-entry"]');
  return { rebookShown: !!el, epoch: el ? Number(el.getAttribute('data-slot-start')) : null, text: row?.textContent ?? null, entryShown: !!entry };
})()`);
await send('Page.navigate', { url: `${APP}/booking/grooming?storeId=${triple.storeId}&serviceId=${triple.serviceId}&petId=${triple.petId}` });
await waitFor(evalJs, `!!document.querySelector('[data-testid="gs-time-grid"],[data-testid="gs-time-loading"],[data-testid="gs-time-closed"],[data-testid="gs-time-passed"]')`, 15000);
await sleep(1500);
const grid = await evalJs(`(()=>{
  const cell = document.querySelector('[data-available="true"]');
  return { firstAvailableEpoch: cell ? Number(cell.getAttribute('data-slot-start')) : null,
           availableCount: document.querySelectorAll('[data-available="true"]').length };
})()`);
await shot(send, `${OUT}/tz-browser-utc-single.png`);
const out = { note: '信息项（非闸门）：浏览器 TZ=UTC。面板用服务端槽 epoch（TZ 无关）；单屏栅格 buildWeekGrid 按浏览器本地日界+营业时间生成候选格，与 +8 服务端槽 epoch 不对齐属既有行为（B4 单屏逻辑，本批不动）。', browserTz: 'UTC', serverTz: 'UTC', panel, grid, panelIso: panel.epoch ? new Date(panel.epoch).toISOString() : null };
writeFileSync(`${OUT}/tz-browser-utc-note.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
process.exit(0);
