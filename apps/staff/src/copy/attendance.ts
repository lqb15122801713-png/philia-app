/**
 * 打卡考勤域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：打卡页说明文（围栏口径/定位失败引导/记录空态）一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 不抽：通用 UI 词（重试打卡/重新加载）、状态签（正常/迟到/早退/补卡/缺卡）、
 * server 拒写原文透出（「不在门店范围，无法打卡」）、
 * 非安全源提示（@/lib/secureContext 既有常量 INSECURE_CONTEXT_GEO_MESSAGE）。
 * 片 2 增量（B1 WiFi/外勤/断网/确认/申诉）与 U5 增量（补卡申请区/审批结果行）：
 * 新 UI 文案一律入键（禁硬编码），见表尾分节。
 * 数值口径：围栏「300 米」为冻结业务口径，随句入键逐字保留。
 */

import { withCopyOverrides } from '@philia/shared';

const ATTENDANCE_COPY_TABLE = {
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

  /* ---- 骨架批片 1（S-03 重排）：打卡卡班次行/周记录行/状态签（原码内硬编码收键） ---- */
  'attendance.shift.line': '班次 {range}',
  'attendance.shift.none': '今日无排班',
  'attendance.punch.busy': '定位打卡中…',
  'attendance.punch.doneIn': '已打上班卡 {time}',
  'attendance.punch.doneOut': '已打下班卡 {time}',
  'attendance.punch.allDone': '今日上下班都已打卡',
  'attendance.records.in': '上班',
  'attendance.records.out': '下班',
  'attendance.records.missing': '缺卡',
  'attendance.records.missingHint': '可在下方申请补卡',
  'attendance.records.makeupPassed': '补卡已通过',
  'attendance.records.flagged': '标记',
  'attendance.status.normal': '正常',
  'attendance.status.late': '迟到',
  'attendance.status.early': '早退',
  'attendance.status.makeup': '补卡',
  'attendance.week.empty': '本周还没有考勤记录——到店后点上方按钮打卡',

  /* ---- 片 2 考勤域（B1-1 WiFi / B1-2 外勤 / B1-3 断网暂存 / B1-6 确认 / B1-7 申诉） ---- */
  'attendance.wifi.title': '门店 WiFi',
  'attendance.wifi.manual': '网页版无法自动读取 WiFi，请手动选择当前连接的门店 WiFi（选中所连 WiFi 后到岗打卡免定位围栏）',
  'attendance.wifi.none': '不使用 WiFi 打卡',
  'attendance.field.tip': '当前在打卡范围外：外勤打卡需上传现场照片，提交后待店长确认',
  'attendance.field.upload': '上传现场照片',
  'attendance.field.uploading': '照片上传中…',
  'attendance.field.ready': '照片已上传，点上方打卡按钮完成外勤打卡',
  'attendance.offline.saved': '网络异常，本次打卡已暂存，恢复网络后自动补传',
  'attendance.offline.banner': '断网暂存 {count} 条打卡，恢复网络后自动补传',
  'attendance.today.detail': '今日打卡明细',
  'attendance.confirm.cta': '确认今日考勤',
  'attendance.confirm.done': '今日考勤已确认',
  'attendance.confirm.toast': '已确认今日考勤',
  'attendance.appeal.cta': '申诉',
  'attendance.appeal.title': '考勤申诉',
  'attendance.appeal.placeholder': '请填写申诉原因（必填）',
  'attendance.appeal.submit': '提交申诉',
  'attendance.appeal.toast': '申诉已提交，待店长处理',
  'attendance.confirmed.chip': '已确认',
  'attendance.source.field': '外勤',
  'attendance.source.offline': '补传',

  /* ---- 走查修复批 D-31：定位不可用放行（端口 attendance_allow_insecure_http，迁移由主代理统一写） ---- */
  'attendance.geo.noGeoNote': '当前环境无法获取定位，本次打卡将以「未取到定位」留痕提交',
  'attendance.source.nogeo': '未取到定位',

  /* ---- U5 定稿升档：补卡申请区 + 审批结果行（原码内硬编码收键；动态数原位保留 u1-num 轨） ---- */
  'attendance.records.loadFail': '考勤记录加载失败，请检查网络后重试',
  'attendance.punch.ok': '已打卡，辛苦了',
  'attendance.punch.duplicated': '今日已打过卡，无需重复操作',
  'attendance.makeup.titleLead': '补卡申请 · 本月还可补',
  'attendance.makeup.titleMid': '次（每月限',
  'attendance.makeup.titleTail': '次）',
  'attendance.makeup.date': '补卡日期（限当月）',
  'attendance.makeup.kind': '班次',
  'attendance.makeup.kindIn': '上班卡',
  'attendance.makeup.kindOut': '下班卡',
  'attendance.makeup.timeIn': '实际上班时间',
  'attendance.makeup.timeOut': '实际下班时间',
  'attendance.makeup.reason': '补卡原因（必填）',
  'attendance.makeup.reasonPh': '例如：到店后忙于接待忘记打卡',
  'attendance.makeup.submit': '提交补卡申请',
  'attendance.makeup.submitting': '提交中…',
  'attendance.makeup.exhausted': '本月补卡次数已用完',
  'attendance.makeup.toast': '补卡申请已提交，待店长审批',
  'attendance.makeup.needReason': '请填写补卡原因',
  'attendance.makeup.datePh': '格式：2026-10-22（年-月-日）',
  'attendance.makeup.timePh': '格式：09:00（24 小时制）',
  'attendance.makeup.invalid': '请按提示格式填写补卡日期与时间（限当月，24 小时制）',
  'attendance.approval.pending': '待审批',
  'attendance.approval.approved': '已通过',
  'attendance.approval.rejected': '已驳回',
  'attendance.approval.makeup': '补卡',
  'attendance.approval.abnormal': '异常',
  'attendance.approval.reason': '原因：{reason}',
  'attendance.approval.rejectNote': '驳回备注：{note}',
} as const;

export const ATTENDANCE_COPY = withCopyOverrides(ATTENDANCE_COPY_TABLE);

export type AttendanceCopyKey = keyof typeof ATTENDANCE_COPY;
