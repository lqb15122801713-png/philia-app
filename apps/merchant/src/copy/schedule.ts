/**
 * 排班管理页文案键表（员工端骨架整建批 片 2 · 商家端 /settings/schedules）
 *
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback），
 * 写法照 copy/copyPort.ts 既有件模式。
 */

import { withCopyOverrides } from '@philia/shared';

const SCHEDULE_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'sched.pageTitle': '排班管理',
  'sched.pageSub': '周视图拖拽排班 · 模板生成 · 发布推送 · 换班审批 · 批量导入',
  'sched.guideTitle': '排班管理由店长或店主处理',
  'sched.guideHint': '排班、发布与换班审批属管理层动作；店员账号的工作面是收银台。',

  /* ---- 周视图 ---- */
  'sched.week.prev': '‹ 上一周',
  'sched.week.this': '本周',
  'sched.week.next': '下一周 ›',
  'sched.week.published': '本周已发布',
  'sched.week.draft': '本周未发布',
  'sched.week.staffCol': '员工 \\ 日期',
  'sched.week.empty': '本店暂无在职员工',
  'sched.block.template': '模板',
  'sched.block.manual': '手动',
  'sched.block.published': '已发布',
  'sched.block.draft': '未发布',
  'sched.block.dragHint': '拖动班次块到其他格子即可调班',
  'sched.drop.note': '拖拽调整留痕',
  'sched.drop.done': '已调整并留痕',

  /* ---- 班次模板 ---- */
  'sched.tpl.title': '班次模板',
  'sched.tpl.aside': '模板按周生成排班；停用后不再参与生成',
  'sched.tpl.namePh': '班次名（如 早班）',
  'sched.tpl.days': '适用周日',
  'sched.tpl.saveCta': '保存模板',
  'sched.tpl.saved': '模板已保存',
  'sched.tpl.deactivate': '停用',
  'sched.tpl.deactivated': '模板已停用',
  'sched.tpl.empty': '暂无模板；新增后可一键生成整周排班',
  'sched.tpl.invalid': '请填齐班次名与起止时间，且至少选一天',

  /* ---- 生成 + 发布 ---- */
  'sched.gen.generateCta': '按模板生成本周',
  'sched.gen.generating': '生成中…',
  'sched.gen.done': '生成完成：新增 {created} 班、跳过 {skipped} 班',
  'sched.gen.publishCta': '发布本周班表',
  'sched.gen.publishing': '发布中…',
  'sched.gen.published': '发布完成：新发布 {n} 班（幂等，已发布不重发）',
  'sched.gen.publishNote': '发布后员工端可见并收到推送；重复发布幂等',

  /* ---- 换班审批 ---- */
  'sched.swap.title': '换班审批',
  'sched.swap.aside': '批准后班次换挂接手人；未认领前责任归原人',
  'sched.swap.empty': '暂无待审批的换班申请',
  'sched.swap.noQueue': '换班队列读口（swapQueue）server 端未透出，审批区待接上；员工发起换班后可在此批准/驳回。',
  'sched.swap.openTarget': '开放认领',
  'sched.swap.approve': '批准',
  'sched.swap.reject': '驳回',
  'sched.swap.notePh': '审批备注（驳回必填）',
  'sched.swap.noteRequired': '驳回换班须填写备注',
  'sched.swap.resolved': '已处理该换班申请',

  /* ---- CSV 批量导入 ---- */
  'sched.import.title': 'CSV 批量导入',
  'sched.import.aside': '列名=员工/日期/开始/结束；先预览对账再落库',
  'sched.import.placeholder': '粘贴 CSV 文本，如：\n员工,日期,开始,结束\n小王,2026-10-05,10:00,19:00',
  'sched.import.previewCta': '预览对账',
  'sched.import.executeCta': '确认导入',
  'sched.import.empty': '请先粘贴 CSV 文本',
  'sched.import.colLine': '行',
  'sched.import.colStaff': '员工',
  'sched.import.colDate': '日期',
  'sched.import.colRange': '时段',
  'sched.import.colResult': '结果',
  'sched.import.rowOk': '可导入',
  'sched.import.summary': '可导入 {ok} 行 · 失败 {fail} 行',
  'sched.import.executed': '导入完成：落库 {inserted} 行、跳过 {skipped} 行',

  /* ---- 技能标签 ---- */
  'sched.skill.title': '技能标签',
  'sched.skill.aside': '点选切换即保存；标签集由配置端口供给',
  'sched.skill.saved': '技能标签已更新',
  'sched.skill.empty': '暂无在职员工',
  'sched.skill.noTags': '标签集为空（配置端口 staff_skill_tags 未供给）',

  /* ---- WiFi 白名单 ---- */
  'sched.wifi.title': 'WiFi 打卡白名单',
  'sched.wifi.pending': 'BSSID 白名单由考勤批提供端口页（attendance_wifi_bssids），本区暂为只读注记，端点落地后接上。',

  /* ---- 通用 ---- */
  'sched.common.loadFail': '数据加载失败，请检查网络后重试',
  'sched.common.retry': '重新加载',
} as const;

export const SCHEDULE_COPY = withCopyOverrides(SCHEDULE_COPY_TABLE);
export type ScheduleCopyKey = keyof typeof SCHEDULE_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function sc(key: ScheduleCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SCHEDULE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
