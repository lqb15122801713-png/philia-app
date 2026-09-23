/**
 * R11a 会员前置批 · 收银台会员域共享模型（Phase 3A · 27 号任务书冻结版 V1.0 §四）
 *
 * 端点契约（server/src/routers/membership.ts）：
 * - plans（public）：四档配置透出（priceFen/rebateBp/serviceDiscountBp/includedPets/
 *   extraPetFen/maxPets + label 权益表述明面）+ 全局参数（到账日/有效期）；
 * - sell / renew（merchantProcedure，clerk 可售卡收款——三级权限不动）：
 *   内测期到店付三段（cash/wechat/alipay），Σ段=档价+多宠附加费（server 硬校验）；
 * - savingsPreview（merchant）：非会员当单「开通萤火立省 ¥X」实时算；
 * - cancel（manager|owner）：退会（本批收银台不做 UI，落点会员域页面）。
 *
 * 报备偏差（读路径缺口，骨架批口径）：
 * - server 无商家侧「按用户查会员状态」端点（membership.my=customerProcedure 仅本人；
 *   cashier.searchMember 未带 membership 字段）——识别后档位/回馈金余额/宠物数以
 *   **本端会话缓存**（售卡/续费成交回写 MEMBER_STATUS）带出；未缓存时不明示假值，
 *   续费金额经 renew 空段探测解析 server 错误原文（"须等于续费金额（X 元）"）取得。
 */

import type { AppRouter } from '@philia/shared'
import type { inferRouterOutputs } from '@trpc/server'

type RouterOutputs = inferRouterOutputs<AppRouter>

/** membership.plans 返回 */
export type MemberPlansResponse = RouterOutputs['membership']['plans']
/** 单档公开形状（planPublicShape） */
export type MemberPlan = MemberPlansResponse['plans'][number]
/** 售卡/续费成交返回的会员实例（superjson：expiresAt/startedAt 为 Date） */
export type MembershipRow = RouterOutputs['membership']['sell']['membership']

/* ------------------------------------------------------------------ */
/* React Query 键                                                      */
/* ------------------------------------------------------------------ */

export const MEMBER_PLANS_KEY = ['membership', 'plans'] as const
/** 会话内会员状态缓存键（售卡/续费成交后 setQueryData 写入；forUser 正式通道的加载期回落） */
export const MEMBER_STATUS_KEY = (userId: string) => ['membership', 'cashierStatus', userId] as const
/** membership.forUser（merchantProcedure，clerk 放行）：识别后带出档位/回馈金余额/宠物数正式通道 */
export const MEMBER_FOR_USER_KEY = (userId: string) => ['membership', 'forUser', userId] as const
export const MEMBER_SAVINGS_KEY = ['membership', 'savingsPreview'] as const

/** membership.forUser 返回（membership 非会员=null；plan=档位配置；rebate=balanceOf 余额视图） */
export type MemberForUser = RouterOutputs['membership']['forUser']

/* ------------------------------------------------------------------ */
/* 档位展示                                                            */
/* ------------------------------------------------------------------ */

/** 档位短名（plan.label 为权益长文案，签/卡题用短名） */
export const PLAN_SHORT_LABEL: Record<string, string> = {
  plan_weiguang: '微光',
  plan_yinghuo: '萤火',
  plan_zhuguang: '烛光',
  plan_nuanyang: '暖阳',
}
export const planShortLabel = (planKey: string): string => PLAN_SHORT_LABEL[planKey] ?? planKey

/** 服务折扣 bp → 中文折签（8800→88 折 / 8500→85 折 / 8000→8 折；10000=无折扣→null） */
export function serviceDiscountLabel(bp: number): string | null {
  if (bp >= 10000) return null
  const z = bp / 100
  return z % 10 === 0 ? `${z / 10} 折` : `${z} 折`
}

/** 回馈金比例 bp → 百分比签（200→2%） */
export const rebatePercentLabel = (bp: number): string => `${bp / 100}%`

/** 会员状态中文签（memberships.status：active 生效 / frozen 冻结 / cancelled 已退会） */
export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  active: '生效中',
  frozen: '已冻结',
  cancelled: '已退会',
}

/** 临期判定（≤30 天到期 → 售卡面板默认续费模式，任务书 §四.5/R11a §五到期提醒口径） */
export const RENEW_SOON_MS = 30 * 24 * 3600 * 1000
export function isRenewDue(m: Pick<MembershipRow, 'status' | 'expiresAt'>, now = new Date()): boolean {
  if (m.status === 'frozen') return true
  if (m.status !== 'active') return false
  return m.expiresAt.getTime() - now.getTime() <= RENEW_SOON_MS
}

/* ------------------------------------------------------------------ */
/* 立省钩子「一屏一次」关闭标记（localStorage，按当单行签名幂等）             */
/* ------------------------------------------------------------------ */

const SAVINGS_DISMISS_KEY = 'philia.cashier.savingsHook.dismissed'
const SAVINGS_DISMISS_CAP = 50

export function loadSavingsDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(SAVINGS_DISMISS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function dismissSavings(sig: string): string[] {
  const next = [...loadSavingsDismissed().filter((s) => s !== sig), sig].slice(-SAVINGS_DISMISS_CAP)
  try {
    window.localStorage.setItem(SAVINGS_DISMISS_KEY, JSON.stringify(next))
  } catch {
    // localStorage 不可用（隐私模式等）：退化为会话内有效
  }
  return next
}
