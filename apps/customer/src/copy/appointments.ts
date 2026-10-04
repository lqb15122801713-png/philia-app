/**
 * 预约域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：AppointmentsPage（我的预约列表 + 空态群）与 AppointmentDetailPage
 * （详情 / 取消规则明面 / 改期 / 服务中提示 / 服务相册）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：数量/时长等到渲染层读端口插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const APPOINTMENTS_COPY_TABLE = {
  /* ---- 我的预约 /appointments ---- */
  'appointments.title': '我的预约',
  'appointments.loadFail': '预约列表加载失败，请检查网络后重试',
  /* 空态三句话（题/说明/出口） */
  'appointments.emptyTitle': '还没有预约',
  'appointments.emptyBody': '给毛孩子安排一次舒服的洗护吧',
  'appointments.emptyCta': '立即预约',
  'appointments.tabEmpty': '暂无{status}的预约',

  /* ---- 预约详情 /appointments/:id ---- */
  'appointments.detailTitle': '预约详情',
  'appointments.detailLoadFail': '预约详情加载失败，请检查网络后重试',
  'appointments.notFound': '预约不存在或无权查看',
  'appointments.backToList': '返回我的预约',

  /* 服务中 LIVE 入口 */
  'appointments.liveBoarding': '寄养进行中',
  'appointments.liveGrooming': '服务进行中',
  'appointments.liveSub': '点击查看实时进度与照片',

  'appointments.codeTitle': '到店核销码',

  /* 状态横条（取消审核中 / 商家婉拒） */
  'appointments.cancelReviewing': '取消申请审核中，门店处理后会通知你；审核通过前预约仍然有效。',
  'appointments.rejectedPrefix': '商家已婉拒',

  /* 服务相册 */
  'appointments.albumTitle': '服务相册',
  'appointments.albumSub': '共 {count} 张照片，服务全程透明可查',

  /* completed 主行动 */
  'appointments.rebook': '再次预约',

  /* ---- 改期面板 ---- */
  'appointments.rescheduleTitleBoarding': '重选入住 / 退房日期',
  'appointments.rescheduleTitleGrooming': '选择新时间',
  'appointments.rescheduleNote': '{service} · {pet}（改期后需商家重新确认）',
  'appointments.slotsLoading': '正在加载可约时段…',
  'appointments.slotsLoadFail': '可约时段加载失败，请关闭后重试',
  'appointments.rescheduleCta': '改期',
  'appointments.rescheduleSubmit': '确认改期',
  'appointments.thinkMore': '再想想',

  /* ---- 取消规则明面（>4h 免费 / ≤4h 商家审核） ---- */
  'appointments.cancelCtaFree': '取消预约',
  'appointments.cancelCtaLate': '申请取消（4 小时内需商家审核）',
  'appointments.cancelAskFree': '确认取消这次预约吗？',
  'appointments.cancelAskLate': '距开始不足 4 小时，取消需商家审核',
  'appointments.cancelRuleFree': '开始前 4 小时以上可免费取消，槽位将立即释放。',
  'appointments.cancelRuleLate': '提交后预约转为「取消审核中」，门店审核通过才会取消并释放槽位。',
  'appointments.cancelReasonTitle': '取消原因（选填，告诉我们为什么）',
  'appointments.cancelSubmitFree': '确认取消',
  'appointments.cancelSubmitLate': '提交取消申请',

  /* ---- 服务中禁自助取消 ---- */
  'appointments.servingTitle': '服务中，如需取消请联系门店',
  'appointments.servingCall': '拨打门店电话',
  'appointments.servingNote': '可到店或经商家端与门店协商处理',

  /* ---- 体验大批片 2：改约历史（rescheduleLogs，空态不渲染） ---- */
  'appointments.rescheduleHistory': '改约历史',
  'appointments.rescheduleRoleCustomer': '客户自助',
  'appointments.rescheduleRoleMerchant': '门店改期',

  /* ---- 体验大批片 2：附加项 / 寄养快照透出（预约信息卡） ---- */
  'appointments.addonsTitle': '附加项',
  'appointments.emergencyContact': '紧急联系人',
  'appointments.medicalAuthLabel': '医疗授权',
  'appointments.medicalAuthSigned': '已签署（{version}）',
  'appointments.walkTimes': '每日遛弯 {n} 次',

  /* ---- 体验大批片 2：取消阶梯收费公示卡（cancelFeeTiers 端口值，暂不扣款） ---- */
  'appointments.cancelFeeTitle': '取消阶梯收费公示',
  'appointments.cancelFeeNote': '以上为公示口径，暂不实际扣款',

  /* ---- 体验大批片 2：预付台账四态徽（prepaidOf） ---- */
  'appointments.prepaidLabel': '预付台账',
  'appointments.prepaidPending': '预付登记中',
  'appointments.prepaidRegistered': '已预付',
  'appointments.prepaidDeducted': '已核销抵扣',
  'appointments.prepaidRefunded': '已退还',
} as const;

export const APPOINTMENTS_COPY = withCopyOverrides(APPOINTMENTS_COPY_TABLE);

export type AppointmentsCopyKey = keyof typeof APPOINTMENTS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function apc(key: AppointmentsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = APPOINTMENTS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
