import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
if (!process.env.PD72_TEST_WORKER) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd72-'));
  const DB_URL = `file:${join(tmpDir, 'pd72.db').replaceAll('\\', '/')}`;
  const result = spawnSync(process.execPath, [TSX_CLI, fileURLToPath(import.meta.url)], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PD72_TEST_WORKER: '1', PHILIA_DB_URL: DB_URL },
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

const [{ db, schema, client }, { appRouter }, { and, eq, inArray }] = await Promise.all([
  import('../db'),
  import('../routers'),
  import('drizzle-orm'),
]);

const failures: string[] = [];
function check(name: string, condition: boolean, details: unknown): void {
  if (condition) {
    console.log(`✓ ${name}`, details);
  } else {
    failures.push(name);
    console.error(`✗ ${name}`, details);
  }
}

async function activeCopyText(ruleKey: string): Promise<string | undefined> {
  const row = await db
    .select({ valueJson: schema.copyOverrides.valueJson })
    .from(schema.copyOverrides)
    .where(and(eq(schema.copyOverrides.ruleKey, ruleKey), eq(schema.copyOverrides.active, true)))
    .get();
  return (row?.valueJson as { text?: string } | undefined)?.text;
}

try {
  const migratedHistory = await activeCopyText('sk.apptHistoryNote');
  const migratedFrontdeskEmpty = await activeCopyText('today.frontdesk.empty');
  check(
    '0113：旧 active 文案在重新 seed 前已升级',
    migratedHistory === '选择过去的日期，可回看当天的服务单' &&
      migratedFrontdeskEmpty === '现在没有要你接待的预约——本店新单会自动派到队列',
    { migratedHistory, migratedFrontdeskEmpty },
  );

  runProc([TSX_CLI, 'src/db/seed.ts']);
  const [users, staffRows, pets, services, copyRows] = await Promise.all([
    db.select().from(schema.users),
    db.select().from(schema.staff),
    db.select().from(schema.pets),
    db.select().from(schema.services),
    db
      .select({ ruleKey: schema.copyOverrides.ruleKey, valueJson: schema.copyOverrides.valueJson })
      .from(schema.copyOverrides)
      .where(
        and(
          eq(schema.copyOverrides.active, true),
          inArray(schema.copyOverrides.ruleKey, ['sk.apptHistoryNote', 'today.frontdesk.empty']),
        ),
      ),
  ]);

  const historyText = (copyRows.find((r) => r.ruleKey === 'sk.apptHistoryNote')?.valueJson ?? {}) as { text?: string };
  const frontdeskEmptyText = (copyRows.find((r) => r.ruleKey === 'today.frontdesk.empty')?.valueJson ?? {}) as { text?: string };
  check(
    'AE-STAFF-01：端口文案不再出现开发口吻',
    !!historyText.text?.includes('过去') && !historyText.text.includes('唯一入口') && !historyText.text.includes('历史单回看'),
    historyText,
  );
  check(
    'AE-STAFF-R2-01：空态不再冒称全店无预约',
    !!frontdeskEmptyText.text && !frontdeskEmptyText.text.includes('全店无预约'),
    frontdeskEmptyText,
  );

  const frontdeskUser = users.find((u) => u.kimiId === 'seed_kimi_staff1');
  const groomerUser = users.find((u) => u.kimiId === 'seed_kimi_staff2');
  const customerUser = users.find((u) => u.kimiId === 'seed_kimi_customer');
  const frontdesk = staffRows.find((s) => s.userId === frontdeskUser?.id && s.role === 'frontdesk');
  const groomer = staffRows.find((s) => s.userId === groomerUser?.id && s.role === 'groomer');
  const pet = pets.find((p) => p.ownerId === customerUser?.id);
  const service = services.find((s) => s.storeId === frontdesk?.storeId && s.type === 'grooming');
  assert.ok(frontdeskUser && groomerUser && customerUser && frontdesk && groomer && pet && service);

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const confirmedId = 'pd72-confirmed-assigned';
  const completedId = 'pd72-completed-assigned';
  const otherStaffId = 'pd72-confirmed-other-staff';
  await db.insert(schema.appointments).values([
    {
      id: confirmedId,
      code: 'PD72A1',
      customerId: customerUser.id,
      storeId: frontdesk.storeId,
      staffId: groomer.id,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: new Date(dayStart.getTime() + 12 * 60 * 60_000),
      scheduledEnd: new Date(dayStart.getTime() + 13 * 60 * 60_000),
      status: 'confirmed',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
    },
    {
      id: completedId,
      code: 'PD72B2',
      customerId: customerUser.id,
      storeId: frontdesk.storeId,
      staffId: groomer.id,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: new Date(dayStart.getTime() + 10 * 60 * 60_000),
      scheduledEnd: new Date(dayStart.getTime() + 11 * 60 * 60_000),
      status: 'completed',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
      checkedInAt: new Date(dayStart.getTime() + 10.5 * 60 * 60_000),
      completedAt: new Date(dayStart.getTime() + 11 * 60 * 60_000),
    },
    {
      id: otherStaffId,
      code: 'PD72C3',
      customerId: customerUser.id,
      storeId: frontdesk.storeId,
      staffId: frontdesk.id,
      petId: pet.id,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: new Date(dayStart.getTime() + 14 * 60 * 60_000),
      scheduledEnd: new Date(dayStart.getTime() + 15 * 60 * 60_000),
      status: 'confirmed',
      priceFen: service.priceFen,
      paymentMode: 'pay_at_store',
    },
  ]);

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

  const todayRows = await frontdeskCaller.appointment.listTodayForStaff();
  check(
    'AE-STAFF-R2-01：前台工位仍见同事确认单与刚完成单',
    todayRows.some((r) => r.id === confirmedId) && todayRows.some((r) => r.id === completedId),
    todayRows.filter((r) => r.id.startsWith('pd72-')).map((r) => ({ id: r.id, status: r.status })),
  );

  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000 - 1);
  const storewideList = frontdeskCaller.appointment.listForStaff as unknown as (input: {
    from: Date;
    to: Date;
    storewide: boolean;
  }) => Promise<Array<{ id: string }>>;
  const scheduleRows = await storewideList({ from: dayStart, to: dayEnd, storewide: true });
  check(
    'AE-STAFF-R2-01：前台预约页门店视图仍见同事确认单与刚完成单',
    scheduleRows.some((r) => r.id === confirmedId) && scheduleRows.some((r) => r.id === completedId),
    scheduleRows.filter((r) => r.id.startsWith('pd72-')).map((r) => r.id),
  );

  const personalRows = await frontdeskCaller.appointment.listForStaff({ from: dayStart, to: dayEnd });
  check(
    '个人绩效原口径不扩成门店视图',
    !personalRows.some((r) => r.id === confirmedId) && !personalRows.some((r) => r.id === completedId),
    personalRows.filter((r) => r.id.startsWith('pd72-')).map((r) => r.id),
  );
  const groomerRows = await groomerCaller.appointment.listTodayForStaff();
  check(
    '美容师本人确认单与完成单保持可见',
    groomerRows.some((r) => r.id === confirmedId) && groomerRows.some((r) => r.id === completedId),
    groomerRows.filter((r) => r.id.startsWith('pd72-')).map((r) => r.id),
  );
  const groomerStorewideList = groomerCaller.appointment.listForStaff as unknown as (input: {
    from: Date;
    to: Date;
    storewide: boolean;
  }) => Promise<Array<{ id: string }>>;
  const groomerScheduleRows = await groomerStorewideList({ from: dayStart, to: dayEnd, storewide: true });
  check(
    '非前台显式 storewide 也不见他人预约',
    !groomerRows.some((r) => r.id === otherStaffId) && !groomerScheduleRows.some((r) => r.id === otherStaffId),
    {
      today: groomerRows.filter((r) => r.id === otherStaffId).map((r) => r.id),
      schedule: groomerScheduleRows.filter((r) => r.id === otherStaffId).map((r) => r.id),
    },
  );

  await db.insert(schema.notifications).values(
    Array.from({ length: 120 }, (_, index) => ({
      userId: frontdeskUser.id,
      type: 'pd72.test',
      category: 'service',
      title: `PD-72 临时通知 ${index + 1}`,
    })),
  );
  const unreadBefore = await frontdeskCaller.push.unreadCount();
  const marked = await frontdeskCaller.push.markAllRead({});
  const unreadAfter = await frontdeskCaller.push.unreadCount();
  check(
    'AE-STAFF-04：120 条真未读全量清零',
    unreadBefore.total === 120 && marked.marked === 120 && unreadAfter.total === 0,
    { before: unreadBefore.total, marked: marked.marked, after: unreadAfter.total },
  );

  assert.deepEqual(failures, [], `PD-72 失败断言：\n${failures.join('\n')}`);
} finally {
  client.close();
}
