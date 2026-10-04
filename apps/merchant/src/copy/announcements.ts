/**
 * 公告域文案键表（员工端骨架整建批 片 3 · 商家端 /settings/announcements）
 *
 * 覆盖：AnnouncementsPage（发布表单 + 公告列表 + 已读回执对账）。
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback），
 * 写法照 copy/schedule.ts 既有件模式。
 */

import { withCopyOverrides } from '@philia/shared';

const ANNOUNCEMENTS_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'ann.pageTitle': '公告',
  'ann.pageSub': '定向发布 · 已读回执对账 · 撤下留痕',
  'ann.guideTitle': '公告发布由店长或店主处理',
  'ann.guideHint': '发布与回执对账属管理层动作；店员账号的工作面是收银台。',

  /* ---- 发布表单 ---- */
  'ann.pub.title': '发布公告',
  'ann.pub.aside': '发布即推送员工端 · 置顶在前',
  'ann.pub.titleLabel': '标题',
  'ann.pub.bodyLabel': '正文',
  'ann.pub.titlePh': '标题（如：本周六店休盘点）',
  'ann.pub.bodyPh': '正文（全员可见口径按定向角色投递）',
  'ann.pub.targetLabel': '定向角色',
  'ann.pub.targetAll': '全员',
  'ann.pub.targetFrontdesk': '前台',
  'ann.pub.targetGroomer': '美容师',
  'ann.pub.pinnedLabel': '置顶',
  'ann.pub.submitCta': '发布',
  'ann.pub.publishing': '发布中…',
  'ann.pub.published': '公告已发布',
  'ann.pub.invalid': '请填齐标题与正文',

  /* ---- 列表 ---- */
  'ann.list.title': '公告列表',
  'ann.list.aside': '新→旧 · 置顶在前 · 撤下为灰态留痕',
  'ann.list.empty': '暂无公告——上方表单发布第一条',
  'ann.list.pinnedBadge': '置顶',
  'ann.list.archivedBadge': '已撤下',
  'ann.list.readCount': '已读 {x}/{y}',
  'ann.list.readCountNoTotal': '已读 {x} 人',
  'ann.list.receiptsCta': '回执 ›',
  'ann.list.archiveCta': '撤下',
  'ann.list.archived': '公告已撤下（留痕，员工端不再展示）',

  /* ---- 回执对账 ---- */
  'ann.reads.title': '已读回执对账',
  'ann.reads.readCol': '已读（{n}）',
  'ann.reads.unreadCol': '未读（{n}）',
  'ann.reads.empty': '暂无回执数据',
  'ann.reads.close': '关闭',

  /* ---- 通用 ---- */
  'ann.common.loadFail': '数据加载失败，请检查网络后重试',
  'ann.common.retry': '重新加载',
} as const;

export const ANNOUNCEMENTS_COPY = withCopyOverrides(ANNOUNCEMENTS_COPY_TABLE);
export type AnnouncementsCopyKey = keyof typeof ANNOUNCEMENTS_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function an(key: AnnouncementsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ANNOUNCEMENTS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
