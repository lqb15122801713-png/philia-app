/** b9.3 三态回归（9a 口径）：rebook 一键再约态 + entry 降级入口卡态（in-service 已另存） */
import { writeFileSync } from 'node:fs';
import { Browser, findUser, sleep } from '../../_lib/phil.mjs';

const OUT = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9.3-home';
const APP = 'http://localhost:7100';

const b = new Browser();
await b.launch();
await b.viewport(390, 844, true);
const user = await findUser('customer');
await b.goto(`${APP}/dev-login`, 2500);
await b.loginInPage(user.id);

// 下单记忆（真实种子三元组，同复现脚本）
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
console.log('三元组', ids);

/* rebook 态 */
await b.eval(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(ids)}))`);
await b.goto(`${APP}/home`, 4500);
const mode1 = await b.eval(`(()=>{
  if (document.querySelector('[data-testid="home-inservice-panel"]')) return 'in-service';
  if (document.querySelector('[data-testid="home-rebook-panel"]')) return 'rebook';
  if (document.querySelector('[data-testid="home-booking-entry"]')) return 'entry:'+document.querySelector('[data-testid="home-booking-entry"]').getAttribute('data-reason');
  return 'none';
})()`);
console.log('rebook 期望态 -> 实际:', mode1);
const sub1 = await b.eval(`document.querySelector('[data-testid="home-greeting-sub"]')?.textContent ?? null`);
console.log('副句:', sub1);
await b.shot(`${OUT}/state-rebook.png`);
writeFileSync(`${OUT}/state-rebook.json`, JSON.stringify({ mode: mode1, subtitle: sub1, ids }, null, 2));

/* entry 降级态（无记忆） */
await b.eval(`localStorage.removeItem('philia:lastBooking')`);
await b.goto(`${APP}/home`, 4500);
const mode2 = await b.eval(`(()=>{
  const e = document.querySelector('[data-testid="home-booking-entry"]');
  if (document.querySelector('[data-testid="home-inservice-panel"]')) return 'in-service';
  if (document.querySelector('[data-testid="home-rebook-panel"]')) return 'rebook';
  if (e) return 'entry:'+e.getAttribute('data-reason');
  return 'none';
})()`);
console.log('entry 期望态 -> 实际:', mode2);
await b.shot(`${OUT}/state-entry.png`);
writeFileSync(`${OUT}/state-entry.json`, JSON.stringify({ mode: mode2 }, null, 2));

b.close();
const ok = mode1 === 'rebook' && mode2.startsWith('entry');
console.log(ok ? '三态回归 OK' : '三态回归 FAIL');
process.exit(ok ? 0 : 1);
