import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient } from '@philia/shared';
import StaffDock from '../components/StaffDock';
import NotificationsPage from '../pages/staff2/NotificationsPage';

const items = [
  ['care-1637-a', '2026-10-26T16:37:00.100+08:00'],
  ['care-1637-b', '2026-10-26T16:37:00.900+08:00'],
  ['care-1229-a', '2026-10-26T12:29:00.100+08:00'],
  ['care-1229-b', '2026-10-26T12:29:00.900+08:00'],
].map(([id, createdAt]) => ({
  id,
  type: 'boarding.careRemind',
  category: 'service',
  title: '照护打卡提醒',
  body: '【旺财】在住寄养已超过 4 小时未打卡，请及时完成照护记录',
  link: '/boarding/stay-1/checkin',
  readAt: null,
  createdAt: new Date(createdAt),
}));

const queryClient = new QueryClient();
const listData = { items, nextCursor: null };
queryClient.setQueryData(['push', 'listNotifications', 'staff-center'], listData);
queryClient.setQueryData(['push', 'unreadCount'], listData);

const trpc = {
  push: {
    listNotifications: { query: async () => listData },
    unreadCount: { query: async () => ({ total: items.length, byCategory: { service: items.length } }) },
    markAllRead: { mutate: async () => ({ marked: items.length }) },
  },
} as unknown as PhiliaClient['trpc'];

const html = renderToString(
  <PhiliaClientContext.Provider value={{ trpc, queryClient }}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationsPage />
        <StaffDock active="me" role="frontdesk" />
      </MemoryRouter>
    </QueryClientProvider>
  </PhiliaClientContext.Provider>,
);

assert.ok(html.includes('未读 2 条'), '4 个未读 ID 去重为 2 行后，通知顶应显示 2');
assert.equal(html.match(/data-testid="ntf-row-/g)?.length, 2, '列表应保持 2 个去重行');
const badge = html.match(/<span[^>]*data-testid="dock-me-badge"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? '';
assert.ok(badge.includes('aria-label="2 条未读"'), `dock 应与通知顶同为 2（实际：${badge || '未渲染'}）`);
console.log('✓ PD-114：4 个未读 ID 去重为 2 行，通知顶＝dock＝2');
