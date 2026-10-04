/**
 * 寄养域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：BoardingPage / staff-admin/BoardingStayDetail / staff-admin/CheckoutDialog。
 * 纪律：经营性文案（屏题副题/空态/退房与收款操作引导/规则明面）一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：在店只数/晚数等到渲染层读看板数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const BOARD_COPY_TABLE = {
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

  /* ---- 片 5 段 1 · W-05 校形（M3 四格 / M7 容量日历 / 疫苗硬规则置灰注） ---- */
  'board.m3InStore': '在店',
  'board.m3Checkin': '今日入住',
  'board.m3Checkout': '今日退房',
  'board.m3Overdue': '超期',
  'board.capCalNote': '容量=在架房型间数合计，已住=逐晚预订槽位（boardingAvailability 预订口径，与上方在店口径不同源）',
  'board.capCalLoading': '容量日历加载中…',
  'board.capCalError': '容量日历加载失败',
  'board.vaccineNote': '疫苗硬规则：员工端入住页透出疫苗有效期（过期赭红、30 天内到期提醒），过期不可入住的置灰拦截以员工端为准',
} as const;

export const BOARD_COPY = withCopyOverrides(BOARD_COPY_TABLE);

export type BoardCopyKey = keyof typeof BOARD_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function bc(key: BoardCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = BOARD_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
