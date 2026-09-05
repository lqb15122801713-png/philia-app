/**
 * T1.3b serviceStep router（六步状态机）· 冒烟验证
 *
 * 运行：npx tsx src/routers/__tests__/serviceStep.smoke.ts
 *
 * 覆盖（对应任务验证清单 1-6）：
 * 1. locked 步 addPhotos/confirmStep → FORBIDDEN；跨店 staff/merchant/客户归属 → FORBIDDEN
 * 2. 张数不足 confirm → BAD_REQUEST（提示还差 N 张）；超 max addPhotos → BAD_REQUEST
 * 3. step1 传 1 张 → confirm → step1 done、step2 active；step_updated 事件落 outbox
 *    且载荷含 photos 与 nextStepKey
 * 4. flagForRedo：(b) 路径回退 active + 旧照片 invalidated + confirm 只统计新照片；
 *    step3 已 done 时对 step2 打标 → 拒；locked 步打标 → 拒；(a) 路径仅置 flagged 不动照片
 * 5. before_after 步：tag normal → 拒；只传 before → 拒；before+after 各 1 → 过
 * 6. 全程走完到 step6 confirm：预约 completed、completed_at 写入、appointment.completed
 *    事件；全程任意时点 active 步数 ≤1（规则 1 不变量）
 *
 * 使用独立临时库（PHILIA_DB_URL 指向 %TMP%），跑完清场，不污染 server/data/philia.db。
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-servicestep-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;

/* ------------------------------ 小工具 ------------------------------ */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

type TrpcErr = { code?: string; message?: string };
async function expectErr(
  name: string,
  p: Promise<unknown>,
  code: string,
  msgPart?: string,
): Promise<void> {
  try {
    await p;
    check(`${name}：应拒绝（${code}）`, false, '未抛错');
  } catch (e) {
    const err = e as TrpcErr;
    check(
      `${name}：${code}${msgPart ? ` 且提示含「${msgPart}」` : ''}`,
      err?.code === code && (!msgPart || String(err?.message ?? '').includes(msgPart)),
      { code: err?.code, message: err?.message },
    );
  }
}

/* ------------------------------ 主流程 ------------------------------ */

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  const { and, asc, desc, eq, isNull } = await import('drizzle-orm');
  const { EventType } = await import('../../realtime/events');
  const { serviceStepRouter, STEP_DEFS } = await import('../serviceStep');

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具：用户/门店/员工/宠物/服务项 + in_service 预约 + 六步初始化 ---------- */
  const OWNER = 'u-owner-ss01';
  const STAFF_USER = 'u-staff-ss01';
  const CUSTOMER = 'u-cust-ss001';
  const STRANGER_CUST = 'u-cust-ss002';
  const STORE = 'store-ss0001';
  const STAFF = 'staff-ss0001';
  const PET = 'pet-ss00001';
  const SERVICE = 'svc-ss00001';
  const APPT = 'appt-ss00001';
  // 跨店对照组（归属校验用）
  const STORE2 = 'store-ss0002';
  const OWNER2 = 'u-owner-ss02';
  const STAFF2_USER = 'u-staff-ss02';
  const STAFF2 = 'staff-ss0002';

  await db.insert(schema.users).values([
    { id: OWNER, kimiId: 'k-ss-owner', nickname: '店主' },
    { id: STAFF_USER, kimiId: 'k-ss-staff', nickname: '店员小洗' },
    { id: CUSTOMER, kimiId: 'k-ss-cust', nickname: '豆豆家长' },
    { id: STRANGER_CUST, kimiId: 'k-ss-cust2', nickname: '路人家长' },
    { id: OWNER2, kimiId: 'k-ss-owner2', nickname: '隔壁店主' },
    { id: STAFF2_USER, kimiId: 'k-ss-staff2', nickname: '隔壁店员' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: OWNER, role: 'merchant_owner' },
    { userId: STAFF_USER, role: 'staff' },
    { userId: CUSTOMER, role: 'customer' },
    { userId: STRANGER_CUST, role: 'customer' },
    { userId: OWNER2, role: 'merchant_owner' },
    { userId: STAFF2_USER, role: 'staff' },
  ]);
  await db.insert(schema.stores).values([
    { id: STORE, ownerId: OWNER, name: '菲丽亚望京店' },
    { id: STORE2, ownerId: OWNER2, name: '隔壁宠物店' },
  ]);
  await db.insert(schema.staff).values([
    { id: STAFF, storeId: STORE, userId: STAFF_USER, name: '小洗' },
    { id: STAFF2, storeId: STORE2, userId: STAFF2_USER, name: '隔壁小王' },
  ]);
  await db
    .insert(schema.pets)
    .values({ id: PET, ownerId: CUSTOMER, name: '豆豆', species: 'dog' });
  await db.insert(schema.services).values({
    id: SERVICE,
    storeId: STORE,
    type: 'grooming',
    name: '精致洗护',
    priceFen: 12800,
  });
  const start = new Date(Date.now() + 3600_000);
  await db.insert(schema.appointments).values({
    id: APPT,
    code: '483921',
    customerId: CUSTOMER,
    storeId: STORE,
    staffId: STAFF,
    petId: PET,
    serviceId: SERVICE,
    type: 'grooming',
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + 3600_000),
    status: 'in_service', // 已核销、服务进行中
    checkedInAt: new Date(),
    priceFen: 12800,
  });
  // 六步初始化夹具（直接写库）：step1 active 且 startedAt 未写（验证 addPhotos 补写），其余 locked
  await db.insert(schema.appointmentSteps).values(
    STEP_DEFS.map((d) => ({
      appointmentId: APPT,
      stepKey: d.stepKey,
      stepOrder: d.stepOrder,
      status: d.stepOrder === 1 ? 'active' : 'locked',
      requiredPhotos: d.minPhotos,
      startedAt: null,
    })),
  );

  /* ---------- tRPC callers ---------- */
  const staffCaller = serviceStepRouter.createCaller({
    db,
    user: { id: STAFF_USER, nickname: '小洗', roles: ['staff'], staffId: STAFF, storeId: STORE },
  });
  const merchantCaller = serviceStepRouter.createCaller({
    db,
    user: { id: OWNER, nickname: '店主', roles: ['merchant_owner'], storeId: STORE },
  });
  const customerCaller = serviceStepRouter.createCaller({
    db,
    user: { id: CUSTOMER, nickname: '豆豆家长', roles: ['customer'] },
  });
  const strangerStaffCaller = serviceStepRouter.createCaller({
    db,
    user: {
      id: STAFF2_USER,
      nickname: '隔壁小王',
      roles: ['staff'],
      staffId: STAFF2,
      storeId: STORE2,
    },
  });
  const strangerMerchantCaller = serviceStepRouter.createCaller({
    db,
    user: { id: OWNER2, nickname: '隔壁店主', roles: ['merchant_owner'], storeId: STORE2 },
  });
  const strangerCustomerCaller = serviceStepRouter.createCaller({
    db,
    user: { id: STRANGER_CUST, nickname: '路人家长', roles: ['customer'] },
  });

  /* ---------- 共享断言工具 ---------- */
  let photoSeq = 0;
  const img = (tag?: 'normal' | 'before' | 'after') => {
    photoSeq += 1;
    return {
      url: `/api/img/smoke/${APPT}/${photoSeq}.jpg`,
      thumbUrl: `/api/img/smoke/${APPT}/${photoSeq}_t.jpg`,
      ...(tag ? { tag } : {}),
    };
  };

  const stepsOf = () =>
    db
      .select()
      .from(schema.appointmentSteps)
      .where(eq(schema.appointmentSteps.appointmentId, APPT))
      .orderBy(asc(schema.appointmentSteps.stepOrder));
  const stepOf = async (key: string) => (await stepsOf()).find((s) => s.stepKey === key)!;

  async function assertInvariant(label: string, max = 1): Promise<void> {
    const actives = (await stepsOf()).filter((s) => s.status === 'active');
    check(`${label}：active 步数 ≤${max}（规则 1 不变量）`, actives.length <= max, {
      active: actives.map((s) => s.stepKey),
    });
  }

  const photosOf = (stepId: string) =>
    db
      .select()
      .from(schema.stepPhotos)
      .where(eq(schema.stepPhotos.stepId, stepId))
      .orderBy(asc(schema.stepPhotos.takenAt), asc(schema.stepPhotos.id));

  async function lastOutbox(eventType: string) {
    return db
      .select()
      .from(schema.eventOutbox)
      .where(eq(schema.eventOutbox.eventType, eventType))
      .orderBy(desc(schema.eventOutbox.id))
      .limit(1)
      .then((r) => r[0]);
  }

  /* ============================== [1] locked 步拒绝 + 归属校验 ============================== */
  console.log('\n[1] locked 步 addPhotos/confirmStep → FORBIDDEN；跨店/客户归属 → FORBIDDEN');
  await expectErr(
    'locked 步（precheck）addPhotos',
    staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'precheck', photos: [img()] }),
    'FORBIDDEN',
  );
  await expectErr(
    'locked 步（precheck）confirmStep',
    staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'precheck' }),
    'FORBIDDEN',
  );
  await expectErr(
    '客户身份 addPhotos（staffProcedure 拦截）',
    customerCaller.addPhotos({ appointmentId: APPT, stepKey: 'disinfection', photos: [img()] }),
    'FORBIDDEN',
  );
  await expectErr(
    '跨店 staff addPhotos（归属校验）',
    strangerStaffCaller.addPhotos({
      appointmentId: APPT,
      stepKey: 'disinfection',
      photos: [img()],
    }),
    'FORBIDDEN',
  );
  await expectErr(
    '跨店 merchant flagForRedo（归属校验）',
    strangerMerchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'disinfection' }),
    'FORBIDDEN',
  );
  await expectErr(
    '他人预约 customer list（归属校验）',
    strangerCustomerCaller.list({ appointmentId: APPT }),
    'FORBIDDEN',
  );
  await assertInvariant('[1] 后');

  /* ============================== [2] 张数校验 ============================== */
  console.log('\n[2] 张数不足 confirm → 拒（提示还差 N 张）；超 max addPhotos → 拒');
  await expectErr(
    'step1 无照片 confirmStep',
    staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'disinfection' }),
    'BAD_REQUEST',
    '还差 1 张',
  );
  await expectErr(
    'step1 一次传 4 张（max=3）addPhotos',
    staffCaller.addPhotos({
      appointmentId: APPT,
      stepKey: 'disinfection',
      photos: [img(), img(), img(), img()],
    }),
    'BAD_REQUEST',
    '上限 3 张',
  );

  /* ============================== [3] step1 正常推进 + 事件载荷 ============================== */
  console.log('\n[3] step1 传 1 张 → confirm → step1 done、step2 active；step_updated 载荷校验');
  const add1 = await staffCaller.addPhotos({
    appointmentId: APPT,
    stepKey: 'disinfection',
    photos: [img()],
  });
  check('step1 addPhotos 登记 1 张', add1.added === 1 && add1.totalValid === 1, add1);
  const s1AfterAdd = await stepOf('disinfection');
  check('addPhotos 补写 started_at（staff 未开始时）', s1AfterAdd.startedAt instanceof Date);

  const conf1 = await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'disinfection' });
  check(
    'confirmStep 返回 nextStepKey=precheck、未完结预约',
    conf1.nextStepKey === 'precheck' && conf1.appointmentCompleted === false,
    conf1,
  );
  const s1 = await stepOf('disinfection');
  const s2 = await stepOf('precheck');
  check(
    'step1 done（done_at 写入、flagged=0）',
    s1.status === 'done' && s1.doneAt instanceof Date && s1.flagged === false,
    { status: s1.status, doneAt: s1.doneAt, flagged: s1.flagged },
  );
  check(
    'step2 locked→active（started_at 写入）',
    s2.status === 'active' && s2.startedAt instanceof Date,
    { status: s2.status, startedAt: s2.startedAt },
  );
  const evt1 = await lastOutbox(EventType.StepUpdated);
  const p1 = evt1?.payload ?? {};
  check(
    'step_updated 落 outbox：频道 appointment:{aid} 且载荷含 photos 与 nextStepKey',
    evt1?.channel === `appointment:${APPT}` &&
      p1.appointmentId === APPT &&
      p1.stepKey === 'disinfection' &&
      p1.status === 'done' &&
      Array.isArray(p1.photos) &&
      (p1.photos as unknown[]).length === 1 &&
      typeof (p1.photos as Array<{ url?: string }>)[0]?.url === 'string' &&
      typeof (p1.photos as Array<{ thumbUrl?: string }>)[0]?.thumbUrl === 'string' &&
      p1.nextStepKey === 'precheck',
    p1,
  );
  await assertInvariant('[3] 后');

  /* ============================== [4] flagForRedo 全路径 ============================== */
  console.log('\n[4] flagForRedo：locked 步拒 / 非最新 done 拒 / (b) 回退+作废旧照 / (a) 仅打标');
  // step2 正常完成（2 张照片）
  await staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'precheck', photos: [img(), img()] });
  await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'precheck' });
  check('step2 完成、step3 active', (await stepOf('grooming')).status === 'active');
  await assertInvariant('step2 confirm 后');

  const step2Row = await stepOf('precheck');
  const step2OldPhotos = await photosOf(step2Row.id);
  check('step2 旧照片 2 张（待作废对象）', step2OldPhotos.length === 2, step2OldPhotos.length);

  // 对 locked 步打标 → 拒
  await expectErr(
    '对 locked 步（detail）打标',
    merchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'detail' }),
    'FORBIDDEN',
  );
  // step2 done 但 step3 active（非"其后全 locked"）→ 拒
  await expectErr(
    'step3 仍 active 时对 step2 打标',
    merchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'precheck' }),
    'FORBIDDEN',
  );

  // 造 (b) 前置状态：step2 done、step3 及之后全 locked、当前无 active（直接 SQL 调整夹具）
  await db
    .update(schema.appointmentSteps)
    .set({ status: 'locked', startedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(schema.appointmentSteps.appointmentId, APPT),
        eq(schema.appointmentSteps.stepKey, 'grooming'),
      ),
    );

  // (b) 路径：对最新 done 步 step2 打标回退
  const flagB = await merchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'precheck' });
  check(
    '(b) 路径返回 reactivated=true、作废 2 张旧照片',
    flagB.reactivated === true && flagB.invalidatedCount === 2,
    flagB,
  );
  const step2AfterFlag = await stepOf('precheck');
  check(
    'step2 done→active、flagged=1、done_at 清空',
    step2AfterFlag.status === 'active' &&
      step2AfterFlag.flagged === true &&
      step2AfterFlag.doneAt === null,
    {
      status: step2AfterFlag.status,
      flagged: step2AfterFlag.flagged,
      doneAt: step2AfterFlag.doneAt,
    },
  );
  const step2PhotosAfterFlag = await photosOf(step2Row.id);
  check(
    '旧照片全部 invalidated_at=now（保留可查）',
    step2PhotosAfterFlag.length === 2 &&
      step2PhotosAfterFlag.every((p) => p.invalidatedAt instanceof Date),
    step2PhotosAfterFlag.map((p) => p.invalidatedAt),
  );
  // 不变量：回退后恰好 1 个 active（=step2）
  const activesAfterFlag = (await stepsOf()).filter((s) => s.status === 'active');
  check(
    '回退后恰好 1 个 active 步且为 step2（规则 1）',
    activesAfterFlag.length === 1 && activesAfterFlag[0]!.stepKey === 'precheck',
    activesAfterFlag.map((s) => s.stepKey),
  );
  // step_flagged 事件：staff + appointment 双频道
  const flaggedRows = await db
    .select()
    .from(schema.eventOutbox)
    .where(eq(schema.eventOutbox.eventType, EventType.StepFlagged));
  const flaggedChannels = new Set(flaggedRows.map((r) => r.channel));
  check(
    'step_flagged 落 outbox ×2（appointment + staff 双频道）且载荷含 stepKey/flagged',
    flaggedRows.length === 2 &&
      flaggedChannels.has(`appointment:${APPT}`) &&
      flaggedChannels.has(`staff:${STAFF}`) &&
      flaggedRows.every((r) => r.payload?.stepKey === 'precheck' && r.payload?.flagged === true),
    flaggedRows.map((r) => [r.channel, r.payload]),
  );
  // confirm 只统计新照片（旧照已作废，还差 2 张）
  await expectErr(
    '回退后 confirmStep step2（仅统计新照片）',
    staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'precheck' }),
    'BAD_REQUEST',
    '还差 2 张',
  );
  // 重拍 2 张新照片 → confirm 通过
  await staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'precheck', photos: [img(), img()] });
  await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'precheck' });
  const step2Final = await stepOf('precheck');
  check(
    '重拍后 step2 重新 done、flagged 清 0',
    step2Final.status === 'done' && step2Final.flagged === false,
    { status: step2Final.status, flagged: step2Final.flagged },
  );
  const listAfterRedo = await customerCaller.list({ appointmentId: APPT });
  const step2Listed = listAfterRedo.find((s) => s.stepKey === 'precheck')!;
  check(
    'list 只返回 2 张新照片（旧照不计入）',
    step2Listed.photos.length === 2 &&
      step2Listed.photos.every((p) => p.invalidatedAt === null) &&
      step2OldPhotos.every((old) => !step2Listed.photos.some((n) => n.id === old.id)),
    step2Listed.photos.map((p) => p.id),
  );
  check('step3 重新 active', (await stepOf('grooming')).status === 'active');
  await assertInvariant('step2 重拍 confirm 后');

  // (a) 路径：对当前 active 步 step3 打标 —— 仅置 flagged，不动照片
  await staffCaller.addPhotos({
    appointmentId: APPT,
    stepKey: 'grooming',
    photos: [img(), img(), img()],
  });
  const step3Row = await stepOf('grooming');
  const flagA = await merchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'grooming' });
  check('(a) 路径返回 reactivated=false、作废 0 张', flagA.reactivated === false && flagA.invalidatedCount === 0, flagA);
  const step3AfterFlag = await stepOf('grooming');
  const step3PhotosAfterFlag = await photosOf(step3Row.id);
  check(
    '(a) 路径：step3 仍 active、flagged=1、3 张照片未失效',
    step3AfterFlag.status === 'active' &&
      step3AfterFlag.flagged === true &&
      step3PhotosAfterFlag.length === 3 &&
      step3PhotosAfterFlag.every((p) => p.invalidatedAt === null),
    { status: step3AfterFlag.status, flagged: step3AfterFlag.flagged },
  );
  // 催拍后员工照常 confirm（规则 3 不看 flagged，confirm 时清 flagged）
  await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'grooming' });
  const step3Final = await stepOf('grooming');
  check(
    'step3 confirm 后 done 且 flagged 清 0',
    step3Final.status === 'done' && step3Final.flagged === false,
  );
  // step3 已 done 时对 step2 打标 → 拒（step2 非最新 done 且其后非全 locked）
  await expectErr(
    'step3 已 done 时对 step2 打标',
    merchantCaller.flagForRedo({ appointmentId: APPT, stepKey: 'precheck' }),
    'FORBIDDEN',
  );
  await assertInvariant('step3 confirm 后');

  /* ============================== [5] before_after 步标签校验 ============================== */
  console.log('\n[5] before_after 步：normal 标签拒 / 只传 before 拒 / before+after 各 1 过');
  // step4 快速完成
  await staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'detail', photos: [img(), img()] });
  await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'detail' });
  check('step4 done、step5 active', (await stepOf('before_after')).status === 'active');

  await expectErr(
    'before_after 步传 normal 标签',
    staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'before_after', photos: [img('normal')] }),
    'BAD_REQUEST',
    'before / after',
  );
  await staffCaller.addPhotos({
    appointmentId: APPT,
    stepKey: 'before_after',
    photos: [img('before')],
  });
  await expectErr(
    '只传 1 张 before 时 confirm',
    staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'before_after' }),
    'BAD_REQUEST',
    'before / after 各至少 1 张',
  );
  await staffCaller.addPhotos({
    appointmentId: APPT,
    stepKey: 'before_after',
    photos: [img('after')],
  });
  const conf5 = await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'before_after' });
  check(
    'before+after 各 1 → confirm 通过、step6 active',
    conf5.nextStepKey === 'confirm' && (await stepOf('confirm')).status === 'active',
    conf5,
  );
  await assertInvariant('step5 confirm 后');

  /* ============================== [6] step6 三合一 + 全程收尾 ============================== */
  console.log('\n[6] step6 confirm：预约 completed + completed_at + appointment.completed 事件');
  const summaryBefore = await customerCaller.progressSummary({ appointmentId: APPT });
  check(
    'progressSummary（step6 前）：currentStepKey=confirm、doneCount=5、total=6、status=in_service',
    summaryBefore.currentStepKey === 'confirm' &&
      summaryBefore.doneCount === 5 &&
      summaryBefore.total === 6 &&
      summaryBefore.status === 'in_service',
    summaryBefore,
  );

  // confirm 步无需照片：addPhotos 应被 max=0 拒绝
  await expectErr(
    'confirm 步传照片（max=0）',
    staffCaller.addPhotos({ appointmentId: APPT, stepKey: 'confirm', photos: [img()] }),
    'BAD_REQUEST',
  );

  // list 全量：六步照片数与升序
  const fullList = await customerCaller.list({ appointmentId: APPT });
  const photoCounts = fullList.map((s) => s.photos.length);
  check(
    'list 返回 6 步且未失效照片数正确 [1,2,3,2,2,0]',
    fullList.length === 6 && JSON.stringify(photoCounts) === JSON.stringify([1, 2, 3, 2, 2, 0]),
    photoCounts,
  );
  check(
    'list 每步照片按 taken_at 升序（非递减）',
    fullList.every((s) =>
      s.photos.every((p, i) => i === 0 || (p.takenAt?.getTime() ?? 0) >= (s.photos[i - 1]!.takenAt?.getTime() ?? 0)),
    ),
  );

  const conf6 = await staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'confirm' });
  check(
    'step6 confirm 返回 appointmentCompleted=true、nextStepKey=null',
    conf6.appointmentCompleted === true && conf6.nextStepKey === null,
    conf6,
  );
  const apptFinal = await db
    .select()
    .from(schema.appointments)
    .where(eq(schema.appointments.id, APPT))
    .get();
  check(
    '预约 in_service→completed 且 completed_at 写入（规则 4 三合一）',
    apptFinal?.status === 'completed' && apptFinal.completedAt instanceof Date,
    { status: apptFinal?.status, completedAt: apptFinal?.completedAt },
  );
  check('step6 done', (await stepOf('confirm')).status === 'done');
  const evtDone = await lastOutbox(EventType.AppointmentCompleted);
  check(
    'appointment.completed 事件落 outbox（频道 appointment:{aid}）',
    evtDone?.channel === `appointment:${APPT}` && evtDone.payload?.appointmentId === APPT,
    evtDone?.payload,
  );
  const evt6 = await lastOutbox(EventType.StepUpdated);
  check(
    'step6 的 step_updated 载荷 nextStepKey=null、photos 为空数组',
    evt6?.payload?.stepKey === 'confirm' &&
      evt6.payload.nextStepKey === null &&
      Array.isArray(evt6.payload.photos) &&
      (evt6.payload.photos as unknown[]).length === 0,
    evt6?.payload,
  );
  await assertInvariant('全程完成后', 1); // 全部 done：0 个 active，≤1 恒成立
  const summaryAfter = await customerCaller.progressSummary({ appointmentId: APPT });
  check(
    'progressSummary（完成态）：currentStepKey=null、doneCount=6、status=completed',
    summaryAfter.currentStepKey === null &&
      summaryAfter.doneCount === 6 &&
      summaryAfter.status === 'completed',
    summaryAfter,
  );
  await expectErr(
    '完成后再 confirmStep（done 步）',
    staffCaller.confirmStep({ appointmentId: APPT, stepKey: 'confirm' }),
    'FORBIDDEN',
  );

  client.close();
} catch (err) {
  failures++;
  console.error('\n[smoke] 未捕获异常：', err);
} finally {
  // Windows 下 libsql 句柄释放略滞后：带重试删除，失败仅告警（临时目录系统会回收）
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[smoke] 临时目录清理失败（不影响验证结果）: ${tmpDir}`, e);
  }
}

console.log(failures === 0 ? '\n全部冒烟验证通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
