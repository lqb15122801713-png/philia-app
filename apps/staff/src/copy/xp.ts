/**
 * XP 成长域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：XP 域说明文（今日经验口径/保级线/榜单口径/规则注脚）与空态一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：段位名/经验数/上限等到渲染层读端口插值（JSX 内 mono 片段，
 * 键只持静态 Lead/Mid/Tail 碎片，同 me.ts 纪律）。
 * 骨架批片 1（S-06）：区块题/状态签/通用 UI 词已随骨架帧抽键（xp.title·xp.sec·xp.retry 等族）；
 * 不抽：server 下发文案（oneLiner/sources label/段位名）。
 */

import { withCopyOverrides } from '@philia/shared';

const XP_COPY_TABLE = {
  /* ---- 段位卡（进度/保级说明） ---- */
  'xp.level.gapLead': '距',
  'xp.level.gapMid': '还差',
  'xp.level.gapTail': '经验',
  'xp.level.max': '已达最高段位',
  'xp.retention.lead': '保级线：月增量',
  'xp.retention.mid': '· 本月已增',
  'xp.retention.none': '当前段位无保级要求，经验累计不清零',

  /* ---- 今日经验 ---- */
  'xp.today.fullHint': '今日经验已满，明日 0 点重置',
  'xp.today.capLead': '日上限',
  'xp.today.capTail': '，超出部分不计分',
  'xp.today.fullBadge': '今日经验已满',

  /* ---- 本店榜口径注脚 ---- */
  'xp.board.note': '榜单只显示前三与你相邻的名次',

  /* ---- 经验明细空态 + 页脚说明 ---- */
  'xp.events.empty': '还没有经验记录——打卡、完成服务、收获好评都会长经验',
  'xp.footer': '每月 1 日段位结算 · 经验累计不清零',

  /* ---- 骨架帧（S-06：backbar + XP 卡 mono30 + 段位五段条 + 徽章墙四列） ---- */
  'xp.title': 'XP 成长',
  'xp.aside.lead': '累计',
  'xp.load.fail': 'XP 档案加载失败，请检查网络后重试',
  'xp.retry': '重新加载',
  'xp.sec.today': '今日经验',
  'xp.sec.board': '本店榜',
  'xp.sec.badges': '段位徽章',
  'xp.sec.events': '近期事件',
  'xp.board.self': '（我）',
  'xp.board.loadFail': '榜单加载失败，请稍后重试',
  'xp.rules.loadFail': '规则加载失败，请稍后重试',
  'xp.rules.learningTag': '学习通道·不占日上限',
  'xp.rules.disabledFallback': '暂未开通',
  'xp.rules.footCap': '日上限',
  'xp.rules.footReview': '同客户当日好评只计',
  'xp.rules.footExamMid': '次 · 考试每级每月限',
  'xp.rules.footExamTail': '次',
  'xp.events.loadFail': '经验明细加载失败，请稍后重试',
  'xp.events.more': '加载更多',
  'xp.events.loading': '加载中…',
  'xp.events.learningTag': '学习',
  'xp.events.droppedTag': '超出日上限，未计分',
  'xp.events.billLead': '单 …',
  'xp.events.boardingLead': '寄养',
  'xp.events.boardingTail': '晚',
  'xp.badge.thresholdLead': '门槛',

  /* ---- 积分申报 / 扣分异议（xp.app 族 · 薪资/XP 面扩，coder K） ---- */
  'xp.app.cta': '申报积分',
  'xp.app.title': '积分申报',
  'xp.app.pointsPh': '申报分值（正整数）',
  'xp.app.reasonPh': '申报理由（必填，说明依据）',
  'xp.app.pointsInvalid': '请填写有效分值（正整数）',
  'xp.app.reasonRequired': '请先填写理由',
  'xp.app.submit': '提交申报',
  'xp.app.submitting': '提交中…',
  'xp.app.submitted': '已提交，等待审核',
  'xp.app.cancel': '取消',
  'xp.app.appealCta': '异议',
  'xp.app.appealTitle': '扣分异议',
  'xp.app.appealReasonPh': '异议理由（必填，说明不该扣的依据）',
  'xp.app.sec.list': '我的申请',
  'xp.app.empty': '暂无申请记录',
  'xp.app.kindAward': '积分申报',
  'xp.app.kindAppeal': '扣分异议',
  'xp.app.pointsLead': '申报',
  'xp.app.statusPending': '待审核',
  'xp.app.statusApproved': '已通过',
  'xp.app.statusRejected': '已驳回',
  'xp.app.reviewLead': '审核注',
  'xp.app.resolvedNote': '已落分，见近期事件',
  'xp.app.note': '申报与异议由店长/老板在管理端审核，员工不可自审',
  'xp.app.loadFail': '申请记录加载失败，请稍后重试',
} as const;

export const XP_COPY = withCopyOverrides(XP_COPY_TABLE);

export type XpCopyKey = keyof typeof XP_COPY;
