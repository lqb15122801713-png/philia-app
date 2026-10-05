/**
 * 店长视图域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：店长视图的经营性文案（非授权引导页题/说明、各区空态、退款区口径说明）
 * 一律经本表取值，组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 骨架批片 1（S-11）：区题/审批钮/口径注已随骨架帧抽键（manager.sec·manager.approve 等族）。
 * 不抽：状态签/类型映射词（补卡/异常/日盘…）、server 错误透传（errMsg）、
 * window.prompt/confirm 对话框文案、toast 操作反馈、表单 label。
 */

import { withCopyOverrides } from '@philia/shared';

const MANAGER_COPY_TABLE = {
  /* ---- 非授权引导页（RoleGuidePage 同口径，非 403 白屏） ---- */
  'manager.guide.title': '店长视图仅店长与老板可用',
  'manager.guide.desc': '当前账号暂无店长权限。考勤/取消/盘点审批与日结确认请改用商家端，或联系店主开通店长角色。',

  /* ---- 各区空态（QueryState emptyText） ---- */
  'manager.attendance.empty': '暂无待审批与防代打标记',
  'manager.cancel.empty': '暂无待审核的取消申请',
  'manager.refund.empty': '暂无退款单',
  'manager.inventory.countedEmpty': '暂无待确认盘点单',
  'manager.inventory.postedEmpty': '暂无已入账盘点单',
  'manager.reviews.empty': '暂无 ≤2 星差评',
  'manager.movements.empty': '暂无库存流水',

  /* ---- 退款区口径说明 ---- */
  'manager.refund.pendingNote': '实退待办（执行超 24 小时未登记）',
  'manager.refund.listNote': '本店退款单（最近 20 条）· 发起入口在商家端收银台',
  'manager.refund.draftNote': '超阈值/涉储值申请须店主审批（驳回权仅店主）',

  /* ---- 盘点区口径说明 ---- */
  'manager.inventory.countedNote': '待确认（店员已录入实盘）',

  /* ---- 骨架帧（S-11：backbar + 异常卡批准/驳回 + 口径注） ---- */
  'manager.title': '店长视图',
  'manager.guide.back': '返回我的',
  'manager.loading': '加载中…',
  'manager.sec.attendance': '考勤审批',
  'manager.sec.cancel': '取消审批',
  'manager.sec.dayclose': '日结确认',
  'manager.sec.refund': '退款',
  'manager.sec.inventory': '盘点',
  'manager.sec.reviews': '差评提示',
  'manager.sec.movements': '库存流水',
  'manager.sec.flagged': '防代打标记（本月 · 只读）',
  'manager.sec.posted': '最近已入账',
  'manager.aside.pending': '条待审',
  'manager.aside.counted': '单待确认',
  'manager.aside.refundPending': '单实退待办',
  'manager.aside.dayclose': '限本店 · 一日一结',
  'manager.aside.reviews': '仅提示 · 不构成工单',
  'manager.aside.movements': '最新 20 条 · 只读',
  'manager.approve': '通过',
  'manager.reject': '驳回',
  'manager.cancel.approve': '批准取消',
  'manager.attendance.note': '驳回必须填写原因 · 通过/驳回全部留痕',
} as const;

export const MANAGER_COPY = withCopyOverrides(MANAGER_COPY_TABLE);

export type ManagerCopyKey = keyof typeof MANAGER_COPY;
