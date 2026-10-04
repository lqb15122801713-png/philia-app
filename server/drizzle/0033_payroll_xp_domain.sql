-- 员工端骨架整建批 片 4（薪资 6+XP 2，涉钱批）：薪资/协作/申诉/XP 域建表（幂等+申报）
-- payroll_runs（工资条批次：生成→老板确认两态）/payroll_items（员工工资条行：四费列+净额+
--   发放标记列——发放=标记留痕不碰真钱，开口项 3 裁；全链路零支付通道）/
-- appointment_collaborators（多人协作单拆分：一单 N 人 split_bp 万分比，主操作人吃余数）/
-- payroll_appeals（薪资异议申诉：仿 attendance_approvals 工艺，挂目标单+返还额 refund_fen 闭环）/
-- xp_applications（XP 积分申请+扣分异议：审核通过才落正式 xp_events（awardXp/正向对冲行），
--   xp_events 只增流水零污染——不加 status 列）/
-- deduction_records 扩列（申诉返还：status=active|reverted 置还留痕不删行，只增不改同族口径）
-- 命名注：工资条两表照开工令卡面 payroll_runs/payroll_items 命名；发放标记勿用 pay/transfer 词根。
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'generated' NOT NULL,
	`generated_by` text NOT NULL,
	`generated_at` integer NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`generated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payroll_runs_store_month` ON `payroll_runs` (`store_id`,`month`);--> statement-breakpoint
CREATE TABLE `payroll_items` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`month` text NOT NULL,
	`payload_json` text NOT NULL,
	`commission_fen` integer DEFAULT 0 NOT NULL,
	`performance_fen` integer DEFAULT 0 NOT NULL,
	`deduction_fen` integer DEFAULT 0 NOT NULL,
	`adjustment_fen` integer DEFAULT 0 NOT NULL,
	`net_fen` integer DEFAULT 0 NOT NULL,
	`rule_version` integer,
	`snapshot_id` text,
	`marked_by` text,
	`marked_at` integer,
	`method_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payroll_items_run_staff` ON `payroll_items` (`run_id`,`staff_id`);--> statement-breakpoint
CREATE INDEX `ix_payroll_items_staff` ON `payroll_items` (`staff_id`,`month`);--> statement-breakpoint
CREATE TABLE `appointment_collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`role` text NOT NULL,
	`split_bp` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_collab_appt_staff` ON `appointment_collaborators` (`appointment_id`,`staff_id`);--> statement-breakpoint
CREATE INDEX `ix_collab_staff` ON `appointment_collaborators` (`staff_id`);--> statement-breakpoint
CREATE TABLE `payroll_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`month` text NOT NULL,
	`reason` text NOT NULL,
	`evidence_urls` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text,
	`refund_fen` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_payroll_appeals_store` ON `payroll_appeals` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_payroll_appeals_staff` ON `payroll_appeals` (`staff_id`,`status`);--> statement-breakpoint
CREATE TABLE `xp_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`app_kind` text NOT NULL,
	`target_event_id` text,
	`points_requested` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text,
	`resolved_event_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_xp_applications_store` ON `xp_applications` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_xp_applications_staff` ON `xp_applications` (`staff_id`,`status`);--> statement-breakpoint
ALTER TABLE `deduction_records` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `deduction_records` ADD `reverted_by` text;--> statement-breakpoint
ALTER TABLE `deduction_records` ADD `reverted_at` integer;--> statement-breakpoint
ALTER TABLE `deduction_records` ADD `revert_note` text;--> statement-breakpoint
-- 协作拆分默认比例入提成配置端口（commission_rules 族同工艺；configRules 未知键硬拒，种子先行；NOT EXISTS 幂等守卫）
INSERT INTO `commission_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_comm_collab_split_default', 1, 'commission_collab_split_default',
  '多人协作单提成拆分默认比例（协作人 bp 万分比；录入表单默认值，逐单可改——拆分比入配置端口口径）',
  '{"splitBp":5000}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `commission_rules` WHERE `rule_key`='commission_collab_split_default' AND `active`=1);
--> statement-breakpoint
-- 薪资异议响应时限入配置端口（service 域同族；NOT EXISTS 幂等守卫，created_by='system'）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_payroll_appeal_sla_hours', 1, 'payroll_appeal_sla_hours',
  '薪资异议响应时限（小时）：店长须在该时限内复核，页面注记明面',
  '{"hours":24}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='payroll_appeal_sla_hours' AND `active`=1);
