-- 端口批收尾片 1（配置端口增补 7 · 任务书冻结版 V1.0）：定时生效登记表+涉钱配置审批载荷表+客户端错误事件表+三 service_rules 键
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS 一次性；规则键注册 NOT EXISTS 守卫（多句 INSERT=全前缀逐句，立规矩照办）。
CREATE TABLE IF NOT EXISTS `config_scheduled` (
  `id` text PRIMARY KEY,
  `domain` text NOT NULL,
  `rule_key` text NOT NULL,
  `row_id` text NOT NULL,
  `effective_at` integer NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_config_scheduled_due` ON `config_scheduled` (`status`, `effective_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `config_change_proposals` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `domain` text NOT NULL,
  `scope` text,
  `changes_json` text NOT NULL,
  `note` text,
  `status` text DEFAULT 'pending' NOT NULL,
  `proposer_id` text NOT NULL REFERENCES `users`(`id`),
  `applied_at` integer,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_config_change_proposals_store_status` ON `config_change_proposals` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `client_error_events` (
  `id` text PRIMARY KEY,
  `app` text NOT NULL,
  `message` text NOT NULL,
  `stack` text,
  `url` text,
  `user_agent` text,
  `ip` text,
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_client_error_events_created` ON `client_error_events` (`created_at`);
--> statement-breakpoint
-- 规则端口键注册（service_rules，NULL=总部下发全局单份；NOT EXISTS 守卫；INSERT=3 逐句）：
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'config_kill_switch', '全局一键开关（kill switch）：开=全部可关参数瞬时回落安全值（线上支付通道关；页面显著红态）', '{"enabled":false}', NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'config_kill_switch' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'config_auto_rollback', '异常自动回滚开关：开=客户端错误越线自动回滚窗口内人工配置变更到上一版（告警留痕）', '{"enabled":true}', NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'config_auto_rollback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'client_error_alert_threshold', '客户端错误告警闸门：窗口 N 分钟内错误上报超 threshold 条=越线（异常自动回滚指标源）', json_object('threshold', 20, 'minutes', 10), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'client_error_alert_threshold' AND `active` = 1);
