CREATE TABLE `membership_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`from_plan` text,
	`to_plan` text,
	`diff_fen` integer,
	`bill_no` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_membership_events_user_created` ON `membership_events` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `memberships` ADD `next_plan_key` text;--> statement-breakpoint
ALTER TABLE `memberships` ADD `next_plan_set_at` integer;--> statement-breakpoint
-- 补缺-3（46 号档+PD-07）：member_plans 三个新端口键幂等回挂（WHERE NOT EXISTS 幂等）。
-- 仅对「已跑过种子」的存量库补行（created_by 挂种子店主；users 无种子店主=全新库 → 跳过，
-- 全新库由 seed.ts 种子段落同样三键，双通道同值不撞）。重复执行/全量重种子均零副作用。
INSERT INTO `member_plans` (`id`, `version`, `rule_key`, `label`, `value_json`, `effective_from`, `active`, `created_by`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(13))), 1, 'member_change_window_days', '到期换档预约窗口：到期前 N 天开放预约下期档位（任意档；期内只升不降，低档走本预约通道）', '{"days":30}', 1789833600, 1, (SELECT id FROM users WHERE kimi_id='seed_kimi_owner' LIMIT 1), unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM member_plans WHERE rule_key='member_change_window_days')
  AND EXISTS (SELECT 1 FROM users WHERE kimi_id='seed_kimi_owner');
--> statement-breakpoint
INSERT INTO `member_plans` (`id`, `version`, `rule_key`, `label`, `value_json`, `effective_from`, `active`, `created_by`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(13))), 1, 'member_cancel_cooldown_days', '退会重购留痕窗口：退会后 N 天内重购记 cancel_rebuy_note（只留痕不拦截）', '{"days":90}', 1789833600, 1, (SELECT id FROM users WHERE kimi_id='seed_kimi_owner' LIMIT 1), unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM member_plans WHERE rule_key='member_cancel_cooldown_days')
  AND EXISTS (SELECT 1 FROM users WHERE kimi_id='seed_kimi_owner');
--> statement-breakpoint
INSERT INTO `member_plans` (`id`, `version`, `rule_key`, `label`, `value_json`, `effective_from`, `active`, `created_by`, `created_at`, `updated_at`)
SELECT lower(hex(randomblob(13))), 1, 'member_cancel_count_threshold', '累计退会次数阈值：累计退会≥N 次再购记 cancel_rebuy_note（只留痕不拦截）', '{"threshold":2}', 1789833600, 1, (SELECT id FROM users WHERE kimi_id='seed_kimi_owner' LIMIT 1), unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM member_plans WHERE rule_key='member_cancel_count_threshold')
  AND EXISTS (SELECT 1 FROM users WHERE kimi_id='seed_kimi_owner');