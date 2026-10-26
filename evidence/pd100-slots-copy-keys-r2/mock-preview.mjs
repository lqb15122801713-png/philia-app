import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import superjson from 'superjson';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = resolve(ROOT, 'apps/merchant/dist');
const PORT = Number(process.env.PD100_PORT ?? 7426);
const BASE = `http://127.0.0.1:${PORT}`;
const indexHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8');
const bundleName = indexHtml.match(/assets\/(index-[^/]+\.js)/)?.[1] ?? null;
const bundleSha256 = bundleName
  ? createHash('sha256').update(readFileSync(resolve(DIST, 'assets', bundleName))).digest('hex')
  : null;
const seen = [];
const unknown = [];
const blockedMutations = [];
let safeSubscriptions = 0;
const createdAt = new Date('2026-10-26T12:00:00Z');

function inputFor(url, index) {
  const raw = url.searchParams.get('input');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed[index]?.json ?? parsed.json;
  } catch {
    return undefined;
  }
}

function slot(slotKey, alt) {
  return {
    slotKey,
    live: {
      id: `pd100-r2-${slotKey}-live`,
      slotKey,
      version: 5,
      contentJson: { url: '/icons/icon-192.png', alt },
      status: 'live',
      createdBy: 'pd100-r2-owner',
      creatorNickname: '合成店主',
      actedBy: null,
      actedByNickname: null,
      actedAt: null,
      createdAt,
    },
    pending: [],
    archived: [],
    totalVersions: 5,
  };
}

function rule(ruleKey, text, screen, position) {
  return {
    id: `pd100-r2-${ruleKey}`,
    ruleKey,
    label: ruleKey,
    valueJson: { text },
    effectiveFrom: createdAt,
    active: true,
    version: 1,
    createdBy: 'pd100-r2-owner',
    createdAt,
    updatedAt: createdAt,
    highRisk: false,
    screen,
    position,
    scheduledPending: false,
    scheduledId: null,
    scheduledEffectiveAt: null,
    moneyHighRisk: false,
    defaultText: text,
  };
}

function dataFor(procedure) {
  if (procedure === 'auth.me') return {
    user: { id: 'pd100-r2-owner', nickname: '合成店主', activePetId: null },
    roles: ['merchant_owner'],
    staff: { id: 'pd100-r2-staff', storeId: 'pd100-r2-store', role: 'frontdesk', schedule: {} },
    store: { id: 'pd100-r2-store', name: '菲丽亚宠物·合成单店' },
  };
  if (procedure === 'slotPort.list') return { slots: [
    slot('home.banner', '首页品牌横幅'),
    slot('login.hero.staff', '员工端登录页主视觉'),
    slot('mall.hero', '商城促销横幅'),
  ] };
  if (procedure === 'config.list') return {
    domain: 'copy',
    currentVersion: 1,
    rules: [
      rule('about.agreements', '协议中心', '客户·关于', '关于页协议入口'),
      rule('staff.title', '员工端', '员工·首页', '员工端首页标题'),
    ],
  };
  if (procedure === 'config.versions') return { versions: [{
    id: 'pd100-r2-copy-version',
    domain: 'copy',
    version: 1,
    changedBy: 'pd100-r2-owner',
    changerNickname: '合成店主',
    createdAt,
    changesJson: [{ rule_key: 'about.agreements', before: null, after: { text: '协议中心' } }],
  }] };
  if (procedure === 'config.activeCopyTexts') return { rows: [] };
  if (procedure === 'slotPort.liveMap') return { slots: [] };
  if (procedure === 'canvas.blocks') return { items: [] };
  if (procedure === 'selfCheck.listPending') return { runs: [] };
  if (procedure === 'report.listMetricAppeals') return { pending: [], reviewed: [] };
  if (procedure === 'stock2.approvalPendingCount') return { count: 0 };
  if (procedure === 'push.unreadCount') return { total: 0, byCategory: {} };
  unknown.push(procedure);
  return {};
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', BASE);
  if (url.pathname === '/__pd100/state') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ base: BASE, bundleName, bundleSha256, seen, unknown, blockedMutations, safeSubscriptions }, null, 2));
    return;
  }
  if (url.pathname.startsWith('/trpc/')) {
    const method = String(req.method ?? 'GET').toUpperCase();
    const procedures = decodeURIComponent(url.pathname.slice('/trpc/'.length)).split(',');
    seen.push(...procedures);
    if (method === 'POST' && procedures.length === 1 && procedures[0] === 'push.subscribe') {
      safeSubscriptions += 1;
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify([{ result: { data: { json: { ok: true } } } }]));
      return;
    }
    if (method !== 'GET') {
      blockedMutations.push({ method, procedures });
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'PD-100-r2 mutation blocked' }));
      return;
    }
    const body = await Promise.all(procedures.map(async (procedure, index) => {
      inputFor(url, index);
      const serialized = superjson.serialize(dataFor(procedure));
      return { result: { data: serialized } };
    }));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': PD-100-r2 read-only mock\n\n');
    req.on('close', () => res.end());
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    blockedMutations.push({ method: req.method, path: url.pathname });
    res.writeHead(403); res.end('PD-100-r2 read-only mock'); return;
  }
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
  let file = resolve(DIST, relative);
  if (file !== DIST && !file.startsWith(`${DIST}${sep}`)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(content);
  } catch {
    if (extname(url.pathname)) {
      res.writeHead(404); res.end('missing asset'); return;
    }
    file = resolve(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
    res.end(await readFile(file));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(JSON.stringify({ base: BASE, bundleName, bundleSha256 }));
});
