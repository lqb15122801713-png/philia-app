/**
 * 薪资域扩（双轨业绩/协作拆分/回冲明面/工资条/异议申诉）文案键表
 * （员工端 薪资/XP 面扩 · coder K）
 * 纪律：键名小写点分（prl. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：申诉复核时限 {h} 读 payroll.appealSlaHours 端口值（缺省 24）；
 * 发放=标记留痕注记明面（不碰真钱口径）；金额/比例数值不进本表，渲染层插值。
 */

import { withCopyOverrides } from '@philia/shared';

const PAYROLL_COPY_TABLE = {
  /* ---- 双轨业绩注记（大数字卡下两行） ---- */
  'prl.track.labor': '劳动业绩',
  'prl.track.sales': '销售业绩',
  'prl.track.note': '劳动=服务操作营收门市价 · 销售=商品实收',

  /* ---- 协作拆分行注（splitBp 服务明细行尾） ---- */
  'prl.line.splitLead': '协作拆得',

  /* ---- 回冲与调整 ---- */
  'prl.sec.refund': '回冲与调整',
  'prl.refund.row': '跨月退款回冲',
  'prl.adjust.sourceLead': '原属',
  'prl.adjust.note': '负数=跨月回冲 · 正数=补调',

  /* ---- 工资条 ---- */
  'prl.sec.slip': '工资条',
  'prl.slip.commission': '提成',
  'prl.slip.performance': '绩效',
  'prl.slip.deduction': '扣减',
  'prl.slip.adjustment': '调整',
  'prl.slip.netLabel': '本月实发',
  'prl.slip.marked': '已发放',
  'prl.slip.unmarked': '尚未标记发放',
  'prl.slip.markNote': '发放为标记留痕，不代表银行到账',
  'prl.slip.empty': '工资条生成中',
  'prl.slip.emptyBody': '每月结算核对后生成，请稍后再看',
  'prl.slip.appeal': '对工资条申诉',

  /* ---- 扣减行内申诉 ---- */
  'prl.deduction.appeal': '申诉',
  'prl.deduction.reverted': '已返还',

  /* ---- 申诉弹层 ---- */
  'prl.appeal.title': '提交申诉',
  'prl.appeal.reasonPh': '申诉理由（必填，说明情况）',
  'prl.appeal.reasonRequired': '请先填写申诉理由',
  'prl.appeal.photoCta': '＋附图（选传，最多 {max} 张）',
  'prl.appeal.photoFull': '最多传 {max} 张图',
  'prl.appeal.submit': '提交申诉',
  'prl.appeal.submitting': '提交中…',
  'prl.appeal.submitted': '申诉已提交，等待复核',
  'prl.appeal.cancel': '取消',

  /* ---- 我的申诉列表 ---- */
  'prl.sec.myAppeals': '我的申诉',
  'prl.appeals.empty': '暂无申诉记录',
  'prl.appeals.statusPending': '待复核',
  'prl.appeals.statusApproved': '复核通过',
  'prl.appeals.statusRejected': '复核驳回',
  'prl.appeals.reviewLead': '复核注',
  'prl.appeals.refundLead': '返还',
  'prl.appeals.target.deduction': '扣减',
  'prl.appeals.target.slipLine': '工资条',
  'prl.appeals.target.adjustment': '调整项',
  'prl.appeals.slaNote': '申诉将在 {h} 小时内复核（时限口径来自配置端口）',
  'prl.appeals.loadFail': '申诉记录加载失败，请稍后重试',
  'prl.retry': '重新加载',
} as const;

export const PAYROLL_COPY = withCopyOverrides(PAYROLL_COPY_TABLE);
export type PayrollCopyKey = keyof typeof PAYROLL_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function pcc(key: PayrollCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PAYROLL_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
