-- 客户端体验大批 片 1（账户体系+支付售后）：addresses/invoice_titles/deposit_records 建表+users 扩列（幂等+申报）
-- addresses（收货地址 CRUD+默认）/invoice_titles（发票抬头 CRUD+默认）/
-- deposit_records（押金收取与退还进度台账+状态机——留痕不碰真钱（开口项 2 裁）：held→refunding→refunded，
--   收取/退还只登记进度，无任何支付通道写）/users 扩列 birthday/gender（生日·性别资料收集）
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`receiver` text NOT NULL,
	`phone` text NOT NULL,
	`region` text NOT NULL,
	`detail` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_addresses_user` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `invoice_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title_type` text NOT NULL,
	`title` text NOT NULL,
	`tax_no` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_invoice_titles_user` ON `invoice_titles` (`user_id`);--> statement-breakpoint
CREATE TABLE `deposit_records` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`ref_appointment_id` text,
	`note` text,
	`held_at` integer,
	`refund_requested_at` integer,
	`refunded_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_deposit_records_customer` ON `deposit_records` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_deposit_records_store` ON `deposit_records` (`store_id`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD `birthday` text;--> statement-breakpoint
ALTER TABLE `users` ADD `gender` text;
