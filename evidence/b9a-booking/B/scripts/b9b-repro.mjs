/** 复现留证：改造前首页主区截图（有记忆 + 无记忆两态）+ DOM 文本 */
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);

// 先造一笔下单记忆（模拟老用户）：直接写 localStorage B4-3 键
await send('Page.navigate', { url: `${APP}/home` });
await waitFor(evalJs, `document.body.innerText.includes('菲丽亚宠物')`);
const ids = await evalJs(`(async()=>{
  const r = await fetch('${'http://localhost:7200'}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const d = await r.json();
  const store = d[0].result.data.json.stores[0];
  const r2 = await fetch('${'http://localhost:7200'}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const d2 = await r2.json();
  const svc = d2[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${'http://localhost:7200'}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const d3 = await r3.json();
  return { storeId: store.id, serviceId: svc.id, petId: d3[0].result.data.json[0].id };
})()`);
console.log('预填三元组', ids);
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(ids)}))`);

await send('Page.navigate', { url: `${APP}/home` });
await sleep(2500);
await shot(send, `${OUT}/repro-home-with-memory.png`);
const txt1 = await evalJs(`document.body.innerText`);
writeFileSync(`${OUT}/repro-home-with-memory.txt`, txt1);

// 无记忆态
await evalJs(`localStorage.removeItem('philia:lastBooking')`);
await send('Page.navigate', { url: `${APP}/home` });
await sleep(2500);
await shot(send, `${OUT}/repro-home-no-memory.png`);

console.log('--- 改造前首页主区文本（有记忆） ---');
console.log(txt1.split('\n').slice(0, 30).join('\n'));
process.exit(0);
