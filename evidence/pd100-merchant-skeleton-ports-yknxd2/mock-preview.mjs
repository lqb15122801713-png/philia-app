import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import superjson from 'superjson';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = resolve(ROOT, 'apps/merchant/dist');
const PORT = Number(process.env.PD100_PORT ?? 7410);
const BASE = `http://127.0.0.1:${PORT}`;
const indexHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8');
const bundleName = indexHtml.match(/assets\/(index-[^/]+\.js)/)?.[1] ?? null;
const bundleSha256 = bundleName
  ? createHash('sha256').update(readFileSync(resolve(DIST, 'assets', bundleName))).digest('hex')
  : null;
const seen = [];
const unknown = [];
const businessMutations = [];
let safeSubscriptions = 0;
let holdTarget = 'none';
const holdWaiters = new Set();
async function maybeHold(target) {
  if (target !== holdTarget) return;
  await new Promise((resolve) => holdWaiters.add(resolve));
}
function releaseHolds() {
  for (const resolve of holdWaiters) resolve();
  holdWaiters.clear();
}
const now = new Date();
const minutesAgo = (n) => new Date(now.getTime() - n * 60_000);
const minutesLater = (n) => new Date(now.getTime() + n * 60_000);
const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const serviceItems = [{
  id: 'pd100-live', storeId: 'pd100-store', petId: 'pd100-pet', serviceId: 'pd100-service', staffId: 'pd100-staff',
  type: 'grooming', status: 'in_service', scheduledStart: minutesAgo(25), scheduledEnd: minutesLater(35),
  checkedInAt: minutesAgo(25), petName: '旺财', serviceName: '基础洗护', staffName: '小周',
}];
const boardingItems = [{
  id: 'pd100-boarding', storeId: 'pd100-store', petId: 'pd100-boarding-pet', serviceId: 'pd100-boarding-service', staffId: 'pd100-staff',
  type: 'boarding', status: 'in_boarding', scheduledStart: minutesAgo(-2880), scheduledEnd: minutesLater(1440),
  checkedInAt: minutesAgo(-2880), petName: '豆豆', serviceName: '标准间寄养', staffName: '小周',
}];
const steps = ['disinfection', 'precheck', 'grooming', 'detail', 'before_after', 'confirm'].map((stepKey, index) => ({
  id: `pd100-step-${index}`, appointmentId: 'pd100-live', stepKey,
  status: index < 2 ? 'done' : index === 2 ? 'active' : 'todo',
  startedAt: index <= 2 ? minutesAgo(20 - index * 5) : null,
  doneAt: index < 2 ? minutesAgo(18 - index * 5) : null,
  photos: [],
}));
const orders = [{
  id: '01M5H1E1PD100000000000000', orderNo: 'P261022YKNXD2', customerNickname: '合成客户',
  createdAt: new Date('2026-10-22T05:30:00.000Z'),
  items: [{ product_id: 'pd100-toy', name: '发声橡胶球', quantity: 1, price_fen: 1900 }],
  totalFen: 1900, rebateFen: 0, status: 'paid', trackingNo: null,
}, {
  id: 'pd100-normal', orderNo: 'P261022KKT4J9', customerNickname: '合成对照客户',
  createdAt: new Date('2026-10-22T03:08:00.000Z'),
  items: [{ product_id: 'pd100-toy', name: '发声橡胶球', quantity: 1, price_fen: 1900 }],
  totalFen: 1900, rebateFen: 0, status: 'paid', trackingNo: null,
}];

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

async function dataFor(procedure, input) {
  const target = procedure === 'appointment.listForStore' && input?.status === 'in_boarding'
    ? 'boarding'
    : procedure === 'slotPort.list'
      ? 'slots'
      : procedure === 'config.list'
        ? 'copy'
        : procedure === 'mall.listStoreOrders'
          ? 'orders'
          : null;
  if (target) await maybeHold(target);
  if (procedure === 'auth.me') return {
    user: { id: 'pd100-owner', nickname: '合成店主', activePetId: null },
    roles: ['merchant_owner'],
    staff: { id: 'pd100-staff', storeId: 'pd100-store', role: 'frontdesk', schedule: {} },
    store: { id: 'pd100-store', name: '菲丽亚宠物·合成单店' },
  };
  if (procedure === 'config.activeCopyTexts') return { rows: [
    { key: 'copyport.pageTitle', text: '文案端口' },
    { key: 'slotport.pageTitle', text: '槽位端口' },
    { key: 'mtx.colCopy', text: '文案端口' },
    { key: 'mtx.colSlots', text: '槽位' },
    { key: 'order.rebatePendingNote', text: '回馈金列读口待补——订单域未透出回馈金字段，待 server 开口；回馈金仅抵商品' },
  ] };
  if (procedure === 'appointment.listForStore') {
    if (input?.status === 'in_service') return serviceItems;
    if (input?.status === 'in_boarding') return boardingItems;
    return [];
  }
  if (procedure === 'boarding.stayBoard') return { board: [{
    appointment: boardingItems[0],
    pet: { id: 'pd100-boarding-pet', name: '豆豆', breed: '比熊', avatarUrl: null },
    lastLogDate: dayKey,
    overdue: false,
  }] };
  if (procedure === 'serviceStep.list') return steps;
  if (procedure === 'mall.listStoreOrders') return { groups: { paid: orders, shipped: [], refunding: [] } };
  if (procedure === 'slotPort.list') return { slots: [{
    slotKey: 'home.banner',
    live: {
      id: 'pd100-slot-live', version: 1,
      contentJson: { url: '/icons/icon-192.png', alt: '安心洗护品牌图' },
      createdAt: minutesAgo(60), creatorNickname: '合成店主',
    },
    pending: [], archived: [], totalVersions: 1,
  }] };
  if (procedure === 'config.list') return { rules: [{
    id: 'pd100-copy-rule', ruleKey: 'order.title', valueJson: { text: '商城订单' },
    active: 1, version: 1, highRisk: false, screen: '商家·商城订单', position: '页题', defaultText: '商城订单',
  }] };
  if (procedure === 'config.versions') return { versions: [] };
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
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', BASE);
  if (url.pathname === '/__pd100/hold') {
    releaseHolds();
    holdTarget = url.searchParams.get('target') ?? 'none';
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ holdTarget }));
    return;
  }
  if (url.pathname === '/__pd100/state') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ base: BASE, bundleName, bundleSha256, holdTarget, seen, unknown, businessMutations, safeSubscriptions }, null, 2));
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
      businessMutations.push({ method, procedures });
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'PD-100 business mutation blocked' }));
      return;
    }
    const body = await Promise.all(procedures.map(async (procedure, index) => {
      const serialized = superjson.serialize(await dataFor(procedure, inputFor(url, index)));
      return { result: { data: serialized } };
    }));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return;
  }
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': PD-100 read-only mock\n\n');
    req.on('close', () => res.end());
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    businessMutations.push({ method: req.method, path: url.pathname });
    res.writeHead(403); res.end('PD-100 read-only mock'); return;
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
