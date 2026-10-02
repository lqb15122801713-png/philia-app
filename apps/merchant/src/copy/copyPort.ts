/**
 * 文案端口页文案键表（端口批片 B · 控制台第七域「文案」自身文案）
 *
 * 键名小写点分、as const 冻结；数值不进表（{var} 插值）。
 * 注意：本页文案自身也走端口（自身键同表可改——改本页文案=新渲染生效）。
 */

import { withCopyOverrides } from '@philia/shared';

const COPYPORT_COPY_TABLE = {
  /* ---- 页头/分组 ---- */
  'copyport.pageTitle': '文案端口',
  'copyport.pageSub': '界面文案后台可改 · 保存即生效（新渲染）· 全程留痕',
  'copyport.searchPlaceholder': '搜索键名或文案…',
  'copyport.filterHighRisk': '只看高危键',
  'copyport.filterChanged': '只看已改',
  'copyport.highRiskBadge': '高危',
  'copyport.changedBadge': '已改',
  'copyport.defaultNote': '码内默认',
  'copyport.keysCount': '{n} 键',
  'copyport.emptyDomain': '该域无匹配键',
  'copyport.loadFail': '文案配置加载失败，请检查网络后重试',

  /* ---- 编辑/保存 ---- */
  'copyport.editCta': '改文案',
  'copyport.editCancel': '收起',
  'copyport.pendingBar': '{n} 项待保存变更',
  'copyport.saveCta': '保存变更',
  'copyport.savedToast': '文案已保存，客户端新渲染即生效',
  'copyport.saveFail': '保存失败，请稍后再试',

  /* ---- 保存确认弹层（R15 涉钱重确认域） ---- */
  'copyport.confirmTitle': '确认保存文案变更？',
  'copyport.confirmBody': '保存即生效（客户端新渲染）。以下 {n} 项变更将写入口径留痕：',
  'copyport.confirmHighRiskTitle': '含高危键（涉钱/涉协议/涉会员口径）',
  'copyport.confirmHighRiskBody': '以下 {n} 键属高危键，保存前请逐条核对前后值。键入「确认保存」四个字解锁：',
  'copyport.confirmPlaceholder': '键入：确认保存',
  'copyport.confirmOk': '确认保存',
  'copyport.confirmCancel': '再想想',
  'copyport.confirmMismatch': '口令不符，请键入「确认保存」',

  /* ---- 留痕 ---- */
  'copyport.historyTitle': '变更留痕',
  'copyport.historyEmpty': '还没有变更记录',
  'copyport.historyVersion': 'v{version}',
  'copyport.historyBy': '操作人：{name}',

  /* ---- 权限引导（非 owner 页内闸） ---- */
  'copyport.ownerOnly': '文案端口仅店主可改',
  'copyport.ownerOnlyBody': '界面文案涉钱涉口径，仅店主账号可进入编辑。如需调整请联系店主。',
} as const;

export const COPYPORT_COPY = withCopyOverrides(COPYPORT_COPY_TABLE);
export type CopyPortCopyKey = keyof typeof COPYPORT_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function cp(key: CopyPortCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = COPYPORT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
