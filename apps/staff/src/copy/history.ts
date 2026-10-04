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

  /* ---- 骨架批片 1（S-02 预约·当天 / S-12 切日态）：班轴状态签与空档/班结 ---- */
  'history.axis.done': '已完成',
  'history.axis.cancelled': '已取消',
  'history.axis.now': '服务中',
  'history.axis.boarding': '寄养中',
  'history.axis.confirmed': '待到店',
  'history.axis.pending': '待确认',
  'history.axis.future': '排定',
  'history.axis.nights': '{n} 晚',
  'history.axis.minutes': '{n} 分钟',
  'history.axis.rating': '★ {n}',
  'history.clock.shift': '班次 {range}',
  'history.clock.noShift': '今日无排班',
  'history.dayFoot.past': '{date} 班结 · 共 {n} 单',
  'history.loadFailed': '预约加载失败，请检查网络后重试',
} as const;

export const HISTORY_COPY = withCopyOverrides(HISTORY_COPY_TABLE);

export type HistoryCopyKey = keyof typeof HISTORY_COPY;
