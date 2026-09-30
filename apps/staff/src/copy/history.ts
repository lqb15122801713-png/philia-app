/**
 * 历史页域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：历史域经营性文案（空态三句话）一律经本表取值，组件内零硬编码；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 不抽：状态映射词（已完成/已取消…）、通用 UI 词（重新加载）、加载失败提示。
 */

export const HISTORY_COPY = {
  /* ---- 空态（规格书原文；题/说明/出口三句话之合句） ---- */
  'history.empty': '还没有历史单——第一单完成后会出现在这里',
} as const;

export type HistoryCopyKey = keyof typeof HISTORY_COPY;
