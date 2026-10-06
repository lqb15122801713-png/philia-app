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
import { Banknote, BedDouble, CalendarCheck, Package, Scissors, ShowerHead, type LucideIcon } from 'lucide-react'
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
/* M1-补2 R1：今日已收统一聚合出口（store.todayTenderStats）                */
/* ------------------------------------------------------------------ */

/**
 * 三处同数同源唯一取数口（收银台头部直连；总览/财务走各自 stats 内嵌
 * todayTender 块——同一 computeDayTender 函数同字段，禁止页面自算）。
 * clerk 调用返回 restricted=true 且金额/笔数全 null（服务端硬遮罩，
 * 矩阵总规则②）——前端据此隐藏整个金额块。
 */
export const TODAY_TENDER_KEY = ['store', 'todayTenderStats'] as const
export type TodayTenderStats = RouterOutputs['store']['todayTenderStats']

/* ------------------------------------------------------------------ */
/* M1-补2 C：日结/交接班 + R5b 储值台账导入                                */
/* ------------------------------------------------------------------ */

/** cashier.currentShift 返回的班次骨架（无金额，clerk 可调） */
export type ShiftInfo = NonNullable<RouterOutputs['cashier']['currentShift']['shift']>
/** cashier.listDayCloses 行（日结单/冲正关联单同构，含 createdByName） */
export type DayCloseRow = RouterOutputs['cashier']['listDayCloses'][number]
/** storedValue.listImportBatches 行（report=对账报告 JSON 已解析） */
export type ImportBatchRow = RouterOutputs['storedValue']['listImportBatches'][number]
/** R5b 对账报告（preview/execute 同构） */
export type ImportReport = NonNullable<ImportBatchRow['report']>

export const CURRENT_SHIFT_KEY = ['cashier', 'currentShift'] as const
export const DAY_CLOSES_KEY = ['cashier', 'listDayCloses'] as const
export const IMPORT_BATCHES_KEY = ['storedValue', 'listImportBatches'] as const

/* ------------------------------------------------------------------ */
/* 片 3：挂账台账 / 现金收支 / 日结预览（真接线类型出口）                      */
/* ------------------------------------------------------------------ */

/** cashier.creditList 行（ledger + billNo + customerName） */
export type CreditListRow = RouterOutputs['cashier']['creditList'][number]
/** cashier.cashMoveList 行（movement + operatorName） */
export type CashMoveRow = RouterOutputs['cashier']['cashMoveList'][number]
/** cashier.dayClosePreview（blind=true 时 stats=null=盲交不透账面） */
export type DayClosePreview = RouterOutputs['cashier']['dayClosePreview']
/** cashier.handoverOf 行（含 floatFen/confirmedAt/confirmedBy/toUserId） */
export type HandoverRow = NonNullable<RouterOutputs['cashier']['handoverOf']['handover']>
/** appointment.prepaidListForStore 行（预付台账） */
export type PrepaidListRow = RouterOutputs['appointment']['prepaidListForStore'][number]
/** deposit.listStore 行（押金台账） */
export type DepositListRow = RouterOutputs['deposit']['listStore']['items'][number]
/** agreement.listForStore 行（授权台账） */
export type AgreementListRow = RouterOutputs['agreement']['listForStore']['items'][number]

export const CREDIT_LIST_KEY = ['cashier', 'creditList'] as const
export const CASH_MOVE_LIST_KEY = ['cashier', 'cashMoveList'] as const
export const DAY_CLOSE_PREVIEW_KEY = ['cashier', 'dayClosePreview'] as const
export const HANDOVER_OF_KEY = 'handoverOf' as const
export const PREPAID_LIST_KEY = ['appointment', 'prepaidListForStore'] as const
export const DEPOSIT_LEDGER_KEY = ['deposit', 'ledger'] as const
export const AGREEMENT_LIST_KEY = ['agreement', 'listForStore'] as const

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
  /**
   * M1-补2 R5：储值余额（分，本金+赠送；searchMember 真值）。
   * 取单还原的会员条无余额快照（快照不含储值域）——恒 0，储值胶囊不出现；
   * 要用储值支付请移除会员后重新检索（余额实时口径）。
   */
  storedValueBalanceFen: number
  /** 在店预约数（confirmed/in_service/in_boarding） */
  appointmentCount: number
}

/** 购物车行（前端工作模型；提交时映射为 cartItemSchema 快照） */
export interface CartLine {
  /** custom=快捷收款行（名目+自定义金额；无商品零迁移扩域） */
  kind: 'service' | 'product' | 'appointment' | 'custom'
  refId: string
  name: string
  spec: string | null
  /** 服务/预约/快捷行恒 1（服务端强校验），仅商品行 1-99 */
  qty: number
  unitPriceFen: number
  /** 行改价留痕（分）；null = 未改价。非空触发服务端 owner 闸门 */
  adjustedPriceFen: number | null
  /** 次卡扣次行（仅 grooming 服务行；须绑会员） */
  paidByPass: boolean
  /** 单品备注（≤200 字；随 hold/settle 入参，小票透出） */
  note?: string | null
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
  /**
   * 抹零让利（分；片 3 · S4）：规则=cashier_rounding_rule 端口键，前端恒 0 占位
   * （真值以 server 重算为准）；单上 roundingFen>0 时展示层透出「抹零 −¥x.xx」
   */
  roundingFen: number
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
    roundingFen: 0, // 占位：抹零规则为 server 端口键口径，前端不自算（真值以单为准）
    payableFen,
    passCoveredFen,
    dueFen: payableFen - passCoveredFen,
    nonApptSubtotalFen,
  }
}

/** 优惠是否超上限（服务端 badRequest 边界：优惠 ≤ 非预约行合计） */
export const discountOverLimit = (a: CartAmounts): boolean => a.discountFen > a.nonApptSubtotalFen

/** 组装 hold/settle 的购物车快照（行 → cartItemSchema；行 note 与整单 note 随快照落库） */
export function toCartSnapshot(
  lines: CartLine[],
  member: CashierMember | null,
  discountType: DiscountType,
  discountValue: number,
  billNo?: string,
  note?: string,
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
      ...(l.note?.trim() ? { note: l.note.trim() } : {}),
      // 快捷收款行：名目/金额前端给，server 校验存在性即放行（不触发改价闸门）
      ...(l.kind === 'custom' ? { customName: l.name, customAmountFen: l.unitPriceFen } : {}),
    })),
    discountType,
    discountValue,
    ...(note?.trim() ? { note: note.trim() } : {}),
  }
}

/**
 * 组装结账支付段：现金/微信/支付宝按选中输入 + 次卡段自动派生 + 储值段手输 +
 * 回馈金段手输（R11a 第六段）+ 挂账段手输（片 3 第七段 credit）：
 * （次卡金额 = Σ扣次行有效价，服务端口径「次卡支付段金额须等于扣次行有效价合计」；
 *   储值段 = 存量储值消费，M1-补2 R5 启用，须绑会员，余额服务端事务内核验；
 *   回馈金段 = 已到账余额抵扣，仅商品行可用——红线 2，server settle 硬校验兜底，
 *   余额不足 deductRebate FORBIDDEN 原文透出；不计已收，computeDayTender rebateFen 单列）；
 *   挂账段 = 台账留痕不碰真钱（至多一段，server 落 credit_ledgers；computeDayTender
 *   跳过不计已收；结清/核销走台账专页 creditSettle/creditWriteoff）。
 * 返回 null = 校验未过（Σ现金类 + 储值 + 回馈金 + 挂账 ≠ 展示应收）。
 */
export function finalizePayments(
  amounts: CartAmounts,
  moneySegs: Array<{ method: Exclude<PayMethod, 'pass' | 'stored_value' | 'rebate' | 'credit'>; amountFen: number }>,
  storedValueFen = 0,
  rebateFen = 0,
  creditFen = 0,
): SettleInput['payments'] | null {
  const sum = moneySegs.reduce((s, p) => s + p.amountFen, 0) + storedValueFen + rebateFen + creditFen
  if (sum !== amounts.dueFen) return null
  const payments: SettleInput['payments'] = moneySegs.map((p) => ({
    method: p.method,
    amountFen: p.amountFen,
  }))
  if (storedValueFen > 0) {
    payments.push({ method: 'stored_value', amountFen: storedValueFen })
  }
  if (rebateFen > 0) {
    payments.push({ method: 'rebate', amountFen: rebateFen })
  }
  if (creditFen > 0) {
    payments.push({ method: 'credit', amountFen: creditFen })
  }
  if (amounts.passCoveredFen > 0) {
    payments.push({ method: 'pass', amountFen: amounts.passCoveredFen })
  }
  return payments
}

/**
 * R11a：会员服务折扣镜像（展示口径）——server cashier.ts applyMemberServiceDiscount
 * 同公式 round(unit×bp/10000)、同「人工改价行不覆盖」、同作用域（service/appointment 行，
 * 商品全员同价）。**提交快照保持 adjustedPriceFen=null**（server 结账实算且避免撞
 * 改价闸门 assertPriceEditAllowed——adjusted≠null 须 owner|manager，clerk 会 403）。
 * bp=null 或 ≥10000（微光无折扣，红线 7）→ 门市价口径原样。
 */
export function computeCartMember(
  lines: CartLine[],
  discountType: DiscountType,
  discountValue: number,
  svcDiscountBp: number | null,
): CartAmounts {
  if (svcDiscountBp === null || svcDiscountBp >= 10000) {
    return computeCart(lines, discountType, discountValue)
  }
  const discounted = lines.map((l) =>
    (l.kind === 'service' || l.kind === 'appointment') && l.adjustedPriceFen == null
      ? { ...l, adjustedPriceFen: Math.round((l.unitPriceFen * svcDiscountBp) / 10000) }
      : l,
  )
  return computeCart(discounted, discountType, discountValue)
}

/** 商品行有效价合计（分）——回馈金抵扣段上限（server：rebate 段 ≤ 当单商品行合计，红线 2） */
export const productTotalFen = (lines: CartLine[]): number =>
  lines.filter((l) => l.kind === 'product').reduce((s, l) => s + lineTotal(l), 0)

/** 行会员折后合计（展示用；非服务/预约行或人工改价行返回 null=不走会员折扣） */
export function memberDiscountLineTotal(l: CartLine, bp: number | null): number | null {
  if (bp === null || bp >= 10000) return null
  if (l.kind !== 'service' && l.kind !== 'appointment') return null
  if (l.adjustedPriceFen != null) return null // 人工改价优先（server 同口径）
  return Math.round((l.unitPriceFen * bp) / 10000) * l.qty
}

/* ------------------------------------------------------------------ */
/* 展示标签 / 图标                                                      */
/* ------------------------------------------------------------------ */

/** 支付方式七分列标签（M1-补2 R5 + R11a + 片 3 credit 挂账：台账留痕不计已收） */
export const PAY_METHOD_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  pass: '次卡扣次',
  stored_value: '储值',
  rebate: '回馈金',
  credit: '挂账',
}

/** 流水状态签：已收薄荷 / 已撤单灰 / 挂单·开单中浅木（收银单无待收——修订单口径）；
    M1-补2 D：reversal=冲正单（永驻流水，不计已收）；settled 被冲正由调用方叠加「已冲正」灰签 */
export const BILL_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  settled: { cls: 'u3-st live', label: '已收' },
  voided: { cls: 'u3-st done', label: '已撤单' },
  held: { cls: 'u3-st wait', label: '挂单' },
  open: { cls: 'u3-st wait', label: '开单中' },
  reversal: { cls: 'u3-st done', label: '冲正单' },
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
  if (l.kind === 'custom') return Banknote
  return serviceIcon(l.name, l.serviceType)
}

/** 单号短显（HD-20260918-003 → #003，今日流水简表用） */
export const shortBillNo = (billNo: string): string => `#${billNo.split('-')[2] ?? billNo}`

export { fenToYuan, hhmm }
