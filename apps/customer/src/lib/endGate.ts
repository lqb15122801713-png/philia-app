/* 客户端按角色落端判定（D-33 走查修复批 → D-36 软绕收紧 → D-39 home 错端加闸 共用件）。
 * 从 DevLoginPage 抽出（D-39）：dev-login 出口卡与 /home 路由闸同一判定源，禁止两份口径漂移。 */

export type EndTarget = 'staff' | 'merchant'

/* 员工端守卫口径=roles 含 staff（见 apps/staff RequireStaff）；groomer/frontdesk 为 staff 表
   岗位名（种子「小美」挂 staff 行 role=frontdesk），一并计入防御未来 user_roles 扩展 */
export const STAFF_END_ROLES = new Set(['staff', 'groomer', 'frontdesk'])
/* 商家端守卫口径=roles 含 merchant_owner / merchant_manager / merchant_clerk
   （见 apps/merchant RequireMerchant） */
export const MERCHANT_END_ROLES = new Set(['merchant_owner', 'merchant_manager', 'merchant_clerk'])

/** 本端（客户端）端口 → 各端端口映射：dev=7100，生产分端=7201（任务书 D-32 实证口径） */
export const END_PORT_MAP: Record<string, Record<EndTarget, string>> = {
  '7100': { staff: '7102', merchant: '7101' },
  '7201': { staff: '7203', merchant: '7202' },
}
/** 未知拓扑明示卡链接的兜底端口（生产拓扑 7203/7202）——仅出可点链接，不盲跳 */
export const END_PORT_FALLBACK: Record<EndTarget, string> = { staff: '7203', merchant: '7202' }

/** 会话角色 → 错端目标（客户角色=null=本端正确）；判定以会话角色字段为准（D-39 军规②） */
export const resolveEndTarget = (roles: string[]): EndTarget | null =>
  roles.some((r) => STAFF_END_ROLES.has(r))
    ? 'staff'
    : roles.some((r) => MERCHANT_END_ROLES.has(r))
      ? 'merchant'
      : null

/** 本机换端口链接（协议/主机随当前页） */
export const endTargetUrl = (port: string) =>
  `${window.location.protocol}//${window.location.hostname}:${port}/`

/** 当前端口拓扑下错端会话的正确出路 URL（已知拓扑=映射口；未知=生产兜底口，仅出链接不盲跳） */
export const endTargetUrlFor = (target: EndTarget): string => {
  const port = window.location.port
  return endTargetUrl(END_PORT_MAP[port]?.[target] ?? END_PORT_FALLBACK[target])
}
