/** 把今天走完的 3 个测试单 completedAt 拨到 20 天前（reminder 共存对照造数；--restore 还原为今天） */
import { db, schema } from '../src/db/index.js';
import { inArray } from 'drizzle-orm';

const IDS = [
  '01M254A5YEHJX4H0D9CPWWYZTT',
  '01M256D240E19GWNG2QMFV3Q8V',
  '01B8TESTCHECKIN000000000001',
];
const restore = process.argv.includes('--restore');
const target = restore ? new Date() : new Date(Date.now() - 20 * 24 * 3600 * 1000);
await db.update(schema.appointments).set({ completedAt: target }).where(inArray(schema.appointments.id, IDS));
console.log(JSON.stringify({ ids: IDS, completedAt: target.toISOString() }));
process.exit(0);
