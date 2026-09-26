/**
 * R11b 会员区文案键表（copy key 一期硬约定 · 38 号施工令 §三「凡内容皆留口」）
 *
 * 纪律：会员区四屏全部界面文案（屏题/卡面文案/权益名/规则明面/CTA/空态/弹层）
 * 一律经本表取值，组件内零硬编码文案；文案端口（18 号档 A4 升级版，连锁合批）建成后
 * 迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 *
 * 数值不进本表：价格/比例/折扣/天数等到渲染层读 member_plans 端口（38 号档 §二-①②）。
 */

export const MEMBER_COPY = {
  /* ---- A-3 会员页 · 持有态 ---- */
  'a3.headTitle': '会员',
  'a3.pushLabel': 'MEMBER',
  'a3.headNo': 'PHILIA CLUB',
  'a3.stampFrozen': '已冻结 · 续费即解冻',
  'a3.frozenTip': '回馈金余额保留但暂不可用，续费请到店收银台办理。',
  'a3.ledgerBalance': '回馈金余额',
  'a3.ledgerPending': '本期预计',
  'a3.ledgerSettleDay': '到账日',
  'a3.ledgerSettleDayValue': '每月 {day} 日',
  'a3.perksTitle': '{tier}权益',
  'a3.perksAllOn': '8 项全部生效',
  'a3.remindExpire': '{days} 天后到期 · 续费即解冻',
  'a3.ctaRenew': '续费{tier} · 每天 ¥{daily}',
  'a3.ctaOtherTier': '看看别的档 →',
  'a3.quitLink': '退会说明 ›',
  'a3.renewSheetTitle': '续费 · 到店办理',
  'a3.renewSheetBody': '内测期续费请到店收银台办理（现金/微信/支付宝）。到期不自动续费；续费后有效期顺延 {days} 天，冻结的回馈金同步解冻。',
  'a3.quitSheetTitle': '退会说明',
  'a3.quitSheetBody': '退会请联系门店办理。年费按剩余整月 × 月均价折算退回（内测期线下原路退回），回馈金余额清零、档位终止，全程留痕。',

  /* ---- J-01 会员办理页 ---- */
  'j1.pushLabel': '开通会员 · JOIN',
  'j1.guideNote': '点卡或滑卡选档——卡本身就是选择器：',
  'j1.perksFollow': '8 项 · 跟随选中档',
  'j1.tierRowPaid': '回馈金 {pct}% · 服务 {zhe} 折 · {pets}',
  'j1.ledgerDaily': '每天',
  'j1.ledgerYearly': '一年',
  'j1.ledgerPets': '多宠覆盖',
  'j1.petsIncluded': '含 {n} 只',
  'j1.estimateNote': '按门店年均消费测算，轻松省回年费',
  'j1.compareLink': '对比四档权益 ›',
  'j1.compareTitle': '四档权益对比',
  'j1.compareNote': '档色即身份',
  'j1.compareFooter': '四档共通：七节点全程可视 · 美容报告 30 分钟 · 安心包全员免费\n年费 ≠ 储值 · 到期不自动续费 · 权益只加不减',
  'j1.ctaOpen': '开通{tier} · 每天 ¥{daily}',
  'j1.ctaOpenFree': '免费注册 · 领个身份',
  'j1.ctaSub': '到期不自动续费 · 随时退卡',
  'j1.alreadyMember': '你已是会员（有效期至 {date}）。续费或升级请到店收银台办理。',
  'j1.backMember': '回会员中心 ›',
  'j1.freeOpenedTitle': '微光会员已开通',
  'j1.freeOpenedBody': '免费档即时生效{date}。升级萤火/烛光/暖阳可享商品回馈金与服务折扣，到店收银台即可办理。',
  'j1.storePayTitle': '请到店完成开通',
  'j1.storePayBody': '你已选定「{tier}会员（{price}）」。内测期请到店收银台付款开通（现金/微信/支付宝），成交即开通、有效期 {days} 天。',
  'j1.storePayStep1': '到店后告知收银员开通「{tier}会员」，报手机号即可。',
  'j1.storePayStep2': '收银台付款（支持现金/微信/支付宝），多宠家庭第 {n} 只起按 +¥{fen}/年/只 计入。',
  'j1.storePayStep3': '付款成交即开通，有效期 {days} 天；会员中心即时显示你的档位。',
  'j1.storePayNote': '内测期仅支持到店收银台开通；线上支付通道开通后将在本页直接开放。',
  'j1.storePayBack': '重新选档',
  'j1.storePayOk': '我知道了',

  /* ---- W-01 回馈金账本 ---- */
  'w1.pushLabel': '回馈金 · REBATE LEDGER',
  'w1.ringCenter': '本周期',
  'w1.balanceLabel': '可用余额',
  'w1.periodLine': '周期 {start} – {end} · {month} 月 {day} 日前到账',
  'w1.logsTitle': '明细',
  'w1.yearTotal': '本年累计 ¥{amount}',
  'w1.typeGrant': '消费回馈',
  'w1.typeDeduct': '回馈金抵扣',
  'w1.typeClawback': '退货扣回',
  'w1.typeFreeze': '冻结',
  'w1.typeClear': '清零',
  'w1.fallbackTitle': '{type} · 单号 {no}',
  'w1.emptyTitle': '回馈金是什么',
  'w1.emptyDesc': '每笔商品消费按档位比例返还，次月统一到账；仅抵商品、365 天有效。',
  'w1.emptyCta': '去商城逛逛',
  'w1.balanceFrozen': '已冻结 · 续费即解冻',

  /* ---- Q-01 会员码屏 ---- */
  'q1.pushLabel': '会员码 · MEMBER CODE',
  'q1.hint': '到店出示 · 店员扫码',
  'q1.refreshNote': '{mm}:{ss} 后自动刷新',
  'q1.codeFooter': '码面白底墨码，识别率优先 · 码每 5 分钟自动刷新',
  'q1.pendingTitle': '会员码扫码核销升级中',
  'q1.pendingBody': '到店报手机号即可享受会员权益；扫码核销通道开通后本页自动升级。',
  'q1.nonMemberPrice': '未开通',
  'q1.nonMemberClaim': '先领个身份，慢慢认识我们',
  'q1.nonMemberGuide': '还不是会员：微光档免费，一键开通即会员；付费档到店收银台办理。',
  'q1.nonMemberCta': '开通会员 ›',
  'q1.passTitle': '次卡余额',
  'q1.passUnit': '次',
  'q1.passRemain': '剩余 {remain} 次 / 共 {total} 次',
  'q1.passStoreFallback': '菲丽亚门店',
  'q1.passEmpty': '暂无次卡。次卡余额为实时数据。',

  /* ---- 权益墙 8 枚（档跟随） ---- */
  'perk.pets': '多宠覆盖',
  'perk.petsSub': '含 {n} 只',
  'perk.discount': '服务折扣',
  'perk.discountSub': '{zhe} 折',
  'perk.discountNone': '门市价',
  'perk.rebate': '回馈金',
  'perk.rebateSub': '{pct}%',
  'perk.rebateNone': '—',
  'perk.groomer': '专属洗护师',
  'perk.groomerSub': '点名安排',
  'perk.birthday': '生日礼遇',
  'perk.birthdaySub': '年度特辑',
  'perk.skin': '皮毛检测',
  'perk.skinSub': '每季一次',
  'perk.boarding': '寄养折扣',
  'perk.boardingSub': '9 折',
  'perk.archive': '年度档案',
  'perk.archiveSub': '全年在册',

  /* ---- 卡面 ---- */
  'card.logo': 'PHILIA · LOVE BOND LIFE',
  'card.freePrice': '免费注册',
  'card.priceYear': '¥{price} / 年',
  'card.claimWeiguang': '先领个身份，慢慢认识我们',
  'card.claimYinghuo': '一年，省下一顿火锅',
  'card.claimZhuguang': '每月一次眼耳甲，不用记',
  'card.claimNuanyang': '含 3 只毛孩子 · 都被叫得出名字',

  /* ---- 通用 ---- */
  'common.memberLoadFail': '会员信息加载失败',
  'common.plansLoadFail': '档位信息加载失败',
  'common.rebateLoadFail': '回馈金账本加载失败',

  /* ---- 规则明面（红线 5：全量八条，数值读端口） ---- */
  'rules.title': '年费 ≠ 储值 · 到期不自动续费',
  'rules.r1': '回馈金比例 {pct}%（{tier}档）· 仅抵商品 · 单笔不设上限',
  'rules.r1Free': '微光免费档无回馈金 · 付费档 {pcts}% · 仅抵商品',
  'rules.r2': '上月 26 日 – 本月 25 日结算 · 次月 {day} 日前到账（故障顺延 ≤3 天并明示）',
  'rules.r3': '{days} 天有效 · 到期未续冻结 · 续费即解冻 · 退卡清零',
  'rules.r4': '回馈金不提现 · 不转让 · 不产息',
  'rules.r5': '用回馈金支付的部分不再返还',
  'rules.r6': '退货按退款比例扣回已返回馈金，余额不足扣至 0 不负账',
  'rules.r7': '回馈金 / 储值 / XP 三本账物理分离，均不计营业额',
  'rules.r8': '商品全员同价无会员价；服务折扣仅付费档生效',
} as const;

export type MemberCopyKey = keyof typeof MEMBER_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function mc(key: MemberCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = MEMBER_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
