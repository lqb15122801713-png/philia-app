import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PhiliaClientContext, type PhiliaClient, type SessionUser } from '@philia/shared';
import App from '../../apps/staff/src/App';

const queryClient = new QueryClient();
const user: SessionUser = {
  id: 'pd72-user-frontdesk',
  nickname: '小美',
  roles: ['staff'],
  staffId: 'pd72-staff-frontdesk',
  storeId: 'pd72-store',
  staffRole: 'frontdesk',
};
const monthFrom = new Date();
monthFrom.setDate(1);
monthFrom.setHours(0, 0, 0, 0);
queryClient.setQueryData(['auth', 'me'], user);
queryClient.setQueryData(['auth', 'me', 'staffDetail'], {
  user,
  roles: user.roles,
  staff: {
    id: user.staffId,
    storeId: user.storeId,
    userId: user.id,
    name: '小美',
    role: 'frontdesk',
    skills: ['wash'],
    schedule: { thu: [{ start: '09:00', end: '18:00' }] },
    status: 'active',
    createdAt: new Date('2026-09-01T00:00:00+08:00'),
  },
  store: { id: user.storeId, name: '菲丽亚宠物·示例店' },
});
queryClient.setQueryData(['appointment', 'listForStaff', { from: monthFrom.getTime() }], []);
queryClient.setQueryData(['push', 'unreadCount'], { total: 192, byCategory: { service: 192 } });

const trpc = {} as unknown as PhiliaClient['trpc'];
const markup = renderToString(
  <PhiliaClientContext.Provider value={{ trpc, queryClient }}>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/me']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  </PhiliaClientContext.Provider>,
);

const dist = fileURLToPath(new URL('../../apps/staff/dist', import.meta.url));
const assets = fileURLToPath(new URL('../../apps/staff/dist/assets', import.meta.url));
const css = readdirSync(assets).find((name) => name.startsWith('index-') && name.endsWith('.css'));
if (!css) throw new Error('先运行 npm run build:staff 生成员工端 CSS');
const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>PD-72 · 我的 · 底栏安全区</title>
    <link rel="stylesheet" href="/assets/${css}" />
  </head>
  <body>
    <div id="root">${markup}</div>
  </body>
</html>
`;
const output = `${dist}/pd72-me.html`;
writeFileSync(output, html);
console.log(output);
