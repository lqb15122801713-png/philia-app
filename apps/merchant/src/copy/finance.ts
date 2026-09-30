/**
 * 财务域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：FinancePage。
 * 纪律：经营性文案（屏题副题/口径明面/空态）一律经本表取值，组件内零硬编码；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 * 数值不进本表：金额/笔数到渲染层读统计经 {var} 插值。
 */

export const FIN_COPY = {
  'fin.title': '财务',
  'fin.sub': '今日已收 ¥{received} · 待收 ¥{pending} · 口径=收款登记（到店付）',
  'fin.capReceivedDay': '今日已收',
  'fin.capReceived7d': '近 7 天已收',
  'fin.capReceivedMonth': '本月已收',
  'fin.capPending': '待收款',
  'fin.capDeduct': '次卡扣次（非现金）',
  'fin.deductNote': '不计入营业额',
  'fin.pendingEmpty': '无待收单',
  'fin.refundStripTitle': '今日退款',
  'fin.refundNetLead': '当日净额=已收−退款：',
  'fin.refundStripNote': '（现金段净额=现金已收−现金退款，现金退款 ¥{amt} 详见日结页； 跨日退款计入发生日，历史封箱不回填）',
  'fin.ledgerTitle': '收款流水',
  'fin.ledgerAside': '按时间倒序',
  'fin.ledgerEmpty': '{period}还没有收款',
} as const;

export type FinCopyKey = keyof typeof FIN_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function fc(key: FinCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = FIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
