import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.PD112_API_BASE ?? 'http://120.53.102.45:7200';
const staffBase = process.env.PD112_STAFF_BASE ?? 'http://120.53.102.45:7203';
const code = process.env.BETA_CODE;
if (!code) throw new Error('BETA_CODE is required for the existing QA account session');
const outDir = dirname(fileURLToPath(import.meta.url));
let cookie = '';

function duplicateGroups(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].filter((items) => items.length > 1);
}

try {
  const html = await (await fetch(`${staffBase}/staff/`)).text();
  const actualDist = html.match(/assets\/(index-[^/]+\.js)/)?.[1] ?? null;
  if (actualDist !== 'index-STmHfnb4.js') throw new Error(`tip/dist drift: ${actualDist}`);

  const login = await fetch(`${base}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13900000002', code }),
  });
  if (!login.ok) throw new Error(`existing QA login failed: ${login.status}`);
  cookie = /philia_session=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1] ?? '';
  if (!cookie) throw new Error('session cookie missing');

  const input = encodeURIComponent(JSON.stringify({ 0: { json: { limit: 50 } } }));
  const headers = { cookie: `philia_session=${cookie}` };
  const [listResponse, unreadResponse] = await Promise.all([
    fetch(`${base}/trpc/push.listNotifications?batch=1&input=${input}`, { headers }),
    fetch(`${base}/trpc/push.unreadCount?batch=1`, { headers }),
  ]);
  if (!listResponse.ok || !unreadResponse.ok) throw new Error(`notification query failed: ${listResponse.status}/${unreadResponse.status}`);
  const [listPayload, unreadPayload] = await Promise.all([listResponse.json(), unreadResponse.json()]);
  const rows = listPayload[0]?.result?.data?.json?.items;
  const unread = unreadPayload[0]?.result?.data?.json;
  if (!Array.isArray(rows) || typeof unread?.total !== 'number') throw new Error('notification evidence missing');

  const exact = duplicateGroups(rows, (row) => JSON.stringify([row.type, row.title, row.body, row.createdAt]));
  const bySecond = duplicateGroups(rows, (row) => JSON.stringify([row.type, row.title, row.body, String(row.createdAt).slice(0, 19)]));
  const byMinute = duplicateGroups(rows, (row) => JSON.stringify([row.type, row.title, row.body, String(row.createdAt).slice(0, 16)]));
  const source = {
    baselineTip: '524b4bc7e203890e42dd90c01bfd7a4c6f84613b',
    deploy: '20261029214338',
    actualDist,
    at: new Date().toISOString(),
    source: `${base}/trpc/push.listNotifications`,
    rowCount: rows.length,
    unread,
    exactDuplicateGroups: exact.length,
    secondDuplicateGroups: bySecond.length,
    minuteDuplicateGroups: byMinute.length,
    clickedAllRead: false,
    businessWrites: false,
    sessionCleanup: 'logout in finally',
    rows: rows.map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.createdAt,
      readAt: row.readAt,
    })),
    minuteDuplicates: byMinute.map((group) => group.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      createdAt: row.createdAt,
      readAt: row.readAt,
    }))),
  };
  const serialized = `${JSON.stringify(source, null, 2)}\n`;
  writeFileSync(join(outDir, 'live-notification-fields.json'), serialized);
  const bundlePath = html.match(/src="([^"]*index-[^/]+\.js)/)?.[1];
  if (!bundlePath) throw new Error('live staff bundle URL missing');
  const bundleResponse = await fetch(new URL(bundlePath, `${staffBase}/staff/`));
  if (!bundleResponse.ok) throw new Error(`live staff bundle failed: ${bundleResponse.status}`);
  const bundle = await bundleResponse.text();
  const bundleEvidence = {
    baselineTip: source.baselineTip,
    deploy: source.deploy,
    actualDist,
    sha256: createHash('sha256').update(bundle).digest('hex'),
    bytes: Buffer.byteLength(bundle),
  };
  writeFileSync(join(outDir, 'live-baseline-bundle.json'), `${JSON.stringify(bundleEvidence, null, 2)}\n`);
  console.log(JSON.stringify({
    rowCount: source.rowCount,
    unreadTotal: unread.total,
    exactDuplicateGroups: exact.length,
    secondDuplicateGroups: bySecond.length,
    minuteDuplicateGroups: byMinute.length,
    minuteDuplicates: source.minuteDuplicates,
    actualDist,
    clickedAllRead: false,
    businessWrites: false,
  }, null, 2));
} finally {
  if (cookie) {
    await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie: `philia_session=${cookie}` } }).catch(() => {});
    cookie = '';
  }
}
