CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agreement_key` text NOT NULL,
	`version` text NOT NULL,
	`content` text NOT NULL,
	`checked_at` integer NOT NULL,
	`user_snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_agreements_user_key` ON `agreements` (`user_id`,`agreement_key`);--> statement-breakpoint
CREATE TABLE `pay_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`pay_no` text NOT NULL,
	`biz_domain` text NOT NULL,
	`biz_id` text NOT NULL,
	`biz_json` text,
	`amount_fen` integer NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`idem_key` text NOT NULL,
	`payment_id` text,
	`callback_json` text,
	`timeout_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pay_orders_pay_no_unique` ON `pay_orders` (`pay_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `pay_orders_idem_key_unique` ON `pay_orders` (`idem_key`);--> statement-breakpoint
CREATE INDEX `ix_pay_orders_biz` ON `pay_orders` (`biz_domain`,`biz_id`);--> statement-breakpoint
CREATE INDEX `ix_pay_orders_status` ON `pay_orders` (`status`);--> statement-breakpoint
CREATE TABLE `pay_rules` (
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
CREATE INDEX `ix_pay_rules_key_active` ON `pay_rules` (`rule_key`,`active`);
--> statement-breakpoint
-- 0017 幂等配置种子（批次 6 补缺大批 · Y6 豁免件同 0016 工艺，零 DDL 纯种子行）
-- pay_rules 初始 version=1 两行：pay_timeout_minutes 支付超时关单时长（分钟）/
-- pay_channel_enabled 线上支付通道开关（内测=mock）。
-- 幂等：active 行已存在则跳过。created_by='system'（迁移期 users 表可为空；
-- 迁移执行器 PRAGMA foreign_keys=OFF，惯例见 migrate.ts 头注）。
INSERT INTO `pay_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_pay_timeout_minutes', 1, 'pay_timeout_minutes',
  '支付超时关单时长（分钟）：paying 超时自动关单（sweeper 60s 轮查；端口改值只管新单，在途单 timeout_at 为创建时快照不回溯）',
  '{"minutes":30}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `pay_rules` WHERE `rule_key`='pay_timeout_minutes' AND `active`=1);
--> statement-breakpoint
INSERT INTO `pay_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_pay_channel_enabled', 1, 'pay_channel_enabled',
  '线上支付通道开关（内测=mock；关=createOrder 拒单，在途单不受影响）',
  '{"enabled":true}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `pay_rules` WHERE `rule_key`='pay_channel_enabled' AND `active`=1);