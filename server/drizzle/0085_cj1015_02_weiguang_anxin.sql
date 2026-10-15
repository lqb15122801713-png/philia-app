-- CJ-1015-02 安心包／微光修订（A1→A2→A3 · 任务书冻结版 V1.0 · 头子 10-15 准）：copy 键 13 增 4 改 + member_plans 1 改
--   A1 微光=注册用户身份（开口①双标：对外微光／对内注册用户）：j1.alreadyMemberFree／j1.freeOpenedTitle／j1.toastOpenedFree／q1.nonMemberGuide 四键改值「微光（注册用户）」并置；身份模型与付费三档零触。
--   A2 安心包到店不绑 App（开口②：可先发+店日库存记账+身份后补）：inventory.issue.* 13 键增（staff:inventory 员工端发放面）。
--   A3 注册用户宠物数正式不限（开口③「含 100」作废）：plan_weiguang value_json included_pets/max_pets 100→0（语义=不设闸；免费档不套 max_pets 硬校验，membership.membershipChargeFen 同源）；付费档封顶照旧。
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行（0071/0079/0083/0084 范式）；member_plans=json_set UPDATE active 行（0069 范式，重放同值无害）。
-- 键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.title', 'staff:inventory', json_object('text', '安心包发放'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.note', 'staff:inventory', json_object('text', '到店全员可发，不绑 App——可先发后补身份；每次发放落库存流水（店日记账）。'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.note' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.cta', 'staff:inventory', json_object('text', '发放'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.cta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.qtyLabel', 'staff:inventory', json_object('text', '数量'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.qtyLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.phoneLabel', 'staff:inventory', json_object('text', '客户手机号（选填：挂上他的权益包）'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.phoneLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.noteLabel', 'staff:inventory', json_object('text', '备注（选填）'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.noteLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.confirm', 'staff:inventory', json_object('text', '确认发放'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.confirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.confirming', 'staff:inventory', json_object('text', '发放中…'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.confirming' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.cancel', 'staff:inventory', json_object('text', '取消'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.cancel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.success', 'staff:inventory', json_object('text', '已发放并入库存流水（身份可后补）'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.success' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.successAttached', 'staff:inventory', json_object('text', '已发放并挂到客户权益包'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.successAttached' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.loadFail', 'staff:inventory', json_object('text', '安心包库存加载失败，请检查网络后重试'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.loadFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'inventory.issue.empty', 'staff:inventory', json_object('text', '本店暂无安心包库存商品'), '员工·盘点', 'InventoryPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'inventory.issue.empty' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '你当前是微光（注册用户身份，账号在即在册，永不冻结）。选付费档开通即享回馈金与服务折扣——新购口径：全档价，有效期自开通重起算。'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.alreadyMemberFree' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '微光（注册用户）已开通'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.freeOpenedTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '微光（注册用户）已开通，欢迎加入'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.toastOpenedFree' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '还不是会员：微光（注册用户）免费在册，一键开通即享基础功能；付费档线上即可开通。'), `updated_at` = unixepoch() WHERE `rule_key` = 'q1.nonMemberGuide' AND `active` = 1;
--> statement-breakpoint
UPDATE `member_plans` SET `value_json` = json_set(`value_json`, '$.included_pets', 0, '$.max_pets', 0), `updated_at` = unixepoch() WHERE `rule_key` = 'plan_weiguang' AND `active` = 1;
