/**
 * 退款/售后域文案键表（补缺批片 1 · copy key 一期硬约定 · 纪律同 copy/appointments.ts）
 *
 * 覆盖：RefundApplyPage（申请表单 /mall/orders/:id/refund、/appointments/:id/refund）、
 * RefundListPage（/refunds）、RefundDetailPage（/refunds/:id）、MallOrdersPage 订单卡
 * 退款入口位与 AppointmentDetailPage 服务单退款入口（补缺大批片 1）。文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，
 * 键名小写点分、冻结不改。
 *
 * 数值不进本表：时效/SLA/免费反悔窗小时数等到渲染层读 configView 端口插值（{var} 模板）。
 */

export const REFUND_COPY = {
  /* ---- 入口（订单卡/详情页入口位） ---- */
  'refund.entryCta': '退款/售后 ›',
  /* 在途申请存在时入口文案（→ /refunds/:id） */
  'refund.progressCta': '退款进度 ›',
  /* 商城 refunding 订单卡进度入口 */
  'refund.viewProgressCta': '查看进度 ›',
  /* 开关关闭时入口第三态（PD-12：不隐藏不报错，明文维护态） */
  'refund.maintainNotice': '退款申请通道维护中，请到店办理',
  /* 服务单详情页入口左侧提示（补缺大批片 1 · AppointmentDetailPage） */
  'refund.entryHint': '对已结账的服务单可申请退款',

  /* ---- 申请表单（/mall/orders/:id/refund 等） ---- */
  'refund.formTitle': '申请退款',
  'refund.originTitle': '原单信息',
  'refund.typeRefundOnly': '仅退款',
  'refund.typeReturnRefund': '退货退款',
  'refund.reasonLabel': '退款原因',
  'refund.reasonPlaceholder': '请选择退款原因',
  'refund.voucherHint': '有争议请附凭证照片，门店审核更快',
  'refund.photoCta': '添加照片',
  'refund.descPlaceholder': '补充说明（选填）',
  'refund.amountLabel': '申请金额',
  'refund.submitCta': '提交申请',
  'refund.submitDone': '退款申请已提交',
  /* 直访异常态（原单不可退/不存在/已有在途申请） */
  'refund.originNotFound': '原单不存在或无权查看',
  'refund.orderNotRefundable': '当前订单状态不可申请退款',
  'refund.inflightNotice': '本单已有在途的退款申请',
  /* 到店服务单直访异常态：尚未结账（无 cashierBillId）→ 诚实态（补缺大批片 1，
     取代 appointmentUnsupported 维护态——服务单入口已接通，仅未结账不可申请） */
  'refund.appointmentNoBill': '该服务单尚未结账，暂不可线上申请退款，如需退款请到店办理',
  'refund.backToOrigin': '返回原单详情',

  /* ---- 状态签（四档色纪律：不设绿） ---- */
  'refund.status.submitted': '审核中',
  'refund.status.processing': '处理中',
  'refund.status.refunding': '退款中',
  'refund.status.settled': '已到账',
  'refund.status.rejected': '已驳回',
  'refund.status.cancelled': '已撤回',

  /* ---- 进度详情（/refunds/:id） ---- */
  'refund.detailTitle': '退款详情',
  'refund.timelineTitle': '进度',
  'refund.rejectedLabel': '驳回原因',
  'refund.refundNoLabel': '退款单号',
  'refund.requestNoLabel': '申请单号',
  'refund.cancelCta': '撤回申请',
  'refund.cancelConfirm': '确定撤回这次退款申请？',
  'refund.cancelDone': '退款申请已撤回',
  'refund.notFound': '申请单不存在或无权查看',
  'refund.backToRefunds': '返回退款列表',

  /* ---- 时效公示卡（表单/详情同款；数值=configView 端口插值） ---- */
  'refund.timingTitle': '退款时效与路径',
  /* 端口无 d1/d2 两键——按任务书先以 1/5 常量插值（已报备），端口补键后改读端口 */
  'refund.timingBody': '原路退回：微信/支付宝 T+{d1}~{d2} 个工作日到账；现金到店退回。',
  'refund.freeRegretNotice': '服务完成 {hours} 小时内申请，全额原路退',
  'refund.partialNotice': '支持按行部分退款，按行明细见下',
  'refund.slaNotice': '门店 {hours} 小时内必复',

  /* ---- 列表（/refunds） ---- */
  'refund.listTitle': '退款/售后',
  'refund.loadFail': '退款信息加载失败，请检查网络后重试',
  /* 空态三句话（题/说明/出口） */
  'refund.emptyTitle': '没有退款申请',
  'refund.emptyBody': '对已完成的服务或商品单，可在详情页申请退款/售后',
  'refund.emptyCta': '去看看订单 ›',
} as const;

export type RefundCopyKey = keyof typeof REFUND_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rc(key: RefundCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = REFUND_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
