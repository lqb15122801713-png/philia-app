/**
 * 商城管理共享类型 / 常量 / 格式化（T5.2 · components/mall-admin）
 *
 * 契约口径（MERCHANT-CONTRACTS · 通用约定）：金额分→元；时间 HH:mm；
 * 日期 M月D日 周x；全部中文；tRPC 错误原文 toast。
 */

import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@philia/shared'

type RouterOutputs = inferRouterOutputs<AppRouter>

/** mall.listProductsForStore 返回行（本店商品，含下架） */
export type StoreProduct = RouterOutputs['mall']['listProductsForStore']['items'][number]
/** mall.listStoreOrders 返回分组 */
export type StoreOrderGroups = RouterOutputs['mall']['listStoreOrders']['groups']
/** 商家端订单队列行（Order & { customerNickname }） */
export type StoreOrder = StoreOrderGroups['paid'][number]

/** React Query 键（TabBar 红点与 OrdersPage 共用，invalidate 互通不重复拉取） */
export const STORE_ORDERS_KEY = ['mall', 'listStoreOrders'] as const
/** 商品管理列表键前缀（带筛选参数派生： [...PRODUCTS_KEY, {category, keyword}]） */
export const PRODUCTS_KEY = ['mall', 'listProductsForStore'] as const

/** 商品分类（应用层枚举 · 与方案 §2.2 一致：主粮/零食/玩具/清洁/其他） */
export const PRODUCT_CATEGORIES = ['主粮', '零食', '玩具', '清洁', '其他'] as const

/** 低库存阈值：低于该值表格库存列标红 */
export const LOW_STOCK_THRESHOLD = 10

/** 商品图上限（v1 管理端口径；服务端 upsertProduct 允许最多 9 张） */
export const MAX_PRODUCT_IMAGES = 5

/** 分 → 元字符串（两位小数，配合 font-number + tabular-nums 纵向对齐） */
export const fenToYuan = (fen: number): string => (fen / 100).toFixed(2)

/** 分 → ¥元 */
export const fmtMoney = (fen: number | null | undefined): string =>
  fen === null || fen === undefined ? '—' : `¥${fenToYuan(fen)}`

/**
 * 元输入 → 分（严格口径）：
 * - 仅接受「非负、最多两位小数」的十进制串（去首尾空格）；
 * - 合法返回整数分，非法返回 null（调用方提示且不提交）。
 * 用字符串拆解而非 parseFloat*100，避免 19.99*100=1998.999… 的浮点误差。
 */
export function yuanToFen(input: string): number | null {
  const s = input.trim()
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const yuan = Number(m[1])
  const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  const fen = yuan * 100 + cents
  if (!Number.isSafeInteger(fen) || fen < 0 || fen > 100_000_000) return null
  return fen
}

/** 分 → 元输入框初始值（不补尾零：1990 → "19.9"，2000 → "20"） */
export function fenToYuanInput(fen: number): string {
  return String(fen / 100)
}

const pad2 = (n: number): string => String(n).padStart(2, '0')
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'] as const

/** HH:mm（24 小时制） */
export const hhmm = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/** M月D日 周x HH:mm（下单/发货时间展示） */
export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '—'
  return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEK_CN[d.getDay()]} ${hhmm(d)}`
}

/** 截取错误信息（tRPC 错误 message 原文 toast） */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
