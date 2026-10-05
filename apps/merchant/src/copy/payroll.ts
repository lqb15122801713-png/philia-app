/**
 * 薪资域文案键表（员工端骨架整建批 片 4 B3 · 商家端 /payroll + 预约详情协作拆分块）
 *
 * 覆盖：PayrollPage（工资条 + 薪资申诉审批 + 罚单录入，一页三竖排分区，
 * 分区工艺照 OpsPage/ScheduleManagePage u3-panel 竖排）+ 预约详情页协作拆分块。
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const PAYROLL_COPY_TABLE = {
  /* ---- 页头 / 权限引导 ---- */
  'payroll.pageTitle': '薪资',
  'payroll.pageSub': '工资条生成与确认 · 申诉审批 · 罚单录入（发放=标记留痕，不碰真钱）',
  'payroll.guideTitle': '薪资管理由店长或店主处理',
  'payroll.guideHint': '工资条生成、申诉审批与罚单录入属管理层动作；店员账号的工作面是收银台。',

  /* ---- 区 1 工资条 ---- */
  'payroll.slip.title': '工资条',
  'payroll.slip.aside': '月份生成 → 老板确认定稿 → 逐人标记发放（标记留痕不碰真钱）',
  'payroll.slip.monthLabel': '工资月份',
  'payroll.slip.generateCta': '生成工资条',
  'payroll.slip.generating': '生成中…',
  'payroll.slip.generated': '工资条已生成',
  'payroll.slip.statusGenerated': '待确认',
  'payroll.slip.statusConfirmed': '已定稿',
  'payroll.slip.confirmCta': '老板确认',
  'payroll.slip.confirming': '确认中…',
  'payroll.slip.confirmed': '工资条已定稿',
  'payroll.slip.empty': '该月份尚未生成工资条',
  'payroll.slip.colStaff': '员工',
  'payroll.slip.colCommission': '提成',
  'payroll.slip.colPerformance': '绩效',
  'payroll.slip.colDeduction': '扣减',
  'payroll.slip.colAdjustment': '调整项',
  'payroll.slip.colNet': '净额',
  'payroll.slip.colDisburse': '发放',
  'payroll.slip.colAction': '操作',
  'payroll.slip.markCta': '标记发放',
  'payroll.slip.markedBadge': '已发放',
  'payroll.slip.markedByLine': '标记人 {by} · {at}',
  'payroll.slip.markTitle': '标记发放 · {name}',
  'payroll.slip.markNote': '发放=标记留痕（记账动作），系统不碰真钱、不走支付通道。',
  'payroll.slip.methodNotePh': '发放方式备注（选填，如「现金」/「转账尾号」）',
  'payroll.slip.markDone': '发放标记已登记',
  'payroll.slip.disbursedNote': '发放=标记留痕不碰真钱；重复标记幂等，留痕可溯。',

  /* ---- 区 2 薪资申诉审批 ---- */
  'payroll.appeal.title': '薪资申诉审批',
  'payroll.appeal.aside': '员工对罚单/工资条行/调整项的异议在此审批，审批意见留痕',
  'payroll.appeal.filterAll': '全部',
  'payroll.appeal.statusPending': '待审批',
  'payroll.appeal.statusApproved': '已批准',
  'payroll.appeal.statusRejected': '已驳回',
  'payroll.appeal.empty': '当前筛选无申诉单',
  'payroll.appeal.kindDeduction': '罚单申诉',
  'payroll.appeal.kindSlipLine': '工资条行',
  'payroll.appeal.kindAdjustment': '调整项',
  'payroll.appeal.monthLine': '涉月 {month}',
  'payroll.appeal.reasonLabel': '申诉理由',
  'payroll.appeal.evidenceLabel': '附图',
  'payroll.appeal.targetAmountLine': '原额 {amount}',
  'payroll.appeal.expandCta': '展开 ›',
  'payroll.appeal.collapseCta': '收起 ›',
  'payroll.appeal.approveCta': '批准',
  'payroll.appeal.rejectCta': '驳回',
  'payroll.appeal.approveTitle': '批准申诉 · {name}',
  'payroll.appeal.rejectTitle': '驳回申诉 · {name}',
  'payroll.appeal.refundLabel': '返还金额（元，默认原额可改）',
  'payroll.appeal.refundPh': '如 120.00',
  'payroll.appeal.refundInvalid': '返还金额须为不小于 0 的两位小数',
  'payroll.appeal.notePh': '审批意见（必填，随单留痕）',
  'payroll.appeal.approveNotePh': '审批意见（选填，随单留痕）',
  'payroll.appeal.noteRequired': '审批意见不能为空',
  'payroll.appeal.approved': '申诉已批准',
  'payroll.appeal.rejected': '申诉已驳回',
  'payroll.appeal.reviewLine': '{result} · {note}',
  'payroll.appeal.refundLine': '返还 {amount}',

  /* ---- 区 3 罚单录入 ---- */
  'payroll.ded.title': '罚单录入',
  'payroll.ded.aside': '扣减只扣绩效不扣提成；当月累计达上限 server 硬拒（50% 红线）',
  'payroll.ded.staffLabel': '员工',
  'payroll.ded.staffPh': '选择员工',
  'payroll.ded.monthLabel': '归属月份',
  'payroll.ded.amountLabel': '扣减金额（元）',
  'payroll.ded.amountPh': '如 200.00',
  'payroll.ded.reasonLabel': '原因',
  'payroll.ded.reasonPh': '必填，随单留痕',
  'payroll.ded.invalid': '请选员工并填写金额与原因',
  'payroll.ded.amountInvalid': '扣减金额须为大于 0 的两位小数',
  'payroll.ded.submitCta': '录入罚单',
  'payroll.ded.submitting': '录入中…',
  'payroll.ded.created': '罚单已录入',
  'payroll.ded.listTitle': '近 20 条罚单',
  'payroll.ded.empty': '暂无罚单记录',
  'payroll.ded.revertedBadge': '已返还',
  'payroll.ded.revertLine': '返还留痕 · {at}',

  /* ---- 预约详情页协作拆分块（B3-2 录入面） ---- */
  'payroll.collab.title': '协作拆分',
  'payroll.collab.aside': '多人协作单按万分比拆分提成；拆分比入端口',
  'payroll.collab.empty': '未登记协作人，本单提成全归主操作人',
  'payroll.collab.readonlyNote': '已完成单的拆分只读透出；服务中/已确认可编辑',
  'payroll.collab.mainNote': '主操作人吃余数：协作人合计 + 主操作人 = 100%',
  'payroll.collab.editCta': '编辑拆分',
  'payroll.collab.cancelEdit': '取消',
  'payroll.collab.saveCta': '保存拆分',
  'payroll.collab.saving': '保存中…',
  'payroll.collab.saved': '协作拆分已保存',
  'payroll.collab.staffPh': '添加协作员工',
  'payroll.collab.addCta': '添加',
  'payroll.collab.removeCta': '移除',
  'payroll.collab.splitLabel': '拆分比（%）',
  'payroll.collab.splitInvalid': '拆分比须为 0~100 的数，且合计不得超过 100%',
  'payroll.collab.sumLine': '协作合计 {sum}%（余 {rest}% 归主操作人）',
  'payroll.collab.roleLabel': '协作角色',
  'payroll.collab.roleWash': '洗护',
  'payroll.collab.roleGroom': '美容',
  'payroll.collab.roleAssist': '助理',

  /* ---- 通用 ---- */
  'payroll.common.loadFail': '数据加载失败，请检查网络后重试',
  'payroll.common.retry': '重新加载',
  'payroll.common.confirm': '确认提交',
  'payroll.common.cancel': '取消',
  'payroll.common.submitting': '提交中…',
} as const;

export const PAYROLL_COPY = withCopyOverrides(PAYROLL_COPY_TABLE);
export type PayrollCopyKey = keyof typeof PAYROLL_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function py(key: PayrollCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PAYROLL_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
