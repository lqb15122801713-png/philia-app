/**
 * R12 退款专项 · 商家端共享模型（Phase 3 · 冻结版 V1.0 唯一施工依据）
 *
 * 纲：退款 ≠ 反结账。反结账既有逻辑一行不动；退款=经营行为计退款单列，
 * 原单已收不涂改（cashier_bills 仅挂 refundStatus/refundBillNo 标记），
 * 当日净额=已收−退款（V2 现金段净额 / V7 跨日计入发生日 biz_date）。
 *
 * 端点契约（server/src/routers/refund.ts）：
 * - preview/execute（owner|manager）：六联动干跑/实跑共用 computePlan 内核，
 *   权限闸（店长累计阈值 V1 / 涉储值店主唯一通道 / 终态禁退 V5）错误原文透出；
 * - list/pendingActual/dayStats（owner|manager 本店）；settleActual（店长本店可办）；
 *   rejectDraft/exportCsv（仅店主）。
 */

import type { AppRouter } from '@philia/shared'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

type RouterOutputs = inferRouterOutputs<AppRouter>
type RouterInputs = inferRouterInputs<AppRouter>

/** refund.preview 返回的六联动计划视图（execute 成功时 plan 同构；幂等重放 plan=null） */
export type RefundPlanView = RouterOutputs['refund']['preview']['plan']
/** refund.preview 入参（execute 在此基础上加 reason 必填 + refundMethod） */
export type RefundPreviewInput = RouterInputs['refund']['preview']
export type RefundExecuteInput = RouterInputs['refund']['execute']
export type RefundType = RefundPreviewInput['type']
/** refund.list 行（refund_bills 全列 + billNo/operatorName/approverName/actualSettled） */
export type RefundListRow = RouterOutputs['refund']['list'][number]
/** refund.pendingActual 行（超 24h 未登记实退待办） */
export type RefundPendingRow = RouterOutputs['refund']['pendingActual'][number]
/** refund.dayStats 返回（日结「退款单列」+ 支付段分列，V2/V7 口径） */
export type RefundDayStats = RouterOutputs['refund']['dayStats']

/* ------------------------------------------------------------------ */
/* React Query 键                                                      */
/* ------------------------------------------------------------------ */

export const REFUND_ROOT_KEY = ['refund'] as const
export const REFUND_LIST_KEY = ['refund', 'list'] as const
export const REFUND_PENDING_KEY = ['refund', 'pendingActual'] as const
export const REFUND_DAY_STATS_KEY = ['refund', 'dayStats'] as const

/* ------------------------------------------------------------------ */
/* 标签 / 状态签                                                        */
/* ------------------------------------------------------------------ */

/** 退款类型中文签（与 server exportCsv TYPE_LABEL 同口径） */
export const REFUND_TYPE_LABEL: Record<RefundType, string> = {
  full: '全额退款',
  partial_items: '部分退款（按行）',
  partial_amount: '部分退款（按金额）',
  boarding_nights: '寄养剩余晚退',
  pass_cancel: '次卡退卡',
}

/** 退款单状态签（u3-st 工艺：草稿浅木 / 待实退 amber / 实退完成薄荷 / 已驳回灰） */
export const REFUND_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  draft: { cls: 'u3-st wait', label: '草稿' },
  executed: { cls: 'u3-st amber', label: '待实退登记' },
  settled: { cls: 'u3-st live', label: '实退完成' },
  rejected: { cls: 'u3-st done', label: '已驳回' },
}

/** 实退方式签（pass_cancel 二选一必选；内测期线下原路为主口径） */
export const REFUND_METHOD_LABEL: Record<string, string> = {
  offline_original: '线下原路退回',
  to_stored_value: '退储值账户',
}

/** 支付段回补通道（preview.segments[].channel） */
export const SEG_CHANNEL_LABEL: Record<string, string> = {
  offline_pending: '线下原路（待实退登记）',
  stored_value_restore: '储值余额回补',
  pass_times_restore: '次卡次数回补',
}

/**
 * 门店规范时区（+8）当日 'YYYY-MM-DD'（refund.dayStats 入参口径，
 * 与 server storeWallclock 同帧：UTC 位移后读 UTC 部件）。
 */
export function storeTodayStr(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10)
}

/**
 * 已落账退款合计（executed|settled 口径；pass_cancel 锚点单 anchorOnly 不占原单
 * 可退余额，服务端同口径——这里只做展示侧聚合，金额真值以 refund_bills 为准）。
 */
export function sumPostedRefunds(rows: RefundListRow[] | undefined, billId: string): {
  totalFen: number
  rows: RefundListRow[]
} {
  const hit = (rows ?? []).filter(
    (r) =>
      r.billId === billId &&
      (r.status === 'executed' || r.status === 'settled') &&
      (r.linkageJson as Record<string, unknown> | null)?.anchorOnly !== true,
  )
  return { totalFen: hit.reduce((s, r) => s + r.amountFen, 0), rows: hit }
}

/** 六联动快照（refund_bills.linkage_json）展示侧结构（仅读取已知键，宽容缺行） */
export interface RefundLinkageView {
  refundFen?: number
  refundedSoFarFen?: number
  refundableFen?: number
  anchorOnly?: boolean
  segments?: Array<{ paymentId: string; method: string; amountFen: number; ratioBp: number; channel: string }>
  items?: Array<{ billItemId: string; kind: string; name: string; qty: number | null; amountFen: number; apportioned: boolean }>
  stockRestock?: Array<{ productId: string; name: string; qty: number }>
  appointmentReverts?: Array<{ appointmentId: string; name: string }>
  boarding?: {
    totalNights: number
    occurredNights: number
    remainingNights: number
    nights: number
    perNightFen: number
  } | null
  passCancel?: {
    paidFen: number
    paidTimes: number
    giftTimes: number
    remainingPaidTimes: number
    giftVoided: number
    remainTimesBefore: number
  } | null
  storedValueRestoreFen?: number
  passTimesRestore?: number
  estimatedCommissionClawbackFen?: number
  rebateClawbackFen?: number
  executedAt?: string
  reason?: string
}

/** linkage_json 解析（缺行/脏数据防御，返回 null 表示无快照=draft） */
export function parseLinkage(json: unknown): RefundLinkageView | null {
  if (json == null || typeof json !== 'object') return null
  return json as RefundLinkageView
}
