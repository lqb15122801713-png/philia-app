-- 端口批收尾片 2（数据 3+运营内容 2 · 任务书冻结版 V1.0）：回收站软删三表六列+公告起止两列+数据订正载荷表
-- 幂等：ADD COLUMN/CREATE TABLE/INDEX IF NOT EXISTS 一次性；SQLite ALTER ADD COLUMN 不支持 IF NOT EXISTS=drizzle migrate 单跑语义（同 0055 工艺）。
ALTER TABLE `products` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `products` ADD `deleted_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `promo_campaigns` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `promo_campaigns` ADD `deleted_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `starts_at` integer;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `ends_at` integer;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `deleted_at` integer;
--> statement-breakpoint
ALTER TABLE `announcements` ADD `deleted_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `data_corrections` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `kind` text NOT NULL,
  `target_key` text NOT NULL,
  `payload_json` text NOT NULL,
  `note` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `proposer_id` text NOT NULL REFERENCES `users`(`id`),
  `applied_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_data_corrections_store_status` ON `data_corrections` (`store_id`, `status`);
