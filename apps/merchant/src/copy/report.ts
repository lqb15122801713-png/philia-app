/**
 * 报表域文案键表（商家端控制台骨架批 · 片 5 段 3 · W-13 报表屏）
 *
 * 覆盖：FinancePage（/finance 重建：M3 四格 + 左 M5 月度台账 + 右报表目录 wlist D1–D9）。
 * 依据=UX-02 两端定稿语言包 §四 W-13：四格（营收/储值负债/回馈金负债/退款红）→
 * 左月度台账｜右报表目录；月结快照/三本账永不混列注。
 * 口径：储值负债/回馈金负债无店级聚合读口（段 2 已核）→ 置灰「读口待补」不画假件；
 * D1–D9=开口项（18 号档 E4「D1-D9 报表口径/导出 🆕立项」）→ 全量置灰「立项待供给」。
 * 纪律：经营性文案一律经本表取值；数值到渲染层读统计经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const REPORT_COPY_TABLE = {
  /* ---- M3 四格 ---- */
  'rpt.quadRevenue': '本月营收',
  'rpt.quadStored': '储值负债',
  'rpt.quadRebate': '回馈金负债',
  'rpt.quadRefund': '本月退款',
  'rpt.quadPending': '读口待补',
  'rpt.quadStoredNote': '店级聚合读口待补（段 2 已核），置灰不造假',
  'rpt.quadRebateNote': '店级聚合读口待补（段 2 已核），置灰不造假',
  'rpt.quadRefundCount': '共 {n} 笔（已执行+已实退）',

  /* ---- 左 M5 月度台账 ---- */
  'rpt.ledgerTitle': '月度台账',
  'rpt.ledgerAside': '收款流水 · 按时间倒序',

  /* ---- 右报表目录 wlist D1–D9（开口项全量置灰） ---- */
  'rpt.dirTitle': '报表目录',
  'rpt.dirD1': 'D1',
  'rpt.dirD2': 'D2',
  'rpt.dirD3': 'D3',
  'rpt.dirD4': 'D4',
  'rpt.dirD5': 'D5',
  'rpt.dirD6': 'D6',
  'rpt.dirD7': 'D7',
  'rpt.dirD8': 'D8',
  'rpt.dirD9': 'D9',
  'rpt.dirPending': '立项待供给',
  'rpt.dirNote': 'D1–D9 报表口径/导出=开口项（18 号档 E4 🆕立项），全量置灰不画假件',

  /* ---- 口径注（钉在目录区下） ---- */
  'rpt.monthCloseNote': '月结快照：每月封箱留存，历史封箱不回填',
  'rpt.threeBooksNote': '三本账永不混列：营收 / 储值 / 回馈金各自单列',
} as const;

export const REPORT_COPY = withCopyOverrides(REPORT_COPY_TABLE);

export type ReportCopyKey = keyof typeof REPORT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rpt(key: ReportCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = REPORT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
