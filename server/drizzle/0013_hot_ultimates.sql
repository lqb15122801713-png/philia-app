CREATE TABLE `duration_rules` (
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
CREATE INDEX `ix_duration_rules_key_active` ON `duration_rules` (`rule_key`,`active`);