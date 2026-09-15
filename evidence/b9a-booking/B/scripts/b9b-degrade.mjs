/**
 * 自验 5：降级三态（不替用户猜 → 退化为「预约洗护 ›」入口卡）
 *  态 1 无下单记忆：localStorage 无 philia:lastBooking → data-reason=no-memory
 *  态 2 多宠物未直选：记忆缺 petId 且客户 2 只宠物 → data-reason=pet-undecided
 *  态 3 无可约槽：记忆指向全天休息测试店 → data-reason=no-slot
 * 每态：截图 + DOM 断言（data-reason / 文案 / 入口 href）落 txt；
 * 附共存断言：entry 态 GroomingReminder 正常渲染（条件卡先例保留）。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const SERVER_DIR = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server';
const tsx = (script, ...extra) => {
  const r = spawnSync('node', ['node_modules/tsx/dist/cli.mjs', script, ...extra], { cwd: SERVER_DIR, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`${script} 失败: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);

// 基础三元组（示例店/基础洗护小型犬/旺财）
await send('Page.navigate', { url: `${APP}/home` });
await sleep(1200);
const base = await evalJs(`(async()=>{
  const r = await fetch('${API}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const store = (await r.json())[0].result.data.json.stores[0];
  const r2 = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const svc = (await r2.json())[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${API}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const pets = (await r3.json())[0].result.data.json;
  return { storeId: store.id, serviceId: svc.id, petId: pets[0].id, petCount: pets.length };
})()`);
console.log('基础数据', base);

const snapEntry = async (name) => {
  await send('Page.navigate', { url: `${APP}/home` });
  const ok = await waitFor(
    evalJs,
    `!!document.querySelector('[data-testid="home-booking-entry"],[data-testid="home-rebook-panel"],[data-testid="home-inservice-panel"]')`,
    15000,
  );
  if (!ok) throw new Error(`${name}: 面板未出现`);
  const info = await evalJs(`(()=>{
    const e = document.querySelector('[data-testid="home-booking-entry"]');
    return {
      entryShown: !!e,
      reason: e?.getAttribute('data-reason') ?? null,
      href: e?.getAttribute('href') ?? null,
      text: e?.innerText ?? null,
      rebookShown: !!document.querySelector('[data-testid="home-rebook-panel"]'),
      inserviceShown: !!document.querySelector('[data-testid="home-inservice-panel"]'),
      reminderShown: !!document.querySelector('[data-testid="grooming-reminder"]'),
    };
  })()`);
  await sleep(400);
  await shot(send, `${OUT}/degrade-${name}.png`);
  writeFileSync(`${OUT}/degrade-${name}.txt`, JSON.stringify(info, null, 2));
  console.log(`${name}:`, JSON.stringify(info));
  return info;
};

/* ---- 态 1：无下单记忆 ---- */
await evalJs(`localStorage.removeItem('philia:lastBooking')`);
const s1 = await snapEntry('1-no-memory');
if (s1.reason !== 'no-memory' || s1.href !== '/booking/grooming') throw new Error('态1 断言失败');

/* ---- 态 2：多宠物未直选（记忆缺 petId；种子客户 2 只宠物） ---- */
if (base.petCount < 2) throw new Error('种子客户需 ≥2 只宠物才能实证多宠物未直选');
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify({ storeId: '${base.storeId}', serviceId: '${base.serviceId}' }))`);
const s2 = await snapEntry('2-pet-undecided');
if (s2.reason !== 'pet-undecided') throw new Error('态2 断言失败');

/* ---- 态 3：无可约槽（全天休息测试店） ---- */
const closed = tsx('scripts/b9b-closed-store.mts');
console.log('休息测试店', closed);
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify({ storeId: '${closed.storeId}', serviceId: '${closed.serviceId}', petId: '${base.petId}' }))`);
const s3 = await snapEntry('3-no-slot');
if (s3.reason !== 'no-slot') throw new Error('态3 断言失败');

/* ---- 还原：正常记忆（供后续双环境一致性用），清理测试店 ---- */
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify({ storeId: base.storeId, serviceId: base.serviceId, petId: base.petId })}))`);
tsx('scripts/b9b-closed-store.mts', '--cleanup');

// 共存断言汇总：entry 态 reminder 应展示（种子客户有 26 天前完成单）
const co = { noMemoryReminderShown: s1.reminderShown, petUndecidedReminderShown: s2.reminderShown, noSlotReminderShown: s3.reminderShown };
writeFileSync(`${OUT}/degrade-coexist-reminder.json`, JSON.stringify(co, null, 2));
console.log('共存断言（entry 态 GroomingReminder 展示）:', JSON.stringify(co));
console.log('PASS: 降级三态全部命中');
process.exit(0);
