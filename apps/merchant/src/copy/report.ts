/**
 * 报表域文案键表（商家端控制台骨架批 · 片 5 段 3+段 4 · W-13 报表屏/报表详情页）
 *
 * 覆盖：FinancePage（/finance：M3 四格 + 昨日营收/14 日 spark + 左 M5 月度台账 +
 * 右报表目录 wlist D1–D9/N1–N8）与 ReportPage（/finance/report/:key，17 张）。
 * 段 4 点亮口径：储值/回馈金负债接 report.storedValueLiability/rebateLiability 真值；
 * 报表目录 17 张全量点亮进页（N7/N8=埋点预埋中注记签 amber，页内给预埋实证）；
 * 导出 CSV 仅店主（总规则③，report.exportCsv server 硬闸 403）。
 * 纪律：经营性文案一律经本表取值；数值到渲染层读统计经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const REPORT_COPY_TABLE = {
  /* ---- M3 四格（负债两格段 4 撤灰接真值） ---- */
  'rpt.quadRevenue': '本月营收',
  'rpt.quadStored': '储值负债',
  'rpt.quadRebate': '回馈金负债',
  'rpt.quadRefund': '本月退款',
  'rpt.quadStoredSub': '{n} 户 · 本金+赠送合计',
  'rpt.quadRebateSub': '{n} 户会员回馈金余额',
  'rpt.quadRefundCount': '共 {n} 笔（已执行+已实退）',

  /* ---- 昨日营收格 + 14 日 spark 格（A3/A4 读口） ---- */
  'rpt.quadYesterday': '昨日营收',
  'rpt.quadYesterdaySub': '{date} · {n} 笔已收',
  'rpt.quadYesterdayClose': '日结对账：{n} 箱 · 账面现金 ¥{amt}',
  'rpt.quadYesterdayNoClose': '昨日未封箱（日结行缺）',
  'rpt.sparkTitle': '近 14 日营收走势',
  'rpt.sparkNote': '今日格=截至当前已收 · financeStats 同源口径',

  /* ---- 左 M5 月度台账 ---- */
  'rpt.ledgerTitle': '月度台账',
  'rpt.ledgerAside': '收款流水 · 按时间倒序',

  /* ---- 右报表目录 wlist D1–D9 + N1–N8（段 4 全量点亮） ---- */
  'rpt.dirTitle': '报表目录',
  'rpt.dirAside': '17 张已点亮 · 导出 CSV 仅店主',
  'rpt.dirD1': 'D1 营收双口径',
  'rpt.dirD2': 'D2 服务营收构成',
  'rpt.dirD3': 'D3 会员增长',
  'rpt.dirD4': 'D4 次卡台账',
  'rpt.dirD5': 'D5 储值台账',
  'rpt.dirD6': 'D6 退款售后',
  'rpt.dirD7': 'D7 员工绩效',
  'rpt.dirD8': 'D8 寄养经营',
  'rpt.dirD9': 'D9 商品销售周转',
  'rpt.dirN1': 'N1 等级分布与升级',
  'rpt.dirN2': 'N2 续费与回本',
  'rpt.dirN3': 'N3 回馈金发行核销',
  'rpt.dirN4': 'N4 评价分布与差评',
  'rpt.dirN5': 'N5 交付合规与时效',
  'rpt.dirN6': 'N6 员工×服务质量',
  'rpt.dirN7': 'N7 内容曝光互动',
  'rpt.dirN8': 'N8 种草预约归因',
  'rpt.dirEmbedBadge': '埋点预埋中',
  'rpt.dirNote': 'D1–D9 / N1–N6 已点亮（月份口径；导出 CSV 仅店主）；N7/N8 埋点预埋中——瀑布流批出表',

  /* ---- 口径注（钉在目录区下） ---- */
  'rpt.monthCloseNote': '月结快照：每月封箱留存，历史封箱不回填',
  'rpt.threeBooksNote': '三本账永不混列：营收 / 储值 / 回馈金各自单列',

  /* ---- ReportPage 公共 ---- */
  'rpt.page.monthLabel': '报表月份',
  'rpt.page.exportCta': '导出 CSV',
  'rpt.page.exporting': '导出中…',
  'rpt.page.exportOwnerOnly': '导出 CSV 仅店主（总规则③）',
  'rpt.page.exportDone': '已导出 {name}（{n} 行）',
  'rpt.page.exportFail': '导出失败，请重试',
  'rpt.page.loadError': '报表加载失败，请检查网络后重试',
  'rpt.page.retry': '重新加载',
  'rpt.page.empty': '该月暂无数据',
  'rpt.page.unknown': '未知报表键',
  'rpt.page.backToDir': '‹ 返回报表目录',
  'rpt.page.noteLead': '口径：',
  'rpt.page.actionFail': '操作失败，请重试',

  /* ---- 大批片 2 · 三视图切换（owner 页头；manager 不出现，固定本店） ---- */
  'rpt.view.store': '单店',
  'rpt.view.stores': '分店',
  'rpt.view.chain': '合计',
  'rpt.view.storePick': '门店',
  'rpt.view.chainAside': '店域合计（scope=chain）',

  /* ---- D1 营收双口径 ---- */
  'rpt.d1.cashCard': '收现口径 ①',
  'rpt.d1.cashSub': '服务+商品+年费收现',
  'rpt.d1.amortCard': '分摊口径 ②',
  'rpt.d1.amortSub': '服务+商品+年费按 12 月分摊（防收钱当月虚胖）',
  'rpt.d1.memberShareTitle': '会员 vs 散客消费占比',
  'rpt.d1.memberLabel': '会员',
  'rpt.d1.guestLabel': '散客',
  'rpt.d1.momLabel': '环比',
  'rpt.d1.yoyLabel': '同比',
  'rpt.d1.noBase': '无基数',
  'rpt.d1.byDayTitle': '逐日营收',
  'rpt.d1.nonCashNote': '非现金单列（不计已收）：次卡 {pass} · 储值 {sv} · 回馈金 {rb}',

  /* ---- D2 服务营收构成 ---- */
  'rpt.d2.tableTitle': '按服务项构成',
  'rpt.d2.attachCard': '附加项目搭售率',
  'rpt.d2.attachSub': '搭售 {n}/{t} 单 · 附加金额 {amt}',

  /* ---- D3 会员增长 ---- */
  'rpt.d3.newCard': '本月新增会员',
  'rpt.d3.activeCard': '存量活跃会员',
  'rpt.d3.active90Card': '90 天活跃率',
  'rpt.d3.active90Sub': '{n}/{t} 人 90 天内有交易',
  'rpt.d3.byPlanTitle': '本月新增按档分布',

  /* ---- D4 次卡台账 ---- */
  'rpt.d4.grantedCard': '本月售卡充次',
  'rpt.d4.deductedCard': '本月扣次',
  'rpt.d4.remainCard': '剩余次数负债',
  'rpt.d4.stockSub': '在册 {n} 张 · 总 {t} 次',
  'rpt.d4.trendTitle': '近 6 月扣次趋势',

  /* ---- D5 储值台账（负债视角） ---- */
  'rpt.d5.rechargeCard': '本月充值',
  'rpt.d5.consumeCard': '本月消耗',
  'rpt.d5.liabilityCard': '期末储值负债',
  'rpt.d5.prepaidRow': '预收负债总额（储值 ¥{sv} + 回馈金 ¥{rb}）',

  /* ---- D6 退款售后 ---- */
  'rpt.d6.countCard': '退款笔数（已执行+已实退）',
  'rpt.d6.amountCard': '退款金额',
  'rpt.d6.byTypeTitle': '类型分布',
  'rpt.d6.rejectCard': '申请驳回率',
  'rpt.d6.rejectSub': '{r}/{t} 件被驳回',
  'rpt.d6.reasonTitle': '申请原因聚类',
  'rpt.d6.linkedBad': '退款关联差评 {n} 件',
  'rpt.d6.spikeWarn': '退款金额环比 {pct}，超预警阈值（{th}）——请核查异常',
  'rpt.d6.spikeOk': '退款金额环比 {pct}（预警阈值 {th}）',
  'rpt.d6.spikeNa': '上月无退款基数，环比不出数',

  /* ---- D7 员工绩效 ---- */
  'rpt.d7.tableTitle': '员工 × 绩效交叉',

  /* ---- D8 寄养经营 ---- */
  'rpt.d8.occCard': '入住率',
  'rpt.d8.occSub': '{pets} 宠物夜 / 容量 {cap} 晚',
  'rpt.d8.nightsCard': '宠物夜数',
  'rpt.d8.perNightCard': '每宠物夜营收',
  'rpt.d8.attachCard': '增值服务搭售率',
  'rpt.d8.overdueCard': '超期单数',

  /* ---- D9 商品销售周转 ---- */
  'rpt.d9.unitsCard': '销量（件）',
  'rpt.d9.salesCard': '销售额',
  'rpt.d9.sellThroughCard': '动销率',
  'rpt.d9.turnoverCard': '周转天数',
  'rpt.d9.ordersSub': '成交 {n} 单',
  'rpt.d9.byProductTitle': '按商品明细',

  /* ---- 大批片 5：D9 销量排行 / 滞销分析（d9TopGoods） ---- */
  'rpt.d9top.rankTitle': '销量排行 TOP20',
  'rpt.d9top.rankEmpty': '本月暂无成交商品',
  'rpt.d9top.slowTitle': '滞销（月零销 + 在库）',
  'rpt.d9top.slowEmpty': '无滞销商品（本月全动销或无在库）',

  /* ---- 大批片 5：页头周报切换（weeklySummary 本周 vs 上周环比） ---- */
  'rpt.weekly.toggle': '周报',
  'rpt.weekly.title': '周报环比（周一起算）',
  'rpt.weekly.curCard': '本周营收',
  'rpt.weekly.prevCard': '上周营收',
  'rpt.weekly.count': '成交 {n} 单',
  'rpt.weekly.serviceShop': '服务 {sv} · 商城 {sp}',
  'rpt.weekly.wowLabel': '环比',
  'rpt.weekly.byDayTitle': '本周逐日',

  /* ---- N1 等级分布与升级 ---- */
  'rpt.n1.stockTitle': '四档存量（活跃会员）',
  'rpt.n1.newTitle': '本月新增按档',
  'rpt.n1.exitCard': '本月退出',
  'rpt.n1.upgradeCard': '升级率',
  'rpt.n1.downgradeCard': '降级率',
  'rpt.n1.upDownSub': '升级 {u} · 降级 {d}（分母=期初存量）',
  'rpt.n1.cohortTitle': '入会月份 cohort（新增 → 至今仍活跃）',

  /* ---- N2 续费与回本 ---- */
  'rpt.n2.cohortTitle': '到期 cohort 续费率（近 6 月+本月）',
  'rpt.n2.warnTitle': '到期预警名单（30 天内）',
  'rpt.n2.warnEmpty': '30 天内无到期会员',
  'rpt.n2.paybackCard': '回本率（店级均值）',
  'rpt.n2.paybackSub': '{n} 位活跃会员 · 年费 ¥{paid} · 实省 ¥{saved}',
  'rpt.n2.paybackDetailTitle': '逐员回本明细',

  /* ---- N3 回馈金发行核销 ---- */
  'rpt.n3.rollTitle': '按期次滚动',
  'rpt.n3.rollNote': '滚动恒等式：期初 + 发行 − 核销 − 过期/破损 = 期末',
  'rpt.n3.redeemCard': '核销率',
  'rpt.n3.redeemSub': '基准 20-35% · 累计发行 ¥{g} · 核销 ¥{d}',
  'rpt.n3.closingCard': '期末回馈金负债',

  /* ---- N4 评价分布与差评 ---- */
  'rpt.n4.distTitle': '星级分布',
  'rpt.n4.badRateCard': '差评率（纠错扣减后）',
  'rpt.n4.avgCard': '平均评分',
  'rpt.n4.replyRateCard': '差评回复率',
  'rpt.n4.replyTimeCard': '平均回复时效',
  'rpt.n4.minutesVal': '{n} 分钟',
  'rpt.n4.tagTitle': '差评标签聚类',
  'rpt.n4.byStaffTitle': '按员工',
  'rpt.n4.byServiceTitle': '按服务',
  'rpt.n4.recentTitle': '差评明细与回复',
  'rpt.n4.recentAside': '近十条 · 全时段口径（非同月过滤）',
  'rpt.n4.recentEmpty': '暂无差评',
  'rpt.n4.replyCta': '回复 ›',
  'rpt.n4.repliedBadge': '已回复',
  'rpt.n4.replyPlaceholder': '填写回复内容（500 字内）…',
  'rpt.n4.replyTagsLabel': '原因标签（可多选，最多 5 个）',
  'rpt.n4.replySubmit': '提交回复',
  'rpt.n4.replyCancel': '取消',
  'rpt.n4.replyDone': '已回复该差评',
  'rpt.n4.correctedRow': '含纠错 {n} 件——approved 申诉已从差评指标即时扣减（附录 B 兜底口径）',

  /* ---- N5 交付合规与时效 ---- */
  'rpt.n5.completedCard': '本月完成服务单',
  'rpt.n5.photoCard': '照片覆盖率',
  'rpt.n5.photoSub': '实传 {n} 张',
  'rpt.n5.bucketsTitle': '报告送达时效分布',
  'rpt.n5.bucket5': '≤5 分钟',
  'rpt.n5.bucket30': '5–30 分钟',
  'rpt.n5.bucket120': '30–120 分钟',
  'rpt.n5.bucketOver': '>120 分钟',
  'rpt.n5.bucketUnread': '未读',
  'rpt.n5.actualCard': '实际时长（均值）',
  'rpt.n5.stdCard': '标准时长（均值）',
  'rpt.n5.sampleCard': '抽检率（打标重拍步占比）',

  /* ---- N6 员工×服务质量（海底捞警示口径） ---- */
  'rpt.n6.tableTitle': '员工 × 服务质量交叉',
  'rpt.n6.gateTitle': '海底捞铁规两件（附录 B）',
  'rpt.n6.queueTitle': '申诉队列（metric_appeals）',
  'rpt.n6.queueGo': '去审批中心 ›',
  'rpt.n6.queueEmpty': '暂无申诉记录',
  'rpt.n6.statusPending': '待复核',
  'rpt.n6.statusApproved': '已采纳',
  'rpt.n6.statusRejected': '已驳回',

  /* ---- N7/N8 埋点预埋说明页 ---- */
  'rpt.embed.intro': '本报表为埋点预埋项：埋点底座已落（content_events 九类事件写口+读数），出表排期=瀑布流批——本页先实证预埋有效性',
  'rpt.embed.eventsTitle': '九类预埋事件（名单写死）',
  'rpt.embed.statsTitle': '预埋有效性实证（本店事件计数）',
  'rpt.embed.statsEmpty': '暂无事件落账——写口就绪，待客户端行为接入',
  'rpt.embed.ev1': 'case_impression 案例曝光',
  'rpt.embed.ev2': 'case_detail_view 案例详情浏览',
  'rpt.embed.ev3': 'case_dwell 案例停留时长',
  'rpt.embed.ev4': 'case_read_finish 案例读完',
  'rpt.embed.ev5': 'case_interact 案例互动',
  'rpt.embed.ev6': 'book_same_impression 预约同款曝光',
  'rpt.embed.ev7': 'book_same_click 预约同款点击',
  'rpt.embed.ev8': 'booking_attributed 预约归因',
  'rpt.embed.ev9': 'booking_verified 到店核销确认',
  'rpt.embed.outNote': '出表=瀑布流批（H 表 §方向三清单）；导出 CSV 不对预埋项开放（server 400 明文）',
} as const;

export const REPORT_COPY = withCopyOverrides(REPORT_COPY_TABLE);

export type ReportCopyKey = keyof typeof REPORT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rpt(key: ReportCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = REPORT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
