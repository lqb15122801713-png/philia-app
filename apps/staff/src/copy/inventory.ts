/**
 * 盘点域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：盘点域经营性文案（空态三句话/效期处置说明/盲盘口径/退回与待确认说明）
 * 一律经本表取值，组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 不抽：类型映射词（日盘/周盘/盲盘）、状态签（待盘点/待店长确认/退回重盘）、
 * 通用 UI 词（重新加载/提交盘点/返回盘点任务列表）、表单 label/placeholder、
 * 含业务参数的区题（「安心包效期（30 天内到期）」数值口径不入键）。
 */

import { withCopyOverrides } from '@philia/shared';

const INVENTORY_COPY_TABLE = {
  /* ---- /inventory 待办单 + 安心包效期 ---- */
  'inventory.tasks.empty': '暂无待办盘点单——店长派单后会出现在这里',
  'inventory.expiry.empty': '30 天内没有临期安心包，继续保持',
  'inventory.expiry.note': '临期/过期安心包请走回收登记流程处置，本页仅作提醒（只读）。',

  /* ---- /inventory/:id 执行页 ---- */
  'inventory.count.missing': '该盘点单不在你的待办中——可能已确认入账或已处理',
  'inventory.count.rejected.title': '已退回重盘',
  'inventory.count.rejected.desc': '店长退回了这张盘点单，请核对后修改实盘数重新提交。',
  'inventory.count.counted.title': '已提交，待店长确认后才入账',
  'inventory.count.counted.desc': '确认前库存不变；如被退回会出现在待办里可重盘。',
  'inventory.count.guide': '逐项填写实盘数量后提交；提交后待店长确认才入账，确认前库存不变。',
  'inventory.count.blindNote': '本单为盲盘，不展示账面数。',
  'inventory.count.noItems': '这张单没有盘点行项，请联系店长确认派单范围',
} as const;

export const INVENTORY_COPY = withCopyOverrides(INVENTORY_COPY_TABLE);

export type InventoryCopyKey = keyof typeof INVENTORY_COPY;
