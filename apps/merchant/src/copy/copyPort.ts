/**
 * 文案端口页文案键表（端口批片 B · 控制台第七域「文案」自身文案；
 * 端口批片 C 追加 slotport.* 族=槽位端口页（控制台第八域「槽位」）自身文案，同表同代理）
 *
 * 键名小写点分、as const 冻结；数值不进表（{var} 插值）。
 * 注意：本页文案自身也走端口（自身键同表可改——改本页文案=新渲染生效）。
 */

import { withCopyOverrides } from '@philia/shared';

const COPYPORT_COPY_TABLE = {
  /* ---- 页头/分组 ---- */
  'copyport.pageTitle': '文案端口',
  'copyport.pageSub': '界面文案后台可改 · 保存即生效（新渲染）· 全程留痕',
  'copyport.searchPlaceholder': '搜索键名/文案/位置注…',
  'copyport.filterHighRisk': '只看高危键',
  'copyport.filterChanged': '只看已改',
  'copyport.highRiskBadge': '高危',
  'copyport.changedBadge': '已改',
  'copyport.defaultNote': '码内默认',
  'copyport.keysCount': '{n} 键',
  'copyport.emptyDomain': '该域无匹配键',
  'copyport.loadFail': '文案配置加载失败，请检查网络后重试',
  /* ---- 端口 V2 修正批：屏分组+位置注 ---- */
  'copyport.screenFilterAll': '全部屏',
  'copyport.unscreenedGroup': '未归屏',
  'copyport.unscreenedNote': '以下键的调用页未被屏名字典覆盖（诚实兜底组）——位置注可人工改，复核后挂屏',
  'copyport.positionLabel': '位置注',
  'copyport.positionPlaceholder': '一句人话：这文案在这屏的什么位置',

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

  /* ---- 槽位端口（端口批片 C · 控制台第八域「槽位」） ---- */
  'slotport.pageTitle': '槽位端口',
  'slotport.pageSub': '展示素材后台可换 · 新素材默认待审 · 点上线即生效（新渲染）',
  'slotport.liveBadge': '上线中',
  'slotport.pendingBadge': '待审',
  'slotport.pendingCount': '{n} 个待审',
  'slotport.versionInfo': 'v{version} · 共 {total} 版',
  'slotport.noLive': '暂无上线版本',
  'slotport.placeholderBadge': '占位中',
  'slotport.placeholderNote': '码内默认渐变/图标占位，上传真件并点上线后替换',
  'slotport.uploadCta': '上传替换',
  'slotport.uploading': '上传中…',
  'slotport.uploadedToast': '已上传，待审中（点上线后生效）',
  'slotport.uploadFail': '上传失败，请稍后再试',
  'slotport.pendingTitle': '待审版本',
  'slotport.publishCta': '点上线',
  'slotport.publishedToast': '已上线，客户端新渲染即生效',
  'slotport.publishFail': '上线失败，请稍后再试',
  'slotport.revertCta': '回退上一版',
  'slotport.revertedToast': '已回退上一版，客户端新渲染即生效',
  'slotport.revertFail': '回退失败，请稍后再试',
  'slotport.empty': '槽位注册表为空（种子未落库）',
  'slotport.loadFail': '槽位数据加载失败，请检查网络后重试',
  'slotport.ownerOnly': '槽位端口仅店主可改',
  'slotport.ownerOnlyBody': '展示素材涉门店门面口径，仅店主账号可上传与上线。如需调整请联系店主。',
} as const;

export const COPYPORT_COPY = withCopyOverrides(COPYPORT_COPY_TABLE);
export type CopyPortCopyKey = keyof typeof COPYPORT_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function cp(key: CopyPortCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = COPYPORT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
