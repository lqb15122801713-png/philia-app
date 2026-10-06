-- 商家端大批 片 2：copy 键注册（三视图/E1 点亮/C3 安心包端口；生成件同帧=copySeedRows 3149 行）
-- ① 新增 16 键（幂等 NOT EXISTS 守卫，与 0048 同工艺）；② 改值 3 键（改键值不改键名，UPDATE 幂等）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.carePackExpired', 'merchant:consoleAdmin', json_object('text', '已过期'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.carePackExpired' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.carePackExpiryTh', 'merchant:consoleAdmin', json_object('text', '临期 ≤30 天'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.carePackExpiryTh' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.carePackRecallNote', 'merchant:consoleAdmin', json_object('text', '回收登记流程=候补件（04a 对账/体验批 T3 联动），本口 v1 只读'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.carePackRecallNote' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portCarePack', 'merchant:consoleAdmin', json_object('text', '安心包端口'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portCarePack' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portCarePackNote', 'merchant:consoleAdmin', json_object('text', '独立库存域 · 只读 v1'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portCarePackNote' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portProfileSave', 'merchant:consoleAdmin', json_object('text', '保存档案'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portProfileSave' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.profileChainTitle', 'merchant:consoleAdmin', json_object('text', '连锁归属'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.profileChainTitle' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.profileHqSelf', 'merchant:consoleAdmin', json_object('text', '店即己部（单层特例）'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.profileHqSelf' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.profileSaved', 'merchant:consoleAdmin', json_object('text', '已保存'), NULL, '未在页面调用点命中（merchant:consoleAdmin 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.profileSaved' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'dash.m3ChainTitle', 'merchant:dashboard', json_object('text', '连锁视图'), NULL, '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'dash.m3ChainTitle' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'dash.m3SingleNote', 'merchant:dashboard', json_object('text', '多店三栏=连锁预留开口项，当前按单店口径呈现'), NULL, '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'dash.m3SingleNote' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.view.chain', 'merchant:report', json_object('text', '合计'), NULL, '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.view.chain' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.view.chainAside', 'merchant:report', json_object('text', '店域合计（scope=chain）'), NULL, '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.view.chainAside' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.view.store', 'merchant:report', json_object('text', '单店'), NULL, '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.view.store' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.view.storePick', 'merchant:report', json_object('text', '门店'), NULL, '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.view.storePick' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.view.stores', 'merchant:report', json_object('text', '分店'), NULL, '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.view.stores' AND `active` = 1)
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '合计+分栏并列（读口=store.chainDashboard 三店真值）'), `updated_at` = unixepoch() WHERE `rule_key` = 'dash.m3ChainNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '门店档案端口'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.profileEmptyTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '连锁字段+档案维护口（E1 点亮·片 2）'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.profileEmptyBody' AND `active` = 1;
