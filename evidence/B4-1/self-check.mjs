/** B4-1 自验：新单屏首渲染 + 缺项置灰态 + 选时间后可点态（截图 + DOM 断言） */
import { launchEdge, connect, loginAsSeedCustomer, waitFor, sleep, APP } from '../cdp-lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)));
const results = [];
const assert = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const cleanup = await launchEdge();
try {
  const cdp = await connect();
  await loginAsSeedCustomer(cdp);
  // 清 localStorage 保证「新客无历史」基线
  await cdp.evalJs(`localStorage.removeItem('philia:lastBooking'); 'ok'`);
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="grooming-single"]')`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-pet-card"]')`);
  await sleep(1500);

  /* 区块存在性 */
  for (const [name, sel] of [
    ['宠物卡', '[data-testid="gs-pet-card"]'],
    ['服务 chips', '[data-testid="gs-service-chips"]'],
    ['门店单行', '[data-testid="gs-store-line"]'],
    ['日期横条', '[data-testid="gs-date-strip"]'],
    ['时段栅格', '[data-testid="gs-time-grid"]'],
    ['折叠区', '[data-testid="gs-extras"]'],
    ['吸底确认条', '[data-testid="gs-confirm"]'],
  ]) {
    assert(`区块渲染：${name}`, await cdp.evalJs(`!!document.querySelector('${sel}')`));
  }

  /* B4-3 默认预填（无历史）：服务=首个在架洗护项，门店=最近门店，宠物=多宠物不替选 */
  const pre = await cdp.evalJs(`(() => {
    const chip = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]');
    const petText = document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '';
    const storeText = document.querySelector('[data-testid="gs-store-line"]')?.textContent ?? '';
    return { chip: chip?.textContent ?? null, petText, storeText };
  })()`);
  assert('默认服务=首个在架洗护项（基础洗护（小型犬））', pre.chip?.includes('基础洗护（小型犬）') ?? false, pre.chip ?? '');
  assert('多宠物不替选（宠物卡显示「请选择宠物」）', pre.petText.includes('请选择宠物'), pre.petText.slice(0, 30));
  assert('默认门店=最近门店（菲丽亚宠物·示例店）', pre.storeText.includes('菲丽亚宠物'), pre.storeText.slice(0, 30));

  /* 更多服务渐进披露（6 项 > 4） */
  const chipCount = await cdp.evalJs(`document.querySelectorAll('[data-testid^="gs-service-chip-"]').length`);
  assert('服务 chips 默认折叠为 4 个', chipCount === 4, `chips=${chipCount}`);
  assert('「更多服务 ▸」存在', await cdp.evalJs(`!!document.querySelector('[data-testid="gs-service-more"]')`));

  /* 日期横条 7 天 + 整月日历开关 */
  const dayCount = await cdp.evalJs(`document.querySelectorAll('[data-testid^="gs-day-"]').length`);
  assert('日期横条 7 天', dayCount === 7, `days=${dayCount}`);
  assert('「展开整月日历 ▸」存在', await cdp.evalJs(`!!document.querySelector('[data-testid="gs-calendar-toggle"]')`));

  /* 时段分组 */
  const groups = await cdp.evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-time-group-"]')).map(g => g.getAttribute('data-testid'))`);
  assert('时段按上午/下午/晚上分组', groups.length >= 2, JSON.stringify(groups));

  /* 三态 1：缺项置灰（未选宠物+未选时间，按区块顺序点名「请选择宠物」） */
  const btn1 = await cdp.evalJs(`(() => {
    const b = document.querySelector('[data-testid="gs-confirm"]');
    return { text: b?.textContent ?? '', state: b?.getAttribute('data-state'), disabled: b?.disabled };
  })()`);
  assert('缺项置灰并点名（请选择宠物）', btn1.state === 'disabled' && btn1.text.includes('请选择宠物'), JSON.stringify(btn1));

  /* 截图：首屏 + 缺项置灰态 */
  await cdp.shot(resolve(OUT, 'single-首屏缺项置灰.png'));

  /* 选宠物（底部半屏）→ 选时间 → 可点态 */
  await cdp.evalJs(`document.querySelector('[data-testid="gs-pet-card"]').click()`);
  await sleep(700);
  assert('宠物底部半屏弹出', await cdp.evalJs(`!!document.querySelector('[data-testid="gs-pet-sheet"]')`));
  await cdp.shot(resolve(OUT, 'single-宠物半屏.png'));
  await cdp.evalJs(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    const btn = Array.from(sheet.querySelectorAll('button')).find(b => b.textContent.includes('旺财'));
    btn?.click(); return btn?.textContent ?? null;
  })()`);
  await sleep(600);
  const btn2 = await cdp.evalJs(`(() => {
    const b = document.querySelector('[data-testid="gs-confirm"]');
    return { text: b?.textContent ?? '', state: b?.getAttribute('data-state') };
  })()`);
  assert('选宠物后缺项点名为「请选择时间」', btn2.state === 'disabled' && btn2.text.includes('请选择时间'), JSON.stringify(btn2));
  await cdp.shot(resolve(OUT, 'single-缺项请选择时间.png'));

  // 点第一个可约槽
  const slotText = await cdp.evalJs(`(() => {
    const s = Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true');
    s?.click(); return s?.textContent ?? null;
  })()`);
  await sleep(600);
  const btn3 = await cdp.evalJs(`(() => {
    const b = document.querySelector('[data-testid="gs-confirm"]');
    return { text: b?.textContent ?? '', state: b?.getAttribute('data-state'), disabled: b?.disabled };
  })()`);
  assert('选时间后可点态「确认预约 · ¥88 · 约 60 分钟」', btn3.state === 'ready' && /确认预约 · ¥\d+ · 约 \d+ 分钟/.test(btn3.text), JSON.stringify({ ...btn3, slotText }));
  await cdp.shot(resolve(OUT, 'single-可点态.png'));

  writeFileSync(resolve(OUT, 'self-check-asserts.txt'),
    results.map(r => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`).join('\n') + '\n');
  const failed = results.filter(r => !r.ok);
  console.log(`\n===== 自验汇总：${results.length - failed.length}/${results.length} 通过 =====`);
  cdp.close();
  process.exit(failed.length ? 1 : 0);
} finally {
  cleanup();
}
