import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PD98_API_BASE ?? 'http://120.53.102.45:7200';
const code = process.env.BETA_CODE;
if (!code) throw new Error('BETA_CODE is required for the existing QA account session');
const out = join(dirname(fileURLToPath(import.meta.url)), 'live-notification-fields.json');
let cookie = '';

function group(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

try {
  const staffBase = process.env.PD98_STAFF_BASE ?? 'http://120.53.102.45:7203';
  const html = await (await fetch(`${staffBase}/staff/`)).text();
  const actualDist = html.match(/assets\/(index-[^/]+\.js)/)?.[1] ?? null;
  if (actualDist !== 'index-DRu9UKUe.js') throw new Error(`tip/dist drift: ${actualDist}`);

  const login = await fetch(`${base}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13900000002', code }),
  });
  if (!login.ok) throw new Error(`existing QA login failed: ${login.status}`);
  cookie = /philia_session=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1] ?? '';
  if (!cookie) throw new Error('session cookie missing');

  const input = encodeURIComponent(JSON.stringify({ 0: { json: { limit: 50 } } }));
  const response = await fetch(`${base}/trpc/push.listNotifications?batch=1&input=${input}`, {
    headers: { cookie: `philia_session=${cookie}` },
  });
  if (!response.ok) throw new Error(`notification query failed: ${response.status}`);
  const payload = await response.json();
  const rows = payload[0]?.result?.data?.json?.items;
  if (!Array.isArray(rows)) throw new Error('notification rows missing');

  const exact = group(rows, (row) => JSON.stringify([row.title, row.body, row.createdAt])).filter((items) => items.length > 1);
  const byMinute = group(rows, (row) => JSON.stringify([row.title, row.body, String(row.createdAt).slice(0, 16)])).filter((items) => items.length > 1);
  const report = {
    at: new Date().toISOString(),
    source: `${base}/trpc/push.listNotifications`,
    baselineTip: '50d6a66f2162de881c32ab57268e076f81aeca4f',
    actualDist,
    rowCount: rows.length,
    exactDuplicateGroups: exact.length,
    minuteDuplicateGroups: byMinute.length,
    clickedAllRead: false,
    businessWrites: false,
    sessionCleanup: 'logout in finally',
    rows: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.createdAt,
      readAt: row.readAt,
    })),
  };
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ rowCount: report.rowCount, exactDuplicateGroups: report.exactDuplicateGroups, minuteDuplicateGroups: report.minuteDuplicateGroups, actualDist, clickedAllRead: false, businessWrites: false }, null, 2));
} finally {
  if (cookie) {
    await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie: `philia_session=${cookie}` } }).catch(() => {});
    cookie = '';
  }
}
