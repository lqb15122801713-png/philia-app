/**
 * 批次 9a.2 实证辅助（临时脚本，不入库 commit）：从种子库挑实证用预约 id。
 * 跑法：cd server && npx tsx scripts/b92-find-ids.mts
 */
import { db } from '../src/db';
import { appointments } from '../src/db/schema';
import { desc } from 'drizzle-orm';

const rows = await db
  .select({
    id: appointments.id,
    type: appointments.type,
    status: appointments.status,
    customerId: appointments.customerId,
    storeId: appointments.storeId,
  })
  .from(appointments)
  .orderBy(desc(appointments.createdAt))
  .limit(50);

const boarding = rows.find((r) => r.type === 'boarding');
const grooming = rows.find((r) => r.type === 'grooming');
const target = rows.find((r) => r.id === '01M256D240E19GWNG2QMFV3Q8V');
console.log(JSON.stringify({ boarding, grooming, target, total: rows.length }, null, 2));
process.exit(0);
