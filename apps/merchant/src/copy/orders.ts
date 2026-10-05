/**
 * 商城订单域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：OrdersPage。
 * 纪律：经营性文案（屏题副题/队列空态）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：队列计数到渲染层读分组数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const ORDER_COPY_TABLE = {
  'order.title': '商城订单',
  'order.sub': '待发货 {a} · 已发货 {b} · 售后 {c}',
  'order.emptyAll': '还没有订单',
  'order.emptySearch': '没有找到匹配的订单',
  'order.emptyPaid': '没有待发货订单',
  'order.emptyShipped': '没有已发货订单',
  'order.emptyRefunding': '没有售后订单',
  /* ---- W-09 回馈金红字列（片 5 段 4 撤灰）：listStoreOrders 行透出 rebateFen 真值 ---- */
  'order.rebateCol': '回馈金抵扣',
  'order.rebatePendingNote': '回馈金抵扣（真值；商城结算当前无抵扣通道=恒 0 是诚实现状）——回馈金仅抵商品',
} as const;

export const ORDER_COPY = withCopyOverrides(ORDER_COPY_TABLE);

export type OrderCopyKey = keyof typeof ORDER_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function od(key: OrderCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ORDER_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
