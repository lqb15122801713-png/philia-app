/**
 * PD-21 D-43 运维一次性清理：历史「待实退登记」堆积（executed 超 24h 未 settled）演示收口
 *
 * 口径（任务书冻结版 V1.0 §一 D-43 + 开口①裁死）：
 * - 默认=**演示收口**（清理历史脏/种子堆积，全留痕）；批量 settle 若超白名单须产品复核且仅演示库；
 * - 白名单=仅命中 `--reason-like`（缺省 `smoke %` 走测/演示残留）且执行超 24h 的行；
 *   真实经营单（无 smoke 标记）永不命中——军规②误伤防线的码内落地；
 * - **dry-run 缺省**（只列不写）；`--apply` 才落：status→settled + settled_at + settle_note 留痕
 *   （操作署名=script:pd21-d43；不发 outbox 事件——运维收口不骚扰客户推送，报备在案）；
 * - 可重复跑（已 settled 天然排除）；报告 `--report <path>` 写 JSON（命中单号/金额/前后状态/时刻/操作）。
 *
 * PD-24 D-51（黄条核实/演示收口）：增「构成核实」段——dry-run 同报**非白名单残留**
 * （executed 超 24h 未 settle 且 reason 不命中白名单的行，只列不写，黄条可解释性数据源）；
 * 报告 JSON 增 `nonWhitelist` 字段（单号/金额/原因/创建时刻）。apply 仍只动白名单行。
 *
 * 禁区（写死）：不碰 refund_requests（客户申请=P1 另批）；不动真支付/真退通道；不物理删行；
 * 不改回馈金/券核销；不改 draft→executed→settled 状态机口径。
 *
 * 用法（server/ 目录）：
 *   npx tsx scripts/refund-settle-cleanup.mts                      # dry-run 只列（含非白名单构成核实）
 *   npx tsx scripts/refund-settle-cleanup.mts --apply --report ../tmp/d43-report.json
 * 库取 PHILIA_DB_URL（缺省 data/philia.db）。
 */

import { writeFileSync } from 'node:fs';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db, schema } from '../src/db';

/** SQL LIKE 语义最小实现（仅 % 通配；构成核实二分用，与库内 LIKE 同口径） */
const likeMatch = (text: string | null, pattern: string): boolean => {
  const src = text ?? '';
  const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`);
  return re.test(src);
};

const APPLY = process.argv.includes('--apply');
const argOf = (k: string, d: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1]! : d;
};
const REASON_LIKE = argOf('--reason-like', 'smoke %');
const REPORT = argOf('--report', '');
const SETTLE_TODO_MS = 24 * 3600 * 1000;
const NOTE = '运维一次性收口（PD-21 D-43 历史演示/走测残留清理；dry-run 先审后落）';

async function main() {
  const deadline = new Date(Date.now() - SETTLE_TODO_MS);
  /* D-51 构成核实：先取全部超期待清（executed>24h 未 settled），再按白名单二分——
     命中=可演示收口；不命中=非白名单残留（只列不写，留可解释） */
  const allStale = await db
    .select()
    .from(schema.refundBills)
    .where(
      and(
        eq(schema.refundBills.status, 'executed'),
        isNull(schema.refundBills.settledAt),
        lt(schema.refundBills.createdAt, deadline),
      ),
    )
    .orderBy(schema.refundBills.createdAt);
  const hits = allStale.filter((r) => likeMatch(r.reason, REASON_LIKE));
  const nonWhitelist = allStale.filter((r) => !likeMatch(r.reason, REASON_LIKE));

  console.log(`[d43] 黄条构成核实：executed 超 24h 未 settled 共 ${allStale.length} 笔 = 白名单 ${hits.length} + 非白名单残留 ${nonWhitelist.length}`);
  console.log(`[d43] 白名单 reason LIKE '${REASON_LIKE}'：命中 ${hits.length} 笔`);
  for (const r of hits) {
    console.log(`  ${r.refundNo} ¥${(r.amountFen / 100).toFixed(2)} ${r.createdAt.toISOString()} ${r.reason}`);
  }
  if (nonWhitelist.length > 0) {
    console.log(`[d43] 非白名单残留 ${nonWhitelist.length} 笔（只列不写——真实经营/无 smoke 标记，永不误伤）：`);
    for (const r of nonWhitelist) {
      console.log(`  ${r.refundNo} ¥${(r.amountFen / 100).toFixed(2)} ${r.createdAt.toISOString()} ${r.reason}`);
    }
  }
  const report = {
    at: new Date().toISOString(),
    dryRun: !APPLY,
    reasonLike: REASON_LIKE,
    hitCount: hits.length,
    rows: hits.map((r) => ({
      refundNo: r.refundNo,
      amountFen: r.amountFen,
      reason: r.reason,
      before: { status: r.status, settledAt: r.settledAt },
      after: APPLY ? { status: 'settled', settleNote: NOTE } : '(dry-run 不写)',
    })),
    /* D-51：非白名单构成核实（只读段；apply 也不触） */
    nonWhitelist: nonWhitelist.map((r) => ({
      refundNo: r.refundNo,
      amountFen: r.amountFen,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
  };

  if (APPLY && hits.length > 0) {
    const now = new Date();
    for (const r of hits) {
      await db
        .update(schema.refundBills)
        .set({ status: 'settled', settledAt: now, settleNote: NOTE, updatedAt: now })
        .where(eq(schema.refundBills.id, r.id));
    }
    console.log(`[d43] --apply 落账 ${hits.length} 笔（settle_note 留痕署名 script:pd21-d43 口径=演示收口）`);
  }
  if (REPORT) {
    writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`[d43] 报告=${REPORT}`);
  }
  console.log(APPLY ? '[d43] DONE(applied)' : '[d43] DONE(dry-run，未写库)');
}

main().catch((e) => {
  console.error('[d43] FATAL', e);
  process.exit(1);
});
