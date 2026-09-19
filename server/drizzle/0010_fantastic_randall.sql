CREATE TABLE `day_closes` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`kind` text DEFAULT 'close' NOT NULL,
	`ref_close_id` text,
	`biz_date` text NOT NULL,
	`book_cash_fen` integer DEFAULT 0 NOT NULL,
	`actual_cash_fen` integer,
	`diff_fen` integer,
	`wechat_fen` integer DEFAULT 0 NOT NULL,
	`alipay_fen` integer DEFAULT 0 NOT NULL,
	`pass_fen` integer DEFAULT 0 NOT NULL,
	`stored_value_fen` integer DEFAULT 0 NOT NULL,
	`cashier_paid_count` integer DEFAULT 0 NOT NULL,
	`paid_count` integer DEFAULT 0 NOT NULL,
	`reason` text,
	`snapshot_json` text,
	`adjustments_json` text,
	`status` text DEFAULT 'frozen' NOT NULL,
	`reversed_at` integer,
	`reversed_by` text,
	`reversal_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reversed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_day_closes_store` ON `day_closes` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_day_closes_shift` ON `day_closes` (`shift_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`opened_by` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`closed_by` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_shifts_store_status` ON `shifts` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `stored_value_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`principal_fen` integer DEFAULT 0 NOT NULL,
	`bonus_fen` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_sv_account_user_store` ON `stored_value_accounts` (`user_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `stored_value_import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`filename` text,
	`mapping_json` text,
	`total_rows` integer DEFAULT 0 NOT NULL,
	`ok_rows` integer DEFAULT 0 NOT NULL,
	`fail_rows` integer DEFAULT 0 NOT NULL,
	`member_count` integer DEFAULT 0 NOT NULL,
	`principal_total_fen` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'executed' NOT NULL,
	`cleared_at` integer,
	`cleared_by` text,
	`report_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cleared_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_sv_batches_status` ON `stored_value_import_batches` (`status`);--> statement-breakpoint
CREATE TABLE `stored_value_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`delta_principal_fen` integer DEFAULT 0 NOT NULL,
	`delta_bonus_fen` integer DEFAULT 0 NOT NULL,
	`delta_fen` integer NOT NULL,
	`balance_before_fen` integer NOT NULL,
	`balance_after_fen` integer NOT NULL,
	`bill_no` text,
	`operator_id` text NOT NULL,
	`import_batch_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `stored_value_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_sv_logs_account` ON `stored_value_logs` (`account_id`);--> statement-breakpoint
CREATE INDEX `ix_sv_logs_batch` ON `stored_value_logs` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `ix_sv_logs_bill` ON `stored_value_logs` (`bill_no`);--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `reversed_at` integer;--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `reversed_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `reversal_bill_no` text;--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `reversal_of_bill_no` text;