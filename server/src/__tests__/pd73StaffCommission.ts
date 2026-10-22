import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!process.env.PD73_TEST_WORKER) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd73-'));
  const DB_URL = `file:${join(tmpDir, 'pd73.db').replaceAll('\\', '/')}`;
  const result = spawnSync(process.execPath, [TSX_CLI, fileURLToPath(import.meta.url)], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PD73_TEST_WORKER: '1', PHILIA_DB_URL: DB_URL },
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

const [{ db, schema, client }, { appRouter }] = await Promise.all([
  import('../db'),
  import('../routers'),
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

async function errorOf(promise: Promise<unknown>): Promise<{ code?: string; message?: string } | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error as { code?: string; message?: string };
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
    user: {
      id: groomerUser.id,
      nickname: groomerUser.nickname,
      roles: ['staff'],
      staffId: groomer.id,
      storeId: groomer.storeId,
    },
  });
  const frontdeskCaller = appRouter.createCaller({
    db,
    user: {
      id: frontdeskUser.id,
      nickname: frontdeskUser.nickname,
      roles: ['staff'],
      staffId: frontdesk.id,
      storeId: frontdesk.storeId,
    },
  });
  const crossStoreCaller = appRouter.createCaller({
    db,
    user: {
      id: groomerUser.id,
      nickname: groomerUser.nickname,
      roles: ['staff'],
      staffId: groomer.id,
      storeId: 'pd73-not-this-store',
    },
  });

  const now = new Date();
  const executeId = 'pd73-execute-assigned';
  const commissionId = 'pd73-commission-unpaid';
  await db.insert(schema.appointments).values([
    {
      id: executeId,
      code: 'PD73A1',
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
      note: 'PD-73 本店合成权限单',
    },
    {
      id: commissionId,
      code: 'PD73B2',
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
      note: 'PD-73 本店合成提成单',
    },
  ]);

  const assignedGet = await groomerCaller.appointment.get({ appointmentId: executeId });
  check(
    'FT-STAFF-R4-01：本店被派员工可读执行单，且归属员工可辨',
    assignedGet.appointment.id === executeId && assignedGet.assignedStaff?.name === groomer.name,
    assignedGet.assignedStaff,
  );
  const otherReadError = await errorOf(frontdeskCaller.appointment.get({ appointmentId: executeId }));
  check(
    'AE-STAFF-R4-04：同店非派单员工读 execute → FORBIDDEN，不回核销码',
    otherReadError?.code === 'FORBIDDEN' && !JSON.stringify(otherReadError).includes('PD73A1'),
    otherReadError,
  );
  const crossReadError = await errorOf(crossStoreCaller.appointment.get({ appointmentId: executeId }));
  check(
    'FT-STAFF-R4-01：非本店上下文读 execute → FORBIDDEN，不回核销码',
    crossReadError?.code === 'FORBIDDEN' && !JSON.stringify(crossReadError).includes('PD73A1'),
    crossReadError,
  );
  const otherStepsError = await errorOf(frontdeskCaller.serviceStep.list({ appointmentId: executeId }));
  check('AE-STAFF-R4-04：同店非派单员工读六步 → FORBIDDEN', otherStepsError?.code === 'FORBIDDEN', otherStepsError);
  const otherWriteError = await errorOf(
    frontdeskCaller.serviceStep.confirmStep({ appointmentId: executeId, stepKey: 'disinfection' }),
  );
  check('FT-STAFF-R4-01：同店非派单员工写六步 → FORBIDDEN', otherWriteError?.code === 'FORBIDDEN', otherWriteError);

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const before = await groomerCaller.commission.mySummary({ month });
  const beforePayload = before.payload as {
    serviceLines: Array<{ refId: string; amountFen: number }>;
    pendingServiceLines?: Array<{ refId: string; estimatedFen: number }>;
    commissionTotalFen: number;
    cardNote: string;
  };
  const pending = beforePayload.pendingServiceLines?.find((line) => line.refId === commissionId);
  check(
    'HP-STAFF-04：完成未收款显示待计提，预计金额按 20% mock 规则',
    pending?.estimatedFen === 2_000 && !beforePayload.serviceLines.some((line) => line.refId === commissionId),
    { pending, serviceLines: beforePayload.serviceLines.filter((line) => line.refId === commissionId) },
  );
  check(
    'HP-STAFF-04：收款前合计不把待计提预计额入账',
    beforePayload.commissionTotalFen === 0,
    beforePayload.commissionTotalFen,
  );
  check(
    'P-STAFF-04：售卡空态不再使用内部接通语',
    !beforePayload.cardNote.includes('已接通') && beforePayload.cardNote.length > 0,
    beforePayload.cardNote,
  );
  check(
    '收款后计提口径：policyNote 不再写旧服务计提时点',
    before.policyNote.includes('服务单=收款后计提') && !before.policyNote.includes(['完成', '即计提'].join('')),
    before.policyNote,
  );
  const operatorBefore = await frontdeskCaller.commission.mySummary({ month });
  const operatorTotalBefore = (operatorBefore.payload as { commissionTotalFen: number }).commissionTotalFen;

  const paid = await ownerCaller.appointment.markPaid({ appointmentId: commissionId });
  assert.equal(paid.idempotent, false);
  const after = await groomerCaller.commission.mySummary({ month });
  const afterPayload = after.payload as {
    serviceLines: Array<{ refId: string; amountFen: number }>;
    pendingServiceLines?: Array<{ refId: string }>;
    commissionTotalFen: number;
  };
  const posted = afterPayload.serviceLines.find((line) => line.refId === commissionId);
  check(
    'HP-STAFF-04：appointment.markPaid mock 收款后生成已入账计提行',
    posted?.amountFen === 2_000 && afterPayload.commissionTotalFen === 2_000,
    { posted, total: afterPayload.commissionTotalFen },
  );
  check(
    'HP-STAFF-04：收款后待计提行转出，不重复计提',
    !afterPayload.pendingServiceLines?.some((line) => line.refId === commissionId) &&
      afterPayload.serviceLines.filter((line) => line.refId === commissionId).length === 1,
    afterPayload.pendingServiceLines,
  );
  const operatorAfter = await frontdeskCaller.commission.mySummary({ month });
  const operatorPayload = operatorAfter.payload as {
    serviceLines: Array<{ refId: string }>;
    pendingServiceLines?: Array<{ refId: string }>;
    commissionTotalFen: number;
  };
  check(
    'O-HEAD-OPERATOR：非归属员工提成不随该单变化',
    operatorPayload.commissionTotalFen === operatorTotalBefore &&
      !operatorPayload.serviceLines.some((line) => line.refId === commissionId) &&
      !operatorPayload.pendingServiceLines?.some((line) => line.refId === commissionId),
    { before: operatorTotalBefore, after: operatorPayload.commissionTotalFen },
  );

  const loginPage = readFileSync(join(SERVER_ROOT, '../apps/staff/src/pages/DevLoginPage.tsx'), 'utf8');
  const loginCopy = readFileSync(join(SERVER_ROOT, '../apps/staff/src/copy/login.ts'), 'utf8');
  const staffApp = readFileSync(join(SERVER_ROOT, '../apps/staff/src/App.tsx'), 'utf8');
  check(
    'AE-STAFF-R4-02：登录页不再枚举种子账号或调用种子清单口',
    !loginPage.includes('dev-seed-users') && !loginPage.includes('staffSeeds') && !loginPage.includes('loadSeeds'),
    'DevLoginPage source',
  );
  check(
    'AE-STAFF-R4-02：登录文案无 dev-login／种子／userId 内部外露',
    !/dev-login|种子|userId|seed_/.test(loginCopy),
    'copy/login source',
  );
  check('AE-STAFF-R4-02：员工正常登录入口为 /login', staffApp.includes('path="/login"'), 'App source');
  check(
    'AE-STAFF-R4-02：登录失败不透出后端 dev／种子错误原文',
    !loginPage.includes('setError(msg)'),
    'DevLoginPage error mapping',
  );

  assert.deepEqual(failures, [], `PD-73 失败断言：\n${failures.join('\n')}`);
} finally {
  client.close();
}
