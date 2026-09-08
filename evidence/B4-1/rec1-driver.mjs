/**
 * 录屏 1 driver：老客单屏下单全链路
 * 打开 /booking/grooming（预填已齐：上次门店+服务+宠物）→ 选时间 → 点确认 → 成功页。
 */
import { sleep } from '../cdp-lib.mjs';

export default async function (evalJs, send) {
  await send('Page.navigate', { url: 'http://localhost:7100/booking/grooming' });
  await sleep(2500);
  // 等预填就绪（宠物卡显示已选宠物 → 说明 localStorage 记忆生效）
  for (let i = 0; i < 15; i++) {
    const ok = await evalJs(`(() => {
      const t = document.querySelector('[data-testid="gs-pet-card"]')?.textContent ?? '';
      const s = document.querySelector('[data-testid^="gs-service-chip-"][data-active="true"]');
      return t.includes('更换') && !!s && !!document.querySelector('[data-testid="gs-time-grid"]');
    })()`);
    if (ok) break;
    await sleep(600);
  }
  await sleep(800); // 帧稳定：展示完整预填单屏
  // 选时间（第一个可约槽）
  await evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true')?.click()`);
  await sleep(900);
  // 点确认
  await evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
  // 等成功页
  for (let i = 0; i < 20; i++) {
    const p = await evalJs(`location.pathname`);
    if (p === '/booking/success') break;
    await sleep(600);
  }
  await sleep(1500); // 成功页停留展示
  console.log('rec1 driver done, path =', await evalJs(`location.pathname`));
}
