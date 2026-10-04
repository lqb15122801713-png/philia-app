/**
 * 消费记录（records）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/account.ts）
 *
 * 覆盖：RecordsPage /records——pay.recordsMine 三源聚合列表（支付/订单/发票，
 * kind 徽+标题+金额+状态+时刻，点跳 link）+ 押金进度区（deposit.listMine：
 * 三态徽 / 三时点 / 金额 / 门店 + 留痕口径注记）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：金额/时刻等到渲染层插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const RECORDS_COPY_TABLE = {
  /* ---- 消费记录 /records ---- */
  'rec.pushLabel': 'RECORDS',
  'rec.title': '消费记录',
  'rec.meEntry': '消费记录',
  'rec.meEntrySub': '支付 · 订单 · 发票 · 押金',
  'rec.loadFail': '记录加载失败，请检查网络后重试',
  /* 空态三句话（是什么 / 为什么 / 去哪） */
  'rec.emptyTitle': '还没有消费记录',
  'rec.emptyBody': '支付单、商城订单与发票记录会在这里汇总',
  'rec.emptyCta': '去商城逛逛 ›',
  /* 三源 kind 徽 */
  'rec.kindPay': '支付',
  'rec.kindOrder': '订单',
  'rec.kindInvoice': '发票',
  /* ---- 押金进度区 ---- */
  'rec.depositTitle': '押金进度',
  /* 诚实口径注记：押金收退=门店登记留痕，无任何支付通道写 */
  'rec.depositNote': '押金收退=门店登记留痕，进度以此为准',
  'rec.depositEmpty': '暂无押金记录',
  'rec.depHeld': '在押',
  'rec.depRefunding': '退还在途',
  'rec.depRefunded': '已退还',
  'rec.depHeldAt': '收取 {time}',
  'rec.depRefundReqAt': '申请退还 {time}',
  'rec.depRefundedAt': '退还完成 {time}',
} as const;

export const RECORDS_COPY = withCopyOverrides(RECORDS_COPY_TABLE);

export type RecordsCopyKey = keyof typeof RECORDS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rcc(key: RecordsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = RECORDS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
