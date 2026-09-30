/**
 * 预约（booking）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：BookingSuccessPage（成功页）、BookingGroomingPage/BookingBoardingPage（旧向导）、
 * GroomingSinglePage/BoardingSinglePage（单屏族）、booking 组件族
 * （PetPicker/StaffPicker 与 single/* 区块）。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：价格/晚数/次数/时刻等到渲染层读端口插值（{var} 模板）。
 */

export const BOOKING_COPY = {
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
} as const;

export type BookingCopyKey = keyof typeof BOOKING_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function bkc(key: BookingCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = BOOKING_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
