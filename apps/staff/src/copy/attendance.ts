/**
 * 打卡考勤域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：打卡页说明文（围栏口径/定位失败引导/记录空态）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，
 * 键名小写点分、冻结不改。
 *
 * 不抽：通用 UI 词（重试打卡/提交补卡申请）、状态签（正常/迟到/早退/补卡/缺卡）、
 * 表单 label、toast 操作反馈、server 拒写原文透出（「不在门店范围，无法打卡」）、
 * 非安全源提示（@/lib/secureContext 既有常量 INSECURE_CONTEXT_GEO_MESSAGE）。
 * 数值口径：围栏「300 米」为冻结业务口径，随句入键逐字保留。
 */

export const ATTENDANCE_COPY = {
  /* ---- 围栏状态说明 ---- */
  'attendance.fence.range': '打卡范围：门店 300 米内',
  'attendance.fence.noCoord': '门店未配置坐标，本次打卡不校验距离',

  /* ---- 定位失败引导（客户端分支文案，非 server 透传） ---- */
  'attendance.geo.unsupported': '当前设备不支持定位，请更换设备或联系店长',
  'attendance.geo.denied': '定位权限被拒绝：请在浏览器设置中允许定位后重试',
  'attendance.geo.timeout': '定位超时，请到开阔处重试',
  'attendance.geo.failed': '定位失败，请检查定位开关后重试',

  /* ---- 本月记录空态 ---- */
  'attendance.records.empty': '本月还没有考勤记录——到店后点上方按钮打卡',
} as const;

export type AttendanceCopyKey = keyof typeof ATTENDANCE_COPY;
