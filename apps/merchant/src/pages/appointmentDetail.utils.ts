/**
 * PD-66（NO-VOID-ENTRY-ON-MERCHANT-UI）：预约详情页动作区可见性纯函数。
 * PD-79（服务中撤单/撤核销入口）：两入口闸同档——仅 in_service（已核销未收银的
 * 服务中单）且未涉钱（paidAt 空）可见；已收银/涉钱单另闸（本令不放开，服务端
 * assertNoMoneyInvolved 硬闸兜底）；in_boarding 寄养另案，completed/cancelled 等无入口。
 */

/** 撤核销入口可见性（权限钉店主/有权角色由 server merchantManagerProcedure 兜底，UI 照详情页惯例不按角色分支） */
export const canVoidCheckin = (status: string, paidAt?: Date | string | null): boolean =>
  status === 'in_service' && !paidAt;

/** 撤单入口可见性（PD-79 新增；与撤核销同档：in_service 且未涉钱） */
export const canMerchantCancel = (status: string, paidAt?: Date | string | null): boolean =>
  status === 'in_service' && !paidAt;
