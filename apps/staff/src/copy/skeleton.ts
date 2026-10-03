/**
 * 员工端骨架批文案键表（片 1 · 骨架重建新增键族）
 * 纪律：键名小写点分、as const 冻结、文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 * 新键随批注册进 copy_overrides（生成器重跑+迁移申报）。
 */

import { withCopyOverrides } from '@philia/shared';

const SKELETON_COPY_TABLE = {
  /* ---- dock 四槽（冻结：工位/预约/打卡/我的） ---- */
  'sk.dockWork': '工位',
  'sk.dockAppt': '预约',
  'sk.dockPunch': '打卡',
  'sk.dockMe': '我的',

  /* ---- 通用件 ---- */
  'sk.back': '返回',
  'sk.today': '今天',
  'sk.yesterday': '昨天',
  'sk.tomorrow': '明天',
  'sk.pickDate': '选日期',

  /* ---- S-01 工位台 ---- */
  'sk.workTitle': '工位',
  'sk.workNo': 'WORKSTATION',
  'sk.idleTitle': '现在没有进行中的服务',
  'sk.idleBody': '来新单会自动顶上来；先去喝口水',
  'sk.nextTitle': '下一单',
  'sk.nextEmpty': '今天后面没有预约了',
  'sk.queueTitle': '排队 {n} 单',
  'sk.dayFoot': '今日班结 · 收工前记得盘点与打卡',
  'sk.stepNow': '进行中',
  'sk.stepDone': '已完成',
  'sk.stepTodo': '待做',
  'sk.workCta': '继续执行',
  'sk.workCtaStart': '开始执行',
  'sk.workCount': '六步进度 {done}/{total}',
  'sk.trioPunch': '打卡',
  'sk.trioPunchSub': '上下班打卡',
  'sk.trioApproval': '补卡审批',
  'sk.trioApprovalSub': '店长视界',
  'sk.trioInventory': '盘点',
  'sk.trioInventorySub': '日盘 ≥¥100',
  'sk.busPending': '在途 {n} 件',

  /* ---- S-02 预约·当天 ---- */
  'sk.apptTitle': '预约',
  'sk.apptNo': 'SCHEDULE',
  'sk.apptEmpty': '这一天没有预约',
  'sk.apptTomorrowNote': '明日 {n} 单 · 早点休息',
  'sk.apptGap': '空档 {n} 分钟',
  'sk.apptHistoryNote': '切到过去=历史单回看（唯一入口）',

  /* ---- S-03 打卡 ---- */
  'sk.punchTitle': '打卡',
  'sk.punchNo': 'ATTENDANCE',
  'sk.punchIn': '上班打卡',
  'sk.punchOut': '下班打卡',
  'sk.punchAgain': '再确认一次',
  'sk.punchInFence': '距店 {n} m · 在围栏内',
  'sk.punchOutFence': '距店 {n} m · 不在围栏',
  'sk.punchWeek': '本周记录',
  'sk.punchFixNote': '漏打卡找店长补录：补卡审批走「我的 → 补卡审批」',
  'sk.punchDone': '已打卡',

  /* ---- S-04 我的 ---- */
  'sk.meTitle': '我的',
  'sk.meNo': 'ME',
  'sk.meGroupA': '提成 / XP / 评价',
  'sk.meGroupB': '盘点 / 审批 / 寄养 / 设置',

  /* ---- 班次/考勤通用 ---- */
  'sk.onDuty': '在岗',
  'sk.offDuty': '未打卡',
} as const;

export const SKELETON_COPY = withCopyOverrides(SKELETON_COPY_TABLE);
export type SkeletonCopyKey = keyof typeof SKELETON_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function skc(key: SkeletonCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = SKELETON_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
