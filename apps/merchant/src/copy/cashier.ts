/**
 * 收银域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：CashierPage / CashierRecordsPage / CashierClosePage / CashierRefundsPage
 * + components/cashier/*（CartPanel/MemberSearch/MembershipPanel/PaySheet/HoldPanel/
 * OfflineBar/dialogs/BillDetailDialog/RefundDialog/RefundDetailDialog/DayClosePanels/
 * ImportLedgerPanel）。
 * 纪律：经营性文案（屏题副题/空态/收银·退款·日结操作引导与口径明面）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 * 数值不进本表：金额/次数/单数到渲染层读数据经 {var} 插值。
 * 不抽：toast 动态通知与错误透传、表单项 label、单据字段名、状态胶囊。
 */

export const CASHIER_COPY = {
  /* ---- 收银台主屏 /cashier ---- */
  'cashier.title': '收银台',
  'cashier.headTenderRef': '参考（不计入已收）',
  'cashier.cartEmpty': '点左侧商品或服务开单',
  'cashier.stockShort': '库存不足：余 {n} 件，结账将按实际库存扣减',
  'cashier.memberDiscountUnknown': '会员折扣由服务端结账时按档自动计算，折后价以成交为准（内测期档位读路径缺口）',
  'cashier.savingsCta': '开通萤火 ›',
  'cashier.offlineBar': '离线中 —— 结账将先本地暂存，恢复网络后自动补传',
  'cashier.offlineFlushing': '网络已恢复，正在补传暂存单…',
  'cashier.offlinePending': '暂存单待补传',
  'cashier.holdEmpty': '无挂单',
  'cashier.holdFooter': '点卡取单续结 · ⋯ 撤单（留痕）',
  'cashier.flowEmpty': '今日暂无流水',
  'cashier.memberSearchEmpty': '未找到会员，按散客结账',

  /* ---- 支付面板（PaySheet）---- */
  'cashier.payOfflineBar': '离线中 —— 确认后本地暂存，恢复网络自动补传',
  'cashier.payPassNoMember': '次卡扣次：散客不可用——先检索会员',
  'cashier.payPassNoCard': '该会员无可用次卡',
  'cashier.payPassNoGroom': '车内无洗护服务行（次卡仅洗护可用）',
  'cashier.payPassShort': '次卡余额不足：剩 {remain} 次 · 需 {need} 次',
  'cashier.payRebateNoProduct': '回馈金仅可抵商品——当单无商品行（服务/寄养行禁用回馈金段）',
  'cashier.payRebateZeroDue': '应收已为 0（次卡已全额抵扣）——无需回馈金段',
  'cashier.payRebateZeroBalance': '回馈金已到账余额为 0（本期预计次月到账后可用）',
  'cashier.paySvZeroDue': '应收已为 0（次卡已全额抵扣）——无需储值段',
  'cashier.payRebateCap': '回馈金金额须 ≤ min(商品行合计 ¥{prod}, 应收 ¥{due}{bal})，可混搭现金/扫码补足',
  'cashier.payRebateNote': '已到账余额 1:1 抵扣（本期预计在途回馈金次月到账后可用）；用回馈金付的部分不再返',
  'cashier.payGapOver': '超出 ¥{amt}——调低任一段金额后才可确认',
  'cashier.payGapUnder': '还差 ¥{amt}——补足后才可确认结账',
  'cashier.payComboRule': '可组合支付：Σ支付 = 应收 才放行确认',
  'cashier.payTenderNote': '已收口径=现金/微信/支付宝；次卡扣次 / 储值消费 / 回馈金抵扣单列，不计入今日已收',
  'cashier.payPassOnly': '全额次卡扣次——无需现金/扫码段（次卡单列，不计入已收）',
  'cashier.paySuccessBack': '3 秒后自动返回',
  'cashier.payNextCta': '再开一单',

  /* ---- 改价/优惠/撤单/反结账弹层（dialogs.tsx）---- */
  'cashier.priceNewNote': '新价 ¥{amt}（改价留痕，随单可查）',
  'cashier.discountOverNote': '优惠不能超过服务/商品行合计（预约行金额不参与优惠）',
  'cashier.voidNote': '撤单后单据留痕为「已撤单」，不会物理删除；仅未支付单可撤（已结账请店主用反结账）',
  'cashier.reverseNote':
    '冲正将自动生成关联冲正单（金额镜像负值，不计当日已收）：库存回补、预约回到待收款、 次卡/储值按原路回补；原单永存不涂改，仅挂「已冲正」灰签（双向可查）。',

  /* ---- 流水详情（BillDetailDialog）横幅尾注 ---- */
  'cashier.billReversalNote': ' · 金额镜像负值，不计入已收',
  'cashier.billReversedNote': ' · 不再计入已收（原单永存不涂改）',
  'cashier.billRefundDetailLink': '（详情见「退款」列表页）',

  /* ---- 收银流水 /cashier/records ---- */
  'cashier.recordsTitle': '收银流水',
  'cashier.recordsSub': '挂单 / 结账 / 撤单 / 冲正全留痕 · 共 {n} 单',
  'cashier.recordsEmpty': '当前筛选无流水——收银台结账后单据会出现在这里',

  /* ---- 日结 / 交接班 /cashier/close ---- */
  'cashier.closeTitle': '日结 / 交接班',
  'cashier.closeSub': '交接班=闭班不冻结 · 日结=冻结当班账目 · 反结账（拆箱）仅店主',
  'cashier.closeShiftConfirmTitle': '交接班确认',
  'cashier.closeShiftConfirmBody':
    '交接班=关闭当前班次（不冻结账目）；下一笔收银将自动开新班。 如需冻结当班账目，请用「日结」。',
  'cashier.shiftEmpty': '当前无开班班次 —— 首笔收银将自动开班（懒建）',
  'cashier.dayCloseFullNote': '全日口径：当前无开班班次也可日结（账面按当日全部支付段计）',
  'cashier.refundDayAside': '当日净额=已收−退款 · 历史日结封箱不回填（只读）',
  'cashier.refundCrossDayNote': '跨日退款计入退款发生日日结（V7）；已封箱历史日结单不回填，只读留痕。',
  'cashier.dayCloseListAside': '冲正单与原单双向可查 · 原单永存不涂改',
  'cashier.dayCloseEmpty': '暂无日结单 —— 上方表单完成首次日结',
  'cashier.reverseCloseNote':
    '拆箱将生成冲正关联单（含前后值快照/操作人/时间/原因），原日结单永存不涂改（置「已冲正」）；之后可对同日重新日结（全日口径）。',
  'cashier.adjustNote': '备注追加进调整记录留痕，原冻结数字不涂改。',

  /* ---- 退款单 /cashier/refunds + RefundDialog / RefundDetailDialog ---- */
  'cashier.refundsTitle': '退款单',
  'cashier.refundsSub': '退款 ≠ 反结账 · 经营行为计退款单列 · 当日净额=已收−退款 · 原单永存不涂改',
  'cashier.refundsGuideTitle': '退款单由店长或店主处理',
  'cashier.refundsGuideHint': '退款发起与实退登记属管理层动作；店员账号的工作面是收银台。',
  'cashier.refundsPendingBold': '笔退款超 24 小时未登记实退',
  'cashier.refundsPendingTail': '——线下原路退回后请点行内「实退登记」',
  'cashier.refundsEmpty': '当前筛选无退款单——收银流水已收单的退款会出现在这里',
  'cashier.refundSettleNote': '内测期实退=线下原路退回+系统内登记；登记后退款单置「实退完成」，账不再变（executed 不可撤销口径）。',
  'cashier.refundRejectNote': '驳回仅对草稿（draft）生效；驳回留痕 rejected+原因。已执行单不可撤销，纠错=再开正单。',
  'cashier.refundSvNotice': '本单涉储值/次卡：退款须店主办理（负债科目不设阈值，server 同口径拦截）',
  'cashier.refundAllocNote': '按支付段占比同比例分摊回补（V3）；按金额退不回库存只退钱（口径写死）',
  'cashier.refundBoardingNote': '已发生晚一分不退；已住/剩余晚数与晚单价以六联动预览为准（分段明示）',
  'cashier.refundPassCancelNote': '折算=剩余付费次数×（实付÷付费总次数），赠次不计价（随退作废）；退卡后卡作废留痕',
  'cashier.refundAnchorNote': '次卡退卡为锚点单口径：金额与原单支付段无关，按下方折算明细落地',
  'cashier.refundAmountNoRestock': '按金额退不回库存只退钱（口径写死）',
  'cashier.refundNoProductRestock': '无商品行回补',
  'cashier.refundExecuteNote': '执行=同事务六联动落账，不可撤销（纠错=再开正单）',
  'cashier.refundDangerBody':
    '危险操作：确认即同事务六联动落账（退款单/支付段回补/库存回补/储值次卡回补/财务口径/回馈金列位）， executed 后不可撤销，纠错=再开正单。',
  'cashier.refundOfflineMethod': '线下原路（内测期口径，实退标记待登记）',
  'cashier.refundDraftEmpty': '草稿单未执行，无六联动快照',

  /* ---- 客户退款申请待办（/cashier/refunds 待办区 · 批次 C5 审批缝）---- */
  'cashier.refundRequestTitle': '客户退款申请',
  'cashier.refundRequestApproveCta': '批准',
  'cashier.refundRequestRejectCta': '驳回',
  'cashier.refundRequestApproveConfirmTitle': '批准退款申请',
  'cashier.refundRequestApproveConfirmBody':
    '批准后按 R12 既有链路原路退回并生成退款单（商城单走线下原路售后）；执行后不可撤销，纠错=再开正单。',
  'cashier.refundRequestRejectTitle': '驳回退款申请',
  'cashier.refundRequestRejectNote': '驳回留痕 rejected+原因，客户侧申请单可见驳回原因。',
  'cashier.refundRequestSlaOverdue': '超期',
  'cashier.refundRequestTypeRefundOnly': '仅退款',
  'cashier.refundRequestTypeReturnRefund': '退货退款',

  /* ---- 售卡/续费/升级补差面板（MembershipPanel）---- */
  'cashier.memberStatusNote': '会员状态以提交时 server 实算为准（内测期读路径缺口，错误原文透出）',
  'cashier.memberPlansMissing': '档位配置缺失——请在规则配置端口检查会员档（member_plans 域）',
  'cashier.memberAlreadyMember': '该客户已是会员 —— 点这里切换到「续费」',
  'cashier.memberNextPlanBadge': '已预约下期：{plan}',
  'cashier.memberRenewNote': '续费=当前档位顺延 {days} 天（到期冻结自今日顺延）+ 回馈金解冻；档位不变（变更请退会后重售）。',
  'cashier.memberRenewCalcNote': '续费金额=当前档价+既有宠物只数附加费，由 server 实算——先点「计算续费金额」取得应收再收款。',
  'cashier.memberPaySectionNote': '到店付收款段（内测期现金/微信/支付宝登记，Σ须等于应收）',
  'cashier.memberRulesNote':
    '会员费=权益服务费（年费 ≠ 储值，不计储值账户/不进储值看板）；有效期 {days} 天自开通日； 到期不自动续费（到期=冻结，续费解冻，退会清零回馈金）。',

  /* ---- 升级补差（MembershipPanel 升级 mode · 补缺-3 商家端代办升档；钱域 server 兜底重算，本端零自算）---- */
  'cashier.upgradeModeTab': '升级补差',
  'cashier.upgradeQuoteLoading': '试算加载中…',
  'cashier.upgradeNewPurchaseTag': '新购口径',
  'cashier.upgradeDiffMonthsTag': '剩余 {m} 整月补差',
  'cashier.upgradeFormula':
    '剩余 {m} 整月 ×（新档月均价 ¥{newMonthly} − 旧档月均价 ¥{oldMonthly}）= 补差 ¥{total}',
  'cashier.upgradeDiffBase': '档价补差 ¥{amount}',
  'cashier.upgradeDiffPet': '多宠附加补差 ¥{amount}',
  'cashier.upgradeQuoteTotal': '补差应收（server 实算）',
  'cashier.upgradeNewPurchaseNote': '新购口径：按新档全价实收（多宠附加按当前只数重算），有效期自成交日重起算',
  'cashier.upgradeNoDowngradeNote': '期内只升不降——如需换到更低档，可在到期前 {days} 天预约下期档位',
  'cashier.upgradeSubmit': '收 ¥{amount} 升档',
  'cashier.upgradeSubmitting': '升档中…',
  'cashier.upgradeSuccess': '已升档「{plan}」· 补差单 {billNo}（¥{amount}）',
  'cashier.upgradeSuccessIdempotent': '已是「{plan}」档——无需补差，未生成新单',
  'cashier.upgradeDoneTitle': '升档完成 · 当前档「{plan}」（即时生效，到期日不变）',
  'cashier.upgradeBillLabel': '补差单号',
  'cashier.upgradeBillIdempotent': '（同档幂等，无新单）',
  'cashier.upgradeDone': '完成',

  /* ---- 储值台账导入（ImportLedgerPanel，只交付不执行）---- */
  'cashier.importAside': '只交付不执行——真台账导入等老板令；演示台账试导可标记清除',
  'cashier.importMappingTitle': '门店映射（台账店名 → 系统门店；未映射行将失败留痕）',
  'cashier.importConfirmPre': '将对',
  'cashier.importConfirmPost': '行可导记录开户/加账并写流水（批次留痕可查）。',
  'cashier.importConfirmNote':
    '真台账（907 人 / ¥671,264.42）执行等老板令；本次为演示台账试导，试导后可用「标记清除」回滚。 重复 execute 会重复入账（无文件级幂等），请勿重复提交。',
  'cashier.importClearNote': '将删除该批次写入的流水并按日志反向冲减账户；批次行永存（置「已清除」留痕）。',
  'cashier.importClearReject': '已产生消费的批次拒绝清除（保护真账）——差错请走对账调整留痕。',
} as const;

export type CashierCopyKey = keyof typeof CASHIER_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function cc(key: CashierCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CASHIER_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
