/**
 * 员工域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：StaffPage / staff-admin/InviteStaffDialog / EditStaffDialog / ScheduleEditorDialog。
 * 纪律：经营性文案（屏题副题/空态/邀请与停用操作引导/角色口径明面）一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：在职计数等到渲染层读列表数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const STAFF_COPY_TABLE = {
  'staff.title': '员工',
  'staff.sub': '在职 {a} · 美容师 {b} · 前台 {c} · 自动派单按排班+负荷（S4）',
  'staff.inviteCta': '＋ 邀请员工',
  'staff.panelAside': '排班=自动派单与可约判定之源',
  'staff.empty': '还没有员工',
  'staff.emptyCta': '去邀请第一位员工',
  'staff.suspendedNote': '停职中不可派单/核销',
  'staff.inviteNameHint': '邀请成功后将以该花名登记员工档案',
  'staff.inviteGuide': '员工在员工端登录后输入邀请码即可绑定本店。邀请码 24 小时内有效、仅可使用一次。',
  'staff.inviteCodeOnce': '明文仅此一次展示，关闭本弹层后无法再次查看，请立即复制并转交员工。',
  'staff.editRoleHint': '前台负责扫码核销与接待；美容师负责服务执行（无核销入口）',
  'staff.editSuspendNote': '停用后该员工立即无法操作员工端（历史业绩保留）',
  'staff.editSkillNote': '技能标签暂为只读（S4 派单批开放编辑）；排班请点员工行右侧的排班摘要编辑。',
  'staff.scheduleNote': '每天最多 {n} 个时段；设为「休息」的当天不排班。',

  /* ---- 离职交接（片 3 B7-4：改挂未完结单 + 交接留痕） ---- */
  'staff.exitCta': '离职交接 ›',
  'staff.exitDialogTitle': '离职交接 · {name}',
  'staff.exitReassignTitle': '改挂未完结单',
  'staff.exitReassignHint': '将该员工名下未完结预约改挂给接手人；改挂留痕前后值快照',
  'staff.exitToStaffPh': '选择接手员工',
  'staff.exitNotePh': '备注（选填，随改挂留痕）',
  'staff.exitReassignSubmit': '确认改挂',
  'staff.exitReassigning': '改挂中…',
  'staff.exitReassigned': '改挂完成：共改挂 {n} 单',
  'staff.exitNoTarget': '请先选择接手员工',
  'staff.exitNoCandidates': '暂无其他在职员工可接手',
  'staff.exitMemberNote': '会员档案无员工负责人列，不在改挂范围（口径明面）。',
  'staff.exitHandoffsTitle': '交接留痕',
  'staff.exitHandoffsEmpty': '暂无交接留痕',
  'staff.exitHandoffKindAppointment': '预约改挂',
  'staff.exitHandoffPrevNext': '{prev} → {next}',
} as const;

export const STAFF_COPY = withCopyOverrides(STAFF_COPY_TABLE);

export type StaffCopyKey = keyof typeof STAFF_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function sf(key: StaffCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = STAFF_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
