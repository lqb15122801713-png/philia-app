/**
 * 商品域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：ProductsPage。
 * 纪律：经营性文案（屏题副题/空态/CTA）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：在售/下架/低库存计数到渲染层读统计经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const PRODUCT_COPY_TABLE = {
  'prod.title': '商品',
  'prod.sub': '在售 {on} · 已下架 {off} · 低库存 {low}',
  'prod.subFallback': '门店商品库存、价格与上下架',
  'prod.createCta': '＋ 新增商品',
  'prod.emptyTitle': '货架空空，去上架第一件商品',
} as const;

export const PRODUCT_COPY = withCopyOverrides(PRODUCT_COPY_TABLE);

export type ProductCopyKey = keyof typeof PRODUCT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pd(key: ProductCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PRODUCT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
