/** B3-5 修复后 UI 验收截图 · 段2：商家端（W-4 / W-14 审核链 / A-P2-14 禁用） */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, findUser, login, sleep, trpcMutate } from '../_lib/phil.mjs';

const OUT = dirname(fileURLToPath(import.meta.url));
const save = (name, data) => { writeFileSync(join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2)); console.log('saved', name); };
const fx = JSON.parse(readFileSync(join(OUT, 'ui-fixtures.json'), 'utf8'));
const customer = await findUser('customer');
const merchant = await findUser('merchant_owner');

// W-14 ≤4h 链：客户取消 orderE（已拨到 now+2h）带原因 → cancel_requested
const cC = await login(customer.id);
const cancelE = await trpcMutate('appointment.cancel', { appointmentId: fx.orderE, reason: '时间不合适：临时加班赶不过来' }, cC);
save('verify-w14-cancelE-outcome.json', { outcome: cancelE.outcome, status: cancelE.appointment.status, cancelReason: cancelE.appointment.cancelReason, cancelSource: cancelE.appointment.cancelSource });

const b = new Browser();
await b.launch();
await b.viewport(1280, 900, false);
await b.goto('http://localhost:7101/dev-login', 2500);
console.log('merchant login:', await b.loginInPage(merchant.id));

/* ---- W-4：列表/详情客户标识 ---- */
await b.goto('http://localhost:7101/appointments?date=all', 3500);
const w4 = await b.eval(`(() => {
  const rows = [...document.querySelectorAll('[role="button"]')].map((r) => r.innerText.replace(/\\n/g, ' | ')).filter((t) => t.includes('示例客户'));
  return { rowsWithNickname: rows.length, sample: rows[0] ?? null, oldStyleGone: !document.body.innerText.includes('客户 XDTB') };
})()`);
save('verify-w4-dom.json', w4);
await b.shot(join(OUT, 'verify-w4-merchant-list.png'));
console.log('w4: list shot');
await b.goto(`http://localhost:7101/appointments/${fx.orderA}`, 3000);
save('verify-w4-detail-dom.json', await b.eval(`(() => ({
  nickname: document.body.innerText.includes('示例客户'),
  tail: document.body.innerText.includes('尾号 0000'),
}))()`));
await b.shot(join(OUT, 'verify-w4-merchant-detail.png'));
console.log('w4: detail shot');

/* ---- W-14（商家侧）：取消审核透出原因 → 批准 → 已取消列表透出 ---- */
await b.goto(`http://localhost:7101/appointments/${fx.orderE}`, 3000);
save('verify-w14-merchant-review-dom.json', await b.eval(`(() => ({
  reasonShown: document.body.innerText.includes('客户取消原因') && document.body.innerText.includes('时间不合适'),
  hasApprove: [...document.querySelectorAll('button')].some((x) => x.textContent.includes('批准取消')),
}))()`));
await b.shot(join(OUT, 'verify-w14-merchant-review.png'));
console.log('w14: review shot');
await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.includes('批准取消'))?.click()`);
await sleep(700);
await b.shot(join(OUT, 'verify-w14-merchant-approve-dialog.png'));
await b.eval(`[...document.querySelectorAll('.fixed button, [role="dialog"] button, button')].filter((x) => x.textContent.trim() === '批准取消').pop()?.click()`);
await sleep(1800);
await b.goto('http://localhost:7101/appointments?status=cancelled&date=all', 3500);
save('verify-w14-merchant-cancelled-dom.json', await b.eval(`(() => {
  const rows = [...document.querySelectorAll('[role="button"]')].filter((r) => r.innerText.includes('已取消'));
  return {
    cancelledRows: rows.length,
    withReason: rows.filter((r) => r.innerText.includes('客户取消') || r.innerText.includes('商家婉拒')).map((r) => r.innerText.replace(/\\n/g, ' | ')).slice(0, 5),
  };
})()`));
await b.shot(join(OUT, 'verify-w14-merchant-cancelled.png'));
console.log('w14: cancelled list shot');

/* ---- A-P2-14（商家侧）：退房结算按钮禁用 ---- */
await b.goto('http://localhost:7101/boarding', 3200);
await b.eval(`[...document.querySelectorAll('[class*="rounded-card"]')].find((x) => x.textContent.includes('旺财') && x.textContent.includes('在店'))?.click()`);
await sleep(900);
save('verify-p214-merchant-dom.json', await b.eval(`(() => {
  const btn = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('退房结算'));
  return { found: !!btn, disabled: btn?.disabled ?? null, hintShown: document.body.innerText.includes('退房核销由员工在员工端办理') };
})()`));
await b.shot(join(OUT, 'verify-p214-merchant-disabled.png'));
console.log('p214: merchant shot');

b.close();
console.log('done');
