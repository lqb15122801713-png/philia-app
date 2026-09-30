/**
 * 我的页 /me 文案键表（copy key 一期硬约定 · 换皮批片 5 UX 片 4 P2-1）
 *
 * 纪律：MePage 界面文案（列表行题/副注）一律经本表取值，组件内零硬编码文案；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 *
 * 数值不进本表：绩效数字（已评条数/均分）由渲染层读聚合数据，经 {u1-num} 片段
 * 在 JSX 内拼装——副注拆为静片段键（Lead/Unit/Avg），动态数原位保留 u1-num 轨。
 */

export const ME_COPY = {
  /* ---- P2-1：双「我的评价」同名歧义消解——
     上组（列表组 1，to=/history，testid=me-reviews）改题「评价总览」=绩效口径聚合入口；
     下组（员工端 2.0 组，to=/reviews，testid=me-reviews-list）保留「我的评价」=评价明细列表 ---- */
  'me.reviewSummary': '评价总览',
  'me.reviewSummaryLead': '近 30 天口径看历史页 · 本月已评',
  'me.reviewSummaryUnit': '条',
  'me.reviewSummaryAvg': '均分',
  'me.myReviews': '我的评价',
  'me.myReviewsSub': '本人收到的客户评价',

  /* ---- C 块（换皮批片 5）：帮助与规范 / 设置 就地展开说明文（操作引导语） ---- */
  'me.help.specTitle': '六步影像规范',
  'me.help.specBody': '消毒 1–3 张 · 预检 2–6 张 · 洗护 3–9 张 · 精修 2–6 张 · 前后对比各 1 张；过程照实时同步家长，张数达标才能确认翻步。',
  'me.help.flowTitle': '核销流程',
  'me.help.flowBody': '客户到店出示预约码 → 前台扫码（无摄像头走手动 6 位码）→ 核销成功自动开单；寄养单核销后办理入住登记。',
  'me.settings.sync': '实时同步：派单/改期/取消即时推送（SSE 长连接，断线自动重连 + 60s 轮询兜底）。',
} as const;

export type MeCopyKey = keyof typeof ME_COPY;
