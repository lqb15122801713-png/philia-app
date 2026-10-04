/**
 * 心愿单/收藏（favorites）域文案键表（客户端体验大批 片 3 · copy key 一期硬约定，
 * 纪律同 copy/records.ts）
 *
 * 覆盖：MallPage 头部「心愿单」入口链 + CouponsPage /me/coupons 心愿单 tab
 * （favList，并入券页取少路由）+ ProductDetailPage 图区右上角收藏钮
 * （favToggle 幂等，已收藏实色）。
 * 数值不进本表：价格等到渲染层读 server 透出插值。
 */

import { withCopyOverrides } from '@philia/shared';

const FAVORITES_COPY_TABLE = {
  /* ---- 心愿单（/me/coupons 心愿单 tab） ---- */
  'fav.mallEntry': '心愿单',
  'fav.title': '心愿单',
  'fav.loadFail': '心愿单加载失败，请稍后重试',
  /* 空态三句话（是什么 / 为什么 / 去哪），出口=商城 */
  'fav.emptyTitle': '心愿单还空着呢',
  'fav.emptyBody': '看中的好物点右上角小心心，会在这里等你',
  'fav.emptyCta': '去商城逛逛 ›',

  /* ---- PDP 收藏钮（图区右上角，幂等） ---- */
  'fav.pdpAdd': '加入心愿单',
  'fav.pdpAdded': '已收藏',
  'fav.addToast': '已加入心愿单',
  'fav.removeToast': '已移出心愿单',
  'fav.toggleFail': '操作失败，请稍后再试',
} as const;

export const FAVORITES_COPY = withCopyOverrides(FAVORITES_COPY_TABLE);

export type FavoritesCopyKey = keyof typeof FAVORITES_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function fvc(key: FavoritesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = FAVORITES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
