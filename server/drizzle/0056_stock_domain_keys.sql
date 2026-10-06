-- 商家端大批片 4（库存域+调拨要货）：copy 键注册 152 枚（inv.*/trf.* 库存调拨两页+ops.stock 审批区+prod. 成本三列；生成件同帧=copySeedRows 3344 行）
-- 幂等：rule_key active 行 NOT EXISTS 守卫；created_by='system'（FK=OFF 惯例见 migrate.ts 头注）。
-- 工艺：本文件=脚本生成（多句 INSERT 全前缀+计数断言=152，0052/0053 断链事故后立规矩）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.aside', 'merchant:inventory', json_object('text', '低于下限=缺（含建议补货量）；高于上限=溢'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.empty', 'merchant:inventory', json_object('text', '暂无上下限预警（未设上下限的商品不参与）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.highBadge', 'merchant:inventory', json_object('text', '溢'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.highBadge' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.lowBadge', 'merchant:inventory', json_object('text', '缺'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.lowBadge' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.stockHigh', 'merchant:inventory', json_object('text', '现存 {stock} · 上限 {max}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.stockHigh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.stockNow', 'merchant:inventory', json_object('text', '现存 {stock} · 下限 {min}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.stockNow' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.suggestQty', 'merchant:inventory', json_object('text', '建议补 {n} 件'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.suggestQty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.alerts.title', 'merchant:inventory', json_object('text', '上下限预警'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.alerts.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.aside', 'merchant:inventory', json_object('text', '按品筛选；效期=生产日期+保质期自动算；FEFO 建议首行先出'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.createCta', 'merchant:inventory', json_object('text', '手工入批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.createDone', 'merchant:inventory', json_object('text', '批次已入，库存已累加'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.createDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.createTitle', 'merchant:inventory', json_object('text', '手工入批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.createTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.empty', 'merchant:inventory', json_object('text', '暂无批次记录'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.fefoFirst', 'merchant:inventory', json_object('text', '先出'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.fefoFirst' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.filterAll', 'merchant:inventory', json_object('text', '全部商品'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.filterAll' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.noExpiry', 'merchant:inventory', json_object('text', '未设效期'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.noExpiry' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.noLabel', 'merchant:inventory', json_object('text', '批号'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.noLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.noPh', 'merchant:inventory', json_object('text', '如 20261006-A'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.noPh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.noRequired', 'merchant:inventory', json_object('text', '批号必填'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.noRequired' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.prodDateLabel', 'merchant:inventory', json_object('text', '生产日期'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.prodDateLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.productLabel', 'merchant:inventory', json_object('text', '商品'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.productLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.qtyInvalid', 'merchant:inventory', json_object('text', '数量需为 1 ~ 1000000 的整数'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.qtyInvalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.qtyLabel', 'merchant:inventory', json_object('text', '数量'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.qtyLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.qtyUnit', 'merchant:inventory', json_object('text', '×{n}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.qtyUnit' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.shelfLifeLabel', 'merchant:inventory', json_object('text', '保质期（天）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.shelfLifeLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.statusActive', 'merchant:inventory', json_object('text', '在库'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.statusActive' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.statusDestroyed', 'merchant:inventory', json_object('text', '已销毁'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.statusDestroyed' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.statusQuarantined', 'merchant:inventory', json_object('text', '已隔离'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.statusQuarantined' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.batch.title', 'merchant:inventory', json_object('text', '批次'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.batch.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.common.cancel', 'merchant:inventory', json_object('text', '取消'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.common.cancel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.common.confirm', 'merchant:inventory', json_object('text', '确认提交'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.common.confirm' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.common.loadFail', 'merchant:inventory', json_object('text', '数据加载失败，请检查网络后重试'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.common.loadFail' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.common.retry', 'merchant:inventory', json_object('text', '重新加载'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.common.retry' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.common.submitting', 'merchant:inventory', json_object('text', '提交中…'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.common.submitting' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.aside', 'merchant:inventory', json_object('text', '临期分级（急 ≤{u} 天 / 临 ≤{w} 天）；仅透出非安全行'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.daysLeft', 'merchant:inventory', json_object('text', '余 {n} 天'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.daysLeft' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.destroyCta', 'merchant:inventory', json_object('text', '销毁'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.destroyCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.destroyDone', 'merchant:inventory', json_object('text', '销毁已登记'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.destroyDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.destroyReasonPh', 'merchant:inventory', json_object('text', '销毁事由（必填，留痕）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.destroyReasonPh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.destroyReasonRequired', 'merchant:inventory', json_object('text', '销毁事由不能为空'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.destroyReasonRequired' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.destroyTitle', 'merchant:inventory', json_object('text', '销毁登记'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.destroyTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.empty', 'merchant:inventory', json_object('text', '暂无临期 / 过期批次'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.expiredDays', 'merchant:inventory', json_object('text', '已过期 {n} 天'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.expiredDays' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.gradeExpired', 'merchant:inventory', json_object('text', '已过期'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.gradeExpired' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.gradeUrgent', 'merchant:inventory', json_object('text', '急'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.gradeUrgent' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.gradeWarn', 'merchant:inventory', json_object('text', '临期'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.gradeWarn' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.quarantineCta', 'merchant:inventory', json_object('text', '隔离'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.quarantineCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.quarantineDone', 'merchant:inventory', json_object('text', '批次已隔离，库存已同步扣出'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.quarantineDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.expiry.title', 'merchant:inventory', json_object('text', '效期看板'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.expiry.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.guideHint', 'merchant:inventory', json_object('text', '批次、预警、报损与估清属管理层动作；店员账号的工作面是收银台。'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.guideHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.guideTitle', 'merchant:inventory', json_object('text', '库存域由店长或店主处理'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.guideTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.marginNote', 'merchant:inventory', json_object('text', '进价/成本与毛利=店主/店长视界（server 双层闸）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.marginNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.pageSub', 'merchant:inventory', json_object('text', '上下限预警 · 效期批次 · 报损 · 估清恢复'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.pageSub' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.pageTitle', 'merchant:inventory', json_object('text', '库存'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.pageTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.aside', 'merchant:inventory', json_object('text', '估清=库存归零商城立即禁售；恢复=补货回库'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.costLabel', 'merchant:inventory', json_object('text', '成本'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.costLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.empty', 'merchant:inventory', json_object('text', '暂无商品'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.markCta', 'merchant:inventory', json_object('text', '估清'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.markCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.markDone', 'merchant:inventory', json_object('text', '已估清，商城立即不可售'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.markDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.restockCta', 'merchant:inventory', json_object('text', '恢复补货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.restockCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.restockDone', 'merchant:inventory', json_object('text', '已补货 {n} 件'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.restockDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.restockQtyLabel', 'merchant:inventory', json_object('text', '补货数量'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.restockQtyLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.restockTitle', 'merchant:inventory', json_object('text', '恢复补货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.restockTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.stockLabel', 'merchant:inventory', json_object('text', '现存 {n}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.stockLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.soldout.title', 'merchant:inventory', json_object('text', '估清 / 恢复'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.soldout.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.aside', 'merchant:inventory', json_object('text', '当场录入进审批，审批通过后扣库存'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.createCta', 'merchant:inventory', json_object('text', '当场录入'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.createDone', 'merchant:inventory', json_object('text', '报损已录入，待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.createDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.createTitle', 'merchant:inventory', json_object('text', '报损录入'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.createTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.empty', 'merchant:inventory', json_object('text', '暂无报损记录'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.qtyLabel', 'merchant:inventory', json_object('text', '数量'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.qtyLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.reasonLabel', 'merchant:inventory', json_object('text', '原因'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.reasonLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.reasonPh', 'merchant:inventory', json_object('text', '如：破损 / 过期 / 丢失（必填）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.reasonPh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.reasonRequired', 'merchant:inventory', json_object('text', '报损原因不能为空'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.reasonRequired' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.statusApproved', 'merchant:inventory', json_object('text', '已通过'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.statusApproved' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.statusPending', 'merchant:inventory', json_object('text', '待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.statusPending' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.statusRejected', 'merchant:inventory', json_object('text', '已驳回'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.statusRejected' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inv.writeoff.title', 'merchant:inventory', json_object('text', '报损'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inv.writeoff.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.guideHint', 'merchant:inventory', json_object('text', '店间调拨与要货申请属管理层动作；店员账号的工作面是收银台。'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.guideHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.guideTitle', 'merchant:inventory', json_object('text', '调拨要货由店长或店主处理'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.guideTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.aside', 'merchant:inventory', json_object('text', '发起→审批→发货→接收，成对确认'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.createCta', 'merchant:inventory', json_object('text', '发起调拨'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.createDone', 'merchant:inventory', json_object('text', '调拨已发起，待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.createDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.createTitle', 'merchant:inventory', json_object('text', '发起调拨'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.createTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.dirIn', 'merchant:inventory', json_object('text', '调入'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.dirIn' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.dirOut', 'merchant:inventory', json_object('text', '调出'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.dirOut' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.empty', 'merchant:inventory', json_object('text', '暂无调拨单'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.fromLabel', 'merchant:inventory', json_object('text', '← {name}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.fromLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.itemsSummary', 'merchant:inventory', json_object('text', '{n} 品 {q} 件'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.itemsSummary' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.noStore', 'merchant:inventory', json_object('text', '暂无可调拨的他店（限老板全域集合内）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.noStore' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.notePh', 'merchant:inventory', json_object('text', '备注（可选）'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.notePh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.productLabel', 'merchant:inventory', json_object('text', '商品'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.productLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.qtyLabel', 'merchant:inventory', json_object('text', '数量'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.qtyLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.receiveCta', 'merchant:inventory', json_object('text', '接收'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.receiveCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.receiveDone', 'merchant:inventory', json_object('text', '已接收，库存已入账'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.receiveDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.shipCta', 'merchant:inventory', json_object('text', '发货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.shipCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.shipDone', 'merchant:inventory', json_object('text', '已发货，转入在途'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.shipDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.statusApproved', 'merchant:inventory', json_object('text', '已审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.statusApproved' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.statusInTransit', 'merchant:inventory', json_object('text', '在途'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.statusInTransit' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.statusPending', 'merchant:inventory', json_object('text', '待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.statusPending' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.statusReceived', 'merchant:inventory', json_object('text', '已接收'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.statusReceived' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.statusRejected', 'merchant:inventory', json_object('text', '已驳回'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.statusRejected' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.title', 'merchant:inventory', json_object('text', '调拨'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.toLabel', 'merchant:inventory', json_object('text', '→ {name}'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.toLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.toStoreLabel', 'merchant:inventory', json_object('text', '目标店'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.toStoreLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.move.toStorePh', 'merchant:inventory', json_object('text', '选择目标门店'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.move.toStorePh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.pageSub', 'merchant:inventory', json_object('text', '店间调拨成对确认 · 在途视图 · 要货申请'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.pageSub' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.pageTitle', 'merchant:inventory', json_object('text', '调拨要货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.pageTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.aside', 'merchant:inventory', json_object('text', '建议量=上限−现存（无上限按下限）；申请进审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.createCta', 'merchant:inventory', json_object('text', '发起要货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.createDone', 'merchant:inventory', json_object('text', '要货申请已提交，待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.createDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.empty', 'merchant:inventory', json_object('text', '暂无要货申请'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.fulfillCta', 'merchant:inventory', json_object('text', '履约'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.fulfillCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.fulfillDone', 'merchant:inventory', json_object('text', '已履约，库存已入账'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.fulfillDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.statusApproved', 'merchant:inventory', json_object('text', '已审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.statusApproved' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.statusFulfilled', 'merchant:inventory', json_object('text', '已履约'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.statusFulfilled' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.statusPending', 'merchant:inventory', json_object('text', '待审批'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.statusPending' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.statusRejected', 'merchant:inventory', json_object('text', '已驳回'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.statusRejected' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.suggest', 'merchant:inventory', json_object('text', '建议量 {n} 件'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.suggest' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.rep.title', 'merchant:inventory', json_object('text', '要货'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.rep.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.aside', 'merchant:inventory', json_object('text', '超 {h} 小时未接收=超时红签'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.empty', 'merchant:inventory', json_object('text', '暂无在途调拨'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.hours', 'merchant:inventory', json_object('text', '在途 {h} 小时'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.hours' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.hoursUnknown', 'merchant:inventory', json_object('text', '发货时间未知'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.hoursUnknown' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.overdue', 'merchant:inventory', json_object('text', '超时'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.overdue' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'trf.transit.title', 'merchant:inventory', json_object('text', '在途视图'), NULL, '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'trf.transit.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.applicantLabel', 'merchant:ops', json_object('text', '申请人'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.applicantLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.approveCta', 'merchant:ops', json_object('text', '通过'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.approveCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.approveDone', 'merchant:ops', json_object('text', '已通过，单据状态已联动'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.approveDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.approveTitle', 'merchant:ops', json_object('text', '通过审批'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.approveTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.aside', 'merchant:ops', json_object('text', '采购/要货/调拨/报损四类统一队列；审批意见必填留痕'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.empty', 'merchant:ops', json_object('text', '暂无待审批单'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.kindPurchase', 'merchant:ops', json_object('text', '采购'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.kindPurchase' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.kindReplenish', 'merchant:ops', json_object('text', '要货'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.kindReplenish' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.kindTransfer', 'merchant:ops', json_object('text', '调拨'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.kindTransfer' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.kindWriteoff', 'merchant:ops', json_object('text', '报损'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.kindWriteoff' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.notePh', 'merchant:ops', json_object('text', '审批意见（必填，随单留痕）'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.notePh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.noteRequired', 'merchant:ops', json_object('text', '审批意见不能为空'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.noteRequired' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.rejectCta', 'merchant:ops', json_object('text', '驳回'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.rejectCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.rejectDone', 'merchant:ops', json_object('text', '已驳回'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.rejectDone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.rejectTitle', 'merchant:ops', json_object('text', '驳回审批'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.rejectTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.stock.title', 'merchant:ops', json_object('text', '库存审批'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.stock.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.costClerkMask', 'merchant:products', json_object('text', '—'), '商家·商品', 'ProductsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.costClerkMask' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.costCol', 'merchant:products', json_object('text', '成本'), '商家·商品', 'ProductsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.costCol' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.csvOptColsNote', 'merchant:products', json_object('text', '可选尾列：进价(元)/库存下限/库存上限（缺省不设，与六列模板向后兼容）'), '商家·商品', 'ProductsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.csvOptColsNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.costHint', 'merchant:products', json_object('text', '选填，最多两位小数；毛利视界字段，仅店主/店长可见'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.costHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.costInvalid', 'merchant:products', json_object('text', '进价需为非负数字，最多两位小数（元）'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.costInvalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.costLabel', 'merchant:products', json_object('text', '进价（元）'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.costLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.limitHint', 'merchant:products', json_object('text', '选填整数；设后参与上下限预警'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.limitHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.limitInvalid', 'merchant:products', json_object('text', '库存上下限需为 0 ~ 1000000 的整数'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.limitInvalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.maxStockLabel', 'merchant:products', json_object('text', '库存上限'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.maxStockLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'prod.editor.minStockLabel', 'merchant:products', json_object('text', '库存下限'), '商家·商品', 'ProductEditorDialog 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'prod.editor.minStockLabel' AND `active` = 1)
