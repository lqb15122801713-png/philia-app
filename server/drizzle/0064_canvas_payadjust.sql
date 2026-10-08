-- 端口批收尾片 3（画布端口+薪资调整端口 · 任务书冻结版 V1.0 B 股 v1.1）：block_registry/page_layouts/pay_adjust_proposals/pay_adjustments 四新表+阈值键+注册表 18 块种子
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS；INSERT NOT EXISTS 守卫（多句 INSERT=脚本生成+INSERT 计数断言==19[18 块+1 阈值键]）。
CREATE TABLE IF NOT EXISTS `block_registry` (
  `id` text PRIMARY KEY,
  `block_key` text NOT NULL,
  `page_key` text NOT NULL,
  `label` text NOT NULL,
  `props_json` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_block_registry_key` ON `block_registry` (`block_key`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `page_layouts` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `page_key` text NOT NULL,
  `version` integer NOT NULL,
  `blocks_json` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `acted_by` text REFERENCES `users`(`id`),
  `acted_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_page_layouts_store_page` ON `page_layouts` (`store_id`, `page_key`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pay_adjust_proposals` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `kind` text NOT NULL,
  `staff_id` text NOT NULL REFERENCES `staff`(`id`),
  `month` text NOT NULL,
  `amount_fen` integer NOT NULL,
  `meta_json` text,
  `reason` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `proposer_id` text NOT NULL REFERENCES `users`(`id`),
  `applied_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_pay_adjust_proposals_store_status` ON `pay_adjust_proposals` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pay_adjustments` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `staff_id` text NOT NULL REFERENCES `staff`(`id`),
  `month` text NOT NULL,
  `kind` text NOT NULL,
  `amount_fen` integer NOT NULL,
  `reason` text NOT NULL,
  `meta_json` text,
  `source_id` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_pay_adjustments_staff_month` ON `pay_adjustments` (`staff_id`, `month`, `status`);
--> statement-breakpoint
-- 区块注册表种子（写死件白名单；propsJson=端口化面登记）+薪资调整阈值键（service_rules 总部行）：
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.banner', 'home', '首页·顶图横幅', '{"slotKey":"home.banner","toggleable":true,"copyKeys":[]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.banner');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.live', 'home', '首页·服务中 LIVE 卡', '{"toggleable":true,"copyKeys":["home.liveTag","home.liveEta"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.live');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.idband', 'home', '首页·身份带', '{"toggleable":true,"copyKeys":["home.idJoin","home.rebateLabel"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.idband');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.megacard', 'home', '首页·浮动大卡（预约双入口）', '{"toggleable":true,"copyKeys":["home.entryGrooming","home.entryBoarding","home.entryNote"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.megacard');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.cases', 'home', '首页·店里今天的故事', '{"toggleable":true,"copyKeys":["home.casesTitle","home.casesMore"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.cases');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.bookingPanel', 'home', '首页·一键再约', '{"toggleable":true,"copyKeys":["home.panelEntryTitle","home.panelEntrySub"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.bookingPanel');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.passStrip', 'home', '首页·会员提醒条', '{"toggleable":true,"copyKeys":["home.passStripPre","home.passStripPost"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.passStrip');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.stats', 'home', '首页·守护值统计行', '{"toggleable":true,"copyKeys":["home.statsDays","home.statsServices","home.statsSpend"]}', 8, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.stats');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'home.pets', 'home', '首页·我的毛孩子', '{"toggleable":true,"copyKeys":["home.petsTitle","home.petsEmpty"]}', 9, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'home.pets');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.cardFace', 'memberCenter', '会员中心·身份大卡', '{"slotKey":"member.cardFace","toggleable":true,"copyKeys":[]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.cardFace');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.tips', 'memberCenter', '会员中心·到期提醒条', '{"toggleable":true,"copyKeys":["a3.remindExpire"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.tips');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.ledger', 'memberCenter', '会员中心·三格账+已省行', '{"toggleable":true,"copyKeys":["a3.ledgerBalance","a3.ledgerPending"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.ledger');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.unusedPerks', 'memberCenter', '会员中心·未用权益区', '{"toggleable":true,"copyKeys":["perk.unusedTitle","perk.unusedEmpty"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.unusedPerks');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.perksWall', 'memberCenter', '会员中心·权益墙', '{"toggleable":true,"copyKeys":["a3.perksTitle","perk.boarding"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.perksWall');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.famCard', 'memberCenter', '会员中心·多宠氛围卡', '{"slotKey":"member.famCard","toggleable":true,"copyKeys":[]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.famCard');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.rules', 'memberCenter', '会员中心·规则明面', '{"toggleable":true,"copyKeys":["rules.title"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.rules');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mc.cta', 'memberCenter', '会员中心·续费操作区', '{"toggleable":true,"copyKeys":["a3.ctaRenew","a3.ctaOtherTier"]}', 8, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mc.cta');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cs.savingsHook', 'cashierMarketing', '收银台·立省钩子营销位', '{"toggleable":true,"copyKeys":["cashier.savingsCta"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cs.savingsHook');
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'pay_adjust_threshold_fen', '薪资手工调整复核阈值（分）：|调整金额|≤阈值 manager 可复核，超阈值仅 owner 复核（金额阈值分级）', json_object('amountFen', 10000), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'pay_adjust_threshold_fen' AND `active` = 1);
