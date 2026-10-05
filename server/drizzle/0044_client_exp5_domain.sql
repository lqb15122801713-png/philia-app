-- 客户端体验大批 片 5（尾牙读口 5+点亮 2+报表 17 张点亮）：域建表与扩列（幂等+申报）
-- 叠尖裁定（明面报备）：本片叠片 2 尖（D2/D8 附加项目搭售率数据源 appointment_addons
--   系片 2 建、main 无）；迁移号续跳 0044/0045（0040-0043=片 3/片 4 占用，tag 全不同）。
-- reviews 扩 tags/reply_text/replied_at/replied_by（N4 差评标签聚类+回复率时效数据源）；
-- metric_appeals（N6 海底捞铁规·申诉通道+纠错留痕：approved 申诉读口径即时扣减，
--   correction_json 前后值留痕，同人同目标 pending 幂等）；
-- content_events（N7/N8 埋点预埋不出表：H 表 §方向三清单九类事件写死，瀑布流批上线即有数）；
-- product_import_batches（B1 商品 CSV 导入批次留痕：失败行回显零落账）；
-- service_rules 幂等种子 1 键（d6_refund_spike_warn_bp=退款率环比突增预警阈值 30%）。
-- 幂等=journal 守卫（仅跑一次）+种子段 WHERE NOT EXISTS；列定义全先于 FOREIGN KEY 表约束；
-- created_by='system'（迁移期 FK=OFF，惯例见 migrate.ts 头注）。
ALTER TABLE `reviews` ADD `tags` text;
--> statement-breakpoint
ALTER TABLE `reviews` ADD `reply_text` text;
--> statement-breakpoint
ALTER TABLE `reviews` ADD `replied_at` integer;
--> statement-breakpoint
ALTER TABLE `reviews` ADD `replied_by` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
CREATE TABLE `metric_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text,
	`correction_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_metric_appeals_store_status` ON `metric_appeals` (`store_id`,`status`);
--> statement-breakpoint
CREATE INDEX `ix_metric_appeals_staff` ON `metric_appeals` (`staff_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `content_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`case_id` text,
	`user_id` text,
	`appointment_id` text,
	`store_id` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_content_events_type_created` ON `content_events` (`event_type`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ix_content_events_case` ON `content_events` (`case_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `product_import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`filename` text NOT NULL,
	`total_rows` integer NOT NULL,
	`ok_rows` integer NOT NULL,
	`fail_rows` integer NOT NULL,
	`report_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_product_import_batches_store` ON `product_import_batches` (`store_id`,`created_at`);
--> statement-breakpoint
-- 幂等配置种子（同 0018 口径：active 行已存在则跳过）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_d6_refund_spike_warn_bp', 1, 'd6_refund_spike_warn_bp',
  'D6 退款率环比突增预警阈值（万分比）：本月退款金额环比增幅超该值→报表预警行（缺省 3000=30%）',
  '{"bp":3000}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='d6_refund_spike_warn_bp' AND `active`=1);
