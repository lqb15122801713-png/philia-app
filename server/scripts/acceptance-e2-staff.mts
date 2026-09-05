/**
 * P6/T6.1 验收补测 §11 E2：员工 A 操作「同店、已指派给员工 B」的预约 → serviceStep.* 归属校验拒绝
 *
 * 既有 serviceStep.smoke 仅覆盖「跨店 staff」负例；E2 要求同店他人员工维度，故补此最小脚本。
 * 夹具：同店两名员工（A=被指派 / B=同店他人），预约 in_service 且 staffId=B（指派给 B），
 * 员工 A 调 addPhotos / confirmStep / flagForRedo 均应 FORBIDDEN；B 自己操作应放行（对照）。
 *
 * 运行（server 目录下）：node node_modules/tsx/dist/cli.mjs scripts/acceptance-e2-staff.mts
 * 独立临时库，跑完清场；退出码 0=通过。
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-e2-staff-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'e2.db').replaceAll('\\', '/')}`;

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../src/db/index.js');
  const { serviceStepRouter } = await import('../src/routers/serviceStep.js');
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  });

  const STORE = 'store-e2';
  const STAFF_A = 'staff-e2-a'; // 同店员工 A（未被指派）
  const STAFF_B = 'staff-e2-b'; // 同店员工 B（被指派）
  const APPT = 'appt-e2';
  const start = new Date(Date.now() + 3600_000);

  await db.insert(schema.users).values([
    { id: 'u-e2-a', kimiId: 'k-e2-a', nickname: '员工A' },
    { id: 'u-e2-b', kimiId: 'k-e2-b', nickname: '员工B' },
    { id: 'u-e2-cust', kimiId: 'k-e2-cust', nickname: '客户' },
    { id: 'u-e2-owner', kimiId: 'k-e2-owner', nickname: '店主' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-e2-a', role: 'staff' },
    { userId: 'u-e2-b', role: 'staff' },
    { userId: 'u-e2-cust', role: 'customer' },
    { userId: 'u-e2-owner', role: 'merchant_owner' },
  ]);
  await db.insert(schema.stores).values({ id: STORE, ownerId: 'u-e2-owner', name: 'E2 测试店' });
  await db.insert(schema.staff).values([
    { id: STAFF_A, storeId: STORE, userId: 'u-e2-a', name: '员工A' },
    { id: STAFF_B, storeId: STORE, userId: 'u-e2-b', name: '员工B' },
  ]);
  await db.insert(schema.pets).values({ id: 'pet-e2', ownerId: 'u-e2-cust', name: '豆豆', species: 'dog' });
  await db.insert(schema.services).values({
    id: 'svc-e2', storeId: STORE, type: 'grooming', name: '洗护', priceFen: 9900,
  });
  await db.insert(schema.appointments).values({
    id: APPT,
    code: '246810',
    customerId: 'u-e2-cust',
    storeId: STORE,
    staffId: STAFF_B, // 已指派给员工 B
    petId: 'pet-e2',
    serviceId: 'svc-e2',
    type: 'grooming',
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + 3600_000),
    status: 'in_service',
    priceFen: 9900,
  });
  await db.insert(schema.appointmentSteps).values({
    id: 'step-e2-1',
    appointmentId: APPT,
    stepKey: 'disinfection',
    stepOrder: 1,
    status: 'active',
    requiredPhotos: 1,
  });

  const callerA = serviceStepRouter.createCaller({
    db,
    user: { id: 'u-e2-a', nickname: '员工A', roles: ['staff'], staffId: STAFF_A, storeId: STORE },
  } as any);
  const callerB = serviceStepRouter.createCaller({
    db,
    user: { id: 'u-e2-b', nickname: '员工B', roles: ['staff'], staffId: STAFF_B, storeId: STORE },
  } as any);
  const photo = { url: '/api/img/x.jpg?sig=s&exp=9999999999', thumbUrl: '/api/img/x_thumb.jpg?sig=s&exp=9999999999' };

  // 员工 A 操作指派给 B 的单 → 三个写过程全部 FORBIDDEN
  for (const [name, fn] of [
    ['addPhotos', () => callerA.addPhotos({ appointmentId: APPT, stepKey: 'disinfection', photos: [photo] })],
    ['confirmStep', () => callerA.confirmStep({ appointmentId: APPT, stepKey: 'disinfection' })],
    ['flagForRedo', () => callerA.flagForRedo({ appointmentId: APPT, stepKey: 'disinfection', reason: 'E2' } as any)],
  ] as const) {
    try {
      await fn();
      check(`E2：同店员工A ${name} 指派给B的单 → FORBIDDEN`, false, '未拒绝');
    } catch (e: any) {
      check(
        `E2：同店员工A ${name} 指派给B的单 → FORBIDDEN`,
        e?.code === 'FORBIDDEN' || String(e?.message).includes('FORBIDDEN'),
        e?.code ?? e?.message,
      );
    }
  }

  // 对照：被指派员工 B 自己操作 active 步 → 放行
  try {
    await callerB.addPhotos({ appointmentId: APPT, stepKey: 'disinfection', photos: [photo] });
    check('对照：员工B（被指派）addPhotos 本单 → 放行', true);
  } catch (e: any) {
    check('对照：员工B（被指派）addPhotos 本单 → 放行', false, e?.message);
  }

  client.close();
} catch (err) {
  failures++;
  console.error('\n[e2-staff] 未捕获异常：', err);
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    console.warn(`[e2-staff] 临时目录清理失败（不影响结果）: ${tmpDir}`);
  }
}

console.log(failures === 0 ? '\nE2 补测通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
