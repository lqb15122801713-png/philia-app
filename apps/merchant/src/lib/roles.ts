/**
 * 商家端三级账号角色分流（批次 M1-补2 · R2 + 补丁① + 权限矩阵会签稿）
 *
 * 三角色（服务端 merchantProcedure 分层硬闸门，前端只是体验层）：
 * - merchant_owner   店主：全域（反结账/导出/CSV 储值导入仅店主）；
 * - merchant_manager 店长：本店+审批（改价/折扣/日结/流水/看板/财务；无反结账/导出/导入）；
 * - merchant_clerk   店员：收银执行层（开单/挂单/取单/结账/撤未支付单）——
 *   总规则② 店员不看营业额（不见流水与看板；todayTenderStats 服务端硬遮罩
 *   restricted=true），路由层只见收银台，直达其他页给引导页（非 403 白屏）。
 *
 * 矩阵冻结口径：改价/折扣 owner|manager（M1 的 owner-only 已放宽一档）；
 * 撤单（仅未支付单）三级全开（补丁①1）；日结/交接班 owner|manager；
 * 反结账（收银单冲正/日结拆箱）/导出/储值台账导入 仅 owner。
 */

import { useMe } from '@philia/shared'

export interface MerchantRole {
  isOwner: boolean
  /** 店长（不含店主） */
  isManager: boolean
  isClerk: boolean
  /** owner|manager —— 管理层（改价/折扣/日结/流水/看板/财务/交接班） */
  canManage: boolean
  /** owner|manager —— 矩阵总规则②：可见营业额/流水/看板（clerk 服务端硬遮罩） */
  canSeeTurnover: boolean
  /** 当前账号 nickname（开单人显名等） */
  nickname: string | null
  storeId: string | undefined
}

export function useMerchantRole(): MerchantRole {
  const { user } = useMe()
  const isOwner = user?.roles.includes('merchant_owner') ?? false
  const isManager = user?.roles.includes('merchant_manager') ?? false
  const isClerk = user?.roles.includes('merchant_clerk') ?? false
  return {
    isOwner,
    isManager,
    isClerk,
    canManage: isOwner || isManager,
    canSeeTurnover: isOwner || isManager,
    nickname: user?.nickname ?? null,
    storeId: user?.storeId,
  }
}

/** 角色中文签（墨轨底部卡/引导页用） */
export const ROLE_LABEL_CN: Record<string, string> = {
  merchant_owner: '店主',
  merchant_manager: '店长',
  merchant_clerk: '店员',
}

export function roleLabelCn(roles: string[] | undefined): string {
  if (!roles) return '—'
  const hit = ['merchant_owner', 'merchant_manager', 'merchant_clerk'].find((r) => roles.includes(r))
  return hit ? ROLE_LABEL_CN[hit]! : '—'
}

/**
 * clerk 白名单路由（矩阵总规则②：店员只见收银台主屏工作面）；
 * 其余一律给引导页（非 403 白屏）。
 * 「/」放行给 RoleLanding 按角色分流（clerk → /cashier）。
 */
export const CLERK_ALLOWED_PATHS: ReadonlyArray<string> = ['/', '/cashier']

/** clerk 直达受限页的引导文案（按路径定制，缺省通用） */
export function clerkGuideText(pathname: string): { title: string; hint: string } {
  if (pathname.startsWith('/cashier/close')) {
    return { title: '日结 / 交接班由店长或店主处理', hint: '日结冻结与交接班确认属管理层动作；您的收银单会自动计入当班账目。' }
  }
  if (pathname.startsWith('/cashier/records')) {
    return { title: '收银流水由店长或店主查看', hint: '店员不看流水与营业额（门店规矩）；挂单/结账在收银台主屏完成。' }
  }
  if (pathname.startsWith('/dashboard')) {
    return { title: '经营总览由店长或店主查看', hint: '店员不看营业额与看板（门店规矩）；开单收银请用收银台。' }
  }
  if (pathname.startsWith('/finance')) {
    return { title: '财务由店长或店主查看', hint: '店员不看营业额（门店规矩）；收款在收银台主屏完成。' }
  }
  return { title: '该功能由店长或店主处理', hint: '店员账号的工作面是收银台；如需协助请找店长。' }
}
