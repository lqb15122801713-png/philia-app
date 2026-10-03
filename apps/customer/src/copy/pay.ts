/**
 * 线上收单（pay）域文案键表（补缺大批片 6 · J-01 收银台页面流 · copy key 一期硬约定，
 * 纪律同 components/member/copy.ts）
 *
 * 覆盖：MemberCheckoutPage（确认订单 /member/checkout）、PayStatePage（支付态 /pay/:payNo）、
 * PayReconcilePage（掉单自助查询 /pay/reconcile）。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：金额/天数/只数等到渲染层读 pay.quote / member_plans 端口插值（{var} 模板）。
 *
 * 「储值」红线自审标注：本表全文 grep「储值」仅 1 处命中=agreement.not_prepaid 协议标题
 * 《年费≠储值明示》（冻结口径例外，协议标题本身含「储值」）；支付/会员费语境正文零命中。
 */

import { withCopyOverrides } from '@philia/shared';

const PAY_COPY_TABLE = {
  /* ---- Mock 水印（R10 最高水位：内测通道全程明示，页面/按钮/结果页三处同文案） ---- */
  'mock.watermark': '内测通道 · 演示支付，不会真实扣款',

  /* ---- 确认订单页 /member/checkout ---- */
  'checkout.pushLabel': '确认订单 · CHECKOUT',
  'checkout.title': '确认订单',
  'checkout.headNo': 'PHILIA PAY',
  'checkout.planLabel': '开通档位',
  'checkout.planPriceYear': '¥{price}/年',
  'checkout.validity': '有效期 {days} 天 · 到期不自动续费',
  'checkout.petCountLabel': '覆盖毛孩子',
  'checkout.petCountValue': '{n} 只',
  'checkout.petIncludedNote': '本档含 {n} 只 · 第 {from} 只起按 +¥{price}/只/年 计',
  'checkout.petMinus': '减少一只',
  'checkout.petPlus': '增加一只',
  'checkout.petExtra': '多宠附加 ¥{price}/只/年 ×{n}',
  'checkout.amountTitle': '金额明细',
  'checkout.amountPlan': '档价（一年）',
  'checkout.amountExtra': '多宠附加',
  'checkout.amountTotal': '应付',
  'checkout.timeoutNotice': '请在 {minutes} 分钟内完成支付，超时订单自动关闭',
  'checkout.quoteFail': '价格试算失败，请重试',
  'checkout.agreeTitle': '开通前请阅读并勾选',
  'checkout.agreeLabel': '我已阅读并同意',
  'checkout.agreeMissing': '三份协议全部勾选后才能去支付',
  'checkout.agreementSheetNote': '版本 {version}',
  'checkout.agreementGotIt': '知道了',
  'checkout.payCta': '去支付 ¥{amount}',
  'checkout.submitting': '正在创建支付单…',
  'checkout.createFail': '支付单创建失败，请稍后再试',
  /* 通道维护态 */
  'checkout.channelOffTitle': '线上支付通道维护中',
  'checkout.channelOffBody': '请到店收银台办理开通（现金/微信/支付宝）；线上通道恢复后本页自动开放。',
  'checkout.channelOffCta': '回开通页 ›',
  /* 异常/分流说明卡（不弹球，全给明示出口） */
  'checkout.missingPlanTitle': '缺少档位信息',
  'checkout.missingPlanBody': '请先到开通页选择档位，再进入确认订单。',
  'checkout.missingPlanCta': '去选档 ›',
  'checkout.freePlanTitle': '免费档无需支付',
  'checkout.freePlanBody': '微光档一键开通即可，无需进入支付流程。',
  'checkout.freePlanCta': '去一键开通 ›',
  'checkout.alreadyTitle': '你已是会员',
  'checkout.alreadyBody': '有效期至 {date}。续费或升级请到店收银台办理，线上换档将于后续批次开放。',
  'checkout.alreadyBodyFree': '免费档永久有效。升级付费档享回馈金与服务折扣，请到店收银台办理。',
  'checkout.alreadyCta': '去会员中心 ›',

  /* ---- 协议名（勾选行链接 + 弹层标题共用） ----
     「储值」红线例外标注：agreement.not_prepaid=《年费≠储值明示》为冻结口径协议标题，
     标题本身含「储值」属允许例外；三份协议正文均不含「储值」字（见 PAY_AGREEMENTS）。 */
  'agreement.member_service': '《会员服务协议》',
  'agreement.not_prepaid': '《年费≠储值明示》',
  'agreement.no_auto_renew': '《到期不自动续费告知》',

  /* ---- 支付态页 /pay/:payNo ---- */
  'state.pushLabel': '收银台 · PAY',
  'state.orderNo': '支付单号 {payNo}',
  'state.planLine': '{planLabel} · 覆盖 {n} 只',
  'state.amountLabel': '应付金额',
  'state.createdTitle': '支付单创建中',
  'state.createdBody': '正在向支付通道下单，请稍候片刻；本页每 2 秒自动刷新。',
  'state.payingTitle': '等待支付结果',
  'state.payingBody': '请在下方内测演示控制区完成演示支付；本页每 2 秒自动刷新支付状态。',
  'state.mockDemoLabel': '内测演示控制',
  'state.mockSuccess': '模拟支付成功',
  'state.mockFail': '模拟失败',
  'state.mockTimeout': '模拟超时',
  'state.mockDrop': '模拟掉单',
  'state.mockWorking': '演示指令执行中…',
  'state.mockFailToast': '演示指令发送失败，请重试',
  'state.paidTitle': '会员已开通',
  'state.paidBody': '{planLabel} · 有效期 {days} 天，权益即时生效。',
  'state.paidCta': '看看会员页 ›',
  'state.failedTitle': '支付未完成',
  'state.failHint': '本次支付未成功，未产生扣款；可重新发起支付。',
  'state.retry': '重新支付',
  'state.retrying': '正在重新下单…',
  'state.closedTitle': '订单已超时关闭',
  'state.closedHint': '超时未支付订单自动关闭，未产生扣款；可重新下单。',
  'state.reorder': '重新下单 ›',
  'state.reconcileEntry': '付了没开？点这里自助对账 ›',
  'state.loadFail': '支付状态加载失败',

  /* ---- 掉单自助查询 /pay/reconcile ---- */
  'reconcile.pushLabel': '自助对账 · RECONCILE',
  'reconcile.title': '付了没开？',
  'reconcile.hint': '已完成支付但会员未开通时，在下方找到对应支付单点「对账补开」，系统自动核对通道结果并补开。',
  'reconcile.listTitle': '我的支付单',
  'reconcile.btn': '对账补开',
  'reconcile.doing': '对账中…',
  'reconcile.success': '已补开成功',
  'reconcile.fail': '对账失败，请稍后再试',
  'reconcile.loadFail': '支付单列表加载失败',
  'reconcile.emptyTitle': '暂无支付单',
  'reconcile.empty1': '你还没有任何线上支付单。',
  'reconcile.empty2': '从开通页选择档位并确认订单后，支付单会出现在这里。',
  'reconcile.empty3': '已完成支付但会员未开通时，回到本页点「对账补开」即可自助补开。',
  'reconcile.emptyCta': '去开通会员 ›',

  /* ---- 支付单状态签 ---- */
  'payStatus.created': '创建中',
  'payStatus.paying': '待支付',
  'payStatus.paid': '已支付',
  'payStatus.failed': '支付失败',
  'payStatus.closed': '已关闭',
} as const;

export const PAY_COPY = withCopyOverrides(PAY_COPY_TABLE);

export type PayCopyKey = keyof typeof PAY_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pc(key: PayCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PAY_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/* ------------------------------------------------------------------ */
/* 协议三份（v1.0 · 全文快照随 createOrder 留痕，冻结口径：46 号档 / PD-07）      */
/*                                                                    */
/* 口径来源：                                                          */
/* - 会员服务协议：权益墙八项 + 回馈金规则明面八条（27 号档红线 5）+ 退会折算       */
/*   「剩余整月 × 月均价、精确到分」（CJ-0922-13 / PD-07 维持冻结）+ 退会后 90 天    */
/*   重购不享新客权益（PD-07 防滥用两件）+ 期内不降级、到期换档=开通（PD-07 §二）；   */
/* - 年费≠储值明示：年费=权益服务费（预付式消费服务费对价，PD-07 §四合规注记），      */
/*   非预存资金、不设个人资金账户、不计息、不提现、不按本金返还；                    */
/* - 到期不自动续费告知：到期不自动扣款、档位终止、回馈金冻结续费即解冻、             */
/*   续费到店或线上再购（27 号档 / PD-07 §二到期换档）。                          */
/* 正文「储值」红线自审：三份正文均不含「储值」字（表述用「预存资金/资金账户/本金」）； */
/* 仅协议标题《年费≠储值明示》含「储值」（冻结口径例外）。                         */
/* ------------------------------------------------------------------ */

export type PayAgreementKey = 'member_service' | 'not_prepaid' | 'no_auto_renew';

export interface PayAgreement {
  agreementKey: PayAgreementKey;
  /** 版本号（随 createOrder 快照留痕；文案修订即升版） */
  version: string;
  /** 展示名（copy 键） */
  titleKey: PayCopyKey;
  /** 协议全文（真实可读正文，非占位符；\n 分段） */
  content: string;
}

export const PAY_AGREEMENTS: readonly PayAgreement[] = [
  {
    agreementKey: 'member_service',
    version: 'v1.0',
    titleKey: 'agreement.member_service',
    content: `一、权益内容：会员权益按所购档位公示执行，包含商品消费回馈金、洗护与寄养服务折扣、多宠覆盖、专属洗护师、生日礼遇、皮毛检测、年度档案等；商品全员同价，不设会员价，服务折扣仅付费档生效。回馈金仅可抵扣商品消费，不提现、不转让、不计息，自到账起 365 天有效，到期未用自动失效；用回馈金支付的部分不再返还，退货按退款比例扣回已返部分。
二、有效期：会员有效期 365 天，自开通（或续费成交）之日起算；到期档位自动终止，不自动续费。
三、退会：可随时联系门店办理退会。退费按剩余整月 × 月均价折算、精确到分（月均价=实付年费 ÷ 12）；退会后回馈金余额清零、档位终止，全程留痕。退会后 90 天内重新购买不享新客权益。
四、档位变更：有效期内不支持降级；到期换档视同新开通，可在到期前预约下期档位。
五、权益调整：会员权益只加不减；门店服务规则如有调整，以门店公示与会员中心页面为准。
六、其他：会员资格限本人使用，不得转借转让；本协议未尽事宜，以门店公示规则为准。`,
  },
  {
    agreementKey: 'not_prepaid',
    version: 'v1.0',
    titleKey: 'agreement.not_prepaid',
    content: `一、费用性质：会员年费是会员权益服务费，是您购买有效期内会员权益（回馈金、服务折扣、多宠覆盖等）所支付的服务对价，于开通时一次性收取。
二、非预存资金：本费用不属于任何形式的预存资金，也非预付卡余额；支付后不为您设立个人资金账户，不计付利息，不可提现，不按本金形式返还。
三、回馈金说明：回馈金是消费后按档位比例返还的商品抵扣权益，仅限抵扣商品消费，不等同现金，不构成您的资金权益，余额不可兑换现金。
四、到期处理：会员到期后档位自动终止，未使用的回馈金随之冻结（续费即解冻）；年费不因权益未使用或未用满而退还。
五、退会折算：如因故退会，仅按《会员服务协议》约定的「剩余整月 × 月均价」口径折算退回，属于服务费的退结算，而非本金返还。
六、明示确认：您勾选本明示并完成支付，即表示已知悉并认可上述费用性质说明。`,
  },
  {
    agreementKey: 'no_auto_renew',
    version: 'v1.0',
    titleKey: 'agreement.no_auto_renew',
    content: `一、到期不自续：会员到期后不自动续费、不自动扣款；本店不保留、不启用任何免密支付或代扣授权，您的支付账户不会被周期性扣费。
二、到期影响：到期档位自动终止——服务折扣、专属洗护师等会员权益停止；回馈金余额冻结但不清零，续费后即时解冻恢复可用。
三、如何续费：到期前后均可续费——到店收银台办理（现金/微信/支付宝），或线上重新购买；续费成交后有效期自成交之日起顺延 365 天，回馈金账户同步解冻。
四、到期换档：到期换档视同新开通，可按当期档位价格与规则重新选择任意档位。
五、提醒方式：到期前会员中心页面将提示到期时间，请留意页面信息；是否续费完全由您自主决定。
六、明示确认：您勾选本告知并完成支付，即表示已知悉到期不自动续费的规则。`,
  },
] as const;
