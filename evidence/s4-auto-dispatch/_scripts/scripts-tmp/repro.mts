import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-repro-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'r.db').replaceAll('\\', '/')}`;
const { migrate } = await import('drizzle-orm/libsql/migrator');
const { db, schema, client } = await import('../src/db/index.ts');
const { loadGroomerOccupancy, freeGroomersInInterval } = await import('../src/routers/appointment.ts');
await migrate(db, { migrationsFolder: 'D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560/philia-app/server/drizzle' });
const SCHED = {
  mon: [{ start: '09:00', end: '18:00' }], tue: [{ start: '09:00', end: '18:00' }],
  wed: [{ start: '09:00', end: '18:00' }], thu: [{ start: '09:00', end: '18:00' }],
  fri: [{ start: '09:00', end: '18:00' }], sat: [{ start: '10:00', end: '19:00' }],
  sun: [{ start: '10:00', end: '19:00' }],
};
await db.insert(schema.users).values([{ id: 'u1', kimiId: 'k1' }, { id: 'u2', kimiId: 'k2' }, { id: 'u3', kimiId: 'k3' }]);
await db.insert(schema.stores).values({ id: 's1', ownerId: 'u1', name: 'x', status: 'active' });
await db.insert(schema.staff).values([
  { id: 'aq', storeId: 's1', userId: 'u2', name: '阿强', role: 'groomer', skills: ['wash'], schedule: SCHED, status: 'active' },
  { id: 'll', storeId: 's1', userId: 'u3', name: '丽丽', role: 'groomer', skills: ['groom'], schedule: SCHED, status: 'active' },
]);
await db.insert(schema.pets).values({ id: 'p1', ownerId: 'u1', name: '豆豆', species: 'dog' });
await db.insert(schema.services).values({ id: 'sv1', storeId: 's1', type: 'grooming', name: '洗护', durationMin: 90, priceFen: 1 });
const today = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
await db.insert(schema.appointments).values({
  code: 'R1', customerId: 'u1', storeId: 's1', staffId: 'll', petId: 'p1', serviceId: 'sv1',
  type: 'grooming', scheduledStart: today(15), scheduledEnd: today(16, 30), status: 'completed', priceFen: 1,
});
const start = today(16).getTime();
const end = today(17, 30).getTime();
const occ = await loadGroomerOccupancy(db as never, 's1', start, end);
console.log('groomers:', occ.groomers.map((g) => g.id));
console.log('appts:', occ.appts.map((a) => ({ staffId: a.staffId, s: a.scheduledStart, e: a.scheduledEnd })));
console.log('free @16:00-17:30:', freeGroomersInInterval(occ, start, end).map((g) => g.id));
client.close();
