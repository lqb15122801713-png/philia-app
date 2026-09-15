/**
 * 自验 6：GroomingReminder 与主区面板共存关系（数据环境：最近 completed 洗护单 = 20 天前，reminder 条件满足）
 *  正例：entry 降级态（无记忆）→ reminder 渲染；
 *  反例：rebook 一键再约态（有记忆）→ reminder 被主区面板控制逻辑隐藏（数据条件满足也不渲染）。
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { connectCdp, loginAsCustomer, shot, sleep, waitFor, APP, API } from './b9b-lib.mjs';

const OUT = process.env.EVD ?? 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/evidence/b9a-booking/B';
const SERVER_DIR = 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server';
const tsx = (script, ...extra) => {
  const r = spawnSync('node', ['node_modules/tsx/dist/cli.mjs', script, ...extra], { cwd: SERVER_DIR, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`${script} 失败: ${r.stderr}`);
  return r.stdout;
};

const cdp = await connectCdp();
const { send, evalJs } = cdp;
await loginAsCustomer(evalJs, send);

// 造数：最近 completed = 20 天前（reminder 条件满足）
console.log(tsx('scripts/b9b-reminder-dates.mts'));

// 基础三元组
await send('Page.navigate', { url: `${APP}/home` });
await sleep(1200);
const base = await evalJs(`(async()=>{
  const r = await fetch('${API}/trpc/store.listNearby?batch=1&input='+encodeURIComponent('{"0":{"json":{}}}'),{credentials:'include'});
  const store = (await r.json())[0].result.data.json.stores[0];
  const r2 = await fetch('${API}/trpc/store.getWithServices?batch=1&input='+encodeURIComponent(JSON.stringify({"0":{"json":{storeId:store.id}}})),{credentials:'include'});
  const svc = (await r2.json())[0].result.data.json.services.find(s=>s.type==='grooming');
  const r3 = await fetch('${API}/trpc/pet.list?batch=1&input='+encodeURIComponent('{"0":{"json":null}}'),{credentials:'include'});
  const pets = (await r3.json())[0].result.data.json;
  return { storeId: store.id, serviceId: svc.id, petId: pets[0].id };
})()`);

const snap = async (name) => {
  await send('Page.navigate', { url: `${APP}/home` });
  await waitFor(
    evalJs,
    `!!document.querySelector('[data-testid="home-booking-entry"],[data-testid="home-rebook-panel"]')`,
    15000,
  );
  await sleep(800); // reminder 查询沉降
  const info = await evalJs(`(()=>{
    const r = document.querySelector('[data-testid="grooming-reminder"]');
    return {
      entryShown: !!document.querySelector('[data-testid="home-booking-entry"]'),
      rebookShown: !!document.querySelector('[data-testid="home-rebook-panel"]'),
      reminderShown: !!r,
      reminderText: r?.innerText ?? null,
    };
  })()`);
  await shot(send, `${OUT}/coexist-${name}.png`);
  writeFileSync(`${OUT}/coexist-${name}.txt`, JSON.stringify(info, null, 2));
  console.log(`${name}:`, JSON.stringify(info));
  return info;
};

/* 正例：entry 态（无记忆）→ reminder 显示 */
await evalJs(`localStorage.removeItem('philia:lastBooking')`);
const s1 = await snap('entry-reminder-shown');

/* 反例：rebook 态（有记忆）→ reminder 隐藏 */
await evalJs(`localStorage.setItem('philia:lastBooking', JSON.stringify(${JSON.stringify(base)}))`);
const s2 = await snap('rebook-reminder-hidden');

const pass =
  s1.entryShown && s1.reminderShown && s2.rebookShown && !s2.reminderShown;
console.log(pass ? 'PASS: 共存关系（entry 显示 / rebook 隐藏）' : 'FAIL: 共存断言不成立');
writeFileSync(`${OUT}/coexist-verdict.json`, JSON.stringify({ pass, entryState: s1, rebookState: s2 }, null, 2));
process.exit(pass ? 0 : 1);
