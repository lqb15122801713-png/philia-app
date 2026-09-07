import { db, schema } from '../src/db';
// B3-4 边界场景直插（create 无法造 4h 内开始的单：营业时间 09-20 且须未来 30min 对齐）
const now = Date.now();
const rows = await db.insert(schema.appointments).values([
  {
    code: 'B34LT4',
    customerId: '01M1XYKBJER5W7SXT254ACXDTB',
    storeId: '01M1XYKBJFPDAKXQM3EVAMG5N2',
    petId: '01M1XYKBJGYJ0NP9941XX01JWE',
    serviceId: '01M1XYKBJHMT12JR173WZ37FSW',
    type: 'boarding',
    scheduledStart: new Date(now + 2 * 3600_000), // 入住日首晚距现在 2h（<4h）
    scheduledEnd: new Date(now + 26 * 3600_000),
    status: 'confirmed',
    priceFen: 19900,
    paymentMode: 'pay_at_store',
  },
  {
    code: 'B34INB',
    customerId: '01M1XYKBJER5W7SXT254ACXDTB',
    storeId: '01M1XYKBJFPDAKXQM3EVAMG5N2',
    petId: '01M1XYKBJGYJ0NP9941XX01JWE',
    serviceId: '01M1XYKBJHMT12JR173WZ37FSW',
    type: 'boarding',
    scheduledStart: new Date(now + 5 * 24 * 3600_000),
    scheduledEnd: new Date(now + 7 * 24 * 3600_000),
    status: 'in_boarding', // 寄养进行中
    priceFen: 39800,
    paymentMode: 'pay_at_store',
  },
]).returning();
for (const r of rows) console.log(r.code, r.id, r.status);
process.exit(0);
