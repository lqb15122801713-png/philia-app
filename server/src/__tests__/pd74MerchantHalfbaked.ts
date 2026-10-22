import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const RUN_ID = process.env.PD74_TEST_RUN_ID ?? randomUUID();
if (process.env.PD74_TEST_WORKER !== RUN_ID) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd74-'));
  const DB_URL = `file:${join(tmpDir, 'pd74.db').replaceAll('\\', '/')}`;
  let status = 1;
  try {
    const result = spawnSync(process.execPath, [TSX_CLI, fileURLToPath(import.meta.url)], {
      cwd: SERVER_ROOT,
      env: {
        ...process.env,
        PD74_TEST_RUN_ID: RUN_ID,
        PD74_TEST_WORKER: RUN_ID,
        PD74_TEST_TMP_DIR: tmpDir,
        PHILIA_DB_URL: DB_URL,
      },
      stdio: 'inherit',
    });
    status = result.status ?? 1;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }
  process.exit(status);
}
assert.ok(process.env.PHILIA_DB_URL && process.env.PD74_TEST_TMP_DIR);
const DB_URL = process.env.PHILIA_DB_URL.replaceAll('\\', '/');
const TMP_DIR = process.env.PD74_TEST_TMP_DIR.replaceAll('\\', '/');
assert.ok(DB_URL.startsWith(`file:${TMP_DIR}/`), 'PD-74 测试只能使用本次临时目录数据库');

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

const EXPECTED_COPY = {
  'auth.seedEmpty': '未读取到店主演示账号，请检查演示数据，或手动输入用户 ID',
  'cashier.refundSvNotice': '本单涉储值/次卡：退款须店主办理（负债科目不设阈值）',
  'cashier.memberRenewCalcNote': '续费金额按当前档价与既有宠物只数核算，请先点「计算续费金额」确认应收再收款。',
  'cashier.upgradeQuoteTotal': '补差应收',
  'cashier.blindCloseNote': '盲交中——账面金额已遮罩，实点先行，差异提交后揭晓',
  'cadm.ownerOnlyBody': '端口配置与发布属店主专属；请切换店主账号。',
  'inv.marginNote': '进价/成本与毛利仅店主、店长可见',
  'mk.guide.hint': '标签/券/活动配置仅管理层可操作；请切换店长或店主账号。',
  'pass.statPendingNote': '会员域暂无本店汇总数据（现仅按人查询），暂不展示汇总数值',
  'payroll.ded.aside': '扣减只扣绩效不扣提成；当月累计最多扣 50%',
  'rpt.embed.outNote': '导出 CSV 仅覆盖已开放报表，预埋项暂不导出',
  'rpt.sparkNote': '今日格=截至当前已收 · 与财务统计同口径',
  'sched.swap.noQueue': '换班队列暂未接入，审批区待开放。',
  'set.addrHint': '用于附近门店的距离排序',
  'set.autoAcceptHint': '新预约自动接单 · 默认开启',
  'set.notifyNewHint': '门店新预约实时推送 · 声音提醒',
  'set.portsAside': '店主专属 · 后台可配置',
  'set.entryCopyHint': '三端文案统一维护',
  'set.entrySlotsHint': '素材上传→待审→上线/回退',
  'set.portBornNote': '后台可改，无需改代码',
  'staff.sub': '在职 {a} · 美容师 {b} · 前台 {c} · 自动派单按排班与负荷',
  'staff.editSkillNote': '技能标签暂为只读；排班请点员工行右侧的排班摘要编辑。',
} as const;
const MERCHANT_COPY_KEYS = Object.keys(EXPECTED_COPY);
const failures: string[] = [];

function check(name: string, condition: boolean, details: unknown): void {
  if (condition) {
    console.log(`✓ ${name}`, details);
  } else {
    failures.push(name);
    console.error(`✗ ${name}`, details);
  }
}

async function copyRows() {
  return db
    .select({ ruleKey: schema.copyOverrides.ruleKey, valueJson: schema.copyOverrides.valueJson })
    .from(schema.copyOverrides)
    .where(and(eq(schema.copyOverrides.active, true), inArray(schema.copyOverrides.ruleKey, [...MERCHANT_COPY_KEYS])));
}

function copyMismatches(rows: Array<{ ruleKey: string; valueJson: unknown }>) {
  return rows.flatMap((row) => {
    const actual = (row.valueJson as { text?: string } | null)?.text ?? '';
    const expected = EXPECTED_COPY[row.ruleKey as keyof typeof EXPECTED_COPY];
    return actual !== expected ? [{ ruleKey: row.ruleKey, expected, actual }] : [];
  });
}

try {
  await db.update(schema.copyOverrides).set({ valueJson: { text: 'PD-74 旧文案' } })
    .where(inArray(schema.copyOverrides.ruleKey, [...MERCHANT_COPY_KEYS]));
  const legacyRows = await copyRows();
  assert.equal(legacyRows.length, MERCHANT_COPY_KEYS.length);
  await client.execute('DELETE FROM `__drizzle_migrations` WHERE `hash` = (SELECT `hash` FROM `__drizzle_migrations` ORDER BY `created_at` DESC LIMIT 1)');
  runProc([TSX_CLI, 'src/db/migrate.ts']);
  const migratedRows = await copyRows();
  check(
    '0115：22 个现役商家文案键逐键精确迁移',
    migratedRows.length === MERCHANT_COPY_KEYS.length && copyMismatches(migratedRows).length === 0,
    copyMismatches(migratedRows),
  );

  runProc([TSX_CLI, 'src/db/seed.ts']);
  const seededRows = await copyRows();
  check(
    'PD-74：22 个商家默认与 seed 逐键同源',
    seededRows.length === MERCHANT_COPY_KEYS.length && copyMismatches(seededRows).length === 0,
    copyMismatches(seededRows),
  );

  const stores = await db.select().from(schema.stores);
  check('PD-74：临时库始终只有一家店', stores.length === 1, stores.length);
  const owner = await db.select().from(schema.users).where(eq(schema.users.kimiId, 'seed_kimi_owner')).get();
  assert.ok(owner && stores[0]);
  const storeId = stores[0].id;
  const service = await db.select().from(schema.services).where(eq(schema.services.storeId, storeId)).then((rows) => rows[0]);
  assert.ok(service);
  const ownerCaller = appRouter.createCaller({
    db,
    user: { id: owner.id, nickname: owner.nickname, roles: ['merchant_owner'], storeId },
  });
  const items = [{
    kind: 'service' as const,
    refId: service.id,
    qty: 1,
    adjustedPriceFen: null,
    paidByPass: false,
  }];
  const held = await ownerCaller.cashier.hold({
    customerId: null,
    items,
    discountType: 'none',
    discountValue: 0,
    note: 'PD-74 临时 mock 单',
  });
  await ownerCaller.cashier.settle({
    customerId: null,
    items,
    billNo: held.bill.billNo,
    discountType: 'none',
    discountValue: 0,
    note: 'PD-74 临时 mock 单',
    payments: [{ method: 'cash', amountFen: held.bill.payableFen }],
  });

  const opened = await ownerCaller.cashier.currentShift();
  assert.ok(opened.shift);
  const oldOpenedAt = new Date('2020-10-19T09:00:00+08:00');
  await db.update(schema.shifts).set({ openedAt: oldOpenedAt }).where(eq(schema.shifts.id, opened.shift.id));
  const before = await ownerCaller.cashier.currentShift();
  const dayClosesBefore = await db.select().from(schema.dayCloses);
  const after = await ownerCaller.cashier.currentShift();
  const dayClosesAfter = await db.select().from(schema.dayCloses);
  check(
    'HP-MERCH-05：跨日读取不自动日切、不改班、不生成日结',
    before.shift?.id === opened.shift.id &&
      after.shift?.id === opened.shift.id &&
      after.shift.status === 'open' &&
      after.shift.openedAt.getTime() === oldOpenedAt.getTime() &&
      dayClosesAfter.length === dayClosesBefore.length,
    { shiftId: after.shift.id, status: after.shift.status, dayCloses: dayClosesAfter.length },
  );

  const executed = await ownerCaller.refund.execute({
    billNo: held.bill.billNo,
    type: 'full',
    reason: 'PD-74 mock 退款写库验证',
    refundMethod: 'offline_original',
  });
  const refundId = executed.refund.id;
  const [storedRefund, refundItems, refundList, originalBill] = await Promise.all([
    db.select().from(schema.refundBills).where(eq(schema.refundBills.id, refundId)).get(),
    db.select().from(schema.refundBillItems).where(eq(schema.refundBillItems.refundId, refundId)),
    ownerCaller.refund.list({}),
    db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, held.bill.id)).get(),
  ]);
  check(
    'FT-MERCHANT-R4-01：mock 退款提交写入 executed 退款单与明细',
    storedRefund?.status === 'executed' && storedRefund.refundNo === executed.refund.refundNo && refundItems.length > 0,
    { status: storedRefund?.status, refundNo: storedRefund?.refundNo, itemCount: refundItems.length },
  );
  check(
    'FT-MERCHANT-R4-01：退款列表与原单退款流水可读',
    refundList.some((row) => row.id === refundId && row.billNo === held.bill.billNo) &&
      originalBill?.refundBillNo === executed.refund.refundNo &&
      originalBill.refundStatus !== null,
    { listVisible: refundList.some((row) => row.id === refundId), refundBillNo: originalBill?.refundBillNo, refundStatus: originalBill?.refundStatus },
  );
  check(
    'PD-74：mock 退款未登记真实实退',
    storedRefund?.status === 'executed' && storedRefund.settledAt === null,
    { status: storedRefund?.status, settledAt: storedRefund?.settledAt },
  );

  const storesAfter = await db.select().from(schema.stores);
  check('PD-74：验证结束未造第二店', storesAfter.length === 1 && storesAfter[0]?.id === storeId, storesAfter.length);
  assert.deepEqual(failures, [], `PD-74 失败断言：\n${failures.join('\n')}`);
} finally {
  client.close();
}
