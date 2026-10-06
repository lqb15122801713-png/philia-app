-- 商家端大批 片 3（收银台 18 件 · 任务书冻结版 V1.0）：抹零列/单品备注/交接班族列/挂账台账/现金收支
-- 幂等：ADD COLUMN/CREATE TABLE IF NOT EXISTS 一次性；规则键注册 NOT EXISTS 守卫。
ALTER TABLE `cashier_bills` ADD `rounding_fen` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `cashier_bill_items` ADD `note` text;
--> statement-breakpoint
ALTER TABLE `shifts` ADD `opening_float_fen` integer;
--> statement-breakpoint
ALTER TABLE `shift_handover_logs` ADD `float_fen` integer;
--> statement-breakpoint
ALTER TABLE `shift_handover_logs` ADD `confirmed_at` integer;
--> statement-breakpoint
ALTER TABLE `shift_handover_logs` ADD `confirmed_by` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `day_closes` ADD `actual_wechat_fen` integer;
--> statement-breakpoint
ALTER TABLE `day_closes` ADD `actual_alipay_fen` integer;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_ledgers` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `bill_id` text NOT NULL REFERENCES `cashier_bills`(`id`),
  `customer_id` text REFERENCES `users`(`id`),
  `amount_fen` integer NOT NULL,
  `settled_fen` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `writeoff_reason` text,
  `note` text,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer,
  `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_credit_ledgers_store_status` ON `credit_ledgers` (`store_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_ledger_logs` (
  `id` text PRIMARY KEY,
  `ledger_id` text NOT NULL REFERENCES `credit_ledgers`(`id`),
  `action` text NOT NULL,
  `amount_fen` integer NOT NULL,
  `note` text,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_credit_ledger_logs_ledger` ON `credit_ledger_logs` (`ledger_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cash_movements` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `shift_id` text REFERENCES `shifts`(`id`),
  `kind` text NOT NULL,
  `amount_fen` integer NOT NULL,
  `reason` text NOT NULL,
  `operator_id` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_cash_movements_store_shift` ON `cash_movements` (`store_id`, `shift_id`);
--> statement-breakpoint
-- 规则端口键注册（service_rules，NULL=总部下发默认行；幂等 NOT EXISTS）：
-- cashier_rounding_rule=抹零规则（none 不抹零[默认零回归] | jiao 抹到角 | yuan 抹到元；退货不读取）；
-- cashier_cash_diff_review_thresh_fen=长短款复核阈值（分，|差异|>阈值须填差异说明，默认 1000）；
-- shifts_opening_float_default_fen=开班备用金默认额（分，默认 50000=¥500；开班登记留口）。
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'cashier_rounding_rule', '收银抹零规则（none 不抹零 | jiao 抹到角 | yuan 抹到元；退货不读取）', json_object('mode', 'none'), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'cashier_rounding_rule' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'cashier_cash_diff_review_thresh_fen', '长短款复核阈值（分）：日结 |实点−账面| 超阈值须填差异说明', json_object('threshFen', 1000), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'cashier_cash_diff_review_thresh_fen' AND `active` = 1)
--> statement-breakpoint

INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'shifts_opening_float_default_fen', '开班备用金默认额（分；开班登记留口，可改）', json_object('amountFen', 50000), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'shifts_opening_float_default_fen' AND `active` = 1);
