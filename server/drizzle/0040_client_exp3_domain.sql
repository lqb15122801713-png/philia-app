-- 客户端体验大批 片 3（会员体系 9+商城 5）：五新表+orders 扩列+端口键种子（幂等+申报）
-- 叠片 1 尖（users.birthday 依赖=0036 已落；迁移号 0040/0041 避开片 2 占用的 0038/0039——批齐合部序不乱）
-- member_perk_grants（未用权益台账+生日礼+新人礼包+升级礼遇共用：kind 枚举服务折扣次数/安心包/
--   生日主人/生日宠物/新人礼包/升级礼遇；发放=资格留痕不真发（候资质批））/
-- coupons（券模板：面额/门槛/有效天数/叠加规则/配额）+coupon_grants（领用台账状态机：
--   claimed→used|expired|voided——**不接真抵扣结算**（开口项 1 裁）：used 仅登记 order_id，orders/payments 零触碰）/
-- favorites（收藏/心愿单：(user_id,product_id) 唯一锚幂等）/
-- product_reviews（商品评价晒单：挂 order_id+product_id 一单一件一评；与服务评价域分键不混 reviews）/
-- orders 扩列 delivery_method（express|same_city|pickup，默认 express 存量零破坏）+shipped_at（发货时刻=超时收货锚）
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
CREATE TABLE `member_perk_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`store_id` text,
	`total_count` integer,
	`remain_count` integer,
	`source_id` text,
	`year` integer,
	`pet_id` text,
	`status` text DEFAULT 'granted' NOT NULL,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_perk_grants_user` ON `member_perk_grants` (`user_id`,`kind`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_perk_grants_birthday` ON `member_perk_grants` (`user_id`,`kind`,`year`,`pet_id`);--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text,
	`title` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`threshold_fen` integer DEFAULT 0 NOT NULL,
	`valid_days` integer NOT NULL,
	`stack_rule` text DEFAULT 'none' NOT NULL,
	`total_quota` integer,
	`status` text DEFAULT 'on' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_coupons_store` ON `coupons` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `coupon_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'claimed' NOT NULL,
	`claimed_at` integer,
	`used_at` integer,
	`order_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_coupon_grants_user_coupon` ON `coupon_grants` (`coupon_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `ix_coupon_grants_user` ON `coupon_grants` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_favorites_user_product` ON `favorites` (`user_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`rating` integer NOT NULL,
	`text` text,
	`photo_urls` text DEFAULT '[]',
	`anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_product_reviews_order_product` ON `product_reviews` (`order_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `ix_product_reviews_product` ON `product_reviews` (`product_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_method` text DEFAULT 'express';--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` integer;--> statement-breakpoint
-- 券叠加规则公示+超时收货天数入配置端口（service 域同族；NOT EXISTS 幂等守卫，created_by='system'）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_coupon_stack_rule', 1, 'coupon_stack_rule',
  '优惠券叠加规则公示（与会员折扣是否同享；公示=只读展示，真抵扣结算候线上收单批）',
  '{"rule":"none","note":"优惠券不与会员折扣叠加；每单限用 1 张（公示口径）"}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='coupon_stack_rule' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_order_auto_receive_days', 1, 'order_auto_receive_days',
  '商城订单发货后自动确认收货天数（超时未点=系统确认，台账留痕）',
  '{"days":7}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='order_auto_receive_days' AND `active`=1);
--> statement-breakpoint
-- 续费优惠入各档端口值（默认 10000=无优惠，待产品侧端口调；json_set 同值重放零副作用）
UPDATE `member_plans` SET `value_json`=json_set(`value_json`,'$.renew_discount_bp',10000), `updated_at`=unixepoch()
WHERE `active`=1 AND `rule_key` IN ('plan_weiguang','plan_yinghuo','plan_zhuguang','plan_nuanyang');
