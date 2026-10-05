/**
 * 优惠券（coupons）域文案键表（客户端体验大批 片 3 · copy key 一期硬约定，
 * 纪律同 copy/records.ts）
 *
 * 覆盖：CouponsPage /me/coupons——领用中心（在售券模板 couponTemplates+领取
 * couponClaim）+ 我的券（myCoupons 三态徽 claimed/used/expired）+ 叠加规则公示卡
 * （couponStackRule 端口值）；CheckoutPage 可用券推荐区同源取用本表。
 * 核销口径（开口项 1 裁）：登记抵扣、线下结算时出示——不接真抵扣结算。
 * 数值不进本表：面额/门槛/天数等到渲染层读 server 透出插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const COUPONS_COPY_TABLE = {
  /* ---- 优惠券页 /me/coupons ---- */
  'cpn.pushLabel': 'COUPONS',
  'cpn.title': '优惠券',
  'cpn.tabMine': '优惠券',
  'cpn.loadFail': '券加载失败，请稍后重试',

  /* 领用中心（在售券模板） */
  'cpn.centerTitle': '领用中心',
  'cpn.claimCta': '领取',
  'cpn.claimedCta': '已领取',
  'cpn.soldOutCta': '已领完',
  'cpn.claimToast': '已领取，结算时出示登记抵扣',
  'cpn.claimFail': '领取失败，请稍后再试',
  'cpn.threshold': '满 {amt} 可用',
  'cpn.thresholdNone': '无门槛',
  'cpn.validDays': '领取后 {days} 天有效',
  'cpn.centerEmpty': '暂时没有可领的券',

  /* 我的券（三态徽） */
  'cpn.mineTitle': '我的券',
  'cpn.statusClaimed': '待使用',
  'cpn.statusUsed': '已核销',
  'cpn.statusExpired': '已过期',
  'cpn.statusVoided': '已作废',
  'cpn.claimedAt': '领取 {time}',
  'cpn.usedAt': '核销 {time}',
  'cpn.mineEmpty': '还没有券，去领用中心看看',
  /* 核销口径注记（开口项 1 裁：登记抵扣，不接真结算） */
  'cpn.useNote': '核销=登记抵扣，线下结算时出示',

  /* 叠加规则公示卡（值读 couponStackRule 端口，本表只出卡题） */
  'cpn.stackTitle': '叠加规则公示',
} as const;

export const COUPONS_COPY = withCopyOverrides(COUPONS_COPY_TABLE);

export type CouponsCopyKey = keyof typeof COUPONS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function cpc(key: CouponsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = COUPONS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
