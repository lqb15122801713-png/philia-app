/**
 * 商城全链路演示（T5.4 联调用，真实种子库，server 需在 7200 运行）：
 * 下单 → mock 支付（含回调幂等/拒签复检）→ 商家发货 → 客户收货
 * 输出：{ orderId, productId }
 */
import superjson from 'superjson';
import { db, schema } from '../src/db/index.js';

const BASE = 'http://localhost:7200';

async function trpcQuery<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const url = input === undefined
    ? `${BASE}/trpc/${path}`
    : `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(superjson.serialize(input)))}`;
  const res = await fetch(url, { headers: { cookie } });
  return unwrap<T>(res, await res.json());
}
async function trpcMutate<T>(path: string, cookie: string, input?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(superjson.serialize(input ?? null)),
  });
  return unwrap<T>(res, await res.json());
}
function unwrap<T>(res: Response, envelope: any): T {
  if (envelope?.error) {
    const err = envelope.error?.json ?? envelope.error;
    throw new Error(`tRPC ${res.status} ${err?.data?.code}: ${err?.message}`);
  }
  return superjson.deserialize(envelope?.result?.data) as T;
}
async function login(userId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const hit = res.headers.getSetCookie().find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error('未拿到会话 cookie');
  return hit.split(';')[0]!;
}

const users = await db.select().from(schema.users).all();
const roles = await db.select().from(schema.userRoles).all();
const roleOf = (r: string) => users.find((u) => roles.some((ur) => ur.userId === u.id && ur.role === r))!;
const customer = roleOf('customer');
const owner = roleOf('merchant_owner');
const customerCookie = await login(customer.id);
const ownerCookie = await login(owner.id);

// 1. 选两商品下单
const { items } = await trpcQuery<any>('mall.listProducts', customerCookie, { pageSize: 5 });
const [p1, p2] = items;
const order = await trpcMutate<any>('mall.createOrder', customerCookie, {
  items: [{ productId: p1.id, qty: 1 }, { productId: p2.id, qty: 2 }],
  address: { name: '示例客户', phone: '13800000000', detail: '杭州市西湖区文三路 100 号 3 幢 502' },
});
console.log('下单:', order.orderNo, order.totalFen, 'fen');

// 2. 支付（mock 演示链路）
const pay = await trpcMutate<any>('mall.createPayment', customerCookie, { orderId: order.id });
const cb = await fetch(`${BASE}/api/pay/mock-callback`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: customerCookie },
  body: JSON.stringify({ orderId: order.id, paymentId: pay.paymentId }),
});
console.log('mock-callback:', cb.status, JSON.stringify(await cb.json()));

// 2a. 回调幂等复检：重复投递 → 成功且无重复流水
const cb2 = await fetch(`${BASE}/api/pay/mock-callback`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: customerCookie },
  body: JSON.stringify({ orderId: order.id, paymentId: pay.paymentId }),
});
const cb2Body: any = await cb2.json();
console.log('回调幂等(二次投递):', cb2.status, 'idempotent =', cb2Body.idempotent);
const payments = await db.select().from(schema.payments).all();
console.log('支付流水条数(应=1):', payments.filter((p) => p.orderId === order.id).length);

// 2b. 篡改签名复检：伪造原始终端点回调 → 应 400
const forged = await fetch(`${BASE}/api/pay/callback`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-mock-signature': 'forged' },
  body: JSON.stringify({ orderId: order.id, paymentId: pay.paymentId, paidFen: order.totalFen }),
});
console.log('篡改签名被拒(应 400):', forged.status);

// 3. 商家发货
const storeOrders = await trpcQuery<any>('mall.listStoreOrders', ownerCookie);
console.log('商家待发货队列含本单:', storeOrders.groups.paid.some((o: any) => o.id === order.id));
await trpcMutate('mall.shipOrder', ownerCookie, { orderId: order.id, trackingNo: 'SF1234567890' });
console.log('已发货');

// 4. 客户确认收货
await trpcMutate('mall.receiveOrder', customerCookie, { orderId: order.id });
const mine = await trpcQuery<any>('mall.listMyOrders', customerCookie);
console.log('客户已收货列表含本单:', mine.groups.received.some((o: any) => o.id === order.id));

console.log(JSON.stringify({ orderId: order.id, productId: p1.id }));
process.exit(0);
