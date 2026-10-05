CREATE TABLE `refund_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_no` text NOT NULL,
	`customer_id` text NOT NULL,
	`store_id` text NOT NULL,
	`order_kind` text NOT NULL,
	`bill_id` text NOT NULL,
	`bill_no` text NOT NULL,
	`type` text NOT NULL,
	`reason_code` text NOT NULL,
	`reason_label` text NOT NULL,
	`description` text,
	`photo_urls` text DEFAULT '[]' NOT NULL,
	`amount_fen` integer NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`timeline_json` text DEFAULT '[]' NOT NULL,
	`approver_id` text,
	`approved_at` integer,
	`reject_reason` text,
	`refund_bill_no` text,
	`reapplied_after_days` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_refund_requests_request_no` ON `refund_requests` (`request_no`);--> statement-breakpoint
CREATE INDEX `ix_refund_requests_customer` ON `refund_requests` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ix_refund_requests_store_status` ON `refund_requests` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_refund_requests_bill` ON `refund_requests` (`bill_id`);
--> statement-breakpoint
-- 0017 幂等配置种子（C5 批次 客户退款申请 · 迁移豁免件照 0016 模式，DDL 之上纯种子行）：
-- refund_rules 五行——客户退款申请开关/申请时限/免费反悔窗口/原因枚举/审批 SLA，
-- 读侧 refundRequest.configView/create 只读 active 行（缺行兜底默认，同 loadRefundThresholdFen 口径），
-- 端口 config.save（refund 域，仅 owner）改值零改码（enabled/hour/days/keywords 均在
-- configRules.ts 校验族内）。幂等：active 行已存在则跳过。created_by='system'
-- （迁移期 users 表可为空；迁移执行器 PRAGMA foreign_keys=OFF，惯例见 migrate.ts 头注）。

INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_request_enabled', 1, 'refund_request_enabled',
  '客户退款申请开关',
  '{"enabled":true}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_request_enabled' AND `active`=1);
--> statement-breakpoint
INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_apply_window_days', 1, 'refund_apply_window_days',
  '退款申请时限（天）',
  '{"days":30}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_apply_window_days' AND `active`=1);
--> statement-breakpoint
INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_free_regret_hours', 1, 'refund_free_regret_hours',
  '免费反悔窗口（小时）',
  '{"hour":24}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_free_regret_hours' AND `active`=1);
--> statement-breakpoint
INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_reason_options', 1, 'refund_reason_options',
  '退款原因枚举',
  '{"keywords":["服务不满意","商品与描述不符","拍错/多拍","未按约定时间服务","宠物健康原因","其他（请补充说明）"]}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_reason_options' AND `active`=1);
--> statement-breakpoint
INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_sla_hours', 1, 'refund_sla_hours',
  '退款审批 SLA（小时）',
  '{"hour":24}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_sla_hours' AND `active`=1);