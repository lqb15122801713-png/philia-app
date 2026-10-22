/**
 * 回馈抽奖（lottery）域文案键表（PD-82 · copy key 一期硬约定 · 纪律同 copy/notify.ts）
 *
 * 覆盖：LotteryPage /member/lottery（页题 / 转盘八格奖品 / 主钮三态 / 结果区 /
 * 规则注记 / mock 诚实注记）。
 * 奖品=前端 mock（本批无服务端抽奖台账/发放链），不虚构真实发放；端口可改文案。
 */

import { withCopyOverrides } from '@philia/shared';

const LOTTERY_COPY_TABLE = {
  /* ---- 页帧 ---- */
  'lty.pushLabel': 'LOTTERY',
  'lty.title': '回馈抽奖',
  'lty.sub': '积分换好礼 · 奖品以店内公示为准',

  /* ---- 转盘八格（mock 奖池；序=格序，渲染层按序排格） ---- */
  'lty.prize0': '洗护 9 折券',
  'lty.prize1': '积分 +20',
  'lty.prize2': '免费剪指甲',
  'lty.prize3': '谢谢参与',
  'lty.prize4': '寄养立减 ¥10',
  'lty.prize5': '积分 +5',
  'lty.prize6': '零食小包',
  'lty.prize7': '再来一次',

  /* ---- 主钮与结果 ---- */
  'lty.spin': '开始抽奖',
  'lty.spinning': '抽奖中…',
  'lty.again': '再抽一次',
  'lty.resultTitle': '抽奖结果',
  'lty.resultWin': '恭喜获得：{prize}',
  'lty.resultRetry': '再来一次：再转一盘',
  'lty.resultNone': '差一点点，下次好运',

  /* ---- 规则与诚实注记 ---- */
  'lty.rulesTitle': '活动规则',
  'lty.rule1': '每人每日可抽 3 次，次数以门店公示为准。',
  'lty.rule2': '券类奖品到账后可在「券包」查看；积分奖品计入会员积分。',
  'lty.mockNote': '演示环境奖品为 Mock 展示，不产生真实发放与扣减。',
} as const;

export const LOTTERY_COPY = withCopyOverrides(LOTTERY_COPY_TABLE);

export type LotteryCopyKey = keyof typeof LOTTERY_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function lty(key: LotteryCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = LOTTERY_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
