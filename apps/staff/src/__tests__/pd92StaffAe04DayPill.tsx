import assert from 'node:assert/strict';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { renderToString } from 'react-dom/server';

Object.assign(globalThis, { React });
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient } from '@philia/shared';
import { SkChips } from '../components/skeleton';
import NotificationsPage from '../pages/staff2/NotificationsPage';

const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function renderNotifications(total?: number, withError = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryOnMount: !withError } } });
  const items = Array.from({ length: total ?? 0 }, (_, index) => ({
    id: `unread-${index + 1}`,
    type: 'schedule.published',
    category: 'service',
    title: '班表已更新',
    body: '请查看最新班表',
    link: '/my-schedule',
    readAt: null,
    createdAt: new Date(Date.UTC(2026, 9, 22, 8, index)),
  }));
  if (total !== undefined) {
    queryClient.setQueryData(['push', 'listNotifications', 'staff-center'], { items, nextCursor: null });
  }
  if (withError) {
    await queryClient.prefetchQuery({
      queryKey: ['push', 'listNotifications', 'staff-center'],
      queryFn: async () => { throw new Error('mock offline'); },
      retry: false,
    });
  }
  const trpc = {
    push: {
      listNotifications: { query: async () => ({ items, nextCursor: null }) },
      markAllRead: { mutate: async () => ({ marked: total ?? 15 }) },
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
}

const pendingHtml = await renderNotifications();
check('AE-04：未读数未返回时不得伪装成真 0', !pendingHtml.includes('未读 0 条'));
check('AE-04：未读数未返回时有同步态说明', pendingHtml.includes('未读') && pendingHtml.includes('同步'));
const statusTag = pendingHtml.match(/<span[^>]*data-testid="ntf-unread-count"[^>]*>/)?.[0] ?? '';
check('AE-04：未读状态变化有读屏状态语义', statusTag.includes('role="status"') && statusTag.includes('aria-atomic="true"'));
const errorHtml = await renderNotifications(undefined, true);
check('AE-04：取数失败时不得伪装成真 0', !errorHtml.includes('未读 0 条'));
check('AE-04：取数失败有手动重新对齐出口', errorHtml.includes('data-testid="ntf-unread-retry"'));
const cachedZeroErrorHtml = await renderNotifications(0, true);
check('AE-04：缓存 0 重取失败不得继续冒充当前真 0', !cachedZeroErrorHtml.includes('未读 0 条') && cachedZeroErrorHtml.includes('未读暂不可用'));
const cachedPositiveErrorHtml = await renderNotifications(15, true);
check('AE-04：缓存正数重取失败不得继续冒充当前值', !cachedPositiveErrorHtml.includes('未读 15 条') && cachedPositiveErrorHtml.includes('未读暂不可用'));
const markAllTag = cachedPositiveErrorHtml.match(/<button[^>]*data-testid="ntf-mark-all"[^>]*>/)?.[0] ?? '';
check('AE-04：重取失败时全部已读不可点', /\sdisabled(?:=|\s|>)/.test(markAllTag));
check('AE-04：重取失败时不沿用过期封顶说明', !(await renderNotifications(192, true)).includes('ntf-unread-cap-note'));
check('AE-04：真 0 仍如实显示', (await renderNotifications(0)).includes('未读 0 条'));
check('AE-04：同源真值 15 仍如实显示', (await renderNotifications(15)).includes('未读 15 条'));

const options = [
  { key: 'today', label: '今天' },
  { key: 'tomorrow', label: '明天' },
] as const;
const dayHtml = renderToString(
  <SkChips testId="sk-daychip" value="today" onChange={() => {}} options={[...options]} selectedIndicator />,
);
check('日 pill：选中的今天有可辨识勾标', dayHtml.includes('data-testid="sk-daychip-today-selected"'));
check('日 pill：未选中的明天不冒勾', !dayHtml.includes('data-testid="sk-daychip-tomorrow-selected"'));
check('日 pill：勾标仅为装饰，不重复朗读状态', /data-testid="sk-daychip-today-selected"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-testid="sk-daychip-today-selected"/.test(dayHtml));
const ordinaryHtml = renderToString(
  <SkChips testId="ordinary-chip" value="today" onChange={() => {}} options={[...options]} />,
);
check('周 pill 等其他 chips 不被本窗改动', !ordinaryHtml.includes('-selected"'));

assert.deepEqual(failures, [], `PD-92 回归钉失败：\n${failures.join('\n')}`);
console.log('✓ PD-92 AE-04＋日 pill 回归钉全绿');
