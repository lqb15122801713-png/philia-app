/** b9.3 复现留证：改造前首页现状版式（有记忆 rebook 态 + 无记忆降级态） */
import { writeFileSync } from 'node:fs';
import { Browser, findUser, sleep } from '../../_lib/phil.mjs';

const OUT = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9.3-home';
const APP = 'http://localhost:7100';

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);

const user = await findUser('customer');
await b.goto(`${APP}/dev-login`, 2500);
const status = await b.loginInPage(user.id);
console.log('dev-login', status);

// 有记忆态：写 B4-3 下单记忆（门店/服务/宠物取真实种子数据）
await b.goto(`${APP}/home`, 3000);
const ids = await b.eval(`(async()=>{
  const r = await fetch('http://localhost:7200/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const d = await r.json();
  const store = d[0].result.data.json.stores[0];
  const r2 = await fetch('http://localhost:7200/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const d2 = await r2.json();
  const svc = d2[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('http://localhost:7200/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const d3 = await r3.json();
  return { storeId: store.id, serviceId: svc.id, petId: d3[0].result.data.json[0].id };
})()`);
console.log('预填三元组', ids);
await b.eval(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(ids)}))`);
await b.goto(`${APP}/home`, 3500);
await b.shot(`${OUT}/before-home-rebook.png`);
writeFileSync(`${OUT}/before-home-rebook.txt`, await b.eval('document.body.innerText'));

// 无记忆降级态
await b.eval(`localStorage.removeItem('philia:lastBooking')`);
await b.goto(`${APP}/home`, 3500);
await b.shot(`${OUT}/before-home-entry.png`);

b.close();
console.log('done');
process.exit(0);
