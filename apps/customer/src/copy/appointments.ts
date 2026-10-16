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
  /* ---- 异常通报条（live 页高亮 · 体验批片 4） ---- */
  'appointments.incidentTitle': '异常通报',
  /* 异常类型三枚举 */
  'appointments.incidentTypeInjury': '受伤',
  'appointments.incidentTypeStress': '应激',
  'appointments.incidentTypeVetVisit': '就医',
  'appointments.incidentHandling': '门店处理中',
  'appointments.incidentOccurredAt': '发生于 {time}',
  /* 全部已处置暖底细条（{note}=最近一条处置说明） */
  'appointments.incidentHandledLine': '异常已处置：{note}',
  /* SSE 即时提示 */
  'appointments.incidentToastReported': '{pet}有异常通报，门店正在处理',
  'appointments.incidentToastHandled': '异常情况已处置，可下滑查看说明',
  'appointments.unsealToast': '{pet}的用品「{item}」已拆封使用',

  /* ---- 服务明细（详情页 · serviceStep.detailSheet） ---- */
  'appointments.detailSheetTitle': '服务明细',
  /* 分项状态徽 */
  'appointments.stepDone': '已完成',
  'appointments.stepDoing': '进行中',
  'appointments.stepPending': '待开始',
  'appointments.stepDuration': '{min} 分钟',
  /* 用料透出（诚实空态） */
  'appointments.materialsTitle': '耗材使用',
  'appointments.materialsEmpty': '本单无耗材扣减记录',
  'appointments.materialQty': '× {n}',

  /* ---- 寄养安心卡（boarding.assuranceCard） ---- */
  'appointments.assuranceTitle': '寄养安心卡',
  'appointments.assuranceRoom': '房间',
  'appointments.roomPending': '待分配',
  'appointments.assuranceWeight': '入住体重',
  'appointments.assuranceBelongings': '随身物品',
  'appointments.assuranceLatestLog': '最新打卡',
  'appointments.assuranceLogDone': '当日照护已完成打卡',
  'appointments.assuranceNoLog': '暂无打卡记录',
  'appointments.assuranceUnsealTitle': '拆封留痕',
  'appointments.assuranceUnsealEmpty': '暂无拆封记录',
  /* stay=null 空态（待入住登记） */
  'appointments.assuranceEmpty': '待入住登记',
  'appointments.assuranceEmptyBody': '店员办理入住后，房间、体重与物品清单会在这里更新',

  /* ---- 画布全屏批片 3（预约域三重屏入册抽键；默认值=改造前写死文案逐字） ---- */
  /* 我的预约：全部 + 五状态 Tab 名 + 卡内角标/数据兜底 */
  'appointments.tabPending': '待确认',
  'appointments.tabConfirmed': '已确认',
  'appointments.tabServing': '服务中',
  'appointments.tabHistory': '已完成',
  'appointments.tabCancelled': '已取消',
  /* D-60 静态 fallback（零迁移）：本键暂不宣称已入端口字典，后续允许迁移时再登记。 */
  'appointments.tabAll': '全部',
  'appointments.cardServingBadge': '● 进行中',
  'appointments.cardStoreFallback': '门店',
  'appointments.cardPetFallback': '毛孩子',

  /* 预约详情：预约信息卡题 + dt 标签群 */
  'appointments.infoTitle': '预约信息',
  'appointments.dtType': '类型',
  'appointments.dtService': '服务',
  'appointments.dtRoomType': '房型',
  'appointments.dtPet': '宠物',
  'appointments.dtTime': '时间',
  'appointments.dtAmount': '金额',
  'appointments.dtPaymentMode': '收款方式',
  'appointments.dtPaid': '实付',
  'appointments.paidSuffix': '（已付）',
  'appointments.dtCheckedIn': '到店核销',
  'appointments.dtCompletedAt': '完成时间',
  'appointments.dtNote': '备注',
  'appointments.dtWalkTimes': '遛弯次数',
  'appointments.dtId': '预约编号',
  'appointments.checkedInRoom': '已入住房间：{room}',

  /* 预约详情：服务相册卡内打标 */
  'appointments.albumPhotoCount': '{n} 张',
  'appointments.albumNoPhoto': '无需照片',
  'appointments.albumBeforeTag': '服务前',
  'appointments.albumAfterTag': '服务后',

  /* 预约详情：门店与导航卡 */
  'appointments.storeTitle': '门店',
  'appointments.navAmap': '高德导航',
  'appointments.navTencent': '腾讯地图',
  'appointments.callStore': '联系门店',

  /* 预约详情：操作区（改期/取消/退款/评价 + toast 群） */
  'appointments.cancelChipSchedule': '行程有变',
  'appointments.cancelChipTime': '时间不合适',
  'appointments.cancelChipPrice': '价格因素',
  'appointments.cancelChipOther': '其他',
  'appointments.cancelNotePh': '补充说明（选填，100 字以内）',
  'appointments.submitting': '提交中…',
  'appointments.rescheduleNeedDates': '请选择新的入住/退房日期',
  'appointments.toastCancelled': '预约已取消',
  'appointments.toastCancelRequested': '已提交取消申请，待门店审核',
  'appointments.cancelFailFallback': '取消失败，请稍后再试',
  'appointments.reviewThanks': '感谢评价！',
  'appointments.reviewFail': '评价提交失败',
  'appointments.rescheduleToast': '改期已提交，等待商家重新确认',
  'appointments.rescheduleFail': '改期失败，请稍后再试',
  'appointments.shareTitle': '菲丽亚服务相册',
  'appointments.shareText': '宝贝在菲丽亚完成了服务，全程照片可见～',
  'appointments.shareCopied': '链接已复制，快发给家人朋友吧',
  'appointments.shareCopyFail': '复制失败，请手动复制地址栏链接',
  'appointments.createdLine': '预约于 {date} {week} 创建',
  'appointments.fallbackService': '服务',
  'appointments.fallbackPet': '宠物',

  /* 洗护全程实时页：返回条题 + 摘要卡组装件（LiveHeader props 透传段） */
  'appointments.liveTitleGrooming': '洗护全程',
  'appointments.liveTitleBoarding': '寄养全程',
  'appointments.livePetFallback': '宝贝',
  'appointments.liveServiceGrooming': '洗护服务',
  'appointments.liveServiceBoarding': '寄养服务',
  'appointments.liveMetaStaff': '{staff}服务中',
  'appointments.liveMetaEta': '预计 {time} 完成',
  'appointments.liveMetaBoarding': '寄养中 · 第 {n} 天',

  /* 洗护全程实时页：六步流 active 步操作说明（LiveStepper description 槽位） */
  'appointments.liveStepsLoading': '正在接入服务进度…',
  'appointments.hintDisinfection': '工具消毒确认中，安心第一步',
  'appointments.hintPrecheck': '正在做预检，确认皮肤与毛发状态',
  'appointments.hintGrooming': '正在洗护美容，新照片会实时出现在这里',
  'appointments.hintDetail': '细节精修中，快要变美啦',
  'appointments.hintBeforeAfter': '正在做交付检查',
  'appointments.hintConfirm': '洗护师正在为您完成最后确认',

  /* 洗护全程实时页：SSE/评价/分享 toast 群 */
  'appointments.liveToastCheckin': '{date}打卡已更新，快看看{pet}的今天',
  'appointments.liveToastReopen': '商家重新开启了本次服务，可继续查看进度',
  'appointments.liveReviewThanks': '感谢评价，已转告门店与洗护师',
  'appointments.liveReviewFail': '评价提交失败，请稍后再试',
  'appointments.liveShareText': '{pet}在{store}完成了{service}，全程照片可见～',
  'appointments.liveShareStoreFallback': '菲丽亚',

  /* 洗护全程实时页：五态分支文案（状态机分支，不入块流） */
  'appointments.liveLoading': '加载中…',
  'appointments.liveErrTitle': '打不开这个进度页',
  'appointments.liveErrForbidden': '这不是你的预约哦，请确认登录的账号是否正确。',
  'appointments.liveErrNotFound': '找不到这个预约，可能链接有误或已被删除。',
  'appointments.liveErrBackCta': '回到我的预约',
  'appointments.livePendingTitle': '服务尚未开始',
  'appointments.liveCancelReviewTitle': '取消申请审核中',
  'appointments.liveCancelReviewBody': '门店正在处理你的取消申请，结果会第一时间通知你。',
  'appointments.livePendingBody': '预约时间 {time}，到店后出示预约码，店员核销后即可在这里看到{kind}全程。',
  'appointments.liveKindGrooming': '洗护',
  'appointments.liveKindBoarding': '寄养',
  'appointments.liveShowCode': '出示预约码',
  'appointments.liveCancelledTitle': '预约已取消',
  'appointments.liveCancelledBody': '这次没能相见，期待下次再约。',
  'appointments.liveRebook': '重新预约',
} as const;

export const APPOINTMENTS_COPY = withCopyOverrides(APPOINTMENTS_COPY_TABLE);

export type AppointmentsCopyKey = keyof typeof APPOINTMENTS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function apc(key: AppointmentsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = APPOINTMENTS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
