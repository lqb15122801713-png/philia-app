/**
 * 账户安全域文案键表（补缺大批片 2 · copy key 一期硬约定，纪律同 copy/mall.ts）
 *
 * 纪律：设置/注销流/换绑流/申诉/设备/隐私六页界面文案（屏题/说明/CTA/空态/弹层/反馈）
 * 一律经本表取值，组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口
 * schema 的种子键集，键名小写点分、冻结不改。
 *
 * R13 敏感字段必填须解释「为什么要」（冻结口径，文案入键）：
 * - bind.whyCode    换绑页：为什么要验证码；
 * - appeal.whyPhoto 申诉页：为什么要身份证明；
 * - deact.whyReview 注销页：为什么要门店复核。
 *
 * 数值不进本表：倒计时秒数/数量/时刻等到渲染层插值。
 */

export const ACCOUNT_COPY = {
  /* ---- 设置 /me/settings ---- */
  'settings.title': '设置',
  'settings.pushLabel': 'SETTINGS',
  'settings.groupAccount': '账号安全',
  'settings.groupGeneral': '设备与隐私',
  'settings.phoneBind': '手机号换绑',
  'settings.appeal': '换绑申诉',
  'settings.appealSub': '原号已不可用？门店协助换绑',
  'settings.devices': '登录设备管理',
  'settings.privacy': '权限与隐私',
  'settings.logout': '退出登录',
  'settings.logoutSub': '退出后需重新登录',
  'settings.groupDanger': '危险操作',
  'settings.deactivate': '注销账号',
  'settings.deactivateSub': '门店复核后生效，不可撤销',
  'settings.logoutFail': '退出失败，请稍后再试',
  'settings.loadFail': '账号信息加载失败，请检查网络后重试',

  /* ---- 注销流 /me/settings/deactivate ---- */
  'deact.pushLabel': 'DEACTIVATE',
  'deact.title': '注销账号',
  'deact.loadFail': '注销状态加载失败，请检查网络后重试',
  'deact.blockTitle': '暂时无法注销',
  'deact.blockBody': '以下事项尚未完结，处理完成后即可申请注销：',
  'deact.blockGo': '去完成 ›',
  'deact.blockNote': '预约、订单与退款完结前，账号不能注销。',
  'deact.impactTitle': '注销后，这些将立即变化',
  'deact.impactRebate': '回馈金清零',
  'deact.impactRebateDesc': '账户内回馈金余额全部清零，不可恢复',
  'deact.impactMember': '会员档终止',
  'deact.impactMemberDesc': '会员身份与全部权益即刻终止，不退折算费用',
  'deact.impactPets': '宠物档案删除',
  'deact.impactPetsDesc': '宠物档案将被删除，门店历史服务记录保留',
  'deact.keepNote': '订单与服务留痕将依法保留，注销 ≠ 删除数据。',
  'deact.reviewNote': '提交后由门店复核，复核通过账号注销生效。',
  /* R13：为什么要门店复核（敏感操作解释，入键） */
  'deact.whyReview': '为什么要门店复核：注销会清零回馈金、终止会员并删除宠物档案，且不可撤销。门店复核是为确认这是本人真实意愿，避免账号被盗后被恶意注销。',
  'deact.ctaSubmit': '确认注销账号',
  /* 补缺修复小批 UX 销项：第二框标题与第一框 CTA 重复 → 差异化（再次确认问句） */
  'deact.confirmTitle': '再次确认注销账号？',
  'deact.confirmBody': '注销后回馈金清零、会员档终止、宠物档案删除。此操作不可撤销，复核通过即生效。',
  'deact.confirmOk': '我已知晓，确认注销',
  'deact.confirmCancel': '再想想',
  'deact.successTitle': '注销申请已提交',
  'deact.successBody': '门店复核期间账号可正常使用；复核通过后账号注销，期间可随时撤回。',
  'deact.inflightTitle': '注销申请审核中',
  'deact.inflightBody': '门店正在复核你的注销申请，期间账号可正常使用。',
  'deact.submittedAt': '提交于 {time}',
  'deact.cancel': '撤回注销申请',
  'deact.cancelPending': '正在撤回…',
  'deact.cancelOk': '注销申请已撤回',
  'deact.cancelFail': '撤回失败，请稍后再试',
  'deact.rejectedTitle': '注销申请被驳回',
  'deact.rejectedPrefix': '驳回原因',
  'deact.approvedNote': '账号已注销，正在前往登录页…',
  'deact.submitFail': '提交失败，请稍后再试',
  'deact.submitting': '提交中…',

  /* ---- 换绑流 /me/settings/phone ---- */
  'bind.pushLabel': 'CHANGE PHONE',
  'bind.title': '手机号换绑',
  'bind.step1Title': '① 验证原手机号',
  'bind.currentPhone': '当前绑定手机号',
  /* R13：为什么要验证码（敏感字段解释，入键） */
  'bind.whyCode': '为什么要验证码：手机号是登录与找回账号的唯一凭证，换绑前须确认原号和新号都在你手上，防止账号被他人改绑盗用。',
  'bind.sendCode': '获取验证码',
  'bind.sending': '发送中…',
  'bind.resendIn': '{sec}s 后重发',
  'bind.sentOk': '验证码已发送',
  'bind.sendFail': '发送失败，请稍后再试',
  'bind.devEcho': '内测模拟码：{code}',
  'bind.devEchoNote': '内测期为模拟通道，验证码直接显示在这里；正式短信通道接入后此区域消失。',
  'bind.codePlaceholder': '输入 6 位验证码',
  'bind.step2Title': '② 绑定新手机号',
  'bind.newPhoneLabel': '新手机号',
  'bind.newPhonePlaceholder': '输入 11 位新手机号',
  'bind.submit': '确认换绑',
  'bind.submitting': '换绑中…',
  'bind.submitFail': '换绑失败，请稍后再试',
  'bind.phoneInvalid': '请输入 11 位手机号',
  'bind.codeInvalid': '请输入 6 位数字验证码',
  'bind.needOldCode': '请先获取并输入原手机号验证码',
  'bind.successTitle': '换绑成功',
  'bind.successBody': '订单、会员、回馈金、宠物档案等全部数据已保留，新手机号即刻生效。',
  'bind.backSettings': '返回设置',
  'bind.noPhoneTitle': '当前账号未绑定手机号',
  'bind.noPhoneBody': '无法自助换绑，请走换绑申诉通道由门店协助处理',
  'bind.noPhoneCta': '去换绑申诉 ›',

  /* ---- 申诉 /me/settings/phone/appeal ---- */
  'appeal.pushLabel': 'APPEAL',
  'appeal.title': '换绑申诉',
  'appeal.intro': '原手机号已不可用（停用/丢失）时，提交申诉由门店协助换绑。',
  'appeal.oldPhoneLabel': '原手机号',
  'appeal.newPhoneLabel': '新手机号',
  'appeal.newPhonePlaceholder': '输入 11 位新手机号',
  /* R13：为什么要身份证明（敏感字段解释，入键） */
  'appeal.whyPhoto': '为什么要身份证明：申诉通道不需要原号验证码，门店必须凭身份证明材料确认操作人是账号本人，防止账号被冒名改绑。',
  'appeal.photoTitle': '身份证明材料',
  'appeal.photoHint': '手持证件照或证件照片，最多 3 张',
  'appeal.addPhoto': '添加照片',
  'appeal.uploading': '上传中…',
  'appeal.uploadFail': '图片上传失败，请重试',
  'appeal.photoLimit': '最多上传 3 张',
  'appeal.removePhoto': '移除',
  'appeal.noteLabel': '情况说明',
  'appeal.notePlaceholder': '简述原号停用原因，方便门店核实（必填）',
  'appeal.noteRequired': '请填写情况说明',
  'appeal.phoneInvalid': '请输入 11 位新手机号',
  'appeal.submit': '提交申诉',
  'appeal.submitting': '提交中…',
  'appeal.submitFail': '提交失败，请稍后再试',
  'appeal.successTitle': '申诉已提交',
  'appeal.successBody': '门店核实材料后处理，结果与备注可在下方申诉记录查看。',
  'appeal.listTitle': '申诉记录',
  'appeal.loadFail': '申诉记录加载失败，请检查网络后重试',
  'appeal.emptyTitle': '还没有申诉记录',
  'appeal.emptyBody': '原手机号还能正常收码时，自助换绑更快',
  'appeal.emptyCta': '去自助换绑 ›',
  'appeal.statusSubmitted': '审核中',
  'appeal.statusApproved': '已通过',
  'appeal.statusRejected': '已驳回',
  'appeal.decidePrefix': '门店备注',
  'appeal.linePhones': '{old} → {new}',

  /* ---- 设备 /me/settings/devices ---- */
  'device.pushLabel': 'DEVICES',
  'device.title': '登录设备管理',
  'device.loadFail': '设备信息加载失败，请检查网络后重试',
  'device.listTitle': '登录设备',
  'device.current': '当前设备',
  'device.lastSeen': '最近活跃 {time}',
  'device.firstSeen': '首次登录 {time}',
  'device.unnamed': '未命名设备',
  'device.logsTitle': '换绑记录',
  'device.channelSelf': '自助换绑',
  'device.channelAssisted': '门店协助',
  'device.logLine': '{old} → {new}',
  /* 空态三句话（无换绑记录）：是什么 / 为什么 / 去哪 */
  'device.emptyTitle': '还没有换绑记录',
  'device.emptyBody': '手机号每次换绑都会在这里留痕，方便核对账号变动',
  'device.emptyCta': '返回设置',

  /* ---- 隐私 /me/settings/privacy ---- */
  'privacy.pushLabel': 'PRIVACY',
  'privacy.title': '权限与隐私',
  'privacy.notifyTitle': '消息通知',
  'privacy.notifyDesc': '预约进度、退款结果等实时提醒',
  'privacy.notifyUnread': '当前有未读通知',
  'privacy.notifyOffHint': '关闭后，预约进度与退款结果请在订单页查看',
  'privacy.locationTitle': '定位',
  'privacy.locationDesc': '用于展示附近门店距离',
  'privacy.locationOffHint': '关闭不影响预约与下单',
  'privacy.locationNote': '当前版本无定位功能消费点：门店距离展示走门店地址，不取您的定位。',
  'privacy.toggleFail': '设置失败，请重试',
  'privacy.footnote': '拒绝授权不影响基本功能使用（《个人信息保护法》最小必要口径）。',
} as const;

export type AccountCopyKey = keyof typeof ACCOUNT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function acc(key: AccountCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = ACCOUNT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
