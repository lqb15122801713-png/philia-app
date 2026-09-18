/**
 * 收银台共享模型（批次 M1 · 商家端收银台 UI · K3 施工）
 *
 * 口径锚点：
 * - 金额全分（Fen），元展示走 mall-admin 既有 fenToYuan（整数元不带小数）；
 * - 购物车金额为前端预览，服务端 hold/settle 一律按快照重算（server cashier.ts
 *   computeAmounts）——computeCart 逐行镜像服务端口径（含「percent 折扣按全量
 *   subtotal 计、 capped at 非预约行合计」的边界），仅用于展示与提交前预校验；
 * - 次卡扣次：仅 grooming 服务行可标记 paidByPass（B2-7R），1 行 = 扣 1 次；
 *   支付段 method='pass' 金额 = Σ扣次行有效价（服务端强校验，UI 自动派生不手填）；
 * - 展示侧「应收」= payable − 次卡抵扣（试样 P6 口径：¥362 − ¥88 = ¥274），
 *   提交侧 payments Σ = payable（含 pass 段），二者换算在本文件 finalizePayments。
 */

import type { AppRouter } from '@philia/shared'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { BedDouble, CalendarCheck, Package, Scissors, ShowerHead, type LucideIcon } from 'lucide-react'
import { fenToYuan, hhmm } from '@/components/mall-admin/format'

type RouterOutputs = inferRouterOutputs<AppRouter>
type RouterInputs = inferRouterInputs<AppRouter>

/** cashier.listBills 行（流水屏 / 挂单队列 / 今日流水共用） */
export type BillListRow = RouterOutputs['cashier']['listBills'][number]
/** cashier.pendingAppointments 行（待收款 tab） */
export type PendingAppt = RouterOutputs['cashier']['pendingAppointments'][number]
/** cashier.searchMember 命中分支 */
export type MemberFound = Extract<RouterOutputs['cashier']['searchMember'], { found: true }>
/** cashier.getBill 详情 */
export type BillDetail = RouterOutputs['cashier']['getBill']
/** store.getWithServices 服务行（active 服务目录） */
export type StoreService = RouterOutputs['store']['getWithServices']['services'][number]
/** cashier.settle 入参（hold = 去掉 payments） */
export type SettleInput = RouterInputs['cashier']['settle']
export type HoldInput = RouterInputs['cashier']['hold']
export type PayMethod = SettleInput['payments'][number]['method']

/** pass.listForStore 行（会员次卡余额/可用性真值来源，与 PassPage 同接口同缓存） */
export type PassListRow = RouterOutputs['pass']['listForStore'][number]

/* ------------------------------------------------------------------ */
/* React Query 键                                                      */
/* ------------------------------------------------------------------ */

export const CASHIER_ROOT_KEY = ['cashier'] as const
export const PENDING_APPTS_KEY = ['cashier', 'pendingAppointments'] as const
export const BILLS_TODAY_KEY = ['cashier', 'listBills', 'today'] as const
export const HELD_BILLS_KEY = ['cashier', 'listBills', 'held'] as const
export const BILL_DETAIL_KEY = 'getBill' as const
/** 流水屏列表键前缀（带筛选派生：[...RECORDS_KEY, {status, range, buyer}]） */
export const RECORDS_KEY = ['cashier', 'listBills', 'records'] as const

/* ------------------------------------------------------------------ */
/* 会员 / 购物车行                                                      */
/* ------------------------------------------------------------------ */

/** 收银台会员条（searchMember 命中 或 取单快照还原 两种来源同构） */
export interface CashierMember {
  id: string
  nickname: string | null
  phoneMasked: string | null
  /** 本店可用次卡剩余次数（检索真值 / 取单后经 pass.listForStore 回填） */
  passRemainTimes: number
  /** 在店预约数（confirmed/in_service/in_boarding） */
  appointmentCount: number
}

/** 购物车行（前端工作模型；提交时映射为 cartItemSchema 快照） */
export interface CartLine {
  kind: 'service' | 'product' | 'appointment'
  refId: string
  name: string
  spec: string | null
  /** 服务/预约行恒 1（服务端强校验），仅商品行 1-99 */
  qty: number
  unitPriceFen: number
  /** 行改价留痕（分）；null = 未改价。非空触发服务端 owner 闸门 */
  adjustedPriceFen: number | null
  /** 次卡扣次行（仅 grooming 服务行；须绑会员） */
  paidByPass: boolean
  /** 服务行原类型（grooming 才可扣次）；取单还原后经服务目录回填 */
  serviceType?: string
  /** 商品行加入时的库存快照（库存不足警示条用；结账以服务端重读为准） */
  stock?: number | null
}

/** 行有效价（改价留痕口径：adjusted ?? unit，与服务端 effPrice 一致） */
export const lineEff = (l: CartLine): number => l.adjustedPriceFen ?? l.unitPriceFen
export const lineTotal = (l: CartLine): number => lineEff(l) * l.qty

export type DiscountType = 'none' | 'percent' | 'amount'

export interface CartAmounts {
  /** 合计（分）：Σ有效价×qty */
  subtotalFen: number
  /** 单级优惠额（分） */
  discountFen: number
  /** 应收（分，提交口径）= subtotal − discount */
  payableFen: number
  /** 次卡抵扣（分）：Σ扣次行有效价 */
  passCoveredFen: number
  /** 展示应收（分）= payable − 次卡抵扣（顾客实际要掏的现金/扫码部分） */
  dueFen: number
  /** 非预约行合计（优惠上限口径） */
  nonApptSubtotalFen: number
}

/**
 * 购物车金额（镜像 server cashier.ts computeAmounts，逐行一致）：
 * percent：discount = subtotal − round(subtotal × value / 100)（value 90 = 九折）；
 * amount：discount = value；二者均不得超过非预约行合计（超出服务端拒绝，
 * UI 在优惠弹层输入期拦截）。
 */
export function computeCart(
  lines: CartLine[],
  discountType: DiscountType,
  discountValue: number,
): CartAmounts {
  const subtotalFen = lines.reduce((s, l) => s + lineTotal(l), 0)
  const nonApptSubtotalFen = lines
    .filter((l) => l.kind !== 'appointment')
    .reduce((s, l) => s + lineTotal(l), 0)
  let discountFen = 0
  if (discountType === 'percent' && discountValue >= 1 && discountValue <= 100) {
    discountFen = subtotalFen - Math.round((subtotalFen * discountValue) / 100)
  } else if (discountType === 'amount') {
    discountFen = discountValue
  }
  const payableFen = subtotalFen - discountFen
  const passCoveredFen = lines.filter((l) => l.paidByPass).reduce((s, l) => s + lineTotal(l), 0)
  return {
    subtotalFen,
    discountFen,
    payableFen,
    passCoveredFen,
    dueFen: payableFen - passCoveredFen,
    nonApptSubtotalFen,
  }
}

/** 优惠是否超上限（服务端 badRequest 边界：优惠 ≤ 非预约行合计） */
export const discountOverLimit = (a: CartAmounts): boolean => a.discountFen > a.nonApptSubtotalFen

/** 组装 hold/settle 的购物车快照（行 → cartItemSchema） */
export function toCartSnapshot(
  lines: CartLine[],
  member: CashierMember | null,
  discountType: DiscountType,
  discountValue: number,
  billNo?: string,
): HoldInput {
  return {
    ...(billNo ? { billNo } : {}),
    customerId: member?.id ?? null,
    items: lines.map((l) => ({
      kind: l.kind,
      refId: l.refId,
      qty: l.qty,
      adjustedPriceFen: l.adjustedPriceFen ?? null,
      paidByPass: l.paidByPass,
    })),
    discountType,
    discountValue,
  }
}

/**
 * 组装结账支付段：现金/微信/支付宝三段按选中输入 + 次卡段自动派生
 * （金额 = Σ扣次行有效价，服务端口径「次卡支付段金额须等于扣次行有效价合计」）。
 * 返回 null = 校验未过（Σ现金类 ≠ 展示应收）。
 */
export function finalizePayments(
  amounts: CartAmounts,
  moneySegs: Array<{ method: Exclude<PayMethod, 'pass'>; amountFen: number }>,
): SettleInput['payments'] | null {
  const sum = moneySegs.reduce((s, p) => s + p.amountFen, 0)
  if (sum !== amounts.dueFen) return null
  const payments: SettleInput['payments'] = moneySegs.map((p) => ({
    method: p.method,
    amountFen: p.amountFen,
  }))
  if (amounts.passCoveredFen > 0) {
    payments.push({ method: 'pass', amountFen: amounts.passCoveredFen })
  }
  return payments
}

/* ------------------------------------------------------------------ */
/* 展示标签 / 图标                                                      */
/* ------------------------------------------------------------------ */

/** 支付方式四分列标签（M1-补1：cash|wechat|alipay|pass；stored_value 预留位不出现） */
export const PAY_METHOD_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  pass: '次卡扣次',
}

/** 流水状态签：已收薄荷 / 已撤单灰 / 挂单·开单中浅木（收银单无待收——修订单口径） */
export const BILL_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  settled: { cls: 'u3-st live', label: '已收' },
  voided: { cls: 'u3-st done', label: '已撤单' },
  held: { cls: 'u3-st wait', label: '挂单' },
  open: { cls: 'u3-st wait', label: '开单中' },
}

/** 服务/行图标映射（试样口径：洗护 shower-head / 造型 scissors / 寄养 bed-double / 商品 package） */
export function serviceIcon(name: string, type?: string): LucideIcon {
  if (type === 'boarding') return BedDouble
  if (/造型|修剪|美容/.test(name)) return Scissors
  return ShowerHead
}

export function lineIcon(l: CartLine): LucideIcon {
  if (l.kind === 'appointment') return CalendarCheck
  if (l.kind === 'product') return Package
  return serviceIcon(l.name, l.serviceType)
}

/** 单号短显（HD-20260918-003 → #003，今日流水简表用） */
export const shortBillNo = (billNo: string): string => `#${billNo.split('-')[2] ?? billNo}`

export { fenToYuan, hhmm }
