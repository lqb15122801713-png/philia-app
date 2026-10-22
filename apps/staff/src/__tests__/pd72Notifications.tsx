import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient } from '@philia/shared';
import NotificationsPage from '../pages/staff2/NotificationsPage';

const queryClient = new QueryClient();
const items = Array.from({ length: 50 }, (_, index) => ({
  id: `read-${index + 1}`,
  type: 'schedule.published',
  category: 'service',
  title: '班表已更新',
  body: '请查看最新班表',
  link: '/my-schedule',
  readAt: new Date('2026-10-22T08:00:00+08:00'),
  createdAt: new Date('2026-10-22T08:00:00+08:00'),
}));
queryClient.setQueryData(['push', 'listNotifications', 'staff-center'], { items, nextCursor: 'read-50' });
queryClient.setQueryData(['push', 'unreadCount'], { total: 192, byCategory: { service: 192 } });

const trpc = {
  push: {
    listNotifications: { query: async () => ({ items, nextCursor: 'read-50' }) },
    unreadCount: { query: async () => ({ total: 192, byCategory: { service: 192 } }) },
    markAllRead: { mutate: async () => ({ marked: 192 }) },
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

assert.ok(html.includes('未读 192 条'), '通知中心应显示服务端总未读 192，而非首屏已读行数 0');
const markAllTag = html.match(/<button[^>]*data-testid="ntf-mark-all"[^>]*>/)?.[0];
assert.ok(markAllTag, '应渲染全部已读按钮');
assert.ok(!/\sdisabled(?:=|\s|>)/.test(markAllTag), '首屏均已读但仍有 192 条历史未读时，全部已读必须可用');
console.log('✓ AE-STAFF-04：192 条服务端总未读如实显示，全部已读可用');
