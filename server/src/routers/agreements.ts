/**
 * 授权台账 router（商家端大批片 3 · S14 授权台账专页+周会导出）：
 * - listForStore（manager|owner）：本店客户（有本店预约单）的 agreements 签署记录
 *   （签署人/手机号掩码/协议类型/版本/签署时刻+关联预约锚[医疗授权按 userId 最新
 *   带快照预约]）——agreements 表无 store_id（客户签署语义），本店口径=签署人∈本店
 *   客户集（有本店预约单，明面登记）；
 * - exportCsv（仅 owner）：周会导出=固定列 CSV+BOM+手写转义+导出留痕
 *   （emitEvent AgreementLedgerExported；工艺照 refund.exportCsv）。
 */

import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { schema } from '../db';
import { broadcastNow, emitEvent } from '../realtime/bus';
import { EventType } from '../realtime/events';
import { merchantManagerProcedure, merchantOwnerProcedure, router, type Db } from '../trpc';

const KEY_LABEL: Record<string, string> = {
  member_service: '会员服务协议',
  not_prepaid: '年费≠储值·不自动续费',
  no_auto_renew: '到期不自动续费',
  boarding_consent: '寄养协议',
  medical_auth: '医疗授权',
};

/** CSV 单元格转义（照 refund.exportCsv 工艺） */
function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function loadLedgerRows(db: Db, storeId: string) {
  const idRows = await db
    .select({ customerId: schema.appointments.customerId })
    .from(schema.appointments)
    .where(eq(schema.appointments.storeId, storeId))
    .groupBy(schema.appointments.customerId);
  const customerIds = idRows.map((r) => r.customerId);
  if (!customerIds.length) return [];
  const rows = await db
    .select({
      row: schema.agreements,
      nickname: schema.users.nickname,
    })
    .from(schema.agreements)
    .leftJoin(schema.users, eq(schema.users.id, schema.agreements.userId))
    .where(inArray(schema.agreements.userId, customerIds))
    .orderBy(desc(schema.agreements.checkedAt))
    .limit(1000);
  return rows.map((r) => {
    const snap = r.row.userSnapshot as { phoneMasked?: string } | null;
    return {
      id: r.row.id,
      userId: r.row.userId,
      nickname: r.nickname ?? null,
      phoneMasked: snap?.phoneMasked ?? null,
      agreementKey: r.row.agreementKey,
      agreementLabel: KEY_LABEL[r.row.agreementKey] ?? r.row.agreementKey,
      version: r.row.version,
      checkedAt: r.row.checkedAt,
    };
  });
}

export const agreementRouter = router({
  listForStore: merchantManagerProcedure
    .input(z.object({ agreementKey: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await loadLedgerRows(ctx.db, ctx.user.storeId!);
      return {
        items: input?.agreementKey ? rows.filter((r) => r.agreementKey === input.agreementKey) : rows,
        note: '本店口径=签署人∈本店客户集（有本店预约单；agreements 表无 store_id 列，明面登记）',
      };
    }),

  exportCsv: merchantOwnerProcedure
    .input(z.object({ agreementKey: z.string().min(1).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const storeId = ctx.user.storeId!;
      const rows = (await loadLedgerRows(ctx.db, storeId)).filter(
        (r) => !input?.agreementKey || r.agreementKey === input.agreementKey,
      );
      const header = ['签署人', '手机号(掩码)', '协议类型', '版本', '签署时刻'];
      const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
      const lines = [
        header.map(csvCell).join(','),
        ...rows.map((r) =>
          [r.nickname ?? r.userId, r.phoneMasked ?? '', r.agreementLabel, r.version, fmt(new Date(r.checkedAt))].map(csvCell).join(','),
        ),
      ];
      const csv = '﻿' + lines.join('\n');
      const filename = `授权台账周会导出_${new Date().toISOString().slice(0, 10)}.csv`;
      const outboxId = await emitEvent(ctx.db, `store:${storeId}`, EventType.AgreementLedgerExported, {
        by: ctx.user.id,
        rows: rows.length,
        agreementKey: input?.agreementKey ?? null,
      });
      broadcastNow(outboxId);
      return { filename, csv, rows: rows.length };
    }),
});

export type AgreementRouter = typeof agreementRouter;
