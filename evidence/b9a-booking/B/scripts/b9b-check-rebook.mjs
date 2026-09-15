/** 自验 1：常态一键再约面板渲染（有 B4-3 记忆） */
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);

// 写入 B4-3 记忆（复用复现脚本拿到的三元组；现场重新取一遍保证新鲜）
await send('Page.navigate', { url: `${APP}/home` });
await sleep(1500);
const ids = await evalJs(`(async()=>{
  const r = await fetch('${API}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const d = await r.json();
  const store = d[0].result.data.json.stores[0];
  const r2 = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const d2 = await r2.json();
  const svc = d2[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${API}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const d3 = await r3.json();
  return { storeId: store.id, serviceId: svc.id, petId: d3[0].result.data.json[0].id, storeName: store.name, svcName: svc.name };
})()`);
console.log('三元组', ids);
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify({ storeId: ids.storeId, serviceId: ids.serviceId, petId: ids.petId })}))`);

await send('Page.navigate', { url: `${APP}/home` });
const ok = await waitFor(evalJs, `!!document.querySelector('[data-testid="home-rebook-cta"]')`, 15000);
console.log('rebook 面板渲染:', ok ? 'OK' : 'FAIL');
const info = await evalJs(`(()=>{
  const el = document.querySelector('[data-testid="home-rebook-cta"]');
  const panel = document.querySelector('[data-testid="home-rebook-panel"]');
  return {
    ctaText: el?.textContent,
    slotStart: el?.getAttribute('data-slot-start'),
    slotIso: el ? new Date(Number(el.getAttribute('data-slot-start'))).toISOString() : null,
    paymentMode: el?.getAttribute('data-payment-mode'),
    panelText: panel?.innerText,
    reminderShown: !!document.querySelector('[data-testid="grooming-reminder"]'),
  };
})()`);
console.log(JSON.stringify(info, null, 2));
await sleep(400);
await shot(send, `${OUT}/impl-home-rebook.png`);
process.exit(0);
