/**
 * 规则配置域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：RulesConfigPage（五域说明文 = 域分区 notice × 3 + 重确认警示 × 5 + 口径小字）。
 * 纪律：经营性文案（屏题副题/域说明文/危险操作警示/口径明面）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 * 数值不进本表：版本号/条数等到渲染层读数据经 {var} 插值。
 */

export const RULES_COPY = {
  'rules.pageTitle': '规则配置管理',
  'rules.pageSub': '提成与 XP 全参数 · 页面可改 · 保存即生效 · 每次修改留痕版本化',
  'rules.guideTitle': '规则配置仅店主可用',
  'rules.guideHint': '提成与 XP 参数的调整入口只对店主开放。',
  'rules.errorHint': '仅店主可读取规则配置；请确认登录态后重试',

  /* ---- 五域说明文（域分区顶部小字；commission/xp 两域无 notice——留白即口径） ---- */
  'rules.noticeDuration':
    '占位待供给——当前为引擎占位值照转，老板完整供给表到后在此直接改值，保存即生效、不回溯既有单据。',
  'rules.noticeMemberPlans':
    '档位/价格/回馈金比例/服务折扣/多宠规则老板可调，保存即生效、新规只管新单（不回溯既有会员与单据）。',
  'rules.noticeRefund':
    '店长可办退款的累计阈值（超过须店主审批）与超阈值留口开关（默认关=维持硬拒）。保存即生效、只管新单不回溯；开关属流程留口，改动前先与产品侧对齐口径。',

  /* ---- 危险操作 D 套（重确认警示分域：各域只说自己的影响面） ---- */
  'rules.confirmTitle': '确认保存规则修改',
  'rules.confirmDanger': '危险操作：保存后立即生效，{warn}。新规只约束生效后的单，不回溯历史月份与已快照数据。',
  'rules.warnCommission': '影响全员提成与绩效核算',
  'rules.warnXp': '影响全员 XP 核算',
  'rules.warnDuration': '影响预约引擎时长与可约槽位',
  'rules.warnMemberPlans': '影响会员档权益与新售卡结算',
  'rules.warnRefund': '影响退款审批闸门与超阈值口径',
  'rules.confirmPhrase': '确认保存',
  'rules.confirmHint': '防误触：口令与按钮双重确认',

  /* ---- 口径小字 + 留痕区 ---- */
  'rules.caliberNote':
    '小字口径：规则保存即生效；新规只约束生效后的单，不回溯历史月份与已快照数据。本页仅店主可见可改，每次修改全留痕。',
  'rules.versionsAside': '谁 / 何时 / 前后值（最近 20 条）',
  'rules.versionsEmpty': '暂无修改记录（当前为初始种子版本）',
  'rules.discountHint': '按百分比填写：88 折 = 88%',
  'rules.splitNote': '合计须为 100%',
} as const;

export type RulesCopyKey = keyof typeof RULES_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rc(key: RulesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = RULES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
