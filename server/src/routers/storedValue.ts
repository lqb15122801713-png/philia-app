/**
 * storedValue router（批次 M1-补2 · R5b 存量储值台账 CSV 导入接口 · 裁定③）
 *
 * 边界（冻结）：
 * - **只交付不执行**：接口交付 + 演示小台账试导验证；真台账（907 人 / ¥671,264.42）
 *   的导入执行等老板令（决策 #32③）。本文件不出现任何充值/新售入口（裁定①
 *   新售冻结不变，回归保护）。
 * - 仅店主（merchantOwnerProcedure，补丁①5）；全量留痕：批次行含成功/失败
 *   行数报告 + 源文件校验位 + 操作人；清除留痕 clearedAt/clearedBy。
 *
 * 两阶段：
 * 1. previewImport（零写入）：解析 CSV（UTF-8 BOM 处理；RFC4180 引号转义）→
 *    字段映射校验 → 回对账报告：
 *    - sourceStats（源文件校验位，与会员是否建档无关）：数据行数 / 本金>0 人数 /
 *      本金合计 / 赠送合计 / 唯一手机号数 / 门店分布 / 次卡夹带行数 / 会员编号缺失数；
 *    - importPlan（逐行可导性）：okRows / failRows / 失败原因分布。
 * 2. executeImport（写入）：同一解析管线，ok 行开户/加账 + 流水（importBatchId），
 *    批次行落库（含 reportJson）；fail 行跳过并在报告中留痕。
 *
 * 字段映射（台账列 → 系统）：
 * - 门店 → 入参 mapping {台账店名: storeId}（必做，未映射行失败留痕）；
 * - 手机号码 = 主键（会员编号 344 行缺失，不用作主键；手机号查 users，未建档行
 *   失败留痕「会员未建档」——本批不现场注册会员）；
 * - 储值本金余额(¥) / 储值赠送金额(¥) → principalFen / bonusFen（元→分，两位小数）；
 * - 次卡名称/次卡剩余次数 = 夹带数据（约 150 人）：**本批不建次卡**，仅在报告
 *   计数预留映射（passCarryRows），正式次卡映射随会员批。
 *
 * 批次标记清除（试导回滚）：clearImportBatch —— 删除该批次写入的流水并按日志
 * 反向冲减账户（无剩余流水的空账户一并删除）；批次行 status='cleared' +
 * clearedAt/clearedBy 留痕（批次行本身永存可查）。**已产生消费的批次拒绝清除**
 * （批次账户存在带 bill_no 的消费/回补流水 → CONFLICT）。
 */

import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { merchantOwnerProcedure, router } from '../trpc';

/* ------------------------------------------------------------------ */
/* CSV 解析（零新依赖：BOM / CRLF / 引号转义 / 引号内逗号换行）              */
/* ------------------------------------------------------------------ */

/** RFC4180 迷你解析器：返回二维字符串数组（含表头行） */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, ''); // UTF-8 BOM
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 台账列名 → 字段索引（按表头名定位，列序错位容错） */
const LEDGER_COLUMNS = {
  store: '门店',
  memberNo: '会员编号',
  memberName: '会员姓名',
  phone: '手机号码',
  cardName: '会员卡名称',
  principal: '储值本金余额(¥)',
  bonus: '储值赠送金额(¥)',
  passName: '次卡名称',
  passRemain: '次卡剩余次数',
} as const;

/** 元 → 分（两位小数；容错 ¥ 符号/千分位逗号/空白；非法返回 null） */
function yuanToFen(raw: string): number | null {
  const cleaned = raw.replace(/[¥￥\s,]/g, '');
  if (cleaned === '') return 0; // 空=0（台账空单元格口径）
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/* ------------------------------------------------------------------ */
/* 行解析与校验（preview / execute 共用同一管线）                            */
/* ------------------------------------------------------------------ */

interface RowPlan {
  line: number; // 1-based（含表头）
  storeName: string;
  storeId?: string;
  phone: string;
  memberName: string;
  principalFen: number;
  bonusFen: number;
  passRemain: number;
  ok: boolean;
  failReason?: string;
  userId?: string;
}

interface ImportReport {
  sourceStats: {
    totalRows: number;
    /** 本金>0 人数（校验位：真台账=907） */
    personsWithBalance: number;
    /** 本金合计（分；校验位：真台账=67126442） */
    principalTotalFen: number;
    bonusTotalFen: number;
    bonusAllZero: boolean;
    /** 唯一手机号数（校验位：真台账=1286） */
    uniquePhones: number;
    /** 门店分布（台账店名→行数；校验位：贝肯山店728/生活馆店328/生态城店234） */
    storeDist: Record<string, number>;
    /** 次卡夹带行数（次卡剩余次数>0；校验位：真台账=150；预留映射未导入） */
    passCarryRows: number;
    /** 会员编号缺失行数（手机号为主键的缘由；真台账=344） */
    memberNoMissing: number;
  };
  importPlan: {
    okRows: number;
    failRows: number;
    /** 失败原因分布（reason → 行数） */
    failReasons: Record<string, number>;
    /** 失败样例（前 20 行号+原因，留痕排查用） */
    failSamples: Array<{ line: number; reason: string }>;
  };
}

async function buildPlan(
  db: typeof import('../db').db,
  csvText: string,
  mapping: Record<string, string>,
): Promise<{ report: ImportReport; rows: RowPlan[] }> {
  const grid = parseCsv(csvText);
  if (grid.length < 2) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'CSV 为空或缺少表头/数据行' });
  }
  const header = grid[0]!.map((h) => h.trim());
  const colIdx = (name: string) => header.indexOf(name);
  // 必要列校验（缺列即整单拒绝，不猜列序）
  for (const key of ['store', 'phone', 'principal', 'bonus'] as const) {
    if (colIdx(LEDGER_COLUMNS[key]) < 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `CSV 表头缺少必要列「${LEDGER_COLUMNS[key]}」（实际表头：${header.join(' | ')}）`,
      });
    }
  }
  const dataRows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ''));

  // 映射目标门店有效性（一次性校验全部 mapping 值）
  const storeIds = [...new Set(Object.values(mapping))];
  const storeRows = storeIds.length
    ? await db.select({ id: schema.stores.id }).from(schema.stores).where(inArray(schema.stores.id, storeIds))
    : [];
  const validStoreIds = new Set(storeRows.map((r) => r.id));
  for (const [name, sid] of Object.entries(mapping)) {
    if (!validStoreIds.has(sid)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `门店映射「${name}」指向不存在的 storeId：${sid}` });
    }
  }

  // 手机号 → users 主键映射（一次性取全量，v1 数据量级无压力）
  const userRows = await db.select({ id: schema.users.id, phone: schema.users.phone }).from(schema.users);
  const userIdByPhone = new Map<string, string>();
  for (const u of userRows) {
    if (u.phone && !userIdByPhone.has(u.phone)) userIdByPhone.set(u.phone, u.id);
  }

  const report: ImportReport = {
    sourceStats: {
      totalRows: dataRows.length,
      personsWithBalance: 0,
      principalTotalFen: 0,
      bonusTotalFen: 0,
      bonusAllZero: true,
      uniquePhones: 0,
      storeDist: {},
      passCarryRows: 0,
      memberNoMissing: 0,
    },
    importPlan: { okRows: 0, failRows: 0, failReasons: {}, failSamples: [] },
  };
  const phones = new Set<string>();
  const plans: RowPlan[] = [];

  dataRows.forEach((cols, i) => {
    const line = i + 2; // 含表头的 1-based 行号
    const cell = (key: keyof typeof LEDGER_COLUMNS) => {
      const idx = colIdx(LEDGER_COLUMNS[key]);
      return idx >= 0 ? (cols[idx] ?? '').trim() : '';
    };
    const storeName = cell('store');
    const phone = cell('phone');
    const principalFen = yuanToFen(cell('principal'));
    const bonusFen = yuanToFen(cell('bonus'));
    const passRemain = Number.parseInt(cell('passRemain') || '0', 10) || 0;

    /* ---- 源文件校验位统计（与可导性无关，全行口径） ---- */
    report.sourceStats.storeDist[storeName] = (report.sourceStats.storeDist[storeName] ?? 0) + 1;
    if (!cell('memberNo')) report.sourceStats.memberNoMissing += 1;
    if (phone) phones.add(phone);
    if (principalFen !== null && principalFen > 0) {
      report.sourceStats.personsWithBalance += 1;
      report.sourceStats.principalTotalFen += principalFen;
    }
    if (bonusFen !== null) {
      report.sourceStats.bonusTotalFen += bonusFen;
      if (bonusFen !== 0) report.sourceStats.bonusAllZero = false;
    }
    if (passRemain > 0) report.sourceStats.passCarryRows += 1;

    /* ---- 逐行可导性校验 ---- */
    const plan: RowPlan = {
      line,
      storeName,
      phone,
      memberName: cell('memberName'),
      principalFen: principalFen ?? 0,
      bonusFen: bonusFen ?? 0,
      passRemain,
      ok: false,
    };
    const fail = (reason: string) => {
      plan.failReason = reason;
      report.importPlan.failRows += 1;
      report.importPlan.failReasons[reason] = (report.importPlan.failReasons[reason] ?? 0) + 1;
      if (report.importPlan.failSamples.length < 20) {
        report.importPlan.failSamples.push({ line, reason });
      }
    };
    if (principalFen === null || bonusFen === null) {
      fail('金额列非法（本金/赠送须为 ≥0 数字）');
    } else if (!/^1\d{10}$/.test(phone)) {
      fail('手机号缺失或非法（手机号为主键）');
    } else if (!mapping[storeName]) {
      fail(`门店未映射（「${storeName}」无 mapping 入参）`);
    } else {
      const userId = userIdByPhone.get(phone);
      if (!userId) {
        fail('会员未建档（按手机号主键查无 users 行；本批不现场注册）');
      } else {
        plan.storeId = mapping[storeName];
        plan.userId = userId;
        plan.ok = true;
        report.importPlan.okRows += 1;
      }
    }
    plans.push(plan);
  });
  report.sourceStats.uniquePhones = phones.size;
  return { report, rows: plans };
}

/* ------------------------------------------------------------------ */
/* 入参 schema                                                            */
/* ------------------------------------------------------------------ */

const importInputSchema = z.object({
  /** CSV 全文（UTF-8，可带 BOM） */
  csvText: z.string().min(1, 'CSV 内容为空').max(8 * 1024 * 1024, 'CSV 过大（上限 8MB）'),
  /** 源文件名（留痕） */
  filename: z.string().trim().max(200).optional(),
  /** 门店映射：台账店名 → 系统 storeId（必做；未映射行失败留痕） */
  mapping: z.record(z.string().min(1), z.string().min(1)),
});

/* ------------------------------------------------------------------ */
/* router（全部 merchantOwnerProcedure——仅店主，补丁①5）                    */
/* ------------------------------------------------------------------ */

export const storedValueRouter = router({
  /**
   * 1. previewImport（仅 owner · 零写入）：解析 + 字段映射校验 + 对账报告。
   * 报告含源文件校验位（本金>0 人数/本金合计/门店分布/次卡夹带计数等），
   * 用于与运营台账口径逐位核对（对账一致的验收锚点）。
   */
  previewImport: merchantOwnerProcedure
    .input(importInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { report } = await buildPlan(ctx.db, input.csvText, input.mapping);
      return { report, note: 'preview 零写入；确认无误后再 execute（执行等老板令）' };
    }),

  /**
   * 2. executeImport（仅 owner · 写入）：ok 行开户/加账 + 流水（importBatchId），
   * 批次行落库（含 reportJson 全量留痕：成功/失败行数报告）。
   * 幂等说明：不设文件级幂等——重复 execute 会重复入账（试导请用
   * clearImportBatch 标记清除后重导；正式执行等老板令一次性导入）。
   */
  executeImport: merchantOwnerProcedure
    .input(importInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { report, rows } = await buildPlan(ctx.db, input.csvText, input.mapping);
      const now = new Date();
      const okRows = rows.filter((r) => r.ok);

      const result = await ctx.db.transaction(async (tx) => {
        const batch = await tx
          .insert(schema.storedValueImportBatches)
          .values({
            operatorId: ctx.user.id,
            filename: input.filename ?? null,
            mappingJson: JSON.stringify(input.mapping),
            totalRows: report.sourceStats.totalRows,
            okRows: okRows.length,
            failRows: report.importPlan.failRows,
            memberCount: report.sourceStats.personsWithBalance,
            principalTotalFen: report.sourceStats.principalTotalFen,
            status: 'executed',
            reportJson: JSON.stringify(report),
          })
          .returning()
          .then((r) => r[0]!);

        for (const row of okRows) {
          // 每行事务内重读账户（台账同一手机号可出现多行——1290 行/1286 唯一手机号），
          // 无账户则开户；余额流水 before/after 逐行真实
          const ensureAccount = async (): Promise<
            typeof schema.storedValueAccounts.$inferSelect
          > => {
            const found = await tx
              .select()
              .from(schema.storedValueAccounts)
              .where(
                and(
                  eq(schema.storedValueAccounts.userId, row.userId!),
                  eq(schema.storedValueAccounts.storeId, row.storeId!),
                ),
              )
              .get();
            if (found) return found;
            const created = await tx
              .insert(schema.storedValueAccounts)
              .values({ userId: row.userId!, storeId: row.storeId!, principalFen: 0, bonusFen: 0 })
              .returning();
            return created[0]!;
          };
          const acc = await ensureAccount();
          const before = acc.principalFen + acc.bonusFen;
          await tx
            .update(schema.storedValueAccounts)
            .set({
              principalFen: acc.principalFen + row.principalFen,
              bonusFen: acc.bonusFen + row.bonusFen,
              updatedAt: now,
            })
            .where(eq(schema.storedValueAccounts.id, acc.id));
          await tx.insert(schema.storedValueLogs).values({
            accountId: acc.id,
            userId: row.userId!,
            storeId: row.storeId!,
            deltaPrincipalFen: row.principalFen,
            deltaBonusFen: row.bonusFen,
            deltaFen: row.principalFen + row.bonusFen,
            balanceBeforeFen: before,
            balanceAfterFen: before + row.principalFen + row.bonusFen,
            billNo: null,
            operatorId: ctx.user.id,
            importBatchId: batch.id,
            note: `台账导入 ${row.storeName}/${row.memberName || row.phone}（行 ${row.line}）`,
          });
        }
        return batch;
      });
      return {
        batchId: result.id,
        okRows: result.okRows,
        failRows: result.failRows,
        report,
        notice: '批次已落库（留痕可查 listImportBatches）；试导回滚用 clearImportBatch 标记清除',
      };
    }),

  /**
   * 3. listImportBatches（仅 owner）：导入批次可查（含报告摘要与清除状态）。
   */
  listImportBatches: merchantOwnerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        batch: schema.storedValueImportBatches,
        operatorName: schema.users.nickname,
      })
      .from(schema.storedValueImportBatches)
      .leftJoin(schema.users, eq(schema.users.id, schema.storedValueImportBatches.operatorId))
      .orderBy(sql`${schema.storedValueImportBatches.createdAt} DESC`);
    return rows.map((r) => ({
      ...r.batch,
      report: r.batch.reportJson ? (JSON.parse(r.batch.reportJson) as ImportReport) : null,
      operatorName: r.operatorName ?? null,
    }));
  }),

  /**
   * 4. clearImportBatch（仅 owner）：批次标记清除（试导回滚）。
   * 语义：删除该批次的导入流水并按日志反向冲减账户（本金/赠送分列回退；
   * 无剩余流水的空账户一并删除）；批次行永存（status='cleared' +
   * clearedAt/clearedBy 留痕）。**已产生消费的批次拒绝清除**（批次账户
   * 存在带 bill_no 的消费/回补流水 → CONFLICT，保护真账）。
   */
  clearImportBatch: merchantOwnerProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const batch = await ctx.db
        .select()
        .from(schema.storedValueImportBatches)
        .where(eq(schema.storedValueImportBatches.id, input.batchId))
        .get();
      if (!batch) throw new TRPCError({ code: 'NOT_FOUND', message: '导入批次不存在' });
      if (batch.status === 'cleared') {
        return { batch, clearedLogs: 0, clearedAccounts: 0, idempotent: true as const };
      }

      const batchLogs = await ctx.db
        .select()
        .from(schema.storedValueLogs)
        .where(eq(schema.storedValueLogs.importBatchId, batch.id));
      const accountIds = [...new Set(batchLogs.map((l) => l.accountId))];
      if (accountIds.length > 0) {
        const consumption = await ctx.db
          .select({ n: sql<number>`count(*)` })
          .from(schema.storedValueLogs)
          .where(
            and(
              inArray(schema.storedValueLogs.accountId, accountIds),
              isNotNull(schema.storedValueLogs.billNo),
            ),
          )
          .get();
        if (Number(consumption?.n ?? 0) > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '该批次账户已产生消费流水，拒绝清除（差错请走对账调整留痕）',
          });
        }
      }

      const now = new Date();
      const result = await ctx.db.transaction(async (tx) => {
        // 按导入日志反向冲减账户
        for (const log of batchLogs) {
          const acc = await tx
            .select()
            .from(schema.storedValueAccounts)
            .where(eq(schema.storedValueAccounts.id, log.accountId))
            .get();
          if (!acc) continue;
          await tx
            .update(schema.storedValueAccounts)
            .set({
              principalFen: acc.principalFen - log.deltaPrincipalFen,
              bonusFen: acc.bonusFen - log.deltaBonusFen,
              updatedAt: now,
            })
            .where(eq(schema.storedValueAccounts.id, acc.id));
        }
        await tx
          .delete(schema.storedValueLogs)
          .where(eq(schema.storedValueLogs.importBatchId, batch.id));
        // 无剩余流水且余额归零的账户一并删除（本批新建账户的干净回滚）
        let clearedAccounts = 0;
        for (const accountId of accountIds) {
          const remain = await tx
            .select({ n: sql<number>`count(*)` })
            .from(schema.storedValueLogs)
            .where(eq(schema.storedValueLogs.accountId, accountId))
            .get();
          if (Number(remain?.n ?? 0) > 0) continue;
          const acc = await tx
            .select()
            .from(schema.storedValueAccounts)
            .where(eq(schema.storedValueAccounts.id, accountId))
            .get();
          if (acc && acc.principalFen === 0 && acc.bonusFen === 0) {
            await tx
              .delete(schema.storedValueAccounts)
              .where(eq(schema.storedValueAccounts.id, accountId));
            clearedAccounts += 1;
          }
        }
        const updated = await tx
          .update(schema.storedValueImportBatches)
          .set({ status: 'cleared', clearedAt: now, clearedBy: ctx.user.id, updatedAt: now })
          .where(eq(schema.storedValueImportBatches.id, batch.id))
          .returning()
          .then((r) => r[0]!);
        return { batch: updated, clearedLogs: batchLogs.length, clearedAccounts };
      });
      return { ...result, idempotent: false as const };
    }),
});

export type StoredValueRouter = typeof storedValueRouter;
