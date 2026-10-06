/**
 * 库存域文案键表（商家端大批片 4 · /inventory 库存域页 + /transfers 调拨要货页）
 * 纪律：键名小写点分、as const 冻结；数值不进表（{var} 插值）；
 * 文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 */

import { withCopyOverrides } from '@philia/shared';

const INVENTORY_COPY_TABLE = {
  /* ---- /inventory 页头 / 权限引导 / 毛利视界注记 ---- */
  'inv.pageTitle': '库存',
  'inv.pageSub': '上下限预警 · 效期批次 · 报损 · 估清恢复',
  'inv.guideTitle': '库存域由店长或店主处理',
  'inv.guideHint': '批次、预警、报损与估清属管理层动作；店员账号的工作面是收银台。',
  'inv.marginNote': '进价/成本与毛利=店主/店长视界（server 双层闸）',

  /* ---- 区 1 上下限预警（stock2.stockAlerts） ---- */
  'inv.alerts.title': '上下限预警',
  'inv.alerts.aside': '低于下限=缺（含建议补货量）；高于上限=溢',
  'inv.alerts.empty': '暂无上下限预警（未设上下限的商品不参与）',
  'inv.alerts.lowBadge': '缺',
  'inv.alerts.highBadge': '溢',
  'inv.alerts.suggestQty': '建议补 {n} 件',
  'inv.alerts.stockNow': '现存 {stock} · 下限 {min}',
  'inv.alerts.stockHigh': '现存 {stock} · 上限 {max}',

  /* ---- 区 2 效期看板（stock2.expiryBoard） ---- */
  'inv.expiry.title': '效期看板',
  'inv.expiry.aside': '临期分级（急 ≤{u} 天 / 临 ≤{w} 天）；仅透出非安全行',
  'inv.expiry.empty': '暂无临期 / 过期批次',
  'inv.expiry.gradeExpired': '已过期',
  'inv.expiry.gradeUrgent': '急',
  'inv.expiry.gradeWarn': '临期',
  'inv.expiry.daysLeft': '余 {n} 天',
  'inv.expiry.expiredDays': '已过期 {n} 天',
  'inv.expiry.quarantineCta': '隔离',
  'inv.expiry.quarantineDone': '批次已隔离，库存已同步扣出',
  'inv.expiry.destroyCta': '销毁',
  'inv.expiry.destroyTitle': '销毁登记',
  'inv.expiry.destroyReasonPh': '销毁事由（必填，留痕）',
  'inv.expiry.destroyReasonRequired': '销毁事由不能为空',
  'inv.expiry.destroyDone': '销毁已登记',

  /* ---- 区 3 批次（stock2.batchList / batchCreate / fefoSuggestion） ---- */
  'inv.batch.title': '批次',
  'inv.batch.aside': '按品筛选；效期=生产日期+保质期自动算；FEFO 建议首行先出',
  'inv.batch.filterAll': '全部商品',
  'inv.batch.empty': '暂无批次记录',
  'inv.batch.createCta': '手工入批',
  'inv.batch.createTitle': '手工入批',
  'inv.batch.productLabel': '商品',
  'inv.batch.noLabel': '批号',
  'inv.batch.noPh': '如 20261006-A',
  'inv.batch.qtyLabel': '数量',
  'inv.batch.prodDateLabel': '生产日期',
  'inv.batch.shelfLifeLabel': '保质期（天）',
  'inv.batch.fefoFirst': '先出',
  'inv.batch.qtyUnit': '×{n}',
  'inv.batch.noExpiry': '未设效期',
  'inv.batch.statusActive': '在库',
  'inv.batch.statusQuarantined': '已隔离',
  'inv.batch.statusDestroyed': '已销毁',
  'inv.batch.noRequired': '批号必填',
  'inv.batch.qtyInvalid': '数量需为 1 ~ 1000000 的整数',
  'inv.batch.createDone': '批次已入，库存已累加',

  /* ---- 区 4 报损（stock2.writeoffCreate / writeoffList） ---- */
  'inv.writeoff.title': '报损',
  'inv.writeoff.aside': '当场录入进审批，审批通过后扣库存',
  'inv.writeoff.empty': '暂无报损记录',
  'inv.writeoff.createCta': '当场录入',
  'inv.writeoff.createTitle': '报损录入',
  'inv.writeoff.qtyLabel': '数量',
  'inv.writeoff.reasonLabel': '原因',
  'inv.writeoff.reasonPh': '如：破损 / 过期 / 丢失（必填）',
  'inv.writeoff.reasonRequired': '报损原因不能为空',
  'inv.writeoff.createDone': '报损已录入，待审批',
  'inv.writeoff.statusPending': '待审批',
  'inv.writeoff.statusApproved': '已通过',
  'inv.writeoff.statusRejected': '已驳回',

  /* ---- 区 5 估清 / 恢复（stock2.markSoldOut / restockProduct） ---- */
  'inv.soldout.title': '估清 / 恢复',
  'inv.soldout.aside': '估清=库存归零商城立即禁售；恢复=补货回库',
  'inv.soldout.empty': '暂无商品',
  'inv.soldout.markCta': '估清',
  'inv.soldout.markDone': '已估清，商城立即不可售',
  'inv.soldout.restockCta': '恢复补货',
  'inv.soldout.restockTitle': '恢复补货',
  'inv.soldout.restockQtyLabel': '补货数量',
  'inv.soldout.restockDone': '已补货 {n} 件',
  'inv.soldout.stockLabel': '现存 {n}',
  'inv.soldout.costLabel': '成本',

  /* ---- 通用 ---- */
  'inv.common.loadFail': '数据加载失败，请检查网络后重试',
  'inv.common.retry': '重新加载',
  'inv.common.cancel': '取消',
  'inv.common.confirm': '确认提交',
  'inv.common.submitting': '提交中…',

  /* ---- /transfers 页头 / 权限引导 ---- */
  'trf.pageTitle': '调拨要货',
  'trf.pageSub': '店间调拨成对确认 · 在途视图 · 要货申请',
  'trf.guideTitle': '调拨要货由店长或店主处理',
  'trf.guideHint': '店间调拨与要货申请属管理层动作；店员账号的工作面是收银台。',

  /* ---- 区 1 调拨（stock2.transferCreate / transferList / transferShip / transferReceive） ---- */
  'trf.move.title': '调拨',
  'trf.move.aside': '发起→审批→发货→接收，成对确认',
  'trf.move.createCta': '发起调拨',
  'trf.move.createTitle': '发起调拨',
  'trf.move.toStoreLabel': '目标店',
  'trf.move.toStorePh': '选择目标门店',
  'trf.move.productLabel': '商品',
  'trf.move.qtyLabel': '数量',
  'trf.move.notePh': '备注（可选）',
  'trf.move.noStore': '暂无可调拨的他店（限老板全域集合内）',
  'trf.move.createDone': '调拨已发起，待审批',
  'trf.move.dirOut': '调出',
  'trf.move.dirIn': '调入',
  'trf.move.empty': '暂无调拨单',
  'trf.move.shipCta': '发货',
  'trf.move.shipDone': '已发货，转入在途',
  'trf.move.receiveCta': '接收',
  'trf.move.receiveDone': '已接收，库存已入账',
  'trf.move.statusPending': '待审批',
  'trf.move.statusApproved': '已审批',
  'trf.move.statusRejected': '已驳回',
  'trf.move.statusInTransit': '在途',
  'trf.move.statusReceived': '已接收',
  'trf.move.toLabel': '→ {name}',
  'trf.move.fromLabel': '← {name}',
  'trf.move.itemsSummary': '{n} 品 {q} 件',

  /* ---- 区 2 在途视图（stock2.transferInTransit） ---- */
  'trf.transit.title': '在途视图',
  'trf.transit.aside': '超 {h} 小时未接收=超时红签',
  'trf.transit.empty': '暂无在途调拨',
  'trf.transit.hours': '在途 {h} 小时',
  'trf.transit.hoursUnknown': '发货时间未知',
  'trf.transit.overdue': '超时',

  /* ---- 区 3 要货（stock2.replenishSuggest / replenishCreate / replenishList / replenishFulfill） ---- */
  'trf.rep.title': '要货',
  'trf.rep.aside': '建议量=上限−现存（无上限按下限）；申请进审批',
  'trf.rep.createCta': '发起要货',
  'trf.rep.suggest': '建议量 {n} 件',
  'trf.rep.createDone': '要货申请已提交，待审批',
  'trf.rep.empty': '暂无要货申请',
  'trf.rep.fulfillCta': '履约',
  'trf.rep.fulfillDone': '已履约，库存已入账',
  'trf.rep.statusPending': '待审批',
  'trf.rep.statusApproved': '已审批',
  'trf.rep.statusRejected': '已驳回',
  'trf.rep.statusFulfilled': '已履约',
} as const;

export const INVENTORY_COPY = withCopyOverrides(INVENTORY_COPY_TABLE);
export type InventoryCopyKey = keyof typeof INVENTORY_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件） */
export function iv(key: InventoryCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = INVENTORY_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
