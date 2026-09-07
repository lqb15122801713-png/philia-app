/**
 * B2-3 复现截图（修复前）：已完成洗护/寄养详情页只有评价区，无「再次预约」入口。
 * 输出：before-detail-grooming.png / before-detail-boarding.png / before-dom.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser } from '../_lib/phil.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CUSTOMER = 'http://localhost:7100';
const data = JSON.parse(readFileSync(resolve(DIR, 'data.json'), 'utf8'));

const customer = await findUser('customer');
const b = new Browser();
const out = {};
try {
  await b.launch();
  await b.viewport(390, 844, true);
  await b.goto(`${CUSTOMER}/dev-login`, 2500);
  const st = await b.loginInPage(customer.id);
  if (st !== 200) throw new Error('客户登录失败');

  for (const [key, appt] of [['grooming', data.groomingDone], ['boarding', data.boardingDone]]) {
    await b.goto(`${CUSTOMER}/appointments/${appt.id}`, 3500);
    const dom = await b.eval(`(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button, a')).map(e => e.textContent.trim()).filter(Boolean);
      return {
        url: location.pathname,
        hasReviewSection: text.includes('服务评价'),
        hasRebook: text.includes('再次预约') || text.includes('一键复购') || text.includes('再买一次'),
        statusCompleted: text.includes('已完成'),
        buttons,
      };
    })()`);
    out[key] = dom;
    console.log(key, JSON.stringify(dom));
    await b.shot(resolve(DIR, `before-detail-${key}.png`));
  }
  writeFileSync(resolve(DIR, 'before-dom.json'), JSON.stringify(out, null, 2));
  if (out.grooming.hasRebook || out.boarding.hasRebook) {
    console.log('UNEXPECTED: 已存在再次预约入口？');
  } else {
    console.log('REPRO OK: 两个完成单详情页均无「再次预约」入口');
  }
} finally {
  b.close();
}
