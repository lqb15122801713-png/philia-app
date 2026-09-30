/**
 * 设置域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：SettingsPage。
 * 纪律：经营性文案（屏题副题/空态/经营口径明面/通知偏好说明）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 * 数值不进本表：通知阈值/时段等到渲染层读口径经 {var} 插值。
 */

export const SETTINGS_COPY = {
  'set.title': '设置',
  'set.sub': '门店与经营口径 · 改动即生效（可约/派单联动）',
  'set.noStoreTitle': '未找到门店信息',
  'set.noStoreHint': '请确认当前账号已完成开店绑定',
  'set.panelStore': '门店',
  'set.panelRules': '经营口径',
  'set.hoursHint': '可约栅格之源',
  'set.addrHint': 'listNearby 距离粗排之用',
  'set.servicesHint': '洗护/造型美容/寄养房型（时长引擎之母）',
  'set.servicesEmpty': '还没有服务项，点下方「＋ 新增服务」创建洗护或寄养服务',
  'set.servicesOffNote': '下架项本次会话内仍列出（可重新上架）；刷新后不再显示（「含下架」列表接口 v2 补齐）',
  'set.notifyAside': '通知偏好仅本机生效（v2 接服务端）',
  'set.autoAcceptHint': 'S4 口径 · 默认开（无开关项，仅口径展示）',
  'set.notifyNewLabel': '新预约通知',
  'set.notifyNewHint': 'SSE store 频道 · 声音提醒',
  'set.notifyCancelLabel': '取消申请提醒',
  'set.notifyCancelHint': '≤4h 申请需审批',
  'set.notifyBoardingLabel': '寄养打卡提醒',
  'set.notifyBoardingHint': '每日 16:00 未打卡提醒员工',
} as const;

export type SettingsCopyKey = keyof typeof SETTINGS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function st(key: SettingsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SETTINGS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
