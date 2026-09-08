/**
 * 录屏 2 driver：老客一键预约 ≤2 次点按
 * Philia 中按钮长按 → 弹层「再次预约同款服务」→ 单屏（预填已齐）→【点按1】选时间 →【点按2】确认 → 成功页。
 */
import { sleep } from '../cdp-lib.mjs';

export default async function (evalJs, send) {
  await send('Page.navigate', { url: 'http://localhost:7100/home' });
  await sleep(2500);
  // 长按 Philia 中按钮（500ms 触发）
  const rect = await evalJs(`(() => {
    const b = document.querySelector('button[aria-label="Philia"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!rect) throw new Error('未找到 Philia 按钮');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(800); // >500ms 长按阈值
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await sleep(900);
  // 弹层点「再次预约同款服务」
  const clicked = await evalJs(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('再次预约同款服务'));
    b?.click(); return !!b;
  })()`);
  if (!clicked) throw new Error('一键预约弹层未出现');
  await sleep(2200); // 跳转单屏 + 预填渲染
  // 【点按 1】选时间
  await evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true')?.click()`);
  await sleep(900);
  // 【点按 2】确认
  await evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
  for (let i = 0; i < 20; i++) {
    const p = await evalJs(`location.pathname`);
    if (p === '/booking/success') break;
    await sleep(600);
  }
  await sleep(1500);
  console.log('rec2 driver done, path =', await evalJs(`location.pathname`));
}
