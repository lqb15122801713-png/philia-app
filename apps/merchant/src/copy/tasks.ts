/**
 * 循环任务模板域文案键表（员工端骨架整建批 片 3 · 商家端 /settings/tasks）
 *
 * 覆盖：TaskTemplatesPage（模板自管：新建/编辑/停用 + 近 7 天落实例表）。
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const TASKS_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'tasktpl.pageTitle': '任务模板',
  'tasktpl.pageSub': '循环任务自管 · 每日/每周按模板生成落实例 · 停用不删行',
  'tasktpl.guideTitle': '任务模板由店长或店主处理',
  'tasktpl.guideHint': '循环任务模板的新建与停用属管理层动作；店员账号的工作面是收银台。',

  /* ---- 模板表单 ---- */
  'tasktpl.form.titleNew': '新建模板',
  'tasktpl.form.titleEdit': '编辑模板',
  'tasktpl.form.aside': '频率=每日 或 每周（每周须选周日）',
  'tasktpl.form.titleLabel': '任务标题',
  'tasktpl.form.detailLabel': '说明',
  'tasktpl.form.titlePh': '任务标题（如：打烊前消毒备台）',
  'tasktpl.form.detailPh': '说明（选填，员工端任务卡透出）',
  'tasktpl.form.scopeLabel': '指派范围',
  'tasktpl.form.scopeRole': '按角色',
  'tasktpl.form.scopeStaff': '按员工',
  'tasktpl.form.roleFrontdesk': '前台',
  'tasktpl.form.roleGroomer': '美容师',
  'tasktpl.form.staffPh': '选择员工',
  'tasktpl.form.freqLabel': '频率',
  'tasktpl.form.freqDaily': '每日',
  'tasktpl.form.freqWeekly': '每周',
  'tasktpl.form.dueLabel': '截止时刻',
  'tasktpl.form.remindLabel': '提前提醒（分钟，选填）',
  'tasktpl.form.remindPh': '如 30',
  'tasktpl.form.saveCta': '保存模板',
  'tasktpl.form.saving': '保存中…',
  'tasktpl.form.saved': '模板已保存',
  'tasktpl.form.cancelEdit': '取消编辑',
  'tasktpl.form.invalid': '请填齐标题与截止时刻；按员工指派须选人；每周频率须至少选一天',

  /* ---- 模板列表 ---- */
  'tasktpl.list.title': '模板列表',
  'tasktpl.list.aside': '停用=不再生成新例（active=false 留痕不删行）',
  'tasktpl.list.empty': '暂无模板——上方表单新建第一条',
  'tasktpl.list.editCta': '编辑 ›',
  'tasktpl.list.deactivateCta': '停用',
  'tasktpl.list.deactivated': '模板已停用',
  'tasktpl.list.inactiveBadge': '已停用',
  'tasktpl.list.scopeRoleLine': '角色·{role}',
  'tasktpl.list.scopeStaffLine': '指定员工',
  'tasktpl.list.freqDailyLine': '每日',
  'tasktpl.list.freqWeeklyLine': '每周 {days}',
  'tasktpl.list.dueLine': '截止 {hm}',
  'tasktpl.list.remindLine': '提前 {n} 分钟提醒',

  /* ---- 近 7 天落实例 ---- */
  'tasktpl.runs.title': '近 7 天落实例',
  'tasktpl.runs.aside': '模板按日生成实例；完成人=员工端打点人',
  'tasktpl.runs.empty': '近 7 天暂无落实例',
  'tasktpl.runs.colDate': '日期',
  'tasktpl.runs.colTemplate': '模板',
  'tasktpl.runs.colDoneBy': '完成人',
  'tasktpl.runs.colStatus': '状态',
  'tasktpl.runs.statusPending': '待完成',
  'tasktpl.runs.statusDone': '已完成',
  'tasktpl.runs.statusMissed': '已过截止',

  /* ---- 通用 ---- */
  'tasktpl.common.loadFail': '数据加载失败，请检查网络后重试',
  'tasktpl.common.retry': '重新加载',
} as const;

export const TASKS_COPY = withCopyOverrides(TASKS_COPY_TABLE);
export type TasksCopyKey = keyof typeof TASKS_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function tk(key: TasksCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = TASKS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
