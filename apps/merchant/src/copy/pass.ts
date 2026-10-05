/**
 * 次卡域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：PassPage（含 TopUpDialog / LogsModal）。
 * 纪律：经营性文案（屏题副题/空态/售卡充次操作引导）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：在效张数等到渲染层读列表数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const PASS_COPY_TABLE = {
  'pass.title': '会员 · 次卡',
  'pass.sub': '在效次卡 {n} 张 · 年费会员细则待定（冻结决策 15）',
  'pass.sellCta': '＋ 售卡',
  'pass.listAside': '按剩余次数',
  'pass.empty': '还没有客户买次卡——洗护 10 次卡是老客最爱',
  'pass.logsAside': '近 100 条 · 倒序',
  'pass.logsEmpty': '暂无扣次流水——预约扣次、取消/拒单回补、售卡充次都会记在这里',
  'pass.topUpCustomerHint': '仅列出本店客户（有本店预约记录或已持本店次卡）；无卡客户将自动建卡（售卡）',
  'pass.topUpTimesHint': '1-999；次卡仅适用于洗护服务',
  /* ---- W-11 校形：M3 四格（真值只接次数包；储值/回馈金负债无本店聚合读口→置灰不造数） ---- */
  'pass.statCards': '持卡会员',
  'pass.statSv': '储值负债',
  'pass.statPass': '次数包',
  'pass.statRebate': '回馈金负债',
  'pass.statPassSub': '剩余可扣 {n} 次',
  'pass.statPending': '读口待补',
  'pass.statPendingNote': '会员域暂无本店聚合读口（现仅按人查），待 server 开口——不造数',
  'pass.threeBooksNote': '三本账分离明面：次卡次数 / 储值 / 回馈金各自单列，永不混列；年费≠储值',
  /* ---- W-11 台账：卡号 mono + 档色点（档色即身份）+ 双归属注 ---- */
  'pass.cardNoCol': '卡号',
  'pass.tierNone': '无档',
  'pass.dualHomeNote': '双归属：次卡=售卡店（本店）归属 · 会员档=办卡店归属 + 全店通用',
} as const;

export const PASS_COPY = withCopyOverrides(PASS_COPY_TABLE);

export type PassCopyKey = keyof typeof PASS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function pc(key: PassCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = PASS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
