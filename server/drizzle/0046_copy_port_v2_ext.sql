-- 端口 V2 修正批（单片）：copy_overrides 扩 screen+position 两列（键注册表扩列）
-- screen=路由级屏中文名（屏名字典写死进生成器；NULL=未归屏诚实组，排末+注记）；
-- position=位置注（调用点组件名+一句人话模板；端口可人工改=留口件，config.save 扩列）。
-- 存量回填=0047（生成器扫三端调用点产物，UPDATE WHERE screen IS NULL 幂等守卫）。
-- 幂等=journal 守卫（仅跑一次）。
ALTER TABLE `copy_overrides` ADD `screen` text;
--> statement-breakpoint
ALTER TABLE `copy_overrides` ADD `position` text;
