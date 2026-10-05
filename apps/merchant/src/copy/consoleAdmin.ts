/**
 * 开发者管理端文案键表（商家端控制台骨架批 · 片 5 段 3 · W-16 聚合新建）
 *
 * 覆盖：ConsolePage（/console 真页替换段 0 占位：左 WcPorts 端口目录 → 右端口编辑
 * + WcPub 发布流 + WcLog 留痕 + WDanger 危险区）。
 * 依据=UX-02 两端定稿语言包 §四 W-16：M8 三件；共构不分叉；L2-④ 二次 PIN；
 * 动规则不动账；冻结项只读。
 * 键族 cadm.*（避开 copyport/slotport/rules/console 既有域）。
 * 共构不分叉：右栏直接复用 RulesConfigPage/CopyConfigPage/SlotPortPage 内核件，
 * 本表只承载聚合层文案（目录章/空态/透出注），内核文案仍在各原族。
 */

import { withCopyOverrides } from '@philia/shared';

const CONSOLE_ADMIN_COPY_TABLE = {
  'cadm.pageTitle': '开发者管理端',
  'cadm.pageSub': '端口配置与发布 · 店主专属 · 共构不分叉',

  /* ---- 左端口目录（A–E 域章；seal=域码槽号） ---- */
  'cadm.groupA': 'A · 内容运营',
  'cadm.groupC': 'C · 会员机制',
  'cadm.groupD': 'D · 员工规则',
  'cadm.groupE': 'E · 门店·数据',
  'cadm.portCopy': '文案端口',
  'cadm.portSlots': '槽位端口',
  'cadm.portMember': '会员档',
  'cadm.portStored': '储值',
  'cadm.portCommission': '提成',
  'cadm.portXp': 'XP',
  'cadm.portProfile': '门店档案',
  'cadm.portReportSpec': '报表口径',
  'cadm.portPendingNote': '置灰 · 端口待立',

  /* ---- 置灰域空态（R10 不画假件：开口项只读占位+明面注） ---- */
  'cadm.storedEmptyTitle': '储值端口待立',
  'cadm.storedEmptyBody': '储值参数暂无独立配置域（储值提成规则已作废置灰，归提成域只读行）；立项前本口只读占位。',
  'cadm.profileEmptyTitle': '档案端口未收编',
  'cadm.profileEmptyBody': '门店档案维护在「门店档案·设置」页（W-15）；本口立项后收编，当前只读占位。',
  'cadm.reportSpecEmptyTitle': '报表口径端口待立',
  'cadm.reportSpecEmptyBody': 'D1–D9 报表口径/导出=开口项（18 号档 E4 🆕立项待供给）；本口只读占位。',

  /* ---- 发布流 / 留痕透出注 ---- */
  'cadm.pubNote': '发布流透出：草稿→预览→发布推三端；回滚=槽位卡「回退上一版」真链路（publish/revert 同管道，虚线注非新件）。',
  'cadm.logTitle': '留痕',
  'cadm.logAside': 'config.versions / 槽位版本计数现状透出',

  /* ---- 危险区（暖底赭红题带；透出既有闸，不新建件） ---- */
  'cadm.dangerPin': '二次确认=L2-④ 二次 PIN：保存须键入「确认保存」口令（文案高危键逐键确认），沿用既有 highRisk 口令闸，非独立 PIN 件。',
  'cadm.dangerFrozen': '冻结项只读：作废/备用/预留规则行与结构字段（如会员档免费属性）不给改。',
  'cadm.dangerNoBackdate': '动规则不动账：规则改动只约束生效后的单，不回溯历史月份与已快照数据。',

  /* ---- 共构不分叉注（页底明面） ---- */
  'cadm.coexistNote': '共构不分叉：右栏直接复用规则配置/文案端口/槽位端口三页内核；旧路由 /settings/rules · /settings/copy · /settings/slots 保留可直达。',

  /* ---- 非 owner 引导（manager；clerk 由 ClerkRouteGuard 拦） ---- */
  'cadm.ownerOnlyTitle': '开发者管理端仅店主可用',
  'cadm.ownerOnlyBody': '端口配置与发布属店主专属（页内闸门 + server 硬闸门兜底）；请切换店主账号。',
} as const;

export const CONSOLE_ADMIN_COPY = withCopyOverrides(CONSOLE_ADMIN_COPY_TABLE);

export type ConsoleAdminCopyKey = keyof typeof CONSOLE_ADMIN_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function cadm(key: ConsoleAdminCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CONSOLE_ADMIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
