/**
 * XP 审核域文案键表（员工端骨架整建批 片 4 B4 · 商家端 /xp-admin）
 *
 * 覆盖：XpAdminPage（积分申报审批 + 扣分异议审批 + 历史两表，一页多分区，
 * 分区工艺照 OpsPage u3-panel 竖排）。
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const XP_ADMIN_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'xpadmin.pageTitle': 'XP 审核',
  'xpadmin.pageSub': '积分申报与扣分异议审批；审核通过才落正式流水，XP 事件只增不改',
  'xpadmin.guideTitle': 'XP 审核由店长或店主处理',
  'xpadmin.guideHint': '积分申报与扣分异议的审批属管理层动作；店员账号的工作面是收银台。',

  /* ---- 区 1 积分申报 ---- */
  'xpadmin.award.title': '积分申报审批',
  'xpadmin.award.aside': '员工申报的正向积分；批准才落正式 XP 事件',
  'xpadmin.award.empty': '暂无待审批的积分申报',
  'xpadmin.award.pointsLine': '申报 +{n} 分',

  /* ---- 区 2 扣分异议 ---- */
  'xpadmin.revoke.title': '扣分异议审批',
  'xpadmin.revoke.aside': '批准=对冲：原负分保留不删，另写一条正向对冲行（明面对冲注记）',
  'xpadmin.revoke.empty': '暂无待审批的扣分异议',
  'xpadmin.revoke.pointsLine': '请求对冲 +{n} 分',
  'xpadmin.revoke.originalLine': '原扣分事件 {n} 分',
  'xpadmin.revoke.hedgeNote': '批准口径：原负分保留，按请求分值写对冲行，事件流水只增不改。',

  /* ---- 审批弹层（两区共用） ---- */
  'xpadmin.review.approveCta': '批准',
  'xpadmin.review.rejectCta': '驳回',
  'xpadmin.review.approveTitle': '批准申请 · {name}',
  'xpadmin.review.rejectTitle': '驳回申请 · {name}',
  'xpadmin.review.notePh': '审批意见（必填，随单留痕）',
  'xpadmin.review.noteRequired': '审批意见不能为空',
  'xpadmin.review.approved': '已批准，正式流水已落',
  'xpadmin.review.rejected': '已驳回',
  'xpadmin.review.reasonLabel': '申请理由',
  'xpadmin.review.appliedAt': '提交于 {at}',

  /* ---- 区 3 历史两表 ---- */
  'xpadmin.history.title': '审批历史',
  'xpadmin.history.aside': '审核结论随单留痕；通过单含落行回链',
  'xpadmin.history.empty': '暂无审批历史',
  'xpadmin.history.statusApproved': '已批准',
  'xpadmin.history.statusRejected': '已驳回',
  'xpadmin.history.kindAward': '积分申报',
  'xpadmin.history.kindRevoke': '扣分异议',
  'xpadmin.history.reviewLine': '{result} · {note}',
  'xpadmin.history.reviewedAt': '审批于 {at}',

  /* ---- 通用 ---- */
  'xpadmin.common.loadFail': '数据加载失败，请检查网络后重试',
  'xpadmin.common.retry': '重新加载',
  'xpadmin.common.confirm': '确认提交',
  'xpadmin.common.cancel': '取消',
  'xpadmin.common.submitting': '提交中…',
} as const;

export const XP_ADMIN_COPY = withCopyOverrides(XP_ADMIN_COPY_TABLE);
export type XpAdminCopyKey = keyof typeof XP_ADMIN_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function xp(key: XpAdminCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = XP_ADMIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
