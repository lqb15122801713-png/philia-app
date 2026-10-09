/**
 * 预约（booking）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：BookingSuccessPage（成功页）、BookingGroomingPage/BookingBoardingPage（旧向导）、
 * GroomingSinglePage/BoardingSinglePage（单屏族）、booking 组件族
 * （PetPicker/StaffPicker 与 single/* 区块）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：价格/晚数/次数/时刻等到渲染层读端口插值（{var} 模板）。
 */

import { withCopyOverrides } from '@philia/shared';

const BOOKING_COPY_TABLE = {
  /* ---- 成功页 /booking/success ---- */
  'booking.successTitle': '预约成功',
  'booking.successSub': '已自动确认，请按时到店并出示预约码',
  'booking.missingParam': '缺少预约参数',
  'booking.summaryLoadFail': '预约摘要加载失败',
  'booking.codeTitle': '到店核销码',
  'booking.viewAppointments': '查看我的预约',
  'booking.backHome': '返回首页',
  'booking.addCalendar': '添加到日历',
  'booking.rescheduleLink': '需要改期？前往预约详情改期 ›',
  'booking.cancelNote': '{week}见 · 如需取消请提前 4 小时',

  /* ---- 页题（向导 / 单屏共用） ---- */
  'booking.groomingTitle': '预约洗护',
  'booking.boardingTitle': '预约寄养',
  'booking.toBoarding': '寄养 ›',
  'booking.toGrooming': '洗护 ›',

  /* ---- 缺项点名（单屏确认条三态，顺序同屏面区块） ---- */
  'booking.needPet': '请先建立宠物档案',
  'booking.choosePet': '请选择宠物',
  'booking.chooseStore': '请选择门店',
  'booking.chooseService': '请选择服务',
  'booking.chooseTime': '请选择时间',
  'booking.chooseCheckin': '请选择入住日期',
  'booking.chooseCheckout': '请选择退房日期',
  'booking.chooseRoom': '请选择房型',
  'booking.noRoom': '该门店暂无寄养房型',

  /* ---- 空宠物建档岔路卡（向导 + PetPicker/PetCardBlock 同族） ---- */
  'booking.noPetTitle': '还没有宠物档案',
  'booking.noPetBodyWizard': '预约前需要先为毛孩子建立档案',
  'booking.noPetBodyBoarding': '预约寄养前需要先为毛孩子建立档案',
  'booking.noPetBodyPicker': '先为毛孩子建一份档案，再来预约吧',
  'booking.noPetCta': '先建立宠物档案',
  'booking.noPetCtaPicker': '去建宠物档案',
  'booking.noPetSkip': '随便看看',

  /* ---- 单屏族区块 ---- */
  'booking.petPickHintGrooming': '点按选择要洗护的毛孩子',
  'booking.petPickHintBoarding': '点按选择要寄养的毛孩子',
  'booking.staffNote': '指定洗护师会写在预约备注里传达给门店',

  /* ---- 洗护师横卡（随缘派单） ---- */
  'booking.staffAny': '随缘派单',
  'booking.staffAnyCard': '随缘',
  'booking.staffAnySub': '门店安排',
  'booking.staffEarliest': '最早可约 {time}',

  /* ---- 服务 / 房型状态（空态与异常态一句话） ---- */
  'booking.noGroomingWizard': '该门店暂无可约洗护服务，去下一步换家门店看看',
  'booking.noGroomingSingle': '该门店暂无可约洗护服务，换家门店看看',
  'booking.roomLoadFail': '房型加载失败，请检查网络',
  'booking.roomEmpty': '该门店暂无寄养房型，换一家看看',

  /* ---- 旧向导寄养门店行 ---- */
  'booking.storeLinePre': '寄养门店：',
  'booking.storeLinePost': '（可在下一步更换）',

  /* ---- 次卡收款提示（规则明面） ---- */
  'booking.passHint': '剩余 {remain} 次 · 预约确认后扣 1 次',
  'booking.passNone': '暂无可用次卡',

  /* ---- 疫苗硬校验（寄养规则明面） ---- */
  'booking.vaccineRule': '寄养要求疫苗有效期覆盖至退房日（{date}）',
  'booking.vaccineBlockedUntil': '疫苗有效期至 {date}，已不满足寄养要求',
  'booking.vaccineBlockedNone': '档案中还没有疫苗有效期记录',
  'booking.vaccineBlockedSuffix': '，寄养需疫苗在有效期内',
  'booking.vaccineFix': '去补录',

  /* ---- 体验大批片 2：附加项（addon 服务多选，确认条价=主价+Σ附加） ---- */
  'booking.addonTitle': '附加项（选加）',
  'booking.addonSummaryNone': '选加附加项',
  'booking.addonSummary': '已选 {count} 项',
  'booking.addonPriceNote': '合计含附加项，最终金额以门店结算为准',

  /* ---- 体验大批片 2：满档留口（fullAlternatives 定死 enabled=false，只渲染注记） ---- */
  'booking.fullSlotFallback': '当日已约满，可改选其他日期或门店',

  /* ---- 体验大批片 2：门店计数诚实口径注记（StoreLineBlock 下，读 listNearby 计数） ---- */
  'booking.storeCountNote': '当前仅 {count} 家门店可约，通用范围以门店列表为准',

  /* ---- 体验大批片 2：寄养折叠区（紧急联系人 / 遛弯次数 / 协议勾选闸） ---- */
  'booking.emergencyTitle': '紧急联系人（建议填写）',
  'booking.ecNamePh': '联系人姓名',
  'booking.ecPhonePh': '11 位手机号',
  'booking.ecRelationPh': '关系，如：家人',
  'booking.ecPhoneInvalid': '请输入 11 位手机号',
  'booking.ecIncomplete': '请补全紧急联系人信息',
  'booking.walkTimesLabel': '每日遛弯次数（选填）',
  'booking.walkTimesPh': '如：2',
  'booking.needMedicalAuth': '请阅读并勾选医疗授权',
  'booking.needBoardingConsent': '请阅读并勾选寄养协议',

  /* ---- 体验大批片 2：成功页协议签署入口（寄养单） ---- */
  'booking.successSignEntry': '寄养协议与医疗授权',
  'booking.successSignView': '查看全文 ›',
  'booking.signedBadge': '已签署',
  'booking.signPendingNote': '本单尚未完成签署，请到店补签',
  /* 微光正名批片 2（C 股 3 栅格随档放宽）：整月日历注记=档口径读（days=服务端透出 advanceDays） */
  'booking.advanceNote': '可约期为未来 {days} 天（按档），更多日期敬请期待',
} as const;

export const BOOKING_COPY = withCopyOverrides(BOOKING_COPY_TABLE);

export type BookingCopyKey = keyof typeof BOOKING_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function bkc(key: BookingCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = BOOKING_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
