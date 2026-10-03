/**
 * 每日自检 /self-check 文案键表（员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（sck. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：表项读 selfCheck.items 端口；今日已交=只读回显+审核状态透出。
 */

import { withCopyOverrides } from '@philia/shared';

const SELFCHECK_COPY_TABLE = {
  'sck.title': '每日自检',
  'sck.no': 'SELF-CHECK',
  'sck.aside': '逐项打点后提交；照片选传，用于留证',
  'sck.pass': '完成',
  'sck.fail': '未完成',
  'sck.photoCta': '＋拍照留证（选传）',
  'sck.photoOn': '已附图 ✓',
  'sck.notePh': '备注（选填）',
  'sck.submit': '提交今日自检',
  'sck.submitting': '提交中…',
  'sck.submitted': '今日自检已提交',
  'sck.unmarked': '还有 {n} 项未打点',
  'sck.doneTitle': '今日已提交',
  'sck.score': '得分 {score}',
  'sck.auditPending': '待店长复核',
  'sck.auditApproved': '复核通过',
  'sck.auditRejected': '复核驳回',
  'sck.empty': '今日没有自检表项',
  'sck.emptyBody': '表项由店长在配置端口维护',
  'sck.loadFail': '加载失败，请检查网络后重试',
  'sck.retry': '重新加载',
} as const;

export const SELFCHECK_COPY = withCopyOverrides(SELFCHECK_COPY_TABLE);
export type SelfCheckCopyKey = keyof typeof SELFCHECK_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function scc(key: SelfCheckCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SELFCHECK_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
