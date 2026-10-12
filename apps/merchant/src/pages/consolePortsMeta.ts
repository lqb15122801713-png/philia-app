/**
 * 控制台端口元数据单源件（控制台改版批 片 1 抽建·片 2 复用）：
 * 15 口办事卡面（ConsolePage 首页）与全局搜索（ConsoleSearch 弹层）共用同一份
 * 「端口键 → 人话标题/说明 copy 键」映射——单源防双表漂移。
 */

import type { ConsoleAdminCopyKey } from '../copy/consoleAdmin';

/** 端口键联合（与 ConsolePage PortKey 同值；独立成件防循环导入） */
export type ConsolePortKey =
  | 'copy' | 'slots' | 'member_plans' | 'stored' | 'carepack' | 'marketing' | 'commission' | 'xp'
  | 'dict' | 'correction' | 'recycle' | 'canvas' | 'profile' | 'reportSpec' | 'payChannel';

/** 留痕行数据源键（config.versions 域 copy/member_plans/commission/xp/pay + slots/canvas/correction 专属读口） */
export type LastChangeSource = 'copy' | 'member_plans' | 'commission' | 'xp' | 'pay' | 'slots' | 'canvas' | 'correction';

export interface ConsolePortMeta {
  port: ConsolePortKey;
  titleKey: ConsoleAdminCopyKey;
  hintKey: ConsoleAdminCopyKey;
  lastKey?: LastChangeSource;
  /** 置灰待立口 */
  pending?: boolean;
  /** 直达真页（不进端口内核） */
  to?: string;
}

/** 15 口全量（A/C/D/E/F 域一个不删；序=办事频度） */
export const CONSOLE_PORT_META: readonly ConsolePortMeta[] = [
  { port: 'copy', titleKey: 'cadm.cardCopyTitle', hintKey: 'cadm.cardCopyHint', lastKey: 'copy' },
  { port: 'slots', titleKey: 'cadm.cardSlotsTitle', hintKey: 'cadm.cardSlotsHint', lastKey: 'slots' },
  { port: 'canvas', titleKey: 'cadm.cardCanvasTitle', hintKey: 'cadm.cardCanvasHint', lastKey: 'canvas' },
  { port: 'member_plans', titleKey: 'cadm.cardMemberTitle', hintKey: 'cadm.cardMemberHint', lastKey: 'member_plans' },
  { port: 'commission', titleKey: 'cadm.cardCommissionTitle', hintKey: 'cadm.cardCommissionHint', lastKey: 'commission' },
  { port: 'xp', titleKey: 'cadm.cardXpTitle', hintKey: 'cadm.cardXpHint', lastKey: 'xp' },
  { port: 'payChannel', titleKey: 'cadm.cardPayTitle', hintKey: 'cadm.cardPayHint', lastKey: 'pay' },
  { port: 'correction', titleKey: 'cadm.cardCorrectionTitle', hintKey: 'cadm.cardCorrectionHint', lastKey: 'correction' },
  { port: 'dict', titleKey: 'cadm.cardDictTitle', hintKey: 'cadm.cardDictHint' },
  { port: 'recycle', titleKey: 'cadm.cardRecycleTitle', hintKey: 'cadm.cardRecycleHint' },
  { port: 'profile', titleKey: 'cadm.cardProfileTitle', hintKey: 'cadm.cardProfileHint' },
  { port: 'carepack', titleKey: 'cadm.cardCarepackTitle', hintKey: 'cadm.cardCarepackHint' },
  { port: 'marketing', titleKey: 'cadm.cardMarketingTitle', hintKey: 'cadm.cardMarketingHint', to: '/marketing' },
  { port: 'stored', titleKey: 'cadm.cardStoredTitle', hintKey: 'cadm.cardStoredHint', pending: true },
  { port: 'reportSpec', titleKey: 'cadm.cardReportSpecTitle', hintKey: 'cadm.cardReportSpecHint', pending: true },
];
