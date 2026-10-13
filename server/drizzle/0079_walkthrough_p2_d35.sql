-- 走查P2修复批（D-35~D-38 · PD-18 · 任务书冻结版 V1.0 · 老板 10-13 签P2开工）：copy 键 1 增（D-35 班次区冻结明示徽 cashier.shiftFrozenBadge）+ 4 键改值（D-37 寄养不可打卡人话两件 + D-38.3 商城配送槽位写准注记两件）
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行（0071 范式）。键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.shiftFrozenBadge', 'merchant:cashier', json_object('text', '今日已日结 · 账目已冻结'), '商家·日结·交接班', 'DayClosePanels 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.shiftFrozenBadge' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '当前不可打卡'), `updated_at` = unixepoch() WHERE `rule_key` = 'boarding.error.title' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '该寄养单不存在、已完结或不归你照护——回任务台可继续其它工作。'), `updated_at` = unixepoch() WHERE `rule_key` = 'boarding.error.fallbackDesc' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '配送方式 · 结算页可选'), `updated_at` = unixepoch() WHERE `rule_key` = 'mall.deliveryTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '快递 / 同城 / 自提 · 内测期免运费 · 时效属后期端口'), `updated_at` = unixepoch() WHERE `rule_key` = 'mall.deliverySub' AND `active` = 1;
