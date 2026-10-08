/**
 * 数据订正域文案键表（端口批收尾片 2 · 数据 3 之② · 商家端 ConsolePage D4 端口）
 *
 * 覆盖：CorrectionBody（三类页签 + 发起表单 + 订正单队列/复核）。
 * 纪律：照 copy/rules.ts 工艺——withCopyOverrides 代理（端口值优先、码内默认
 * fallback）、as const 冻结、数值不进表（{var} 插值）、组件内零硬编码。
 */

import { withCopyOverrides } from '@philia/shared';

const CORRECTION_COPY_TABLE = {
  /* ---- 端口头 / 红线注记 ---- */
  'corr.title': '数据订正',
  'corr.aside': '余额/回馈金/工时单条修正 · 前后值留痕 · 审批通过才生效',
  'corr.redlineNote': '订正=前后值留痕+审批通过才生效；不回溯已封箱（日结/月结快照不重算）',

  /* ---- 三类页签 ---- */
  'corr.tabStored': '储值余额',
  'corr.tabRebate': '回馈金',
  'corr.tabWorkHours': '考勤工时',
  'corr.kindStored': '储值余额',
  'corr.kindRebate': '回馈金',
  'corr.kindWorkHours': '考勤工时',

  /* ---- 发起表单（owner） ---- */
  'corr.formTitle': '发起订正',
  'corr.formAside': '提交后进审批队列，复核通过才生效',
  'corr.memberSearchPh': '手机号 / 昵称搜索会员',
  'corr.memberPickLabel': '目标会员',
  'corr.memberEmpty': '无匹配会员（本店有预约或持次卡的客户名册内搜索）',
  'corr.principalLabel': '本金新值（分）',
  'corr.bonusLabel': '赠送新值（分）',
  'corr.balanceLabel': '余额新值（分）',
  'corr.staffPickLabel': '选择员工',
  'corr.dateLabel': '打卡日期',
  'corr.recordPickLabel': '选择打卡记录',
  'corr.recordEmpty': '该员工该日经既有口无可定位记录（仅当月防代打标记记录透出，可手输记录 ID）',
  'corr.recordManualLabel': '或手输记录 ID',
  'corr.tsLabel': '新打卡时刻',
  'corr.noteLabel': '订正事由',
  'corr.notePh': '事由必填（留痕用）',
  'corr.submitCta': '提交审批',
  'corr.proposed': '已提交审批',
  'corr.invalid': '请填齐目标、数值与事由',

  /* ---- 订正单队列 ---- */
  'corr.queueTitle': '订正单队列',
  'corr.queueAside': 'pending 在前 · 复核通过才生效',
  'corr.queueEmpty': '暂无订正单',
  'corr.loadFail': '订正单加载失败',
  'corr.statusPending': '待复核',
  'corr.statusApplied': '已生效',
  'corr.statusRejected': '已驳回',
  'corr.approveCta': '通过',
  'corr.rejectCta': '驳回',
  'corr.approveConfirm': '确认通过并立即应用该订正？',
  'corr.approved': '已通过并生效',
  'corr.rejected': '已驳回',
  'corr.rejectNotePrompt': '请输入驳回原因（必填）',
  'corr.rejectNoteRequired': '驳回原因不能为空',
  'corr.fmtPrincipal': '本金',
  'corr.fmtBonus': '赠送',
} as const;

export const CORRECTION_COPY = withCopyOverrides(CORRECTION_COPY_TABLE);

export type CorrectionCopyKey = keyof typeof CORRECTION_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function ck(key: CorrectionCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CORRECTION_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
