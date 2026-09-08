/** 批次 4 复现：改造前四屏向导截图（/booking/grooming 旧向导），存 evidence/B4-1/repro/ */
import { launchEdge, connect, loginAsSeedCustomer, waitFor, sleep, APP } from '../../cdp-lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)));

const cleanup = await launchEdge();
try {
  const cdp = await connect();
  await loginAsSeedCustomer(cdp);
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `document.body.innerText.includes('选服务')`);

  // 屏1：选服务（步骤条 4 步可见）
  await cdp.shot(resolve(OUT, 'wizard-step1-选服务.png'));
  const stepsText = await cdp.evalJs(`document.body.innerText.match(/选服务[\\s\\S]{0,40}确认/)?.[0] ?? ''`);
  console.log('步骤条文本:', JSON.stringify(stepsText));

  // 选第一个服务 → 下一步（单店自动跳过屏2 → 屏3）
  await cdp.evalJs(`(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('约') && b.textContent.includes('分钟'));
    btns[0]?.click(); return btns.length;
  })()`);
  await sleep(500);
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步')?.click()`);
  await sleep(1200);

  // 屏3：选员工 + 选时间
  await waitFor(cdp, `document.body.innerText.includes('选择洗护师')`);
  await cdp.shot(resolve(OUT, 'wizard-step3-选员工选时间.png'));

  // 选第一个可约槽 → 下一步 → 屏4
  await cdp.evalJs(`(() => {
    const slot = Array.from(document.querySelectorAll('button')).find(b => /^\\d{2}:\\d{2}$/.test(b.textContent.trim()) && !b.disabled);
    slot?.click(); return slot?.textContent;
  })()`);
  await sleep(400);
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '下一步')?.click()`);
  await sleep(1200);

  // 屏4：确认（选宠物/收款/备注）
  await waitFor(cdp, `document.body.innerText.includes('收款方式')`);
  await cdp.shot(resolve(OUT, 'wizard-step4-确认.png'));

  // 点摘要胶囊「门店」chip 回屏2 补截屏2
  await cdp.evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('门店'))?.click()`);
  await sleep(1000);
  await cdp.shot(resolve(OUT, 'wizard-step2-选门店.png'));

  console.log('REPRO OK');
  cdp.close();
} finally {
  cleanup();
}
