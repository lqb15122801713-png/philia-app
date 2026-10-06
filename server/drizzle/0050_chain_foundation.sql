-- 商家端大批 片 1（连锁地基 · 任务书冻结版 V1.0）：L1 两层模型+多店归属留口+批次表店域列
-- ① stores 扩两层：store_type（store|hq，缺省 store）+ hq_id 自引用；
--    存量回填=幂等 UPDATE（总部=自身——「店即己部」单层特例，开口项 3 裁）。
-- ② staff.extra_store_ids / memberships.home_store_id=多店归属字段留口
--    （片 1 仅留口不消费，跨店支援工时归集/会员归属细化=连锁回归批接）。
-- ③ stored_value_import_batches.store_id=店域闸补漏列（listImportBatches 全平台透出
--    漏闸修复前置）；存量批次=mapping_json 单店推导回填（混合/无映射=NULL 不透出+登记）。
-- 幂等：ADD COLUMN 一次性（迁移表记重放不重复）；UPDATE 均带 NULL/单店守卫，重放零副作用。
ALTER TABLE `stores` ADD `store_type` text DEFAULT 'store' NOT NULL;
--> statement-breakpoint
ALTER TABLE `stores` ADD `hq_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
UPDATE `stores` SET `hq_id` = `id` WHERE `hq_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `staff` ADD `extra_store_ids` text;
--> statement-breakpoint
ALTER TABLE `memberships` ADD `home_store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `stored_value_import_batches` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
UPDATE `stored_value_import_batches` SET `store_id` = (
  SELECT MIN(`value`) FROM json_each(`stored_value_import_batches`.`mapping_json`)
) WHERE `store_id` IS NULL AND `mapping_json` IS NOT NULL AND (
  SELECT COUNT(DISTINCT `value`) FROM json_each(`stored_value_import_batches`.`mapping_json`)
) = 1;
