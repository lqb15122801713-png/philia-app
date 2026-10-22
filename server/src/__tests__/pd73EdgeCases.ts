import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!process.env.PD73_EDGE_WORKER) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd73-edge-'));
  const DB_URL = `file:${join(tmpDir, 'edge.db').replaceAll('\\', '/')}`;
  const result = spawnSync(process.execPath, [TSX_CLI, fileURLToPath(import.meta.url)], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PD73_EDGE_WORKER: '1', PHILIA_DB_URL: DB_URL },
    stdio: 'inherit',
  });
  rmSync(tmpDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  process.exit(result.status ?? 1);
}
assert.ok(process.env.PHILIA_DB_URL);
const DB_URL = process.env.PHILIA_DB_URL;

function runProc(args: string[]): void {
  const result = spawnSync(process.execPath, args, {
    cwd: SERVER_ROOT,
    env: { ...process.env, PHILIA_DB_URL: DB_URL },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`命令失败(${result.status}): ${args.join(' ')}`);
}

runProc([TSX_CLI, 'src/db/migrate.ts']);
runProc([TSX_CLI, 'src/db/seed.ts']);

const [{ db, schema, client }, { appRouter }, { and, eq }, { computeMonth, snapshotStoreMonth }] = await Promise.all([
  import('../db'),
  import('../routers'),
  import('drizzle-orm'),
  import('../routers/commission'),
]);

const failures: string[] = [];
function check(name: string, condition: boolean, details?: unknown): void {
  if (condition) {
    console.log(`✓ ${name}`, details ?? '');
  } else {
    failures.push(name);
    console.error(`✗ ${name}`, details ?? '');
  }
}

async function errorOf(promise: Promise<unknown>): Promise<{ code?: string } | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error as { code?: string };
  }
}

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
  const frontdesk = staffRows.find((s) => s.userId === frontdeskUser?.id && s.role === 'frontdesk');
  const groomer = staffRows.find((s) => s.userId === groomerUser?.id && s.role === 'groomer');
  const pet = pets.find((p) => p.ownerId === customer?.id);
  const service = services.find((s) => s.storeId === groomer?.storeId && s.type === 'grooming');
  assert.ok(owner && frontdeskUser && groomerUser && customer && frontdesk && groomer && pet && service);

  const ownerCaller = appRouter.createCaller({
    db,
    user: { id: owner.id, nickname: owner.nickname, roles: ['merchant_owner'], storeId: groomer.storeId },
  });
  const groomerCaller = appRouter.createCaller({
    db,
    user: { id: groomerUser.id, nickname: groomerUser.nickname, roles: ['staff'], staffId: groomer.id, storeId: groomer.storeId },
  });
  const frontdeskCaller = appRouter.createCaller({
    db,
    user: { id: frontdeskUser.id, nickname: frontdeskUser.nickname, roles: ['staff'], staffId: frontdesk.id, storeId: frontdesk.storeId },
  });
  const clerkCaller = appRouter.createCaller({
    db,
    user: { id: frontdeskUser.id, nickname: frontdeskUser.nickname, roles: ['merchant_clerk'], staffId: frontdesk.id, storeId: frontdesk.storeId },
  });
  const dualMerchantCaller = appRouter.createCaller({
    db,
    user: {
      id: frontdeskUser.id,
      nickname: frontdeskUser.nickname,
      roles: ['staff', 'merchant_clerk'],
      staffId: frontdesk.id,
      storeId: frontdesk.storeId,
    },
  });
  const dualCustomerCaller = appRouter.createCaller({
    db,
    user: {
      id: frontdeskUser.id,
      nickname: frontdeskUser.nickname,
      roles: ['customer', 'staff'],
      staffId: frontdesk.id,
      storeId: frontdesk.storeId,
    },
  });

  const now = new Date();
  await db.insert(schema.appointments).values({
    id: 'pd73-edge-execute',
    code: 'PD73E1',
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
  });
  check(
    '纯 merchant_clerk 非派单写六步 → FORBIDDEN',
    (await errorOf(clerkCaller.serviceStep.confirmStep({ appointmentId: 'pd73-edge-execute', stepKey: 'disinfection' })))?.code === 'FORBIDDEN',
  );
  check(
    'staff+merchant_clerk 双角色非派单写六步 → FORBIDDEN',
    (await errorOf(dualMerchantCaller.serviceStep.confirmStep({ appointmentId: 'pd73-edge-execute', stepKey: 'disinfection' })))?.code === 'FORBIDDEN',
  );

  await db.insert(schema.pets).values({ id: 'pd73-edge-dual-pet', ownerId: frontdeskUser.id, name: '双角色宠物', species: 'dog' });
  await db.insert(schema.appointments).values({
    id: 'pd73-edge-dual-owned',
    code: 'PD73E2',
    customerId: frontdeskUser.id,
    storeId: groomer.storeId,
    staffId: groomer.id,
    petId: 'pd73-edge-dual-pet',
    serviceId: service.id,
    type: 'grooming',
    scheduledStart: now,
    scheduledEnd: new Date(now.getTime() + 60 * 60_000),
    status: 'in_service',
    priceFen: 10_000,
    paymentMode: 'pay_at_store',
    checkedInAt: now,
  });
  const dualGet = await errorOf(dualCustomerCaller.appointment.get({ appointmentId: 'pd73-edge-dual-owned' }));
  check('customer+staff 双角色仍可读本人预约', dualGet === null, dualGet);
  const dualSteps = await errorOf(dualCustomerCaller.serviceStep.list({ appointmentId: 'pd73-edge-dual-owned' }));
  check('customer+staff 双角色仍可读本人六步', dualSteps === null, dualSteps);

  await db.insert(schema.appointments).values([
    {
      id: 'pd73-edge-direct',
      code: 'PD73E3',
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
    },
    {
      id: 'pd73-edge-billed',
      code: 'PD73E4',
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
    },
  ]);
  await ownerCaller.appointment.markPaid({ appointmentId: 'pd73-edge-direct' });
  const billed = await ownerCaller.cashier.settle({
    items: [{ kind: 'appointment', refId: 'pd73-edge-billed', qty: 1 }],
    payments: [{ method: 'cash', amountFen: 10_000 }],
  });
  await db.update(schema.appointments).set({ paidAt: new Date(now.getTime() - 1_000) }).where(eq(schema.appointments.id, 'pd73-edge-direct'));
  await db.update(schema.cashierBills).set({ settledAt: now }).where(eq(schema.cashierBills.id, billed.bill.id));
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mixed = await computeMonth(
    db,
    groomer,
    month,
    new Map([['commission_overwork_multiplier', { threshold_per_day: 1, multiplier_bp: 15000 }]]),
  );
  const directLine = mixed.serviceLines.find((line) => line.refId === 'pd73-edge-direct');
  const billedLines = mixed.serviceLines.filter((line) => line.refId === 'pd73-edge-billed');
  check(
    '混合来源产能顺序按收款时刻而非来源插入顺序',
    directLine?.pendingApproval === false && billedLines[0]?.pendingApproval === true,
    { direct: directLine, billed: billedLines[0] },
  );
  check(
    'cashier.settle 与直接收款来源互斥，账单预约仅一行',
    billedLines.length === 1 && !mixed.pendingServiceLines.some((line) => line.refId === 'pd73-edge-billed'),
    billedLines,
  );

  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
  await db.insert(schema.appointments).values({
    id: 'pd73-edge-snapshot',
    code: 'PD73E5',
    customerId: customer.id,
    storeId: groomer.storeId,
    staffId: groomer.id,
    petId: pet.id,
    serviceId: service.id,
    type: 'grooming',
    scheduledStart: previousDate,
    scheduledEnd: new Date(previousDate.getTime() + 60 * 60_000),
    status: 'completed',
    priceFen: 10_000,
    paymentMode: 'pay_at_store',
    checkedInAt: previousDate,
    completedAt: previousDate,
  });
  await snapshotStoreMonth(db, groomer.storeId, previousMonth);
  const snapshot = await db
    .select()
    .from(schema.commissionSnapshots)
    .where(
      and(
        eq(schema.commissionSnapshots.staffId, groomer.id),
        eq(schema.commissionSnapshots.period, previousMonth),
        eq(schema.commissionSnapshots.kind, 'commission'),
      ),
    )
    .get();
  const snapshotPending = (snapshot?.payloadJson as { pendingServiceLines?: unknown[] } | undefined)?.pendingServiceLines;
  check('财务快照不冻结未收款待计提状态', Array.isArray(snapshotPending) && snapshotPending.length === 0, snapshotPending);
  await ownerCaller.payroll.generateMonth({ month: previousMonth });
  const payrollItem = await db
    .select()
    .from(schema.payrollItems)
    .where(and(eq(schema.payrollItems.staffId, groomer.id), eq(schema.payrollItems.month, previousMonth)))
    .get();
  const payrollPending = (payrollItem?.payloadJson as { pendingServiceLines?: unknown[] } | undefined)?.pendingServiceLines;
  check('工资条快照同样不冻结未收款待计提状态', Array.isArray(payrollPending) && payrollPending.length === 0, payrollPending);

  await db.insert(schema.appointments).values({
    id: 'pd73-edge-collab',
    code: 'PD73E6',
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
  });
  await db.insert(schema.appointmentCollaborators).values({
    appointmentId: 'pd73-edge-collab',
    staffId: frontdesk.id,
    role: 'assist',
    splitBp: 4000,
    createdBy: owner.id,
    createdAt: now,
  });
  const mainSummary = await groomerCaller.commission.mySummary({ month });
  const mainPending = (mainSummary.payload as { pendingServiceLines?: Array<{ refId: string; estimatedFen: number }> })
    .pendingServiceLines?.find((line) => line.refId === 'pd73-edge-collab');
  check('主操作人待计提预计额扣除已知协作拆分', mainPending?.estimatedFen === 1_200, mainPending);
  const collabSummary = await frontdeskCaller.commission.mySummary({ month });
  const collabPending = (collabSummary.payload as { pendingServiceLines?: Array<{ refId: string; estimatedFen: number; splitBp?: number }> })
    .pendingServiceLines?.find((line) => line.refId === 'pd73-edge-collab');
  check('协作人待计提预计额与收款后拆分一致', collabPending?.estimatedFen === 800 && collabPending.splitBp === 4000, collabPending);

  const loginPage = readFileSync(join(SERVER_ROOT, '../apps/staff/src/pages/DevLoginPage.tsx'), 'utf8');
  const loginCopy = readFileSync(join(SERVER_ROOT, '../apps/staff/src/copy/login.ts'), 'utf8');
  check(
    '登录页不展示内部角色键',
    !loginCopy.includes('前台 frontdesk') && !loginCopy.includes('美容师 groomer') && !loginPage.includes('user.roles.join'),
    'login role copy',
  );

  assert.deepEqual(failures, [], `PD-73 边缘失败断言：\n${failures.join('\n')}`);
} finally {
  client.close();
}
