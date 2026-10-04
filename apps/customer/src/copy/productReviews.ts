/**
 * 商品评价（productReviews）域文案键表（客户端体验大批 片 3 · copy key 一期
 * 硬约定，纪律同 copy/records.ts）
 *
 * 覆盖：ProductDetailPage 描述卡后「商品评价」区（productReviews 列表+均分+
 * 晒单图墙+写评价入口）+ MallOrdersPage received 态「写评价」入口。写评价闸=
 * 仅 received 订单可评（一单一件一评：uq_product_reviews_order_product），
 * 晒图走既有 /api/upload 链（relDir='review/product'）。
 * 数值不进本表：评分/条数到渲染层读 server 透出插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const PRODUCT_REVIEWS_COPY_TABLE = {
  /* ---- 评价区（PDP 描述卡后） ---- */
  'rev.title': '商品评价',
  'rev.summary': '{avg} 分 · {count} 条评价',
  'rev.empty': '还没有评价，收货后来写第一条',
  'rev.loadFail': '评价加载失败，请稍后重试',
  'rev.more': '加载更多',
  'rev.anonymousName': '匿名用户',

  /* ---- 写评价（仅 received 订单可评；PDP 弹层表单） ---- */
  'rev.writeCta': '写评价',
  'rev.orderEntry': '写评价',
  'rev.sheetTitle': '写评价',
  'rev.ratingLabel': '评分',
  'rev.textPlaceholder': '说说商品怎么样…（可不填）',
  'rev.photoAdd': '晒图',
  'rev.photoLimit': '最多 3 张',
  'rev.anonymous': '匿名评价',
  'rev.submit': '提交评价',
  'rev.submitting': '提交中…',
  'rev.toastOk': '评价已提交',
  'rev.submitFail': '评价提交失败，请稍后再试',
  /* 无 received 可评单时的诚实注记（不画假入口） */
  'rev.needReceived': '确认收货后即可评价本商品',
} as const;

export const PRODUCT_REVIEWS_COPY = withCopyOverrides(PRODUCT_REVIEWS_COPY_TABLE);

export type ProductReviewsCopyKey = keyof typeof PRODUCT_REVIEWS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rvc(key: ProductReviewsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PRODUCT_REVIEWS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
