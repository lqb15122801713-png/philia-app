/**
 * 预约域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：AppointmentsPage / AppointmentDetailPage / appointments/RescheduleSheet。
 * 纪律：经营性文案（屏题副题/空态/核销与收款引导/规则明面）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：单数/金额/时限等到渲染层读数据经 {var} 插值（结构性口径数如六步之 6 除外）。
 */

import { withCopyOverrides } from '@philia/shared';

const APPT_COPY_TABLE = {
  /* ---- 预约列表 /appointments ---- */
  'appt.listTitle': '预约',
  'appt.listSub': '{date} · 共 {count} 单 · 自动接单已启用',
  'appt.listSubAllDates': '全部日期',
  'appt.createCta': '＋ 新增预约',
  'appt.createGuide': '新客户预约请引导至客户端预约页；到店客可由前台手动核销登记',
  'appt.listEmpty': '这一天没有预约',

  /* ---- 预约详情 /appointments/:id ---- */
  'appt.detailNotFoundTitle': '找不到这个预约',
  'appt.detailNotFoundBody': '预约不存在或已被移除，回预约管理看看今天的单子。',
  'appt.trailAside': '事件即轨迹 · 按时间排序',
  'appt.trailEmpty': '暂无可展示的事件',
  'appt.verifyCodeHint': '客户到店后由员工扫码或输入此码核销',
  'appt.progressDone': '六步完成',
  'appt.progressActive': '第 {n}/6 步 · 实时同步',
  'appt.progressCount': '{done}/6 步',
  'appt.progressWait': '等待到店核销',
  'appt.reviewCancelBody':
    '客户在开始前 {hours} 小时内申请取消该预约。批准后槽位立即释放并通知客户；拒绝后预约恢复为「已确认」。',
  'appt.payDialogTitle': '登记收款？',
  'appt.payDialogBody': '{mode} · 应收 {amount}。登记后该预约转为「已收款」，不可撤销。',
  'appt.payDialogConfirm': '确认收款 {amount}',
  'appt.boardingStayEmpty': '客户到店核销后，这里会登记房间、入住称重与随身物品。',

  /* ---- 改期弹层（RescheduleSheet）---- */
  'appt.rescheduleEmpty': '未来 7 天暂无可约时段，请稍后再试或调整服务时长',
} as const;

export const APPT_COPY = withCopyOverrides(APPT_COPY_TABLE);

export type ApptCopyKey = keyof typeof APPT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function ac(key: ApptCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = APPT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
