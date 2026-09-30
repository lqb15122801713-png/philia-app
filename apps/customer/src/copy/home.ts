/**
 * 首页域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：HomePage（BANNER 槽 / 身份带 / LIVE 卡 / 浮动大卡 / 案例流 / 会员提醒条 /
 * 统计行 / 毛孩子行）+ home/HomeBookingPanel 降级入口卡。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：金额/次数/天数/比例等到渲染层读端口插值（{var} 模板）。
 */

export const HOME_COPY = {
  /* ---- A-2 服务中态 · LIVE 卡 ---- */
  'home.liveTag': 'LIVE · 洗护进行中',
  'home.liveEta': '预计 {time} 完成',
  'home.liveViewAll': '查看全程 ›',
  /* 备台行（消毒备台态，七节点步 1 完成时刻为真值） */
  'home.preprowTitle': '消毒备台 · 一客一消',
  'home.preprowDoneAt': '{time} 已完成',
  'home.preprowDone': '已完成',

  /* ---- 身份带 idband / 窄行 idline ---- */
  'home.idFallback': '菲丽亚宠友',
  'home.rebateLabel': '回馈金',
  'home.idJoin': '免费领个身份 ›',
  'home.memberCode': '会员码 ›',

  /* ---- 浮动大卡 megacard（双入口） ---- */
  'home.entryGrooming': '预约洗澡美容',
  'home.entryBoarding': '预约寄养',
  'home.entryBoardingNote': '按晚 · 疫苗核验',

  /* ---- 回馈金结算环行 / 引导行（规则明面） ---- */
  'home.ringPeriod': '本期已攒回馈金 · 周期 {start} – {end}',
  'home.ringArrive': '{month} 月 {day} 日到账',
  'home.ringRule': '买商品的 {pct}%，次月回到这里。',
  'home.rebateLedger': '回馈金账本',
  'home.openMemberClaim': '开通会员，买商品返回馈金',
  'home.rebateBalanceLine': '余额 {amt} · 每月 {day} 日到账',
  'home.openMemberSub': '付费档返 {pcts}%，次月到账',

  /* ---- 案例流（MomentsPage 域真实数据） ---- */
  'home.casesTitle': '店里今天的故事',
  'home.casesMore': '每日更新 ›',
  'home.caseTitle': '{pet}的{service}日记',

  /* ---- 会员提醒条（次卡余额） ---- */
  'home.passStripPre': '次卡共剩 ',
  'home.passStripPost': ' 次 · 到店出示会员码',

  /* ---- 陪伴统计行 ---- */
  'home.statsDays': '陪伴天数',
  'home.statsServices': '服务次数',
  'home.statsSpend': '累计消费',

  /* ---- 我的毛孩子行 ---- */
  'home.petsTitle': '我的毛孩子',
  'home.petsEmpty': '还没有毛孩子档案，去添加 TA 吧',
  'home.petsLoadFail': '毛孩子加载失败',

  /* ---- HomeBookingPanel 降级入口卡 ---- */
  'home.panelEntryTitle': '预约洗护',
  'home.panelEntrySub': '选择门店、服务和时间',
} as const;

export type HomeCopyKey = keyof typeof HOME_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function hc(key: HomeCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = HOME_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
