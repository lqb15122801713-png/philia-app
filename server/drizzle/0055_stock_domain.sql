-- 商家端大批片 4（库存域+调拨要货 · 任务书冻结版 V1.0）：products 三列+七新表+预警参数键
-- 幂等：ADD COLUMN/CREATE TABLE IF NOT EXISTS 一次性；规则键注册 NOT EXISTS 守卫（多句 INSERT=全前缀逐句，立规矩照办）。
ALTER TABLE `products` ADD `cost_fen` integer;
--> statement-breakpoint
ALTER TABLE `products` ADD `min_stock` integer;
--> statement-breakpoint
ALTER TABLE `products` ADD `max_stock` integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `product_batches` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `product_id` text NOT NULL REFERENCES `products`(`id`),
  `batch_no` text NOT NULL,
  `production_date` integer,
  `shelf_life_days` integer,
  `expiry_date` integer,
  `qty` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `note` text,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_product_batches_product` ON `product_batches` (`product_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_product_batches_store_expiry` ON `product_batches` (`store_id`, `expiry_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `name` text NOT NULL,
  `contact` text,
  `phone` text,
  `note` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_suppliers_store` ON `suppliers` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `supplier_id` text REFERENCES `suppliers`(`id`),
  `order_no` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `items_json` text NOT NULL,
  `expect_at` integer,
  `note` text,
  `received_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_purchase_orders_store_status` ON `purchase_orders` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `stock_writeoffs` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `product_id` text NOT NULL REFERENCES `products`(`id`),
  `batch_id` text REFERENCES `product_batches`(`id`),
  `qty` integer NOT NULL,
  `reason` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `review_note` text,
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` integer,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_stock_writeoffs_store_status` ON `stock_writeoffs` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `transfer_orders` (
  `id` text PRIMARY KEY,
  `from_store_id` text NOT NULL REFERENCES `stores`(`id`),
  `to_store_id` text NOT NULL REFERENCES `stores`(`id`),
  `order_no` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `items_json` text NOT NULL,
  `sent_at` integer,
  `received_at` integer,
  `received_by` text REFERENCES `users`(`id`),
  `note` text,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_transfer_orders_from` ON `transfer_orders` (`from_store_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_transfer_orders_to` ON `transfer_orders` (`to_store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `replenish_requests` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `product_id` text NOT NULL REFERENCES `products`(`id`),
  `qty` integer NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `note` text,
  `review_note` text,
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` integer,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_replenish_requests_store_status` ON `replenish_requests` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `approval_requests` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `kind` text NOT NULL,
  `ref_id` text NOT NULL,
  `summary` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `applicant_id` text NOT NULL REFERENCES `users`(`id`),
  `reviewer_id` text REFERENCES `users`(`id`),
  `review_note` text,
  `reviewed_at` integer,
  `timeline_json` text NOT NULL,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_approval_requests_store_status` ON `approval_requests` (`store_id`, `status`);
--> statement-breakpoint
-- 规则端口键注册（service_rules，NULL=总部下发默认行；NOT EXISTS 守卫）：
-- transfer_in_transit_warn_hours=调拨在途超时预警（小时，缺省 24）；
-- expiry_warn_days=临期预警阈值（天，缺省 30）；expiry_urgent_days=急临期阈值（天，缺省 7）。
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'transfer_in_transit_warn_hours', '调拨在途超时预警（小时）：in_transit 超 N 小时未接收→预警行', json_object('hours', 24), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'transfer_in_transit_warn_hours' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'expiry_warn_days', '临期预警阈值（天）：效期 ≤N 天=临期分级「临」', json_object('days', 30), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'expiry_warn_days' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'expiry_urgent_days', '急临期阈值（天）：效期 ≤N 天=临期分级「急」', json_object('days', 7), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'expiry_urgent_days' AND `active` = 1);
