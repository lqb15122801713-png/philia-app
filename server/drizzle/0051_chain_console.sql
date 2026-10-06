-- 商家端大批 片 2（老板端驾驶舱 · 任务书冻结版 V1.0）：换绑申诉店域列+配置分层列+门店分组列
-- ① phone_change_requests.store_id：裁件②（片 1 意见书 §三）换绑申诉队列店域过滤——
--    提交时落客户最近消费店；存量=最近消费单推导回填（appointments/cashier_bills 新者，
--    无单=NULL=平台件：老板全域可见、店长本店不见）。
-- ② 六张规则表 +store_id（commission/xp/duration/refund/service/pay）：配置作用域分层
--    （NULL=总部下发全局默认；store_id=门店覆盖；解析序=门店行优先）。
--    member_plans（决策 #41 中央建卡）/copy_overrides（端口 V2 全局单份）两表不分层——登记。
-- ③ stores.group_name：门店分组锚（驾驶舱分栏分组/E1 维护口）。
-- 幂等：ADD COLUMN 一次性；UPDATE 带 NULL 守卫重放零副作用。
ALTER TABLE `phone_change_requests` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
UPDATE `phone_change_requests` SET `store_id` = (
  SELECT `store_id` FROM (
    SELECT `store_id`, `created_at` FROM `appointments` WHERE `customer_id` = `phone_change_requests`.`user_id`
    UNION ALL
    SELECT `store_id`, `created_at` FROM `cashier_bills` WHERE `customer_id` = `phone_change_requests`.`user_id`
    ORDER BY `created_at` DESC LIMIT 1
  )
) WHERE `store_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `commission_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `duration_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `xp_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `refund_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `service_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `pay_rules` ADD `store_id` text REFERENCES `stores`(`id`);
--> statement-breakpoint
ALTER TABLE `stores` ADD `group_name` text;
