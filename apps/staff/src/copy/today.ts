/**
 * 今日任务台域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：任务台域经营性文案（空态三句话 / 核销台引导语）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 覆盖：TodayPage 无角色空态、GroomerDesk/FrontdeskDesk 空态、核销台手动码引导。
 * 不抽：加载失败/重试等通用 UI 词、toast 操作反馈、aria-label。
 * 插值：{name} 等动态位以 {var} 占位，渲染层 replace 注入。
 */

import { withCopyOverrides } from '@philia/shared';

const TODAY_COPY_TABLE = {
  /* ---- TodayPage 无 staff 记录空态（已登录未分配角色，不白屏） ---- */
  'today.noRole.title': '还未分配员工角色',
  'today.noRole.bodyLead': '当前账号「{name}」还没有绑定门店员工身份。',
  'today.noRole.bodyGuide': '请联系店主在商家端「员工管理」邀请入职并分配角色（前台 / 美容师）后再使用。',

  /* ---- 端口批收尾片 3 · A31：输码绑定入职（auth.bindStaff 公开口） ---- */
  'today.bind.title': '有邀请码？直接绑定入职',
  'today.bind.inputPh': '输入 8 位邀请码',
  'today.bind.submitCta': '绑定入职',
  'today.bind.binding': '绑定中…',
  'today.bind.done': '绑定成功，正在进入工位…',

  /* ---- GroomerDesk 日轴空态（规格书原文） ---- */
  'today.groomer.empty': '今天没有派给你的单——休息，或去前台看看有没有要帮忙的',

  /* ---- FrontdeskDesk 轴空态 + 核销台引导语 ---- */
  'today.frontdesk.empty': '今天全店无预约——等自动接单，或把预约页分享给老客',
  'today.frontdesk.scanHint': '无摄像头环境走「手动输入 6 位核销码」',

  /* ---- S-01 工位台 · 前台核销大卡 + 今日接待分组（骨架批片 1 追加） ---- */
  'today.frontdesk.scanCta': '扫码核销 · 到店登记',
  'today.frontdesk.tag': '今日接待',
  'today.frontdesk.pendingCount': '待核销 {n} 单',
  'today.frontdesk.stats': '已核销 {checked} · 待核销 {waiting} · 服务中 {inService}',
  'today.frontdesk.groupPending': '待核销',
  'today.frontdesk.groupDone': '已核销',

  /* ---- S-01 工位台 · 待办行（改期回退/寄养入住/寄养照护，承自 FrontdeskDesk/AllDayRow） ---- */
  'today.todo.title': '待办',
  'today.todo.reschedule': '改期回退 {n} 单待确认',
  'today.todo.boardingIn': '寄养入住 {n} 只待登记',
  'today.todo.boardingInCta': '入住 ›',
  'today.todo.boardingCareCta': '去打卡 ›',
} as const;

export const TODAY_COPY = withCopyOverrides(TODAY_COPY_TABLE);

export type TodayCopyKey = keyof typeof TODAY_COPY;
