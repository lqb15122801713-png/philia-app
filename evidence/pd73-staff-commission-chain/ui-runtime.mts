import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SERVER_ROOT = join(REPO_ROOT, 'server');
const EVIDENCE_ROOT = join(REPO_ROOT, 'evidence', 'pd73-staff-commission-chain');
const RUNTIME_ROOT = join(REPO_ROOT, '.runtime', 'pd73-ui');
const DB_FILE = join(RUNTIME_ROOT, 'ui.db');
const DB_URL = `file:${DB_FILE.replaceAll('\\', '/')}`;
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const command = process.argv[2];

function runProc(args: string[]): void {
  const result = spawnSync(process.execPath, args, {
    cwd: SERVER_ROOT,
    env: { ...process.env, PHILIA_DB_URL: DB_URL },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`命令失败(${result.status}): ${args.join(' ')}`);
}

if (command === 'setup') {
  rmSync(RUNTIME_ROOT, { recursive: true, force: true });
  mkdirSync(RUNTIME_ROOT, { recursive: true });
  runProc([TSX_CLI, 'src/db/migrate.ts']);
  runProc([TSX_CLI, 'src/db/seed.ts']);
  process.env.PHILIA_DB_URL = DB_URL;
  const [{ db, schema, client }, { appRouter }, { insertInitialSteps }] = await Promise.all([
    import('../../server/src/db'),
    import('../../server/src/routers'),
    import('../../server/src/routers/serviceStep'),
  ]);
  try {
    const [users, staffRows, pets, services] = await Promise.all([
      db.select().from(schema.users),
      db.select().from(schema.staff),
      db.select().from(schema.pets),
      db.select().from(schema.services),
    ]);
    const owner = users.find((u) => u.kimiId === 'seed_kimi_owner');
    const frontdeskUser = users.find((u) => u.kimiId === 'seed_kimi_staff1');
    const groomerUser = users.find((u) => u.kimiId === 'seed_kimi_staff2');
    const customer = users.find((u) => u.kimiId === 'seed_kimi_customer');
    const groomer = staffRows.find((s) => s.userId === groomerUser?.id && s.role === 'groomer');
    const pet = pets.find((p) => p.ownerId === customer?.id);
    const service = services.find((s) => s.storeId === groomer?.storeId && s.type === 'grooming');
    assert.ok(owner && frontdeskUser && groomerUser && customer && groomer && pet && service);
    const now = new Date();
    const executeId = 'pd73-ui-execute';
    const commissionId = 'pd73-ui-commission';
    await db.insert(schema.appointments).values([
      {
        id: executeId,
        code: 'PD73U1',
        customerId: customer.id,
        storeId: groomer.storeId,
        staffId: groomer.id,
        petId: pet.id,
        serviceId: service.id,
        type: 'grooming',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 60 * 60_000),
        status: 'in_service',
        priceFen: 10_000,
        paymentMode: 'pay_at_store',
        checkedInAt: now,
        note: 'PD-73 浏览器隔离合成单',
      },
      {
        id: commissionId,
        code: 'PD73U2',
        customerId: customer.id,
        storeId: groomer.storeId,
        staffId: groomer.id,
        petId: pet.id,
        serviceId: service.id,
        type: 'grooming',
        scheduledStart: now,
        scheduledEnd: new Date(now.getTime() + 60 * 60_000),
        status: 'completed',
        priceFen: 10_000,
        paymentMode: 'pay_at_store',
        checkedInAt: now,
        completedAt: now,
        note: 'PD-73 浏览器隔离提成单',
      },
    ]);
    await db.transaction(async (tx) => {
      await insertInitialSteps(tx as unknown as Parameters<typeof insertInitialSteps>[0], executeId);
    });
    const fixture = {
      apiBase: 'http://localhost:7300',
      staffBase: 'http://localhost:7302',
      executeId,
      commissionId,
      ownerId: owner.id,
      frontdeskId: frontdeskUser.id,
      frontdeskName: frontdeskUser.nickname,
      groomerId: groomerUser.id,
      groomerName: groomerUser.nickname,
      expectedFen: 2_000,
      dbFile: DB_FILE,
    };
    writeFileSync(join(EVIDENCE_ROOT, 'ui-fixture.json'), JSON.stringify(fixture, null, 2));
    console.log(JSON.stringify(fixture, null, 2));
  } finally {
    client.close();
  }
} else if (command === 'mark-paid') {
  process.env.PHILIA_DB_URL = DB_URL;
  const fixture = JSON.parse(readFileSync(join(EVIDENCE_ROOT, 'ui-fixture.json'), 'utf8')) as {
    commissionId: string;
    ownerId: string;
  };
  const [{ db, schema, client }, { appRouter }] = await Promise.all([
    import('../../server/src/db'),
    import('../../server/src/routers'),
  ]);
  try {
    const [users, appointments] = await Promise.all([
      db.select().from(schema.users),
      db.select().from(schema.appointments),
    ]);
    const owner = users.find((user) => user.id === fixture.ownerId);
    const appointment = appointments.find((row) => row.id === fixture.commissionId);
    assert.ok(owner && appointment);
    const caller = appRouter.createCaller({
      db,
      user: { id: owner.id, nickname: owner.nickname, roles: ['merchant_owner'], storeId: appointment.storeId },
    });
    const result = await caller.appointment.markPaid({ appointmentId: fixture.commissionId });
    console.log(JSON.stringify({ idempotent: result.idempotent, paidAt: result.appointment.paidAt, paidFen: result.appointment.paidFen }, null, 2));
  } finally {
    client.close();
  }
} else if (command === 'cleanup') {
  rmSync(RUNTIME_ROOT, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  console.log('PD-73 UI 临时数据库已删除');
} else {
  throw new Error('用法：setup | mark-paid | cleanup');
}
