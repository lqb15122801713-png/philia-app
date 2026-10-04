/**
 * 问题上报 /pdca 文案键表（员工端骨架整建批 片 3 · 员工端，coder H）
 * 纪律：键名小写点分（pdc. 族前缀防全局撞键）、as const 冻结、withCopyOverrides 代理
 * （端口值优先、码内默认 fallback）；新键随批注册进 copy_overrides（生成器重跑申报）。
 * 口径：员工可见本店全部问题单；我是责任人的单可「开始整改/提交整改」；
 * 类目集读 service_rules.pdca_categories 端口值（缺省回落码内表）。
 */

import { withCopyOverrides } from '@philia/shared';

const PDCA_COPY_TABLE = {
  'pdc.title': '问题上报',
  'pdc.no': 'PDCA',
  'pdc.tabAll': '全部',
  'pdc.tabOpen': '待整改',
  'pdc.tabFixing': '整改中',
  'pdc.tabRecheck': '待复检',
  'pdc.tabClosed': '已关闭',
  'pdc.raiseTitle': '上报问题',
  'pdc.titlePh': '一句话说清问题',
  'pdc.titleRequired': '请先填写问题标题',
  'pdc.categoryPh': '选择类目',
  'pdc.detailPh': '补充说明（选填）',
  'pdc.photoCta': '＋拍照留证（选传，最多 {max} 张）',
  'pdc.photoFull': '最多传 {max} 张图',
  'pdc.submit': '提交',
  'pdc.submitting': '提交中…',
  'pdc.submitted': '已上报，店长会分派整改',
  'pdc.mine': '我负责',
  'pdc.startFix': '开始整改',
  'pdc.submitFix': '提交整改',
  'pdc.fixNotePh': '整改说明（怎么处理的）…',
  'pdc.fixNoteRequired': '请填写整改说明',
  'pdc.fixStarted': '已认领整改',
  'pdc.fixSubmitted': '整改已提交，待复检',
  'pdc.empty': '该状态下暂无问题单',
  'pdc.listTitle': '问题单',
  'pdc.loadFail': '加载失败，请检查网络后重试',
  'pdc.retry': '重新加载',
} as const;

export const PDCA_COPY = withCopyOverrides(PDCA_COPY_TABLE);
export type PdcaCopyKey = keyof typeof PDCA_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function pcc(key: PdcaCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PDCA_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
