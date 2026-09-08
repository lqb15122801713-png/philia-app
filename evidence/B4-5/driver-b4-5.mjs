/**
 * B4-5 录屏 driver：首页 → 点复购提醒卡 → 单屏三参预填 → 选时段 → 确认 → 成功页
 * 由 record-cdp.mjs 注入执行：export default async function (evalJs, send, sleep)
 * 前置：server:7200 / customer:7100 已起；库内已有 ≥14 天 completed 洗护标记单（seed-completed-grooming.mts 20）
 */
export default async function (evalJs, send, sleep) {
  const API = 'http://localhost:7200';
  const APP = 'http://localhost:7100';
  const poll = async (expr, tries = 25, gap = 400) => {
    for (let i = 0; i < tries; i++) {
      if (await evalJs(expr)) return true;
      await sleep(gap);
    }
    return false;
  };

  // 种子客户登录（动态取 id，不硬编码 ULID）
  const res = await fetch(`${API}/api/auth/dev-seed-users`);
  const data = await res.json();
  const customer = (data.users ?? []).find((u) => (u.roles ?? []).includes('customer')) ?? data.users?.[0];

  await send('Page.navigate', { url: `${APP}/home` });
  await sleep(1400);
  await evalJs(`fetch('${API}/api/auth/dev-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: '${customer.id}' }), credentials: 'include' }).then((r) => r.status)`);

  // 首页（登录态）→ 等提醒卡
  await send('Page.navigate', { url: `${APP}/home` });
  await poll(`!!document.querySelector('[data-testid="grooming-reminder"]')`);
  await evalJs(`document.querySelector('[data-testid="grooming-reminder"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(1200); // 停留展示提醒卡

  // 点卡 → 单屏
  await evalJs(`document.querySelector('[data-testid="grooming-reminder"]').click()`);
  await poll(`!!document.querySelector('[data-testid="grooming-single"]')`);
  await poll(`(document.querySelector('[data-testid="grooming-single"]')?.textContent || '').includes('旺财')`);
  await sleep(1400); // 停留展示三参预填

  // 时段栅格滚入视野 → 选首个可约时段
  await evalJs(`document.querySelector('[data-testid="gs-time-grid"]')?.scrollIntoView({ block: 'center' })`);
  await sleep(900);
  await evalJs(`document.querySelector('[data-testid="gs-time-grid"] button[data-available="true"]')?.click()`);
  await sleep(900); // 展示选中态 + 确认条点亮

  // 确认 → 成功页
  await evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.click()`);
  await poll(`location.pathname === '/booking/success' && (document.body.textContent || '').includes('预约成功')`, 25, 500);
  await sleep(1500); // 停留成功页
}
