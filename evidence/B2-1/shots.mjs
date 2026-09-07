/**
 * B2-1 截图脚本：商家登录 → 仪表盘截图 → 点「待确认 · 去处理」→ 列表截图。
 * 用法：node shots.mjs <before|after> [regress]
 *   after + regress 时追加：四个日期过滤档手动切换点验 + TabBar 直达（默认今天）检查。
 * 输出：evidence/B2-1/<prefix>-*.png / <prefix>-dom.json / <prefix>-ranges.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] ?? 'before';
const regress = process.argv[3] === 'regress';
const MERCHANT = 'http://localhost:7101';

const merchant = await findUser('merchant_owner');
console.log('merchant:', merchant.nickname, merchant.id);

const b = new Browser();
try {
  await b.launch();
  await b.viewport(390, 844, true);

  // 登录页落点 + 页面内登录
  await b.goto(`${MERCHANT}/dev-login`, 2500);
  const st = await b.loginInPage(merchant.id);
  console.log('login HTTP', st);
  if (st !== 200) throw new Error('商家登录失败');

  // 1) 仪表盘
  await b.goto(`${MERCHANT}/dashboard`, 3500);
  const dash = await b.eval(`(() => {
    const rows = Array.from(document.querySelectorAll('section ul li button'));
    const todo = rows.map(r => r.textContent.replace(/\\s+/g, '')).filter(t => t.includes('去处理'));
    return { todo, bodyHasPending: document.body.textContent.includes('待确认') };
  })()`);
  console.log('dashboard todo rows:', JSON.stringify(dash));
  await b.shot(resolve(DIR, `${prefix}-1-dashboard.png`));

  // 2) 点击「待确认」行的去处理
  await b.eval(`(() => {
    const rows = Array.from(document.querySelectorAll('section ul li button'));
    const row = rows.find(r => r.textContent.includes('待确认'));
    if (!row) throw new Error('未找到待确认行');
    row.click();
  })()`);
  await sleep(3000);
  const listInfo = await b.eval(`(() => {
    const text = document.body.textContent;
    const empty = text.includes('该条件下暂无预约');
    // 日期过滤按钮激活态
    const btns = Array.from(document.querySelectorAll('button')).filter(b => ['今天','明天','本周','自定义','全部'].includes(b.textContent.trim()));
    const active = btns.filter(b => b.className.includes('font-semibold')).map(b => b.textContent.trim());
    const cards = document.querySelectorAll('a[href^="/appointments/"], [data-appt-row]').length;
    return { url: location.href, empty, activeRange: active, rowNodes: cards,
      hasWangcai: text.includes('旺财'), snippet: text.slice(0, 400) };
  })()`);
  console.log('list:', JSON.stringify(listInfo));
  await b.shot(resolve(DIR, `${prefix}-2-list.png`));
  writeFileSync(resolve(DIR, `${prefix}-dom.json`), JSON.stringify({ dash, listInfo }, null, 2));

  if (regress) {
    // 3) 回归：四个日期过滤档手动切换
    const ranges = {};
    for (const label of ['今天', '明天', '本周', '自定义']) {
      await b.eval(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '${label}');
        if (!btn) throw new Error('未找到日期档 ${label}');
        btn.click();
      })()`);
      await sleep(2200);
      ranges[label] = await b.eval(`(() => {
        const text = document.body.textContent;
        return { empty: text.includes('该条件下暂无预约'), hasWangcai: text.includes('旺财'),
          dateInputs: document.querySelectorAll('input[type="date"]').length };
      })()`);
      console.log('range', label, JSON.stringify(ranges[label]));
      await b.shot(resolve(DIR, `${prefix}-range-${label}.png`));
    }
    // 4) 回归：非待办入口（直接导航 /appointments，无参数）→ 默认「今天」
    await b.goto(`${MERCHANT}/appointments`, 3000);
    const direct = await b.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => ['今天','明天','本周','自定义','全部'].includes(b.textContent.trim()));
      const active = btns.filter(b => b.className.includes('font-semibold')).map(b => b.textContent.trim());
      return { url: location.href, activeRange: active, empty: document.body.textContent.includes('该条件下暂无预约') };
    })()`);
    console.log('direct entry:', JSON.stringify(direct));
    await b.shot(resolve(DIR, `${prefix}-3-direct-today.png`));
    writeFileSync(resolve(DIR, `${prefix}-ranges.json`), JSON.stringify({ ranges, direct }, null, 2));
  }
} finally {
  b.close();
}
