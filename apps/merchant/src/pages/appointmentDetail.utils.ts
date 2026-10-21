/**
 * PD-66（NO-VOID-ENTRY-ON-MERCHANT-UI）：预约详情页动作区可见性纯函数。
 * 撤核销入口闸：仅 in_service（已核销未收银的服务中单）可见；
 * in_boarding 寄养另案，completed/cancelled 等无入口。
 */

/** 撤核销入口可见性（权限钉店主/有权角色由 server merchantManagerProcedure 兜底，UI 照详情页惯例不按角色分支） */
export const canVoidCheckin = (status: string): boolean => status === 'in_service';
