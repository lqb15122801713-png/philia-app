-- 端口批片 C 顺带件②（开工令清账）：slot_contents 补 publish/revert 操作人留痕列
-- （acted_by/acted_at——对齐文案域 rule_config_versions 治理口径：谁点的上线/回退可查）。
-- 幂等=journal 守卫（本迁移仅跑一次）；存量行两列=NULL（历史版本无操作人=诚实空）。
ALTER TABLE `slot_contents` ADD `acted_by` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `slot_contents` ADD `acted_at` integer;
