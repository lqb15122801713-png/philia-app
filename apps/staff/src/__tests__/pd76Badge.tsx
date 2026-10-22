/**
 * PD-76 · AE-STAFF-04 角标口径 A 单元钉（SSR 渲染断言，同 pd72Notifications 跑法）
 *
 * 跑法：node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json apps/staff/src/__tests__/pd76Badge.tsx
 *
 * 口径 A（已裁）：底栏徽标 99+ 封顶显示 / aria-label 恒真值 / me 行·通知头真值 /
 * 通知头 >99 附一致说明；三处同源唯一 selector（lib/unreadBadge → push.unreadCount.total）。
 */
import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient } from '@philia/shared';
import { badgeAriaText, badgeCapText, UNREAD_BADGE_CAP } from '../lib/unreadBadge';
import { SkDock } from '../components/skeleton';
import NotificationsPage from '../pages/staff2/NotificationsPage';

/* ---- 纯函数钉 ---- */
assert.equal(badgeCapText(0), '0');
assert.equal(badgeCapText(99), '99');
assert.equal(badgeCapText(100), '99+');
assert.equal(badgeCapText(192), '99+');
assert.equal(badgeAriaText(5), '5 条未读');
assert.equal(badgeAriaText(192), '192 条未读');
assert.equal(UNREAD_BADGE_CAP, 99);
console.log('✓ 纯函数：badgeCapText 99 封顶 / badgeAriaText 恒真值');

/* ---- dock 徽标渲染钉：>99 → 显示 99+，aria 真值 ---- */
{
  const html = renderToString(
    <MemoryRouter>
      <SkDock active="me" badges={{ me: 192 }} />
    </MemoryRouter>,
  );
  const bdg = html.match(/<span[^>]*data-testid="dock-me-badge"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? '';
  assert.ok(bdg, 'dock「我的」槽徽标应渲染');
  assert.ok(bdg.includes('aria-label="192 条未读"'), `aria 应持真值 192（实际：${bdg}）`);
  assert.ok(bdg.includes('99+'), `显示应封顶 99+（实际：${bdg}）`);
  assert.ok(!/>\s*192\s*</.test(bdg), '显示位不得出现未封顶真值');
  console.log('✓ dock 徽标：显示 99+ 封顶 + aria「192 条未读」真值');
}

/* ---- 通知头渲染钉：真值 + >99 一致说明；≤99 无说明 ---- */
const renderNotifications = (total: number) => {
  const queryClient = new QueryClient();
  const items: unknown[] = [];
  queryClient.setQueryData(['push', 'listNotifications', 'staff-center'], { items, nextCursor: null });
  queryClient.setQueryData(['push', 'unreadCount'], { total, byCategory: { service: total } });
  const trpc = {
    push: {
      listNotifications: { query: async () => ({ items, nextCursor: null }) },
      unreadCount: { query: async () => ({ total, byCategory: { service: total } }) },
      markAllRead: { mutate: async () => ({ marked: total }) },
    },
  } as unknown as PhiliaClient['trpc'];
  return renderToString(
    <PhiliaClientContext.Provider value={{ trpc, queryClient }}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </PhiliaClientContext.Provider>,
  );
};

{
  const html = renderNotifications(192);
  assert.ok(html.includes('未读 192 条'), '通知头应显真值 192');
  assert.ok(html.includes('data-testid="ntf-unread-cap-note"'), '>99 应渲染一致说明行');
  assert.ok(html.includes('99+'), '一致说明应点名底栏 99+ 封顶口径');
  console.log('✓ 通知头 192：真值 + 一致说明（底栏仅展示上限）在');
}
{
  const html = renderNotifications(5);
  assert.ok(html.includes('未读 5 条'), '通知头应显真值 5');
  assert.ok(!html.includes('ntf-unread-cap-note'), '≤99 不渲染一致说明行');
  console.log('✓ 通知头 5：真值、无一致说明（口径内）');
}

console.log('✓ PD-76 角标口径 A 全钉绿');
