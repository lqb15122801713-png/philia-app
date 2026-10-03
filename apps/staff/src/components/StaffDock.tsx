/**
 * 全域 StaffDock（员工端唯一底部导航）——骨架整建批片 1：内部改渲染 SkDock（S1 flatdock）。
 *
 * dock 四槽冻结「工位/预约/打卡/我的」（UX 语言包 V1.1 §二 S1）；
 * 高 58+safe-area、白卡底+顶发丝线、icon 20 stroke1.6+10.5 签、激活=深棕字+顶部 22×3 淡黄短划
 * （样式全在 styles/skeleton.css .sk-dock，本件零样式）。
 *
 * 签名兼容：active 沿用旧键（today/history/me，新增 punch 对应 /attendance 主级屏），
 * 内部映射 today→work、history→appt、me→me；role prop 忽略但保留（调用点零改动）。
 * 详情级页面（S-05~S-11 二级页）不渲染 dock（统一走返回条）。
 */

import { SkDock, type SkDockActive } from './skeleton'

export type StaffDockActive = 'today' | 'history' | 'punch' | 'me'
export type StaffDockRole = 'groomer' | 'frontdesk'

const ACTIVE_MAP: Record<StaffDockActive, SkDockActive> = {
  today: 'work',
  history: 'appt',
  punch: 'punch',
  me: 'me',
}

export default function StaffDock({ active, role }: { active: StaffDockActive; role: StaffDockRole }) {
  void role // 四槽冻结后角色不再分流 dock 形态；保留 prop 兼容旧调用点
  return <SkDock active={ACTIVE_MAP[active]} />
}
