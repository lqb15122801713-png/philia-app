/**
 * 寄养打卡域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：寄养入住登记/每日打卡页的经营性文案（异常态题、核销前置引导、超期/退房说明）
 * 一律经本表取值，组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 骨架批片 1（S-10）：页题/晚数注/出口钮已随骨架帧抽键（boarding.title/boarding.night.* 等）。
 * 不抽：toast 操作反馈、server 错误透传（detailQuery.error.message 原样透出）。
 * 动态位：晚数/时刻走 JSX 内 mono 片段，键只持静态 Lead/Tail 碎片（同 me.ts 纪律）。
 */

import { withCopyOverrides } from '@philia/shared';

const BOARDING_COPY_TABLE = {
  /* ---- 异常态（无法查看 / 非寄养单） ---- */
  'boarding.error.title': '无法查看该寄养单',
  'boarding.error.fallbackDesc': '预约不存在或无权查看',
  'boarding.error.notBoarding': '该预约不是寄养单',

  /* ---- 核销前置引导（未核销不可入住登记） ---- */
  'boarding.preCheckin.title': '客户还未到店核销',
  'boarding.preCheckin.desc': '请先在任务台扫码或手动核销该预约，核销后才能办理入住登记。',
  'boarding.preCheckin.action': '去任务台核销',

  /* ---- 已取消 / 取消审核中 ---- */
  'boarding.cancelled.title': '该预约已取消',
  'boarding.cancelRequested.title': '该预约正在取消审核中',
  'boarding.cancelled.desc': '如有疑问请到商家端查看处理。',

  /* ---- 超期横幅 + 完成态横幅 ---- */
  'boarding.overdue.title': '已超期，请提醒商家安排退房',
  'boarding.overdue.dueLead': '应于',
  'boarding.overdue.dueTail': '退房',
  'boarding.completed.banner': '本单已完成退房结算',

  /* ---- 退房二次确认（内联展开） ---- */
  'boarding.checkout.confirmTitle': '确认办理退房？',
  'boarding.checkout.confirmDesc': '退房后预约转入「已完成」；到店付订单请提醒商家在财务页确认收款。',

  /* ---- 骨架帧（S-10：backbar 题 + mono 晚数注 + 出口钮） ---- */
  'boarding.title': '寄养打卡',
  'boarding.night.lead': '第',
  'boarding.night.mid': '晚 · 共',
  'boarding.night.tail': '晚',
  'boarding.backToday': '返回任务台',
  'boarding.checkout.action': '办理退房',
  'boarding.checkout.confirm': '确认退房',
  'boarding.checkout.cancel': '再想想',
  'boarding.checkout.pending': '办理中…',
} as const;

export const BOARDING_COPY = withCopyOverrides(BOARDING_COPY_TABLE);

export type BoardingCopyKey = keyof typeof BOARDING_COPY;
