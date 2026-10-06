-- 商家端大批片 5（会员营销+报表+找回两件 · 任务书冻结版 V1.0）：券类型列+七新表+互斥键组
-- 幂等：ADD COLUMN/CREATE TABLE IF NOT EXISTS 一次性；规则键 NOT EXISTS 守卫（脚本生成+计数断言照办）。
ALTER TABLE `coupons` ADD `coupon_type` text DEFAULT 'consume' NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `member_tags` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `kind` text NOT NULL,
  `value` text NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_member_tags_store_user_kind` ON `member_tags` (`store_id`, `user_id`, `kind`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_member_tags_store_value` ON `member_tags` (`store_id`, `kind`, `value`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coupon_campaigns` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `coupon_id` text NOT NULL REFERENCES `coupons`(`id`),
  `title` text NOT NULL,
  `target_kind` text,
  `target_value` text,
  `granted_count` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'issued' NOT NULL,
  `note` text,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_coupon_campaigns_store` ON `coupon_campaigns` (`store_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `promo_campaigns` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `type` text NOT NULL,
  `name` text NOT NULL,
  `rules_json` text NOT NULL,
  `starts_at` integer,
  `ends_at` integer,
  `status` text DEFAULT 'draft' NOT NULL,
  `note` text,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_promo_campaigns_store` ON `promo_campaigns` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `expense_records` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `type` text NOT NULL,
  `amount_fen` integer NOT NULL,
  `biz_month` text NOT NULL,
  `note` text,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_expense_records_store_month` ON `expense_records` (`store_id`, `biz_month`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `exchange_records` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `orig_bill_id` text REFERENCES `cashier_bills`(`id`),
  `customer_id` text REFERENCES `users`(`id`),
  `orig_item_name` text NOT NULL,
  `new_product_id` text REFERENCES `products`(`id`),
  `new_item_name` text NOT NULL,
  `diff_fen` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'applied' NOT NULL,
  `note` text,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_exchange_records_store` ON `exchange_records` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `return_inspections` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `refund_bill_id` text,
  `product_id` text NOT NULL REFERENCES `products`(`id`),
  `qty` integer DEFAULT 1 NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `qc_note` text,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_return_inspections_store_status` ON `return_inspections` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `report_snapshots` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `month` text NOT NULL,
  `kind` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_report_snapshots_store_month` ON `report_snapshots` (`store_id`, `month`);
--> statement-breakpoint
-- 促销互斥·叠加规则逐项开关键组（service_rules，NULL=总部下发默认行；端口值公示）：
-- 券×会员折扣已有 coupon_stack_rule 单条照案；本组=活动×券/活动×会员/多活动叠加+生日礼档位留口。
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'promo_stack_campaign_coupon', '促销互斥：活动×券叠加（none=不叠加[默认] | allow=同享）', json_object('rule', 'none'), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'promo_stack_campaign_coupon' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'promo_stack_campaign_member', '促销互斥：活动×会员折扣叠加（none=不叠加[默认] | allow=同享）', json_object('rule', 'none'), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'promo_stack_campaign_member' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'promo_stack_multi_campaign', '促销互斥：多活动叠加（none=互斥[默认] | allow=可叠加）', json_object('rule', 'none'), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'promo_stack_multi_campaign' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'birthday_perk_tier', '生日礼档位（生日营销配置面：券类型 birthday + 面额分/门槛分；留口可改）', json_object('amountFen', 500, 'thresholdFen', 0, 'validDays', 30), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'birthday_perk_tier' AND `active` = 1);
