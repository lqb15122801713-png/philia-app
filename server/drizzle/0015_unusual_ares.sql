CREATE TABLE `member_plans` (
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
CREATE INDEX `ix_member_plans_key_active` ON `member_plans` (`rule_key`,`active`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_key` text NOT NULL,
	`sold_store_id` text,
	`started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pet_count` integer DEFAULT 0 NOT NULL,
	`paid_fen` integer DEFAULT 0 NOT NULL,
	`cancelled_at` integer,
	`cancel_reason` text,
	`refund_fen` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sold_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_memberships_user_status` ON `memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `rebate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`balance_fen` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rebate_accounts_user_id_unique` ON `rebate_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `rebate_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`type` text NOT NULL,
	`delta_fen` integer NOT NULL,
	`before_fen` integer NOT NULL,
	`after_fen` integer NOT NULL,
	`source_id` text NOT NULL,
	`period` text,
	`settlement_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `rebate_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`settlement_id`) REFERENCES `rebate_settlements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_rebate_logs_user_created` ON `rebate_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_rebate_logs_period` ON `rebate_logs` (`period`);--> statement-breakpoint
CREATE TABLE `rebate_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`granted_count` integer NOT NULL,
	`granted_fen` integer NOT NULL,
	`scheduled_day` integer NOT NULL,
	`executed_at` integer,
	`status` text DEFAULT 'done' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rebate_settlements_period` ON `rebate_settlements` (`period`);