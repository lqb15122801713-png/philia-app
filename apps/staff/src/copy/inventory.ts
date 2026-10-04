/**
 * 盘点域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：盘点域经营性文案（空态三句话/效期处置说明/盲盘口径/退回与待确认说明）
 * 一律经本表取值，组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 骨架批片 1（S-08/S-09）：区题/状态签/通用 UI 词已随骨架帧抽键（inventory.sec·inventory.count 等族）。
 * 不抽：类型映射词（日盘/周盘/盲盘）、toast 操作反馈、server 错误透传。
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

  /* ---- 骨架帧（S-08 盘点列表：apphead + 今日胶囊 + 卡列） ---- */
  'inventory.title': '盘点',
  'inventory.no': 'INVENTORY',
  'inventory.aside.pending': '单待办',
  'inventory.load.fail': '盘点任务加载失败，请检查网络后重试',
  'inventory.retry': '重新加载',
  'inventory.task.created': '建单',
  'inventory.task.countLead': '共',
  'inventory.task.countTail': '项',
  'inventory.task.rejectedEditable': '可重新录入',
  'inventory.status.draft': '待盘点',
  'inventory.status.counted': '待店长确认',
  'inventory.status.rejected': '退回重盘',
  'inventory.list.note': '日盘门槛：单价 ≥¥100 · 盲盘不显示系统库存',
  'inventory.expiry.title': '安心包效期（30 天内到期）',
  'inventory.expiry.loadFail': '效期信息加载失败，请检查网络后重试',
  'inventory.expiry.until': '效期至',
  'inventory.expiry.stock': '库存',
  'inventory.expiry.expired': '已过期',
  'inventory.expiry.leftLead': '剩',
  'inventory.expiry.leftTail': '天',

  /* ---- 骨架帧（S-09 盘点录入：backbar + 录入卡 + 吸底 G2） ---- */
  'inventory.count.execSuffix': '执行',
  'inventory.count.fallbackTitle': '盘点执行',
  'inventory.count.itemsAside': '项',
  'inventory.count.loadFail': '盘点单加载失败，请检查网络后重试',
  'inventory.count.backList': '返回盘点任务',
  'inventory.count.backListPlain': '返回盘点任务列表',
  'inventory.count.systemStock': '账面',
  'inventory.count.actualStock': '实盘',
  'inventory.count.inputPlaceholder': '实盘数量',
  'inventory.count.diffSame': '账实相符',
  'inventory.count.diffLoss': '盘亏',
  'inventory.count.diffGain': '盘盈',
  'inventory.count.submitPending': '提交中…',
  'inventory.count.submitAgain': '重新提交盘点',
  'inventory.count.submit': '提交盘点',
  'inventory.count.submitNeedAll': '请填完全部实盘数量',
  'inventory.count.submitSub': '提交即锁定 · 待店长过账才入账',
  'inventory.count.productFallback': '商品',
} as const;

export const INVENTORY_COPY = withCopyOverrides(INVENTORY_COPY_TABLE);

export type InventoryCopyKey = keyof typeof INVENTORY_COPY;
