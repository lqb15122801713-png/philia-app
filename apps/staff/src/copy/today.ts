/**
 * 今日任务台域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：任务台域经营性文案（空态三句话 / 核销台引导语）一律经本表取值，组件内零硬编码；
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 覆盖：TodayPage 无角色空态、GroomerDesk/FrontdeskDesk 空态、核销台手动码引导。
 * 不抽：加载失败/重试等通用 UI 词、toast 操作反馈、aria-label。
 * 插值：{name} 等动态位以 {var} 占位，渲染层 replace 注入。
 */

export const TODAY_COPY = {
  /* ---- TodayPage 无 staff 记录空态（已登录未分配角色，不白屏） ---- */
  'today.noRole.title': '还未分配员工角色',
  'today.noRole.bodyLead': '当前账号「{name}」还没有绑定门店员工身份。',
  'today.noRole.bodyGuide': '请联系店主在商家端「员工管理」邀请入职并分配角色（前台 / 美容师）后再使用。',

  /* ---- GroomerDesk 日轴空态（规格书原文） ---- */
  'today.groomer.empty': '今天没有派给你的单——休息，或去前台看看有没有要帮忙的',

  /* ---- FrontdeskDesk 轴空态 + 核销台引导语 ---- */
  'today.frontdesk.empty': '今天全店无预约——等自动接单，或把预约页分享给老客',
  'today.frontdesk.scanHint': '无摄像头环境走「手动输入 6 位核销码」',
} as const;

export type TodayCopyKey = keyof typeof TODAY_COPY;
