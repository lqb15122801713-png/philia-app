-- 客户端体验大批 片 2（预约链路 12）：appointments/pets 扩列+三新表+端口键种子（幂等+申报）
-- appointments 扩 emergency_contact_json/medical_auth_json（按单快照）/walk_times_per_day（寄养遛弯次数入下单选项）；
-- pets 扩 vaccine_proof_urls（疫苗证明留证——仅留证不改寄养硬闸，行为变更报备在案）；
-- appointment_addons（附加项加购留痕：快照名+价，预约价=主价+Σ附加快照）/
-- prepaid_records（预约即预付台账状态机——留痕不碰真钱（开口项 1 裁）：prepaid_pending→prepaid_registered→
--   checked_deducted|refunded；全程零支付通道写）/
-- appointment_reschedule_logs（改约历史专表：before/after 快照+操作人+角色）
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
ALTER TABLE `appointments` ADD `emergency_contact_json` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `medical_auth_json` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `walk_times_per_day` integer;--> statement-breakpoint
ALTER TABLE `pets` ADD `vaccine_proof_urls` text DEFAULT '[]';--> statement-breakpoint
CREATE TABLE `appointment_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`addon_service_id` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`price_fen` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`addon_service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_appointment_addons_appt` ON `appointment_addons` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `prepaid_records` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`store_id` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`status` text DEFAULT 'prepaid_pending' NOT NULL,
	`operator_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_prepaid_appointment` ON `prepaid_records` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `ix_prepaid_store` ON `prepaid_records` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `appointment_reschedule_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`before_start` integer NOT NULL,
	`before_end` integer NOT NULL,
	`after_start` integer NOT NULL,
	`after_end` integer NOT NULL,
	`changed_by` text NOT NULL,
	`by_role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_reschedule_logs_appt` ON `appointment_reschedule_logs` (`appointment_id`);--> statement-breakpoint
-- 取消阶梯收费公示参数入配置端口（service 域同族；NOT EXISTS 幂等守卫，created_by='system'）
-- 公示=只读展示（不扣真费——开口项 1 裁）；档位=距开越小费比越高（bp 万分比）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_cancel_fee_tiers', 1, 'cancel_fee_tiers',
  '取消/爽约阶梯收费公示档（距开 N 小时→费比 bp；公示口径=只读展示不扣真费，真通道候资质批）',
  '{"tiers":[{"hoursBefore":24,"feeBp":0,"label":"24 小时前免费取消"},{"hoursBefore":4,"feeBp":0,"label":"4–24 小时免费（需门店审核）"},{"hoursBefore":0,"feeBp":3000,"label":"4 小时内/爽约 30%（公示口径，暂不扣款）"}]}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='cancel_fee_tiers' AND `active`=1);
--> statement-breakpoint
-- 会员档提前预约天数入各档端口值（json_set 加键不动既有键；幂等=json_set 同值重放零副作用）
UPDATE `member_plans` SET `value_json`=json_set(`value_json`,'$.advance_book_days',3), `updated_at`=unixepoch()
WHERE `active`=1 AND `rule_key`='plan_weiguang';
--> statement-breakpoint
UPDATE `member_plans` SET `value_json`=json_set(`value_json`,'$.advance_book_days',7), `updated_at`=unixepoch()
WHERE `active`=1 AND `rule_key` IN ('plan_yinghuo','plan_zhuguang');
--> statement-breakpoint
UPDATE `member_plans` SET `value_json`=json_set(`value_json`,'$.advance_book_days',14), `updated_at`=unixepoch()
WHERE `active`=1 AND `rule_key`='plan_nuanyang';
