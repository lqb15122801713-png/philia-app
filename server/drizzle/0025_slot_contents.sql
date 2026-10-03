-- 端口批片 C（CJ-1002-01 内容层全端口化 · A5 落地）：展示槽位 slot_contents 建表 + 七槽注册种子
-- （BANNER/卡面/登录宣言图/空态插画/多宠氛围卡/商品占位模板；现状值=码内默认路径或渐变占位 url=NULL——
--  R10 不画假件：无真件不落假图，前端 fallback=码内渐变/默认图）。
-- 幂等：种子段 slot_key NOT EXISTS 守卫（重放零副作用）；created_by='system'
-- （迁移执行器 PRAGMA foreign_keys=OFF，惯例见 migrate.ts 头注）。
CREATE TABLE `slot_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_key` text NOT NULL,
	`version` integer NOT NULL,
	`content_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_slot_contents_key_status` ON `slot_contents` (`slot_key`,`status`);--> statement-breakpoint
CREATE INDEX `ix_slot_contents_key_version` ON `slot_contents` (`slot_key`,`version`);--> statement-breakpoint
-- 七槽注册种子（status='live' 版本 1=码内现状值；famCard/cardFace/product.placeholder 渐变占位 url=NULL）
WITH s(slot_key, url, alt) AS (VALUES
  ('home.banner', '/brand/banner-home-1200.png', '首页品牌横幅'),
  ('login.hero.staff', '/brand/banner-home-1200.png', '员工端登录页主视觉'),
  ('pets.emptyIllustration', '/brand/empty-appointments-800.png', '宠物/预约空态插画'),
  ('member.famCard', NULL, '多宠氛围卡（渐变占位，待素材通道真件）'),
  ('member.cardFace', NULL, '会员卡面（档色谱渐变占位，待素材通道真件）'),
  ('product.placeholder', NULL, '商品无图占位模板（爪印图标占位，待素材通道真件）')
)
INSERT INTO `slot_contents` (`id`,`slot_key`,`version`,`content_json`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedslot_' || s.slot_key, 1, s.slot_key, json_object('url', s.url, 'alt', s.alt), 'live', 'system', unixepoch(), unixepoch()
FROM s
WHERE NOT EXISTS (SELECT 1 FROM `slot_contents` WHERE `slot_key` = s.slot_key);
