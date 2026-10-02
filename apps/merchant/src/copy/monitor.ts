/**
 * 监控域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：MonitorHubPage / AppointmentMonitorPage / appointments/BoardingMonitorPanel。
 * 纪律：经营性文案（屏题副题/空态/家长端视角与打标重拍规则明面/操作引导）一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：单数/晚数等到渲染层读数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const MONITOR_COPY_TABLE = {
  /* ---- 在店监控 Hub /monitor ---- */
  'mon.hubTitle': '在店监控',
  'mon.hubSub': '服务中 {a} 单 · 寄养 {b} 只 · 实时同步',
  'mon.hubEmpty': '现在店里很安静——有单开工时这里会实时动起来',
  'mon.hubBoardingOverdue': '应退未退 {n} 天 · 联系主人或续住',

  /* ---- 单约监控 /monitor/:id ---- */
  'mon.parentViewTitle': '家长端视角',
  'mon.parentViewAside': '与客户端「服务中全程页」同源',
  'mon.parentViewBody':
    '家长看到的内容与这屏一致（六步进度+过程照）。照片一经上传即双频道推送，不可删除，仅可被商家「打标重拍」作废旧照（B3-1 在案）。',
  'mon.cancelledTitle': '预约已取消',
  'mon.cancelledBody': '该预约已取消，无服务过程可监视。',
  'mon.notStartedTitle': '服务尚未开始',
  'mon.notStartedBody': '客户到店核销后，这里会实时展示服务进度与照片。',
  'mon.stepsEmpty': '六步流尚未初始化（等待员工核销）。',
  'mon.wallEmpty': '员工上传过程照后会实时出现在这里。',
  'mon.staffContactNote': '店内对讲或到工位找TA；联系方式请走门店内部渠道。',
  'mon.staffUnassigned': '该单尚未指派员工，可在预约详情页改派。',
  'mon.flagTitle': '打标重拍「{step}」？',
  'mon.flagBodyReopen':
    '该预约已完成：打标将重新开启本预约（打回「服务中」），该步骤回退为「进行中」，员工重拍后需重新确认完成。',
  'mon.flagBodyDone': '该步骤将回退为「进行中」，已有照片全部作废，员工需重新拍摄上传。',
  'mon.flagBodyActive': '该步骤当前进行中，打标后员工会收到重拍提醒。',
  'mon.boardingLogsEmpty': '员工打卡后会实时出现在这里；历史打卡明细请在「寄养管理」页查看。',
} as const;

export const MONITOR_COPY = withCopyOverrides(MONITOR_COPY_TABLE);

export type MonitorCopyKey = keyof typeof MONITOR_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function oc(key: MonitorCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = MONITOR_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
