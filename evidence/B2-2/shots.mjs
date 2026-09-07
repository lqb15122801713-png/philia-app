/**
 * B2-2 截图脚本：客户登录 → /appointments → 逐 Tab 记录计数与列表状态徽标。
 * 用法：node shots.mjs <before|after>
 * 输出：evidence/B2-2/<prefix>-tab-*.png / <prefix>-tabs.json
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, sleep } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const prefix = process.argv[2] ?? 'before';
const CUSTOMER = 'http://localhost:7100';

const customer = await findUser('customer');
console.log('customer:', customer.nickname, customer.id);

const b = new Browser();
try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto(`${CUSTOMER}/dev-login`, 2500);
  const st = await b.loginInPage(customer.id);
  console.log('login HTTP', st);
  if (st !== 200) throw new Error('客户登录失败');

  await b.goto(`${CUSTOMER}/appointments`, 3500);

  const tabInfo = await b.eval(`(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b =>
      /^(待确认|已确认|服务中|已完成|已取消)/.test(b.textContent.trim()));
    return btns.map(b => b.textContent.trim().replace(/\\s+/g, ''));
  })()`);
  console.log('tabs:', JSON.stringify(tabInfo));

  const out = { tabs: tabInfo, detail: {} };
  for (const raw of tabInfo) {
    const label = raw.replace(/\d+$/, '');
    await b.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('${label}'));
      if (!btn) throw new Error('未找到 Tab ${label}');
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      btn.click();
    })()`);
    await sleep(2000);
    const d = await b.eval(`(() => {
      const cards = Array.from(document.querySelectorAll('a[href^="/appointments/"]'));
      return {
        cards: cards.map(c => c.textContent.replace(/\\s+/g, '')),
        badges: cards.map(c => {
          const pill = c.querySelector('span.rounded-full');
          return pill ? pill.textContent.trim() : '';
        }),
        emptyText: document.body.textContent.includes('暂无') ? true : false,
      };
    })()`);
    out.detail[label] = d;
    console.log(label, JSON.stringify(d));
    if (prefix === 'regress' || label === '已完成' || label === '已取消') {
      await b.shot(resolve(DIR, `${prefix}-tab-${label}.png`));
    }
  }
  writeFileSync(resolve(DIR, `${prefix}-tabs.json`), JSON.stringify(out, null, 2));
} finally {
  b.close();
}
