/**
 * 经营总览域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：DashboardPage + dashboard/StatCards + dashboard/TodayTimeline + dashboard/TodoSection
 * + dashboard/TicketTodoSection + dashboard/InvoiceTodoSection（补缺大批片 4）。
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
  /* 客户退款申请待办（批次 C5 审批缝 · 计数=refundRequest.listPending 独立查询挂角标） */
  'dash.todoRefundRequestLabel': '客户退款申请',
  'dash.todoRefundRequestHint': '客户申请退款，待审批',
  /* 超期样例小字片段（mono 数字位在 JSX 内拼装，静片段入键——同 staff me.ts 先例） */
  'dash.todoOverdueLead': '应退未退',
  'dash.todoOverdueUnit': '天',
  'dash.todoOverdueToday': '今日到期未退',

  /* ---- 补缺大批片 4：TodoSection 增两行计数（可选 props 传入才渲染，clerk 不出现） ---- */
  'dash.todoTicketLabel': '客服工单',
  'dash.todoTicketHint': '客户反馈待回复',
  'dash.todoInvoiceLabel': '发票申请',
  'dash.todoInvoiceHint': '客户开票申请待登记',
  'dash.retry': '重试',
  'dash.cancel': '取消',

  /* ---- 客服工单待办块（TicketTodoSection）---- */
  'dash.ticketBlockTitle': '客服工单',
  'dash.ticketTypeSuggest': '建议',
  'dash.ticketTypeComplaint': '投诉',
  'dash.ticketTypePraise': '表扬',
  'dash.ticketTypeOther': '其他',
  'dash.ticketContactNone': '未留联系方式',
  'dash.ticketPhotoCount': '附图 {n} 张',
  'dash.ticketReplyCta': '回复',
  'dash.ticketReplyTitle': '回复工单 {no}',
  'dash.ticketReplyLabel': '回复内容（必填）',
  'dash.ticketReplyPlaceholder': '写下给客户的回复…',
  'dash.ticketReplyRequired': '请填写回复内容',
  'dash.ticketReplySubmit': '提交回复',
  'dash.ticketReplySubmitting': '提交中…',
  'dash.ticketReplySuccess': '已回复工单 {no}',
  'dash.ticketLoadFailed': '工单列表加载失败',

  /* ---- 发票申请待办块（InvoiceTodoSection）---- */
  'dash.invoiceBlockTitle': '发票申请',
  'dash.invoiceTitlePersonal': '个人',
  'dash.invoiceTitleBusiness': '企业',
  'dash.invoiceDeliveryEmail': '邮箱发送',
  'dash.invoiceDeliveryPickup': '到店自取',
  'dash.invoiceBillLead': '原单',
  'dash.invoiceTitleLead': '抬头',
  'dash.invoiceTaxNoLead': '税号',
  'dash.invoiceRegisterCta': '登记开票',
  'dash.invoiceRegisterTitle': '登记开票 {no}',
  'dash.invoiceAmountNote': '开票金额=订单实付 ¥{amount}',
  'dash.invoiceNoLabel': '实际发票号（必填）',
  'dash.invoiceNoPlaceholder': '输入已开具的发票号',
  'dash.invoiceNoRequired': '请填写实际发票号',
  'dash.invoiceRegisterSubmit': '确认登记',
  'dash.invoiceRegistering': '登记中…',
  'dash.invoiceRegisterSuccess': '已登记开票 {no}',
  'dash.invoiceLoadFailed': '发票申请列表加载失败',

  /* 换绑申诉待办块（批次 R13b 大片 2 · authSecurity.listPhoneAppeals/reviewPhoneAppeal） */
  'dash.appealBlockTitle': '换绑申诉',
  'dash.appealCountUnit': '笔',
  'dash.appealAssistCta': '协助换绑',
  'dash.appealRejectCta': '驳回',
  'dash.appealCancelCta': '取消',
  'dash.appealSlaOverdue': '超期',
  /* 协助换绑二次确认弹层（R15 明面句 + 核验说明必填，note 客户端可见） */
  'dash.appealAssistConfirmTitle': '协助换绑确认',
  'dash.appealAssistNotice': '确认已线下核验身份，换绑后数据全保留',
  'dash.appealAssistNoteLabel': '核验说明（必填，客户端可见）',
  'dash.appealAssistNotePlaceholder': '核验方式与结论留痕，如：已线下核对本人证件',
  'dash.appealAssistNoteRequired': '请先填写核验说明',
  'dash.appealAssistSubmit': '确认协助换绑',
  'dash.appealAssistSuccess': '已协助换绑，新手机号已生效',
  /* 驳回弹层（原因必填，客户端可见） */
  'dash.appealRejectTitle': '驳回换绑申诉',
  'dash.appealRejectNoteLabel': '驳回原因（必填，客户端可见）',
  'dash.appealRejectNotePlaceholder': '驳回原因将展示给客户',
  'dash.appealRejectNoteRequired': '请先填写驳回原因',
  'dash.appealRejectSubmit': '确认驳回',
  'dash.appealRejectSuccess': '已驳回该换绑申诉',
  /* TodoSection 申诉计数行 */
  'dash.todoAppealLabel': '换绑申诉',
  'dash.todoAppealHint': '手机号换绑申诉，待协助核验',
} as const;

export type DashCopyKey = keyof typeof DASH_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function dc(key: DashCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = DASH_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
