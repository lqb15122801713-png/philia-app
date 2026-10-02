CREATE TABLE `invoice_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`order_kind` text NOT NULL,
	`bill_id` text NOT NULL,
	`bill_no` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`title_type` text NOT NULL,
	`title` text NOT NULL,
	`tax_no` text,
	`delivery` text NOT NULL,
	`email` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`issued_invoice_no` text,
	`issued_at` integer,
	`issued_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_requests_invoice_no_unique` ON `invoice_requests` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `ix_invoice_requests_store_status` ON `invoice_requests` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_invoice_requests_user` ON `invoice_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_invoice_requests_bill` ON `invoice_requests` (`order_kind`,`bill_id`);--> statement-breakpoint
CREATE TABLE `service_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload` text NOT NULL,
	`generated_at` integer NOT NULL,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_certificates_appointment_id_unique` ON `service_certificates` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `ix_service_certificates_user` ON `service_certificates` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vitals` text NOT NULL,
	`abnormal_text` text,
	`next_advice` text,
	`generated_at` integer NOT NULL,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_reports_appointment_id_unique` ON `service_reports` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `ix_service_reports_user` ON `service_reports` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`rule_key` text NOT NULL,
	`label` text NOT NULL,
	`value_json` text NOT NULL,
	`effective_from` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_service_rules_key_active` ON `service_rules` (`rule_key`,`active`);--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_no` text NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`photo_urls` text DEFAULT '[]' NOT NULL,
	`contact_phone` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`reply_text` text,
	`replied_by` text,
	`replied_at` integer,
	`timeline_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replied_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_ticket_no_unique` ON `support_tickets` (`ticket_no`);--> statement-breakpoint
CREATE INDEX `ix_support_tickets_store_status` ON `support_tickets` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_support_tickets_user` ON `support_tickets` (`user_id`,`created_at`);--> statement-breakpoint
-- 幂等配置种子（补缺大批片 4 · 同 0016 口径：active 行已存在则跳过；
-- created_by='system'，迁移期 users 表可为空——迁移执行器 PRAGMA foreign_keys=OFF，
-- 惯例见 migrate.ts 头注）：service_rules.service_hours=客服服务时间公示
-- （客户端读口 serviceLoop.serviceHours；配置端口域 domain='service'）。
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_service_hours', 1, 'service_hours',
  '客服服务时间（客户端公示文案）',
  '{"text":"09:00–21:00"}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='service_hours' AND `active`=1);
