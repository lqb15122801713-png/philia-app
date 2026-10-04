/**
 * 我的页 /me 文案键表（copy key 一期硬约定 · 换皮批片 5 UX 片 4 P2-1）
 *
 * 纪律：MePage 界面文案（列表行题/副注）一律经本表取值，组件内零硬编码文案；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：绩效数字（已评条数/均分）由渲染层读聚合数据，经 {u1-num} 片段
 * 在 JSX 内拼装——副注拆为静片段键（Lead/Unit/Avg），动态数原位保留 u1-num 轨。
 */

import { withCopyOverrides } from '@philia/shared';

const ME_COPY_TABLE = {
  /* ---- P2-1：双「我的评价」同名歧义消解——
     上组（列表组 1，to=/history，testid=me-reviews）改题「评价总览」=绩效口径聚合入口；
     下组（员工端 2.0 组，to=/reviews，testid=me-reviews-list）保留「我的评价」=评价明细列表 ---- */
  'me.reviewSummary': '评价总览',
  'me.reviewSummaryLead': '近 30 天口径看历史页 · 本月已评',
  'me.reviewSummaryUnit': '条',
  'me.reviewSummaryAvg': '均分',
  'me.reviewMonthLead': '本月已评',
  'me.myReviews': '我的评价',
  'me.myReviewsSub': '本人收到的客户评价',

  /* ---- C 块（换皮批片 5）：帮助与规范 / 设置 就地展开说明文（操作引导语） ---- */
  'me.help.specTitle': '六步影像规范',
  'me.help.specBody': '消毒 1–3 张 · 预检 2–6 张 · 洗护 3–9 张 · 精修 2–6 张 · 前后对比各 1 张；过程照实时同步家长，张数达标才能确认翻步。',
  'me.help.flowTitle': '核销流程',
  'me.help.flowBody': '客户到店出示预约码 → 前台扫码（无摄像头走手动 6 位码）→ 核销成功自动开单；寄养单核销后办理入住登记。',
  'me.settings.sync': '实时同步：派单/改期/取消即时推送（SSE 长连接，断线自动重连 + 60s 轮询兜底）。',

  /* ---- 骨架批片 1（S-04 重排）：身份卡/两组链接行/三格账（原码内硬编码收键） ---- */
  'me.idcard.no': '工号 {no}',
  'me.stat.done': '本月完成单',
  'me.stat.goodRate': '好评率',
  'me.stat.boardingLogs': '本月寄养打卡',
  'me.row.pay': '薪资提成',
  'me.row.paySub': '本月提成逐单明细 · 绩效 · 扣减',
  'me.row.xp': 'XP 成长',
  'me.row.xpSub': '段位 · 本店榜 · 规则一句话',
  'me.row.inventory': '盘点任务',
  'me.row.inventorySub': '日盘/周盘执行 · 安心包效期',
  'me.row.manager': '补卡审批',
  'me.row.managerSub': '店长视界 · 审批 · 日结确认',
  'me.row.boarding': '寄养负责中',
  'me.row.boardingSub': '{n} 只在店（任务台全天行打卡）',
  'me.row.settings': '设置',
  'me.row.settingsSub': '实时同步与通知',
  'me.row.schedule': '我的排班',
  'me.row.help': '帮助与规范',
  'me.row.helpSub': '六步影像规范 · 核销流程',
  'me.row.logout': '退出登录',
  'me.row.loggingOut': '退出中…',
  'me.onDuty': '在班',
  'me.offDuty': '今日休息',
  'me.joined': '入职 {ym}',
  'me.version': 'Philia 员工端 · 内测 v1.1',
} as const;

export const ME_COPY = withCopyOverrides(ME_COPY_TABLE);

export type MeCopyKey = keyof typeof ME_COPY;
