/**
 * PD-68 冒烟：409 后目标槽不可再选——列表须与 create 重叠闸同源剔槽
 *
 * 运行：npx tsx src/routers/__tests__/slotAvailAfter409.smoke.ts
 *
 * 缺陷机理（OBS：林晓_修后点验_PD64_2026-10-21「409 后槽仍 available」）：
 * 客端单屏栅格查询 getWithServices 只带 URL 预填 serviceId——自然进店（无 ?serviceId=）
 * 时服务端按 slotsNeeded=1（30min）过滤可约槽，而 appointment.create 以时长引擎输出
 * （如 60min→2 连续槽）判 groomer 空闲：首槽空、续槽占的时段列表显示可约，create 409
 * 「该时段已约满」，409 后 refetch 仍按 slotsNeeded=1 → 该槽仍 data-available=true 可再点。
 *
 * 本测试钉死同源契约（重叠冲突 → 409 → 同源列表剔槽＝槽不可选）：
 *  1. 唯一 groomer 在 [T+30min, T+90min) 有 confirmed 单——漏传 serviceId 的列表
 *     （slotsNeeded=1）仍含 T（旧闸差实证，修复前客户端口径）；
 *  2. create（60min 服务）于 T → CONFLICT「该时段已约满」（真 409）；
 *  3. 带生效 serviceId 的列表（与 create 同一时长闸＝修复后客户端口径）剔除 T，
 *     且 409 后再查仍剔除（409 后该槽不可再选）；
 *  4. 不过度拦截：终点相接的 T+90min 起始槽仍在同源列表（边界相接不算重叠）。
 *
 * 隔离策略：独立临时库（PHILIA_DB_URL → %TMP%），迁移+自建夹具，结束即删——不动种子库。
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 必须先于任何 '../db' 相关模块加载：指向独立临时库
const tmpDir = mkdtempSync(join(tmpdir(), 'philia-pd68-smoke-'));
process.env.PHILIA_DB_URL = `file:${join(tmpDir, 'smoke.db').replaceAll('\\', '/')}`;
process.env.BOOKING_CODE_SECRET = 'smoke-booking-code-secret';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

/** 断言 Promise 以指定 TRPCError code 拒绝（可选消息正则） */
async function rejects(p: Promise<unknown>, code: string, msgRe?: RegExp): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return err.code === code && (!msgRe || msgRe.test(err.message ?? ''));
  }
}

/** 相对今天 dayOffset 天、本地 h:m 的时间（秒/毫秒清零） */
const at = (dayOffset: number, h: number, m = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
};

try {
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const { db, schema, client } = await import('../../db');
  type Context = import('../../trpc').Context;
  const { appointmentRouter } = await import('../appointment');
  const { storeRouter } = await import('../store');

  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });

  /* ---------- 夹具 ---------- */
  await db.insert(schema.users).values([
    { id: 'u-c1', kimiId: 'k-c1', nickname: '客户一号' },
    { id: 'u-m', kimiId: 'k-m', nickname: '店主' },
    { id: 'u-e', kimiId: 'k-e', nickname: '美容师' },
  ]);
  await db.insert(schema.userRoles).values([
    { userId: 'u-c1', role: 'customer' },
    { userId: 'u-m', role: 'merchant_owner' },
    { userId: 'u-e', role: 'staff' },
  ]);
  const OPEN_ALL = {
    mon: { open: '09:00', close: '20:00' },
    tue: { open: '09:00', close: '20:00' },
    wed: { open: '09:00', close: '20:00' },
    thu: { open: '09:00', close: '20:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '20:00' },
    sun: { open: '09:00', close: '20:00' },
  };
  const SCHED_FULL = {
    mon: [{ start: '00:00', end: '23:59' }],
    tue: [{ start: '00:00', end: '23:59' }],
    wed: [{ start: '00:00', end: '23:59' }],
    thu: [{ start: '00:00', end: '23:59' }],
    fri: [{ start: '00:00', end: '23:59' }],
    sat: [{ start: '00:00', end: '23:59' }],
    sun: [{ start: '00:00', end: '23:59' }],
  };
  await db.insert(schema.stores).values([
    { id: 's-1', ownerId: 'u-m', name: 'PD68 冒烟店', openHours: OPEN_ALL, status: 'active' },
  ]);
  // 唯一 groomer（全覆盖排班）：容量=1，占满即 409
  await db.insert(schema.staff).values([
    { id: 'st-e', storeId: 's-1', userId: 'u-e', name: '美容师E', role: 'groomer', skills: ['wash'], schedule: SCHED_FULL, status: 'active' },
  ]);
  await db.insert(schema.pets).values([{ id: 'p-1', ownerId: 'u-c1', name: '豆豆', species: 'dog' }]);
  // 60min 洗护（引擎回退时长=60 → slotsNeeded=2 连续槽）
  await db.insert(schema.services).values([
    { id: 'sv-g1', storeId: 's-1', type: 'grooming', name: '基础洗护', durationMin: 60, priceFen: 8800 },
  ]);

  const ctxCustomer = (id: string): Context => ({ db, user: { id, nickname: null, roles: ['customer'] } });
  const c1 = appointmentRouter.createCaller(ctxCustomer('u-c1'));
  const storeC1 = storeRouter.createCaller(ctxCustomer('u-c1'));

  // T=明天 10:00；唯一 groomer 在 [T+30min, T+90min) 已有 confirmed 单——
  // T 首槽 [10:00,10:30) 空、60min 服务区间 [10:00,11:00) 与之重叠
  const T = at(1, 10);
  await db.insert(schema.appointments).values({
    id: 'a-occ',
    code: 'PD68OCC1',
    customerId: 'u-c1',
    storeId: 's-1',
    staffId: 'st-e',
    petId: 'p-1',
    serviceId: 'sv-g1',
    type: 'grooming',
    status: 'confirmed',
    scheduledStart: at(1, 10, 30),
    scheduledEnd: at(1, 11, 30),
    priceFen: 8800,
    paymentMode: 'pay_at_store',
  });

  const hasSlot = (slots: { slotStart: Date }[], t: Date) => slots.some((s) => s.slotStart.getTime() === t.getTime());

  /* ---------- 1. 旧闸差实证：漏传 serviceId 的列表（slotsNeeded=1）仍含 T ---------- */
  const paramless = await storeC1.getWithServices({ storeId: 's-1' });
  check(
    '漏传 serviceId 的列表（修复前客户端口径）仍含 T＝闸差实证',
    hasSlot(paramless.slots, T),
    paramless.slots.map((s) => s.slotStart.toISOString()),
  );

  /* ---------- 2. 重叠冲突 → 真 409 ---------- */
  check(
    'create 于 T（60min 区间叠占）→ CONFLICT「该时段已约满」',
    await rejects(
      c1.create({
        storeId: 's-1',
        petId: 'p-1',
        serviceId: 'sv-g1',
        type: 'grooming',
        scheduledStart: T,
        paymentMode: 'pay_at_store',
      }),
      'CONFLICT',
      /该时段已约满/,
    ),
  );

  /* ---------- 3. 同源剔槽：带生效 serviceId 的列表剔除 T（409 前后一致） ---------- */
  const sameSource = await storeC1.getWithServices({ storeId: 's-1', serviceId: 'sv-g1' });
  check('带生效 serviceId 的列表（与 create 同一时长闸）剔除 T', !hasSlot(sameSource.slots, T));
  const afterConflict = await storeC1.getWithServices({ storeId: 's-1', serviceId: 'sv-g1' });
  check('409 后同源列表刷新仍剔除 T（槽不可再选）', !hasSlot(afterConflict.slots, T));

  /* ---------- 4. 不过度拦截：终点相接 / 远离冲突的时段照常可约 ---------- */
  check('同源列表保留 T+90min 起始槽（终点相接不算重叠）', hasSlot(sameSource.slots, at(1, 11, 30)));
  check('同源列表保留 T-30min 起始槽（[09:30,10:30) 与冲突仅相接）', hasSlot(sameSource.slots, at(1, 9, 30)));

  console.log(failures === 0 ? 'slotAvailAfter409.smoke：全部通过' : `slotAvailAfter409.smoke：${failures} 项失败`);
  client.close();
  await new Promise((r) => setTimeout(r, 400)); // Windows 下 libsql 文件句柄释放略滞后
} catch (err) {
  failures++;
  console.error('\n[smoke] 未捕获异常：', err);
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch (e) {
    console.warn(`[smoke] 临时目录清理失败（不影响验证结果）: ${tmpDir}`, e);
  }
}
process.exit(failures > 0 ? 1 : 0);
