/**
 * 员工心声 /voice 文案键表（员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（vce. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：响应时限 {h} 读 service_rules.voice_sla_hours 端口值（缺省 24），文案不吹死。
 */

import { withCopyOverrides } from '@philia/shared';

const VOICE_COPY_TABLE = {
  'vce.title': '员工心声',
  'vce.no': 'VOICE',
  'vce.formTitle': '提交心声',
  'vce.formAside': '建议、吐槽、求助都可以写；店长会在工作时段处理',
  'vce.descPh': '想对店里说的话…',
  'vce.descRequired': '请先填写心声内容',
  'vce.photoCta': '＋附图（选传，最多 {max} 张）',
  'vce.photoFull': '最多传 {max} 张图',
  'vce.phonePh': '联系方式（选填，便于回复）',
  'vce.submit': '提交',
  'vce.submitting': '提交中…',
  'vce.submitted': '已提交，感谢你的声音',
  'vce.slaNote': '门店承诺 {h} 小时内响应（时限口径来自配置端口）',
  'vce.myList': '我的心声',
  'vce.empty': '还没有提交过心声',
  'vce.statusSubmitted': '已提交',
  'vce.statusReplied': '已回复',
  'vce.statusClosed': '已关闭',
  'vce.replyLead': '门店回复',
  'vce.loadFail': '加载失败，请检查网络后重试',
  'vce.retry': '重新加载',
} as const;

export const VOICE_COPY = withCopyOverrides(VOICE_COPY_TABLE);
export type VoiceCopyKey = keyof typeof VOICE_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function vcc(key: VoiceCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = VOICE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
