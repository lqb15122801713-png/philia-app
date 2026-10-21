/**
 * 开发者管理端文案键表（商家端控制台骨架批 · 片 5 段 3 · W-16 聚合新建）
 *
 * 覆盖：ConsolePage（/console 真页替换段 0 占位：左 WcPorts 端口目录 → 右端口编辑
 * + WcPub 发布流 + WcLog 留痕 + WDanger 危险区）。
 * 依据=UX-02 两端定稿语言包 §四 W-16：M8 三件；共构不分叉；L2-④ 二次 PIN；
 * 动规则不动账；冻结项只读。
 * 键族 cadm.*（避开 copyport/slotport/rules/console 既有域）。
 * 共构不分叉：右栏直接复用 RulesConfigPage/CopyConfigPage/SlotPortPage 内核件，
 * 本表只承载聚合层文案（目录章/空态/透出注），内核文案仍在各原族。
 */

import { withCopyOverrides } from '@philia/shared';

const CONSOLE_ADMIN_COPY_TABLE = {
  'cadm.pageTitle': '运营后台端',
  /* PD-25 D-56（CJ-1014-01）：pageSub 写死「内容与脸面 · 店主 · 钱权另闸」（不写运营角色） */
  'cadm.pageSub': '内容与脸面 · 店主 · 钱权另闸',

  /* ---- 左端口目录（A–E 域章；seal=域码槽号） ---- */
  'cadm.groupA': 'A · 内容运营',
  'cadm.groupC': 'C · 会员机制',
  'cadm.groupD': 'D · 员工规则',
  'cadm.groupE': 'E · 门店·数据',
  'cadm.portCopy': '文案端口',
  'cadm.portSlots': '槽位端口',
  'cadm.portMember': '会员档',
  'cadm.portStored': '储值',
  'cadm.portCarePack': '安心包端口',
  'cadm.portCarePackNote': '独立库存域 · 只读 v1',
  /* 大批片 5：C4 会员营销（直达 /marketing 真页，非置灰占位） */
  'cadm.portMarketing': '会员营销',
  'cadm.portCommission': '提成',
  'cadm.portXp': 'XP',
  'cadm.portProfile': '门店档案',
  'cadm.portReportSpec': '报表口径',
  /* 产品-1010 片 1：E3 支付通道端口（高危件；口令复核闸句硬编码在 PayChannelPortBody，不走 copy 键防不一致） */
  'cadm.portPayChannel': '支付通道',
  'cadm.portPayChannelNote': '高危件 · 口令复核',
  'cadm.portPendingNote': '置灰 · 端口待立',

  /* ---- 置灰域空态（R10 不画假件：开口项只读占位+明面注） ---- */
  'cadm.storedEmptyTitle': '储值端口待立',
  'cadm.storedEmptyBody': '储值参数暂无独立配置域（储值提成规则已作废置灰，归提成域只读行）；立项前本口只读占位。',
  /* 大批片 2 · E1 点亮：profile 两键退役改值=ProfilePortBody 卡题/卡注（删键不做） */
  'cadm.profileEmptyTitle': '门店档案端口',
  'cadm.profileEmptyBody': '连锁字段+档案维护口（E1 点亮·片 2）',
  'cadm.reportSpecEmptyTitle': '报表口径端口待立',
  'cadm.reportSpecEmptyBody': 'D1–D9 报表口径/导出=开口项（18 号档 E4 🆕立项待供给）；本口只读占位。',

  /* ---- E1 门店档案端口（大批片 2 点亮） ---- */
  'cadm.portProfileSave': '保存档案',
  'cadm.profileSaved': '已保存',
  'cadm.profileChainTitle': '连锁归属',
  'cadm.profileHqSelf': '店即己部（单层特例）',

  /* ---- C3 安心包端口（大批片 2；立项名 C2 与控制台既有 C2 储值撞号，落 C3 已报备） ---- */
  'cadm.carePackExpiryTh': '临期 ≤30 天',
  'cadm.carePackExpired': '已过期',
  'cadm.carePackRecallNote': '回收登记流程=候补件（04a 对账/体验批 T3 联动），本口 v1 只读',

  /* ---- 发布流 / 留痕透出注 ---- */
  'cadm.pubNote': '发布流透出：草稿→预览→发布推三端；回滚=槽位卡「回退上一版」真链路（publish/revert 同管道，虚线注非新件）。',
  'cadm.logTitle': '留痕',
  'cadm.logAside': 'config.versions / 槽位版本计数现状透出',

  /* ---- 危险区（暖底赭红题带；透出既有闸，不新建件） ---- */
  'cadm.dangerPin': '二次确认=L2-④ 二次 PIN：保存须键入「确认保存」口令（文案高危键逐键确认），沿用既有 highRisk 口令闸，非独立 PIN 件。',
  'cadm.dangerFrozen': '冻结项只读：作废/备用/预留规则行与结构字段（如会员档免费属性）不给改。',
  'cadm.dangerNoBackdate': '动规则不动账：规则改动只约束生效后的单，不回溯历史月份与已快照数据。',

  /* ---- 共构不分叉注（页底明面） ---- */
  'cadm.coexistNote': '共构不分叉：右栏直接复用规则配置/文案端口/槽位端口三页内核；旧路由 /settings/rules · /settings/copy · /settings/slots 保留可直达。',

  /* ---- 非 owner 引导（manager；clerk 由 ClerkRouteGuard 拦） ---- */
  'cadm.ownerOnlyTitle': '运营后台端仅店主可用',
  'cadm.ownerOnlyBody': '端口配置与发布属店主专属（页内闸门 + server 硬闸门兜底）；请切换店主账号。',

  /* ---- kill switch 显著态（端口批收尾片 1 · 件 4a：页顶横幅/小字行+双确认切换） ----
     PD-25 D-56 C3：arm 三键支付语义加强（明示支付+非 Banner；闸/端点/行为零改动） */
  'cadm.killBannerOn': 'KILL SWITCH 生效中：线上支付通道等可关参数已回落安全值（{by} · {updatedAt}）',
  'cadm.killRestore': '恢复',
  'cadm.killRestoreConfirm': '确认恢复？可关参数将解除安全值回落。',
  'cadm.killArmNote': '支付一键关停（非 Banner）：线上支付通道等可关参数瞬时回落安全值（全局）。',
  /* PD-55 意见轨②（CONSOLE-RETAKE §3）：关停条入危险区容器的题带文案 */
  'cadm.killDangerTitle': '危险区 · 支付全局关停',
  'cadm.killArm': '支付一键关停',
  'cadm.killArmConfirm': '确认支付一键关停？线上支付通道等可关参数将瞬时回落安全值（与 Banner 槽位下线无关）。',
  'cadm.killDone': '全局开关已切换',

  /* ---- D3 参数字典端口（端口批收尾片 1 · 件 5：config.dictionary 全量透出+服务端搜索） ---- */
  'cadm.portDict': '参数字典',
  'cadm.dictTitle': '参数字典',
  'cadm.dictAside': '全参数域逐键透出 · 服务端搜索 · copy 域不收',
  'cadm.dictSearchPlaceholder': '搜索参数（键名 / 名称 / 帮助注）',
  'cadm.dictEmpty': '无匹配参数',
  'cadm.dictError': '参数字典加载失败',
  'cadm.dictMoneyBadge': '涉钱',
  'cadm.dictDomainCommission': '提成',
  'cadm.dictDomainXp': 'XP',
  'cadm.dictDomainDuration': '时长',
  'cadm.dictDomainRefund': '退款',
  'cadm.dictDomainMemberPlans': '会员档',
  'cadm.dictDomainService': '服务',
  'cadm.dictDomainPay': '支付',

  /* ---- D4 数据订正端口（端口批收尾片 2 · 数据 3 之②；CorrectionBody 直嵌） ---- */
  'cadm.portCorrection': '数据订正',

  /* ---- D5 回收站端口（端口批收尾片 2 · 数据 3 之③；RecycleBinBody 直嵌） ---- */  'cadm.portRecycle': '回收站',
  'cadm.recycleTitle': '回收站',
  'cadm.recycleAside': '软删恢复统一口 · 商品/活动/公告三域运营件',
  'cadm.recycleNote': '回收站=软删+恢复；账务/支付/账单类永不进回收站（无硬删口）',
  'cadm.recycleEmpty': '回收站为空',
  'cadm.recycleLoadFail': '回收站加载失败',
  'cadm.recycleRestore': '恢复',
  'cadm.recycleRestored': '已恢复',
  'cadm.recycleDomainProduct': '商品',
  'cadm.recycleDomainPromo': '活动',
  'cadm.recycleDomainAnnounce': '公告',

  /* ---- F1 画布端口（端口批收尾片 3 · B 股；CanvasPortBody 直嵌） ---- */
  'cadm.groupF': 'F · 页面画布',
  'cadm.portCanvas': '画布端口',

  /* ---- A28 新店克隆口（端口批收尾片 3；ProfilePortBody 底部「门店操作」区） ---- */
  'cadm.cloneSectionTitle': '门店操作',
  'cadm.cloneCta': '新店克隆',
  'cadm.cloneModalTitle': '确认克隆新店',
  'cadm.cloneWarn': '克隆=档案+服务+商品 stock 归零+六表门店覆盖行复制，不带数据（订单/会员/员工/库存流水/账单一律不克隆）',
  'cadm.cloneNameLabel': '新店名称',
  'cadm.cloneConfirmCta': '确认克隆',
  'cadm.cloneCancel': '取消',
  'cadm.cloneDone': '新店已克隆',
  /* ---- 控制台改版批 片 1（产品-1012 · 刀 1 办事导向首页）：办事卡面人话键族 ----
     每卡=标题（你能干什么）+一句人话说明+最近改动留痕行；参数表降级=高级层 */
  'cadm.homeTitle': '办事首页',
  'cadm.homeSub': '按你要办的事选卡——改文案、换图片、装修页面、改规则，都在这里',
  'cadm.homeLastNone': '近期无改动留痕',
  'cadm.homeAdvanced': '高级层 · 全部端口（参数表）',
  'cadm.homeAdvancedNote': '15 个端口全在这层，点即达；门面卡面不收参数表',
  'cadm.homeBackHome': '‹ 回办事首页',
  'cadm.homePortBadge': '端口',
  /* PD-55 意见轨①（CONSOLE-RETAKE §2）：办事卡三层分区签（常办/慎办/占位） */
  'cadm.homeTierDaily': '常办',
  'cadm.homeTierDailyNote': '改字换图装修 · 常来常办',
  'cadm.homeTierCareful': '慎办',
  'cadm.homeTierCarefulNote': '钱与规则 · 高危件口令复核',
  'cadm.homeTierPending': '占位',
  'cadm.homeTierPendingNote': '端口待立 · 只读占位',
  /* 卡面（title=你能干什么 / hint=一句人话说明；置灰口 hint 带待立注记） */
  'cadm.cardCopyTitle': '改文案',
  'cadm.cardCopyHint': '三端任何一句界面文字，在这里改',
  'cadm.cardSlotsTitle': '换素材',
  'cadm.cardSlotsHint': '首页顶图等图片位，换图→预览→发布推三端',
  'cadm.cardCanvasTitle': '画布装修',
  'cadm.cardCanvasHint': '46 屏页面区块拖一拖、改字、预览即变',
  'cadm.cardMemberTitle': '改会员档',
  'cadm.cardMemberHint': '四档价格与权益参数调整',
  'cadm.cardCommissionTitle': '改提成',
  'cadm.cardCommissionHint': '员工提成规则参数',
  'cadm.cardXpTitle': '改 XP',
  'cadm.cardXpHint': 'XP 规则参数与月度结算口径',
  'cadm.cardPayTitle': '改支付通道',
  'cadm.cardPayHint': '线上支付通道开关与参数（高危件·口令复核）',
  'cadm.cardCorrectionTitle': '数据订正',
  'cadm.cardCorrectionHint': '错单错账发起订正，复核后生效',
  'cadm.cardDictTitle': '参数字典',
  'cadm.cardDictHint': '全部参数逐键透出，可搜',
  'cadm.cardRecycleTitle': '回收站',
  'cadm.cardRecycleHint': '软删的商品/活动/公告在这里恢复',
  'cadm.cardProfileTitle': '门店档案',
  'cadm.cardProfileHint': '门店档案维护+连锁归属+新店克隆',
  'cadm.cardCarepackTitle': '安心包',
  'cadm.cardCarepackHint': '安心包库存与临期（只读 v1）',
  'cadm.cardMarketingTitle': '会员营销',
  'cadm.cardMarketingHint': '营销活动与台账（直达营销页）',
  'cadm.cardStoredTitle': '储值',
  'cadm.cardStoredHint': '端口待立（只读占位）',
  'cadm.cardReportSpecTitle': '报表口径',
  'cadm.cardReportSpecHint': '端口待立（只读占位）',

  /* ---- 控制台改版批 片 2（产品-1012 · 刀 2 全局搜索 Cmd+K）：搜索件键族 ---- */
  'cadm.searchCta': '搜索：提成 / 回馈金 / 文案 / 屏…',
  'cadm.searchTitle': '全局搜索',
  'cadm.searchPlaceholder': '搜词直达：端口 / 键 / 画布屏 / 素材位',
  'cadm.searchHint': 'Cmd+K（Mac）/ Ctrl+K（Win）唤起 · 命中即跳 · Esc 关闭',
  'cadm.searchEmpty': '没有找到「{q}」相关的开关或页面',
  'cadm.searchEmptyTry': '试试这些词（点一下就搜）：',
  'cadm.searchGroupPort': '端口',
  'cadm.searchGroupKey': '文案键',
  'cadm.searchGroupParam': '参数键',
  'cadm.searchGroupScreen': '画布屏',
  'cadm.searchGroupSlot': '素材位',
  'cadm.searchPerf': '索引 {total} 项 · 构建 {buildMs} ms · 本次首筛 {ms} ms',
  'cadm.searchIndexing': '索引构建中…',

  /* ---- 候裁清零批 件 5：画布块行「慎隐」注记（mallOrders.sheets 二次确认弹层块） ---- */
  'cadm.canvasSheetsHideNote': '慎隐：藏了=改单直接提交无确认弹层',
} as const;

export const CONSOLE_ADMIN_COPY = withCopyOverrides(CONSOLE_ADMIN_COPY_TABLE);

export type ConsoleAdminCopyKey = keyof typeof CONSOLE_ADMIN_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function cadm(key: ConsoleAdminCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CONSOLE_ADMIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
