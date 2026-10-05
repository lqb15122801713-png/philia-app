-- 员工端骨架整建批 片 3（任务执行 6+通讯 5+权限 4）：任务/通讯/权限域建表（幂等+申报）
-- task_templates（循环任务模板入端口同族自管）/task_runs（模板按日落实例，(template_id,biz_date) 幂等锚）/
-- pdca_issues（问题-整改-复检闭环，timeline_json 只增留痕照 support_tickets 工艺）/
-- self_check_runs（门店每日自检+上级审核，(store_id,biz_date) 一店一日一表）/
-- announcements+announcement_reads（公告+已读回执，(announcement_id,user_id) 幂等锚）/
-- shift_handover_logs（交接班结构化四节：在洗清单/钥匙/现金/客诉；一班一份，不碰 shifts 列——收银/日结快照口径冻结）/
-- staff_exit_handoffs（离职资源改挂留痕，仿 reception_logs 前后值口径）/
-- step_photos 扩列（client_taken_at=EXIF 拍摄时刻 / flag_reason=校验留痕——只许现场拍兜底闸）/
-- support_tickets 扩列（created_via=customer|staff——员工心声同族留痕零新表）
-- 命名注：staff_tasks=片 1 只读投影概念名（非实体表），循环任务实体=task_templates/task_runs 不撞名；
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`assign_scope` text NOT NULL,
	`assign_role` text,
	`assign_staff_id` text,
	`freq` text NOT NULL,
	`weekdays` text NOT NULL,
	`due_min` integer NOT NULL,
	`remind_min` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assign_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_task_templates_store` ON `task_templates` (`store_id`,`active`);--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`template_id` text NOT NULL,
	`biz_date` text NOT NULL,
	`staff_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`done_by` text,
	`done_at` integer,
	`reminded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`done_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_task_runs_tpl_date` ON `task_runs` (`template_id`,`biz_date`);--> statement-breakpoint
CREATE INDEX `ix_task_runs_store_date` ON `task_runs` (`store_id`,`biz_date`,`status`);--> statement-breakpoint
CREATE TABLE `pdca_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`category` text,
	`photo_urls` text,
	`raised_by` text NOT NULL,
	`assign_staff_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`fix_note` text,
	`fixed_by` text,
	`fixed_at` integer,
	`recheck_note` text,
	`recheck_by` text,
	`recheck_at` integer,
	`recheck_result` text,
	`timeline_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`raised_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_pdca_issues_store` ON `pdca_issues` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `self_check_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`biz_date` text NOT NULL,
	`items_json` text NOT NULL,
	`score` integer NOT NULL,
	`filled_by` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`review_note` text,
	`review_by` text,
	`review_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`filled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_self_check_store_date` ON `self_check_runs` (`store_id`,`biz_date`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`target_role` text DEFAULT 'all' NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`published_by` text NOT NULL,
	`published_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_announcements_store` ON `announcements` (`store_id`,`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `announcement_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_announcement_reads` ON `announcement_reads` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `shift_handover_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`shift_id` text NOT NULL,
	`store_id` text NOT NULL,
	`washing_json` text,
	`keys_note` text,
	`cash_note` text,
	`complaints_note` text,
	`from_user_id` text NOT NULL,
	`to_user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_handover_shift` ON `shift_handover_logs` (`shift_id`);--> statement-breakpoint
CREATE TABLE `staff_exit_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`from_staff_id` text NOT NULL,
	`to_staff_id` text,
	`prev_value` text,
	`new_value` text,
	`note` text,
	`changed_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_exit_handoffs_store` ON `staff_exit_handoffs` (`store_id`,`from_staff_id`);--> statement-breakpoint
ALTER TABLE `step_photos` ADD `client_taken_at` integer;--> statement-breakpoint
ALTER TABLE `step_photos` ADD `flag_reason` text;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `created_via` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
-- 自检表项入配置端口（service 域同族，端口可调；NOT EXISTS 幂等守卫，created_by='system'）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_self_check_items', 1, 'self_check_items',
  '门店每日自检表项（员工逐项打点+拍照留证；店长在配置端口维护表项与分值）',
  '{"items":[{"key":"disinfect","label":"消毒备台完成","score":25},{"key":"stock","label":"安心包/库存盘点","score":25},{"key":"device","label":"设备巡检正常","score":25},{"key":"env","label":"店堂环境整洁","score":25}]}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='self_check_items' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_voice_sla_hours', 1, 'voice_sla_hours',
  '员工心声响应时限（小时）：店长须在该时限内回复，页面注记明面',
  '{"hours":24}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='voice_sla_hours' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_pdca_categories', 1, 'pdca_categories',
  'PDCA 问题类目集（巡检排行分组维度；店长在配置端口维护类目集）',
  '{"categories":["卫生","设备","服务","安全","其他"]}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='pdca_categories' AND `active`=1);
