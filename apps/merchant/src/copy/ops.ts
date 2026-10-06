/**
 * 运营域文案键表（员工端骨架整建批 片 3 · 商家端 /ops）
 *
 * 覆盖：OpsPage（PDCA 问题闭环 + 自检审核 + 巡检汇总 + 指标申诉复核 +
 * 库存审批中心（大批片 4 区 5：采购/要货/调拨/报损四类），
 * 分区工艺照 ScheduleManagePage u3-panel 竖排）。
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const OPS_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'ops.pageTitle': '运营',
  'ops.pageSub': '问题闭环 PDCA · 每日自检审核 · 巡检汇总（单店口径）',
  'ops.guideTitle': '运营闭环由店长或店主处理',
  'ops.guideHint': '问题复检与自检审核属管理层动作；店员账号的工作面是收银台。',

  /* ---- 区 1 PDCA 问题闭环 ---- */
  'ops.pdca.title': '问题闭环（PDCA）',
  'ops.pdca.aside': '提出→整改→复检，复检不通过回到待整改',
  'ops.pdca.empty': '当前筛选无问题单',
  'ops.pdca.filterAll': '全部',
  'ops.pdca.statusOpen': '待整改',
  'ops.pdca.statusFixing': '整改中',
  'ops.pdca.statusRecheck': '待复检',
  'ops.pdca.statusClosed': '已闭环',
  'ops.pdca.recheckPass': '复检通过',
  'ops.pdca.recheckFail': '复检不通过',
  'ops.pdca.notePh': '复检备注（必填，留痕）',
  'ops.pdca.noteRequired': '复检备注不能为空',
  'ops.pdca.recheckDone': '复检结论已登记',
  'ops.pdca.timelineTitle': '留痕时间线',
  'ops.pdca.fixNoteLabel': '整改说明',
  'ops.pdca.recheckNoteLabel': '复检结论',
  'ops.pdca.expandCta': '详情 ›',
  'ops.pdca.collapseCta': '收起 ›',

  /* ---- 区 2 自检审核 ---- */
  'ops.self.title': '自检审核',
  'ops.self.aside': '员工每日自检提交后在此审核；审核意见必填并留痕',
  'ops.self.empty': '暂无待审核的自检表',
  'ops.self.scoreLabel': '得分 {n}',
  'ops.self.filledBy': '填报人 {name}',
  'ops.self.expandCta': '展开自检快照 ›',
  'ops.self.collapseCta': '收起 ›',
  'ops.self.itemPassed': '已打点',
  'ops.self.itemFailed': '未达标',
  'ops.self.reviewCta': '审核（写意见）',
  'ops.self.notePh': '审核意见（必填，随单留痕）',
  'ops.self.noteRequired': '审核意见不能为空',
  'ops.self.reviewDone': '审核意见已登记',

  /* ---- 区 3 巡检汇总 ---- */
  'ops.sum.title': '巡检汇总',
  'ops.sum.aside': '单店口径',
  'ops.sum.closed30d': '近 30 天闭环',
  'ops.sum.byStatus': '按状态计数',
  'ops.sum.byCategory': '类目排行（Top）',
  'ops.sum.emptyCategory': '暂无类目数据',
  'ops.sum.storeScopeNote': '本卡为单店口径；跨店排行属开口项，待连锁合批（5 候）后透出。',
  'ops.sum.loadFail': '汇总加载失败，请检查网络后重试',

  /* ---- 区 4 指标申诉复核（N6 申诉通道 · report.listMetricAppeals / reviewMetricAppeal） ---- */
  'ops.appeal.title': '指标申诉复核',
  'ops.appeal.aside': '差评归属/报表指标异议；通过必留纠错前后值',
  'ops.appeal.empty': '暂无待复核申诉',
  'ops.appeal.targetReview': '差评归属',
  'ops.appeal.targetMetric': '报表指标',
  'ops.appeal.reasonLabel': '申诉理由',
  'ops.appeal.approveCta': '通过（纠错）',
  'ops.appeal.rejectCta': '驳回',
  'ops.appeal.approveTitle': '通过申诉 · 纠错留痕',
  'ops.appeal.rejectTitle': '驳回申诉',
  'ops.appeal.beforeLabel': '纠错前取值',
  'ops.appeal.afterLabel': '纠错后取值',
  'ops.appeal.beforePh': '如：差评误挂到该员工 / 指标原值 82',
  'ops.appeal.afterPh': '如：差评归属更正 / 更正后 79',
  'ops.appeal.correctionNotePh': '纠错说明（可选）',
  'ops.appeal.approveNotePh': '复核意见（可选）',
  'ops.appeal.rejectNotePh': '复核意见（必填，随单留痕）',
  'ops.appeal.correctionRequired': '通过必须填写纠错前后值——兜底留痕铁规',
  'ops.appeal.rejectNoteRequired': '驳回必须填写复核意见',
  'ops.appeal.approveDone': '申诉已通过，纠错留痕已登记',
  'ops.appeal.rejectDone': '申诉已驳回',
  'ops.appeal.statusApproved': '已通过',
  'ops.appeal.statusRejected': '已驳回',
  'ops.appeal.reviewedTitle': '已复核（近 50 条）',
  'ops.appeal.reviewNoteLabel': '复核意见',
  'ops.appeal.correctionLabel': '纠错留痕',
  'ops.appeal.reviewedAtLabel': '复核时间',

  /* ---- 区 5 库存审批中心（大批片 4 · stock2.approvalListPending / approvalReview 四类通用） ---- */
  'ops.stock.title': '库存审批',
  'ops.stock.aside': '采购/要货/调拨/报损四类统一队列；审批意见必填留痕',
  'ops.stock.empty': '暂无待审批单',
  'ops.stock.kindPurchase': '采购',
  'ops.stock.kindReplenish': '要货',
  'ops.stock.kindTransfer': '调拨',
  'ops.stock.kindWriteoff': '报损',
  'ops.stock.applicantLabel': '申请人',
  'ops.stock.approveCta': '通过',
  'ops.stock.rejectCta': '驳回',
  'ops.stock.approveTitle': '通过审批',
  'ops.stock.rejectTitle': '驳回审批',
  'ops.stock.notePh': '审批意见（必填，随单留痕）',
  'ops.stock.noteRequired': '审批意见不能为空',
  'ops.stock.approveDone': '已通过，单据状态已联动',
  'ops.stock.rejectDone': '已驳回',

  /* ---- 通用 ---- */
  'ops.common.loadFail': '数据加载失败，请检查网络后重试',
  'ops.common.retry': '重新加载',
  'ops.common.confirm': '确认提交',
  'ops.common.cancel': '取消',
  'ops.common.submitting': '提交中…',
} as const;

export const OPS_COPY = withCopyOverrides(OPS_COPY_TABLE);
export type OpsCopyKey = keyof typeof OPS_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function op(key: OpsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = OPS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
