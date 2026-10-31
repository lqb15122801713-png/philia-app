import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient } from '@philia/shared';
import NotificationsPage from '../pages/staff2/NotificationsPage';

const queryClient = new QueryClient();
const items = Array.from({ length: 25 }, (_, index) => {
  const createdAt = new Date(Date.UTC(2026, 9, 22, 8, index)).toISOString();
  return ['a', 'b'].map((suffix) => ({
    id: `unread-${index + 1}-${suffix}`,
    type: 'schedule.published',
    category: 'service',
    title: '班表已更新',
    body: '请查看最新班表',
    link: '/my-schedule',
    readAt: null,
    createdAt: new Date(createdAt),
  }));
}).flat();
queryClient.setQueryData(['push', 'listNotifications', 'staff-center'], { items, nextCursor: 'unread-25-b' });

const trpc = {
  push: {
    listNotifications: { query: async () => ({ items, nextCursor: 'unread-25-b' }) },
    markAllRead: { mutate: async () => ({ marked: 50 }) },
  },
} as unknown as PhiliaClient['trpc'];

const html = renderToString(
  <PhiliaClientContext.Provider value={{ trpc, queryClient }}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  </PhiliaClientContext.Provider>,
);

assert.ok(html.includes('未读 25 条'), '50 个未读 ID 去重为 25 行后，通知中心应显示 25');
const markAllTag = html.match(/<button[^>]*data-testid="ntf-mark-all"[^>]*>/)?.[0];
assert.ok(markAllTag, '应渲染全部已读按钮');
assert.ok(!/\sdisabled(?:=|\s|>)/.test(markAllTag), '仍有 25 个去重未读行时，全部已读必须可用');
console.log('✓ AE-STAFF-04：50 个未读 ID 按 25 个去重行显示，全部已读可用');
