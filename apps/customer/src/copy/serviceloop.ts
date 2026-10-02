/**
 * 服务闭环域文案键表（补缺大批片 4 · 客户端；纪律同 appointments.ts / mall.ts）
 *
 * 覆盖五域：相册 album.*（MomentsPage /philia/moments + 各入口）、证书 cert.*
 * （/philia/certs 列表与详情）、报告 report.*（/philia/reports/:appointmentId）、
 * 工单 ticket.*（小棉花 /support*）、发票 inv.*（/invoice/apply、/invoices*）。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：时刻/金额/计数/门店名等到渲染层读数据插值（{var} 模板）；
 * moments.ts 既有相册键本片全量迁入 album.*（值逐字保留，含 smoke 锚点「服务相册」）。
 */

export const SL_COPY = {
  /* ---- 服务相册 album.*（/philia/moments；迁入自 copy/moments.ts，值逐字保留） ---- */
  'album.title': '服务相册',
  'album.loadFail': '相册加载失败',
  /* 空态三句话（题/说明/出口；R1/R6） */
  'album.emptyTitle': '相册还是空的',
  'album.emptyBody': '完成洗护服务后，前后对比照会自动收进这里',
  'album.emptyCta': '去预约洗护',
  /* 分享（Web Share / 复制链接兜底；仅完成单卡片） */
  'album.shareCta': '分享这份美好',
  'album.shareCopied': '链接已复制',
  'album.shareTitle': '{pet}的变美记录',
  'album.shareText': '{date} 在菲丽亚完成了{service}，看看前后对比！',
  /* 进行中卡片行注（in_service 单仅透出已确认 done 步照片，口径见 server albumFeed） */
  'album.inProgressNote': '进行中 · 已确认 {n} 步',
  /* 卡面兜底名（数据缺省时的克制回退） */
  'album.petFallback': '毛孩子',
  'album.serviceFallback': '洗护服务',
  'album.photoAlt': '{pet}服务后照片',
  /* 入口行（MePage 功能网格 / PetsPage 洗护史区） */
  'album.meEntryTitle': '服务相册',
  'album.meEntrySub': '美好瞬间',
  'album.petsEntry': '服务相册 ›',

  /* ---- 安心证书 cert.*（/philia/certs + /philia/certs/:appointmentId） ---- */
  'cert.listTitle': '安心证书',
  'cert.cardTitle': '安心证书',
  'cert.loadFail': '证书加载失败，请稍后重试',
  /* 空态三句话（出口=服务相册） */
  'cert.emptyTitle': '还没有安心证书',
  'cert.emptyBody': '完成洗护后，门店会为宝贝生成专属安心证书',
  'cert.emptyCta': '去看看服务相册',
  'cert.backList': '返回证书列表',
  /* 卡面件 */
  'cert.brandMark': 'PHILIA',
  'cert.stepPhotos': '{count} 张',
  /* 留痕行（mono；generatedAt/deliveredAt 为渲染层 fmtDateTime 插值） */
  'cert.traceLine': '生成于 {generatedAt} · 送达 {deliveredAt}',
  /* 入口（预约详情已完成单操作区 / PetsPage 服务履历位） */
  'cert.detailEntry': '安心证书 ›',
  'cert.entryTitle': '安心证书',

  /* ---- 美容报告 report.*（/philia/reports/:appointmentId） ---- */
  'report.title': '美容报告',
  'report.loadFail': '报告加载失败，请稍后重试',
  'report.vitalsTitle': '本次体征',
  /* 体征五项 label（按 vital.key 取，server 快照 label 兜底） */
  'report.vitalWeight': '体重',
  'report.vitalSkin': '皮肤',
  'report.vitalEar': '耳朵',
  'report.vitalCoat': '被毛',
  'report.vitalNail': '指甲',
  /* 三态 pill + 补缺修复小批 UX 销项：unrecorded 未记录中性签（弱色，缺项不再挂「正常」） */
  'report.statusNormal': '正常',
  'report.statusAttention': '注意',
  'report.statusAbnormal': '异常',
  'report.statusUnrecorded': '未记录',
  /* 体征值缺省（server 留痕口径：缺省项 note='本次未记录'） */
  'report.notRecorded': '本次未记录',
  'report.abnormalTitle': '异常提示',
  'report.nextAdviceTitle': '下次护理建议',
  /* 承诺句 */
  'report.promiseLine': '美容报告 30 分钟内送达',
  'report.traceLine': '生成于 {generatedAt} · 送达 {deliveredAt}',
  /* 入口（预约详情已完成单操作区） */
  'report.detailEntry': '美容报告 ›',

  /* ---- 客服工单 ticket.*（小棉花：/support、/support/new、/support/:id） ---- */
  'ticket.listTitle': '小棉花客服',
  'ticket.newTitle': '联系小棉花',
  'ticket.detailTitle': '工单详情',
  'ticket.loadFail': '工单加载失败，请稍后重试',
  /* 空态三句话（出口=写工单） */
  'ticket.emptyTitle': '还没有工单',
  'ticket.emptyBody': '建议、吐槽或表扬，都可以告诉小棉花',
  'ticket.emptyCta': '写一封给小棉花',
  'ticket.backList': '返回工单列表',
  /* 类型四枚举 */
  'ticket.typeLabel': '类型',
  'ticket.typeSuggest': '提建议',
  'ticket.typeComplaint': '要吐槽',
  'ticket.typePraise': '表扬',
  'ticket.typeOther': '其他',
  /* 表单件 */
  'ticket.storeLabel': '相关门店',
  'ticket.storeRequired': '请选择相关门店',
  'ticket.descLabel': '问题描述',
  'ticket.descPlaceholder': '发生了什么？说得越细，小棉花越好帮',
  'ticket.descRequired': '请填写问题描述',
  'ticket.photosLabel': '附图（选传，最多 3 张）',
  'ticket.photoAdd': '上传照片',
  'ticket.photoRemove': '移除',
  'ticket.contactLabel': '联系方式',
  'ticket.contactPlaceholder': '手机号，方便门店回电',
  /* 服务时间公示（{hours}=serviceHours 端口值；端口无值时整卡不渲染，不上假时效） */
  'ticket.hoursTitle': '客服服务时间',
  'ticket.hoursLine': '人工服务时间 {hours}',
  'ticket.submit': '提交给小棉花',
  'ticket.submitting': '提交中…',
  'ticket.submitFail': '提交失败，请稍后重试',
  'ticket.uploadFail': '照片上传失败，请重试',
  /* 状态 pill */
  'ticket.statusSubmitted': '已提交',
  'ticket.statusReplied': '已回复',
  'ticket.statusClosed': '已关闭',
  /* 详情件 */
  'ticket.replyTitle': '门店回复',
  'ticket.timelineTitle': '处理进度',
  'ticket.timelineSubmitted': '工单已提交',
  'ticket.timelineReplied': '门店已回复',
  'ticket.timelineClosed': '工单已关闭',
  /* 入口（MePage 功能网格小棉花） */
  'ticket.meEntryTitle': '小棉花',
  'ticket.meEntrySub': '建议与吐槽',

  /* ---- 发票 inv.*（/invoice/apply/:kind/:id、/invoices、/invoices/:id） ---- */
  'inv.applyTitle': '申请发票',
  'inv.listTitle': '我的发票',
  'inv.detailTitle': '发票详情',
  'inv.loadFail': '加载失败，请稍后重试',
  /* 空态三句话（出口=我的预约） */
  'inv.emptyTitle': '还没有发票申请',
  'inv.emptyBody': '已支付的订单都可以申请开发票',
  'inv.emptyCta': '查看我的预约',
  'inv.backList': '返回发票列表',
  /* 原单摘要 */
  'inv.billSummaryTitle': '开票单据',
  'inv.billNo': '单号',
  'inv.store': '门店',
  'inv.kindAppointment': '洗护预约',
  'inv.kindOrder': '商城订单',
  'inv.kindCashier': '门店收银',
  /* R15 金额明面句（{amount}=来源单实付，渲染层 fenToYuan 插值，server 重算为准） */
  'inv.amountLine': '开票金额=订单实付 {amount}',
  'inv.amountLabel': '开票金额',
  /* 抬头 */
  'inv.titleTypeLabel': '抬头类型',
  'inv.titlePersonal': '个人',
  'inv.titleBusiness': '企业',
  'inv.titleLabel': '发票抬头',
  'inv.titlePlaceholderPersonal': '姓名或个人抬头',
  'inv.titlePlaceholderBusiness': '企业全称',
  'inv.titleRequired': '请填写发票抬头',
  /* 税号（企业条件必填 + R13 解释句） */
  'inv.taxNoLabel': '税号',
  'inv.taxNoPlaceholder': '统一社会信用代码',
  'inv.taxNoRequired': '企业抬头按税务规定须填税号',
  /* 送达 */
  'inv.deliveryLabel': '送达方式',
  'inv.deliveryEmail': '邮箱接收',
  'inv.deliveryPickup': '到店自取',
  'inv.emailLabel': '接收邮箱',
  'inv.emailPlaceholder': 'name@example.com',
  'inv.emailInvalid': '邮箱格式不正确',
  /* 诚实口径 */
  'inv.honestLine': '提交后门店为您开具',
  'inv.submit': '提交申请',
  'inv.submitting': '提交中…',
  'inv.submitFail': '提交失败，请稍后重试',
  /* 状态 pill */
  'inv.statusSubmitted': '申请中',
  'inv.statusIssued': '已开具',
  /* 入口（预约详情实付行后 / 商城订单卡操作区；在途或已开具单=进度入口） */
  'inv.applyEntry': '申请发票 ›',
  'inv.progressEntry': '发票进度 ›',
  /* 详情回显 */
  'inv.appliedAt': '申请于 {time}',
  'inv.issuedNoLabel': '发票号',
  'inv.issuedAtLine': '开具于 {time}',
  /* 来源单读不到/不可在线办（R10 诚实口径：收银单客户端无读口，不画假摘要） */
  'inv.billNotFound': '未找到该单据，无法申请开票',
  'inv.cashierUnsupported': '收银单开票请到店办理，或联系小棉花协助',
} as const;

export type ServiceLoopCopyKey = keyof typeof SL_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function sl(key: ServiceLoopCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SL_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
