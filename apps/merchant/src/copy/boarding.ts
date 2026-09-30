/**
 * 寄养域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：BoardingPage / staff-admin/BoardingStayDetail / staff-admin/CheckoutDialog。
 * 纪律：经营性文案（屏题副题/空态/退房与收款操作引导/规则明面）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 * 数值不进本表：在店只数/晚数等到渲染层读看板数据经 {var} 插值。
 */

export const BOARD_COPY = {
  /* ---- 寄养管理 /boarding ---- */
  'board.title': '寄养',
  'board.sub': '在店 {a} 只 · 今日退房 {b} 只 · {c} 只今日未打卡',
  'board.checkinCta': '＋ 入住登记',
  'board.checkinGuide': '入住登记由前台在员工端办理（到店扫码）',
  'board.panelAside': '按退房日排序',
  'board.emptyTitle': '现在没有寄养的毛孩子',
  'board.emptyBody': '客户寄养单核销入店后会出现在这里',
  'board.detailPlaceholder': '点选左侧在店行查看入住详情',
  'board.roomVacant': '空 · 可订',

  /* ---- 在店详情侧栏（BoardingStayDetail）---- */
  'board.stayLogsGap':
    '打卡明细（喂食 / 遛弯 / 照片墙）的商家查看接口待服务端补齐（v2）； 目前明细可在员工端寄养打卡页查看。',
  'board.stayCheckoutLead': '退房核销由员工在员工端办理（v1.1 起）；员工退房后本单转入「已完成」，',
  'board.stayCheckoutPayStore': '到店付请到财务页「待收款」确认收款。',
  'board.stayCheckoutOther': '款项以店内结算为准。',

  /* ---- 退房确认（CheckoutDialog）---- */
  'board.checkoutOverdue': '本单已超期，请与客户确认续住或按约结算。',
  'board.checkoutPayNote': '本单为到店付：退房后请在财务页「待收款」确认收款，款项才会计入营业额。',
  'board.checkoutConfirmNote': '确认后预约转为「已完成」，房间立即释放；操作幂等，重复点击不会重复结算。',
} as const;

export type BoardCopyKey = keyof typeof BOARD_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function bc(key: BoardCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = BOARD_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
