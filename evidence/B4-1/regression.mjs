/** B4-1 回归：旧向导 /booking/grooming/wizard 走通 + 寄养向导不受影响（截图+断言） */
import { launchEdge, connect, loginAsSeedCustomer, waitFor, sleep, APP } from '../cdp-lib.mjs';
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

  /* 旧向导：步骤条在、可逐步走到确认屏 */
  await cdp.nav(`${APP}/booking/grooming/wizard`);
  await waitFor(cdp, `document.body.innerText.includes('选服务')`);
  const step1 = await cdp.evalJs(`document.body.innerText.match(/选服务[\\s\\S]{0,40}确认/)?.[0] ?? ''`);
  assert('旧向导 4 步步骤条渲染（/wizard 路由）', step1.includes('选门店') && step1.includes('确认'), step1.replace(/\n/g, '→'));
  await cdp.shot(resolve(OUT, 'regression-wizard-屏1.png'));
  // 选服务 → 下一步（单店跳屏2）→ 屏3 选时间 → 下一步 → 屏4
  await cdp.evalJs(`(() => { const b = Array.from(document.querySelectorAll('button')).filter(x => x.textContent.includes('分钟')); b[0]?.click(); })()`);
  await sleep(500);
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步')?.click()`);
  await sleep(1200);
  const s3 = await cdp.evalJs(`document.body.innerText.includes('选择洗护师')`);
  assert('旧向导屏3（选员工+选时间）可达', s3);
  await cdp.shot(resolve(OUT, 'regression-wizard-屏3.png'));
  await cdp.evalJs(`(() => { const s = Array.from(document.querySelectorAll('button')).find(b => /^\\d{2}:\\d{2}$/.test(b.textContent.trim()) && !b.disabled); s?.click(); })()`);
  await sleep(400);
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步')?.click()`);
  await sleep(1200);
  const s4 = await cdp.evalJs(`document.body.innerText.includes('收款方式')`);
  assert('旧向导屏4（确认）可达，全链走通', s4);
  await cdp.shot(resolve(OUT, 'regression-wizard-屏4.png'));

  /* 寄养向导：未动，可打开 */
  await cdp.nav(`${APP}/booking/boarding`);
  await sleep(2000);
  const boarding = await cdp.evalJs(`({ hasContent: document.body.innerText.includes('寄养'), path: location.pathname })`);
  assert('寄养向导 /booking/boarding 正常打开（本任务未动）', boarding.hasContent && boarding.path === '/booking/boarding', JSON.stringify(boarding));
  await cdp.shot(resolve(OUT, 'regression-boarding.png'));

  writeFileSync(resolve(OUT, 'regression-asserts.txt'), lines.join('\n') + '\n');
  const failed = lines.filter((l) => l.startsWith('FAIL'));
  console.log(`\n===== 回归汇总：${lines.length - failed.length}/${lines.length} 通过 =====`);
  cdp.close();
  process.exitCode = failed.length ? 1 : 0;
} finally {
  cleanup();
}
