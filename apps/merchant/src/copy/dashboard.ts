/**
 * 经营总览域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：DashboardPage + dashboard/StatCards + dashboard/TodayTimeline + dashboard/TodoSection。
 * 纪律：经营性文案（屏题/卡题/空态/待办引导）一律经本表取值，组件内零硬编码；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 * 数值不进本表：计数/金额到渲染层读聚合数据经 {var} 插值。
 */

export const DASH_COPY = {
  'dash.title': '经营总览',
  'dash.statCapAppt': '今日预约',
  'dash.statCapRevenue': '今日营业额',
  'dash.statCapBoarding': '在店寄养',
  'dash.statCapMode': '接单模式',
  'dash.statModeValue': '自动接单',
  'dash.statModePill': '已启用 · 新预约免确认',
  'dash.statBoardingEmpty': '当前无在店寄养',
  'dash.timelineTitle': '今日预约',
  'dash.timelineEmpty': '今天还没有预约——把预约页分享给老客，或等自动接单',
  'dash.todoTitle': '待办',
  'dash.todoCancelLabel': '取消申请待审',
  'dash.todoCancelHint': '客户申请取消，待审批',
  'dash.todoUnpaidLabel': '待收款',
  'dash.todoUnpaidHint': '服务已完成，未登记收款',
  'dash.todoOverdueLabel': '超期寄养',
  'dash.todoOverdueHint': '超过预计退房时间仍在店',
  'dash.todoPendingLabel': '历史待确认单',
  'dash.todoPendingHint': '自动接单已启用 · 仅旧单与改期回退单在此',
  /* 超期样例小字片段（mono 数字位在 JSX 内拼装，静片段入键——同 staff me.ts 先例） */
  'dash.todoOverdueLead': '应退未退',
  'dash.todoOverdueUnit': '天',
  'dash.todoOverdueToday': '今日到期未退',
} as const;

export type DashCopyKey = keyof typeof DASH_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function dc(key: DashCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = DASH_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
