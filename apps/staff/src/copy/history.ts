/**
 * 历史页域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：历史域经营性文案（空态三句话）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 不抽：状态映射词（已完成/已取消…）、通用 UI 词（重新加载）、加载失败提示。
 */

import { withCopyOverrides } from '@philia/shared';

const HISTORY_COPY_TABLE = {
  /* ---- 空态（规格书原文；题/说明/出口三句话之合句） ---- */
  'history.empty': '还没有历史单——第一单完成后会出现在这里',
} as const;

export const HISTORY_COPY = withCopyOverrides(HISTORY_COPY_TABLE);

export type HistoryCopyKey = keyof typeof HISTORY_COPY;
