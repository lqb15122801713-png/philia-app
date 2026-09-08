/**
 * B4-3 默认值预填体系证据：
 *  ① 上次成功下单记忆（localStorage）预填：真实 UI 下单 → 重进单屏三参齐（宠物/服务/门店）
 *  ② URL ?storeId/?serviceId/?petId 优先级高于记忆
 *  ③ 无历史默认：最近门店 + 该店首个在架洗护项 + 多宠物不替选「请选择」；唯一宠物直选（临时单宠物用户）
 *  ④ 一键预约/再次预约落点切新单屏（运行时 DOM 断言 + 静态 grep 记录于 verify.md）
 */
import { launchEdge, connect, loginAsSeedCustomer, waitFor, sleep, APP, API } from '../cdp-lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)));
const lines = [];
const assert = (name, ok, detail = '') => {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const cleanup = await launchEdge();
try {
  const cdp = await connect();
  await loginAsSeedCustomer(cdp);
  await cdp.evalJs(`localStorage.removeItem('philia:lastBooking'); 'ok'`);

  /* ============ ① 上次下单记忆预填 ============ */
  // 真实 UI 下单（选旺财 + 第一个可约槽 + 确认）
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1200);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-pet-card"]').click()`);
  await sleep(600);
  await cdp.evalJs(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    Array.from(sheet.querySelectorAll('button')).find(b => b.textContent.includes('旺财'))?.click();
  })()`);
  await sleep(600);
  await cdp.evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true')?.click()`);
  await sleep(500);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
  await waitFor(cdp, `location.pathname === '/booking/success'`);
  const mem = await cdp.evalJs(`localStorage.getItem('philia:lastBooking')`);
  const M = JSON.parse(mem);
  assert('① 下单成功写入 localStorage 记忆（storeId/serviceId/petId 三参齐）',
    !!(M?.storeId && M?.serviceId && M?.petId), mem ?? 'null');

  // 重进单屏：三参应按记忆预填
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1500);
  const pre1 = await cdp.evalJs(`(() => {
    const chip = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]');
    return {
      petText: document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '',
      chipId: chip?.getAttribute('data-testid')?.replace('gs-service-chip-', '') ?? null,
      chipText: chip?.textContent ?? '',
      storeText: document.querySelector('[data-testid="gs-store-line"]')?.textContent ?? '',
      btn: document.querySelector('[data-testid="gs-confirm"]')?.textContent ?? '',
    };
  })()`);
  assert('① 记忆预填：服务 chip 选中 = 记忆 serviceId', pre1.chipId === M.serviceId, `${pre1.chipId} vs ${M.serviceId}`);
  assert('① 记忆预填：宠物卡已选（旺财）', pre1.petText.includes('旺财'), pre1.petText.slice(0, 30));
  assert('① 记忆预填：门店 = 记忆门店（菲丽亚宠物·示例店）', pre1.storeText.includes('菲丽亚宠物'), pre1.storeText.slice(0, 30));
  assert('① 预填已齐 → 按钮仅缺时间（「请选择时间」）', pre1.btn.includes('请选择时间'), pre1.btn);
  await cdp.shot(resolve(OUT, 'B4-3-①上次下单记忆预填.png'));
  writeFileSync(resolve(OUT, 'B4-3-①上次下单记忆预填.txt'),
    `localStorage philia:lastBooking = ${mem}\n重进单屏: ${JSON.stringify(pre1, null, 2)}\n`);

  /* ============ ② URL 参数优先级高于记忆 ============ */
  const ids = await cdp.evalJs(`(async () => {
    const q = (p, input) => fetch('${API}/trpc/' + p + '?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:input}})), {credentials:'include'}).then(r=>r.json()).then(d=>d[0].result.data.json);
    const sws = await q('store.getWithServices', { storeId: '${M.storeId}' });
    const alt = sws.services.find(s => s.type === 'grooming' && s.id !== '${M.serviceId}');
    const pets = await q('pet.list', null);
    const otherPet = pets.find(p => p.id !== '${M.petId}');
    return { altServiceId: alt.id, altServiceName: alt.name, otherPetId: otherPet.id, otherPetName: otherPet.name };
  })()`);
  await cdp.nav(`${APP}/booking/grooming?storeId=${M.storeId}&serviceId=${ids.altServiceId}&petId=${ids.otherPetId}`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1500);
  const pre2 = await cdp.evalJs(`(() => {
    const chip = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]');
    return {
      petText: document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '',
      chipId: chip?.getAttribute('data-testid')?.replace('gs-service-chip-', '') ?? null,
      chipText: chip?.textContent ?? '',
    };
  })()`);
  assert(`② URL 优先：服务选中 = URL 的 ${ids.altServiceName}（非记忆项）`, pre2.chipId === ids.altServiceId, pre2.chipText.slice(0, 30));
  assert(`② URL 优先：宠物选中 = URL 的 ${ids.otherPetName}（非记忆宠物）`, pre2.petText.includes(ids.otherPetName), pre2.petText.slice(0, 30));
  await cdp.shot(resolve(OUT, 'B4-3-②URL参数优先级高于记忆.png'));
  writeFileSync(resolve(OUT, 'B4-3-②URL参数优先级高于记忆.txt'),
    `记忆: ${mem}\nURL: serviceId=${ids.altServiceId} petId=${ids.otherPetId}\n结果: ${JSON.stringify(pre2, null, 2)}\n`);

  /* ============ ③ 无历史默认 ============ */
  await cdp.evalJs(`localStorage.removeItem('philia:lastBooking'); 'ok'`);
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1500);
  const pre3 = await cdp.evalJs(`(() => {
    const chip = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]');
    return {
      petText: document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '',
      chipText: chip?.textContent ?? '',
      storeText: document.querySelector('[data-testid="gs-store-line"]')?.textContent ?? '',
    };
  })()`);
  assert('③ 无历史：门店 = 最近门店（listNearby 第一家）', pre3.storeText.includes('菲丽亚宠物·示例店'), pre3.storeText.slice(0, 30));
  assert('③ 无历史：服务 = 该店首个在架洗护项（基础洗护（小型犬））', pre3.chipText.includes('基础洗护（小型犬）'), pre3.chipText.slice(0, 30));
  assert('③ 无历史：多宠物不替选（「请选择宠物」）', pre3.petText.includes('请选择宠物'), pre3.petText.slice(0, 30));
  await cdp.shot(resolve(OUT, 'B4-3-③无历史默认-多宠不替选.png'));
  writeFileSync(resolve(OUT, 'B4-3-③无历史默认-多宠不替选.txt'), JSON.stringify(pre3, null, 2) + '\n');

  // 唯一宠物直选：临时单宠物用户（B4空宠物客户 + pet.upsert 一只）
  const seeds = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json());
  const nopet = seeds.users.find((u) => u.nickname === 'B4空宠物客户');
  const st = await cdp.evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userId:'${nopet.id}'}), credentials:'include' }).then(r=>r.status)`);
  assert('③ 临时用户登录', st === 200, `HTTP ${st}`);
  // 幂等：已有 1 只宠物则不重复建档（>1 只为脏数据，提示先 cleanup）
  const petCount = await cdp.evalJs(`(async () => {
    const d = await fetch('${API}/trpc/pet.list?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:null}})), {credentials:'include'}).then(r=>r.json());
    return d[0].result.data.json.length;
  })()`);
  if (petCount === 0) {
    await cdp.evalJs(`fetch('${API}/trpc/pet.upsert?batch=1', { method:'POST', headers:{'content-type':'application/json'}, credentials:'include',
      body: JSON.stringify({0:{json:{name:'独苗', species:'dog', breed:'柯基', weightKg:12}}}) }).then(r=>r.status)`);
  }
  assert('③ 临时用户恰有 1 只宠物（唯一宠物直选前提）', petCount <= 1, `pets=${petCount}`);
  await cdp.evalJs(`localStorage.removeItem('philia:lastBooking'); 'ok'`);
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1500);
  const pre4 = await cdp.evalJs(`document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? ''`);
  assert('③ 无历史：唯一宠物直选（宠物卡显示「独苗」）', pre4.includes('独苗'), pre4.slice(0, 40));
  await cdp.shot(resolve(OUT, 'B4-3-③无历史默认-唯一宠物直选.png'));
  writeFileSync(resolve(OUT, 'B4-3-③无历史默认-唯一宠物直选.txt'), `宠物卡: ${pre4}\n`);

  /* ============ ④ 落点切新单屏（运行时） ============ */
  await loginAsSeedCustomer(cdp);
  // 4a. 完成单「再次预约」：找一单 completed 洗护 → 详情页点「再次预约」
  const completedId = await cdp.evalJs(`(async () => {
    const d = await fetch('${API}/trpc/appointment.listMine?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:null}})), {credentials:'include'}).then(r=>r.json());
    const g = d[0].result.data.json.groups;
    const c = (g.completed ?? []).find(a => a.type === 'grooming');
    return c?.id ?? null;
  })()`);
  assert('④ 存在 completed 洗护单（再次预约入口前提）', completedId !== null, String(completedId));
  if (completedId) {
    await cdp.nav(`${APP}/appointments/${completedId}`);
    await sleep(1800);
    await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '再次预约')?.click()`);
    await sleep(2200);
    const land = await cdp.evalJs(`({ path: location.pathname, search: location.search, single: !!document.querySelector('[data-testid="grooming-single"]'), chip: !!document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]'), pet: document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '' })`);
    assert('④ 完成单「再次预约」落点 = 新单屏 /booking/grooming（带三参预填）',
      land.path === '/booking/grooming' && land.single && land.search.includes('serviceId=') && land.search.includes('petId='),
      JSON.stringify(land).slice(0, 140));
    assert('④ 落点预填生效（服务已选 + 宠物已选）', land.chip && !land.pet.includes('请选择'), JSON.stringify({ chip: land.chip, pet: land.pet.slice(0, 20) }));
    await cdp.shot(resolve(OUT, 'B4-3-④完成单再次预约落点.png'));
    writeFileSync(resolve(OUT, 'B4-3-④完成单再次预约落点.txt'), JSON.stringify(land, null, 2) + '\n');
  }
  // 4b. Philia 中按钮长按 →「再次预约同款服务」→ 新单屏（rec2 录屏同源实证，此处 DOM 断言存档）
  await cdp.nav(`${APP}/home`);
  await sleep(1800);
  const rect = await cdp.evalJs(`(() => { const b = document.querySelector('button[aria-label="Philia"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(800);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(800);
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('再次预约同款服务'))?.click()`);
  await sleep(2200);
  const land2 = await cdp.evalJs(`({ path: location.pathname, single: !!document.querySelector('[data-testid="grooming-single"]') })`);
  assert('④ Philia 中按钮长按一键预约落点 = 新单屏（交互不变）', land2.path === '/booking/grooming' && land2.single, JSON.stringify(land2));
  await cdp.shot(resolve(OUT, 'B4-3-④长按一键预约落点.png'));
  writeFileSync(resolve(OUT, 'B4-3-④长按一键预约落点.txt'), JSON.stringify(land2, null, 2) + '\n');

  writeFileSync(resolve(OUT, 'verify-asserts.txt'), lines.join('\n') + '\n');
  const failed = lines.filter((l) => l.startsWith('FAIL'));
  console.log(`\n===== B4-3 汇总：${lines.length - failed.length}/${lines.length} 通过 =====`);
  cdp.close();
  process.exitCode = failed.length ? 1 : 0;
} finally {
  cleanup();
}
