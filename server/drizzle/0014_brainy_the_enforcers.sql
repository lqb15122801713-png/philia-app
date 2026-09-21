CREATE TABLE `refund_bill_items` (
	`id` text PRIMARY KEY NOT NULL,
	`refund_id` text NOT NULL,
	`bill_item_id` text,
	`payment_id` text,
	`kind` text NOT NULL,
	`qty` integer,
	`amount_fen` integer NOT NULL,
	`detail_json` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`refund_id`) REFERENCES `refund_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bill_item_id`) REFERENCES `cashier_bill_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `cashier_payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_refund_bill_items_refund` ON `refund_bill_items` (`refund_id`);--> statement-breakpoint
CREATE TABLE `refund_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`refund_no` text NOT NULL,
	`biz_date` text NOT NULL,
	`bill_id` text NOT NULL,
	`type` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`linkage_json` text,
	`refund_method` text,
	`settled_at` integer,
	`settle_note` text,
	`operator_id` text NOT NULL,
	`approver_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bill_id`) REFERENCES `cashier_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_refund_bills_refund_no` ON `refund_bills` (`refund_no`);--> statement-breakpoint
CREATE INDEX `ix_refund_bills_store_bizdate` ON `refund_bills` (`store_id`,`biz_date`);--> statement-breakpoint
CREATE INDEX `ix_refund_bills_bill` ON `refund_bills` (`bill_id`);--> statement-breakpoint
CREATE INDEX `ix_refund_bills_status` ON `refund_bills` (`status`);--> statement-breakpoint
CREATE TABLE `refund_rules` (
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
CREATE INDEX `ix_refund_rules_key_active` ON `refund_rules` (`rule_key`,`active`);--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `refund_status` text;--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `refund_bill_no` text;