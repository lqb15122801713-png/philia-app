-- M1-补1 修订 2：cashier_bills 增 operator_id（必填，by=who 审计链）+ shift_id（可空，M2 班次预留）。
-- operator_id 走「default 后回填」（修订单许可）：SQLite 对存量表无法直接加
-- NOT NULL 无默认值列——先带 DEFAULT '' 落列（迁移期 FK 已关，见 migrate.ts），
-- 再回填 operator_id = created_by（v1 同源口径），应用层此后恒写真实操作员。
ALTER TABLE `cashier_bills` ADD `operator_id` text NOT NULL DEFAULT '' REFERENCES users(id);--> statement-breakpoint
UPDATE `cashier_bills` SET `operator_id` = `created_by`;--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `shift_id` text;
