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
  /* ---- W-10 校形：CSV 导入点亮（片 5 段 4：模板下载+预览 dry-run+落账；
     闸=owner|manager，server merchantManagerProcedure 硬闸）+ M5 台账日盘档（≥¥100 日盘门槛） ---- */
  'prod.csvCta': 'CSV 导入',
  'prod.csvImportTitle': 'CSV 批量导入',
  'prod.csvTemplateCta': '下载模板',
  'prod.csvFileCta': '选择 CSV 文件',
  'prod.csvNoFile': '请先选择 CSV 文件',
  'prod.csvPreviewCta': '预览校验',
  'prod.csvExecuteCta': '确认导入',
  'prod.csvSummary': '共 {t} 行 · 可导入 {ok} · 失败 {f}',
  'prod.csvAllOk': '全部合法，可确认导入',
  'prod.csvDone': '导入成功 {n} 行',
  'prod.csvClose': '收起',
  'prod.dailyCountCol': '日盘档',
  'prod.dailyCountYes': '日盘',
  'prod.dailyCountNote': '日盘档=单价 ≥¥100 商品每日盘点门槛（S-08 同口径）',
} as const;

export const PRODUCT_COPY = withCopyOverrides(PRODUCT_COPY_TABLE);

export type ProductCopyKey = keyof typeof PRODUCT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pd(key: ProductCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PRODUCT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
