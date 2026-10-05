/**
 * 手机号脱敏助手（批次 R13a 账号安全）
 *
 * 口径：+86 手机号 → 138****0000（前三后四）。一切留痕表/透出侧只存/只返
 * masked 值（phone_change_requests / phone_change_logs / listDevices 等）；
 * 明文仅存于 users.phone（登录/校验必需）、verification_codes.phone（发送必需）
 * 与 phone_change_requests.new_phone（审批执行载荷，见 schema 表头注报备）。
 */

/** 手机号脱敏：前三后四，中间 4 位 *；空值/短号兜底不泄露原文 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  if (phone.length >= 7) return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  return '****';
}
