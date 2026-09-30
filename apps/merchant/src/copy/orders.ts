/**
 * 商城订单域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：OrdersPage。
 * 纪律：经营性文案（屏题副题/队列空态）一律经本表取值，组件内零硬编码；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 * 数值不进本表：队列计数到渲染层读分组数据经 {var} 插值。
 */

export const ORDER_COPY = {
  'order.title': '商城订单',
  'order.sub': '待发货 {a} · 已发货 {b} · 售后 {c}',
  'order.emptyAll': '还没有订单',
  'order.emptySearch': '没有找到匹配的订单',
  'order.emptyPaid': '没有待发货订单',
  'order.emptyShipped': '没有已发货订单',
  'order.emptyRefunding': '没有售后订单',
} as const;

export type OrderCopyKey = keyof typeof ORDER_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function od(key: OrderCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ORDER_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
