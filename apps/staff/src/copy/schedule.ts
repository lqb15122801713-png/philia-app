/**
 * 我的排班页文案键表（员工端骨架整建批 片 2 · 员工端 /my-schedule）
 *
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const SCHEDULE_COPY_TABLE = {
  /* ---- 页头 ---- */
  'sched.title': '我的排班',
  'sched.no': 'MY SCHEDULE',
  'sched.meFullLink': '完整排班与换班 ›',

  /* ---- 周视图 ---- */
  'sched.myweek.prev': '‹ 上周',
  'sched.week.this': '本周',
  'sched.myweek.next': '下周 ›',
  'sched.myweek.published': '已发布',
  'sched.myweek.draft': '待发布',
  'sched.myweek.empty': '本周还没有排班',
  'sched.week.mine': '我',
  'sched.week.rest': '休息',

  /* ---- 可用时间 ---- */
  'sched.avail.title': '我的可用时间',
  'sched.avail.aside': '填每周可上班时段，店长排班会参考',
  'sched.avail.saveCta': '保存可用时间',
  'sched.avail.saved': '可用时间已保存',
  'sched.avail.invalid': '请选择周日并填对起止时间',
  'sched.avail.empty': '还没有填过可用时间',
  'sched.avail.notePh': '备注（可空，如 只能晚班）',

  /* ---- 请假/调休 ---- */
  'sched.leave.title': '请假 / 调休申请',
  'sched.leave.kindLeave': '请假',
  'sched.leave.kindCompOff': '调休',
  'sched.leave.start': '开始日期',
  'sched.leave.end': '结束日期',
  'sched.leave.reasonPh': '请写明原因（必填）',
  'sched.leave.submitCta': '提交申请',
  'sched.leave.submitting': '提交中…',
  'sched.leave.submitted': '已提交，待店长审批',
  'sched.leave.invalid': '请填齐起止日期与原因',
  'sched.leave.myList': '我的申请',
  'sched.leave.empty': '还没有申请记录',
  'sched.leave.pending': '待审批',
  'sched.leave.approved': '已通过',
  'sched.leave.rejected': '已驳回',

  /* ---- 调休余额 ---- */
  'sched.comp.title': '调休余额',
  'sched.comp.hours': '{h} 小时',
  'sched.comp.entries': '变动流水',
  'sched.comp.empty': '暂无变动记录',

  /* ---- 换班 ---- */
  'sched.swap.cta': '发起换班',
  'sched.swap.pickTarget': '选择接手同事',
  'sched.swap.openPool': '开放认领（不指定）',
  'sched.swap.reasonPh': '换班理由（必填）',
  'sched.swap.submitCta': '提交换班申请',
  'sched.swap.submitted': '换班申请已提交，待店长审批',
  'sched.swap.invalid': '请填写换班理由',
  'sched.swap.cancel': '收起',

  /* ---- 通用 ---- */
  'sched.common.loadFail': '数据加载失败，请检查网络后重试',
  'sched.common.retry': '重新加载',
} as const;

export const SCHEDULE_COPY = withCopyOverrides(SCHEDULE_COPY_TABLE);
export type ScheduleCopyKey = keyof typeof SCHEDULE_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function sdc(key: ScheduleCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SCHEDULE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
