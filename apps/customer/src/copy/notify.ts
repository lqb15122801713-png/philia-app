/**
 * 站内信消息中心文案键表（补缺大批片 5 · copy key 一期硬约定 · 纪律同 copy/home.ts）
 *
 * 覆盖：NotifyCenterPage（/notifications 分类 chips / 列表行 / 空态三句话 / 全部已读 /
 * 删除二次确认 / 加载更多）+ NotifyPrefsPage（/notifications/prefs 营销开关卡 /
 * 不可关组 / 明示文案卡）+ HomePage 铃铛 aria / MePage 消息行。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 */

import { withCopyOverrides } from '@philia/shared';

const NTF_COPY_TABLE = {
  /* ---- 消息中心页帧 ---- */
  'ntf.title': '消息',
  'ntf.catTrade': '交易',
  'ntf.catService': '服务',
  'ntf.catAccount': '账户',
  'ntf.catMarketing': '活动',
  'ntf.allTab': '全部',
  'ntf.unreadTab': '未读',
  'ntf.markAllRead': '全部已读',
  'ntf.loadMore': '加载更多',

  /* ---- 空态三句话（R10：无消息=真空态，不画假件） ---- */
  'ntf.emptyTitle': '还没有消息',
  'ntf.emptyBody': '预约进度、退款结果、证书报告都会在这里告诉你',
  'ntf.emptyCta': '去首页逛逛 ›',

  /* ---- 列表行动作 ---- */
  'ntf.delete': '删除',
  'ntf.deleteConfirm': '再点一次确认删除',
  'ntf.deleted': '已删除',

  /* ---- 异常态 ---- */
  'ntf.loadFail': '消息加载失败',
  'ntf.retry': '重试',

  /* ---- 订阅管理页 ---- */
  'ntf.prefsTitle': '订阅管理',
  'ntf.prefsHint': '营销与活动通知可关闭；交易、服务、账户通知为保障服务履约不可关闭',
  'ntf.marketingLabel': '活动与优惠',
  'ntf.marketingDesc': '会员日、回馈金到账提醒、门店活动',
  'ntf.mandatoryLabel': '交易 / 服务 / 账户通知',
  'ntf.mandatoryDesc': '预约进度、退款结果、证书报告、账号安全——不可关闭',
  'ntf.mandatoryNote': '不可关闭',
  'ntf.offToast': '已关闭活动通知',
  'ntf.onToast': '已开启活动通知',
} as const;

export const NTF_COPY = withCopyOverrides(NTF_COPY_TABLE);

export type NtfCopyKey = keyof typeof NTF_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function ntf(key: NtfCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = NTF_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
