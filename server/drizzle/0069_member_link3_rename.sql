-- 会员链路修正小批 片 3（E 股·更名与限制解除 · 任务-1008-2 两裁终审）：
-- ① copy 键 6 增（建档不限/永久在册正名/toast 入端口）+10 改值（更名扫面+货架首行+永久正名）；
-- ② member_plans：plan_weiguang label 改「会员档·注册用户」+value_json 正名（建档不限 included/max=100·extra=0）
--    +advance_book_days 注册用户 3→7、萤火/烛光 7→14（暖阳 14 不动）——端口值与种子同源；
-- ③ commission_card_fixed 键名同步（旧名免费档→注册用户免费档，值 0 不变）。
-- 幂等：copy 新增=NOT EXISTS 守卫；改值=UPDATE active=1 行；member_plans/commission=UPDATE active 行（重放同值无害）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.petsUnlimited', 'member', json_object('text', '建档不限'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.petsUnlimited' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'perk.petsSubFree', 'member', json_object('text', '建档不限'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'perk.petsSubFree' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.freeValidityValue', 'member', json_object('text', '永久在册'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.freeValidityValue' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.freeValidityNote', 'member', json_object('text', '账号在即在册 · 永不冻结'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.freeValidityNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.toastAlready', 'member', json_object('text', '你已是会员'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.toastAlready' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.toastOpenedFree', 'member', json_object('text', '注册用户已开通，欢迎加入'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.toastOpenedFree' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '你当前是注册用户（账号在即在册，永不冻结）。选付费档开通即享回馈金与服务折扣——新购口径：全档价，有效期自开通重起算。'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.alreadyMemberFree' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '注册用户已开通'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.freeOpenedTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '还不是会员：注册用户免费在册，一键开通即享基础功能；付费档线上即可开通。'), `updated_at` = unixepoch() WHERE `rule_key` = 'q1.nonMemberGuide' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '注册用户免费档无回馈金 · 付费档 {pcts}% · 仅抵商品'), `updated_at` = unixepoch() WHERE `rule_key` = 'rules.r1Free' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '账号在即在册 · 永不冻结 · 随时可开通付费档'), `updated_at` = unixepoch() WHERE `rule_key` = 'rules.r3Free' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '先开通会员（注册用户免费在册，一键开通），再按需要升档。'), `updated_at` = unixepoch() WHERE `rule_key` = 'up.nonMemberBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '注册用户永久在册 · 账号在即在册永不冻结 · 无到期换档；升档即时生效请走升级页。'), `updated_at` = unixepoch() WHERE `rule_key` = 'chg.freeNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '免费'), `updated_at` = unixepoch() WHERE `rule_key` = 'card.freePrice' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '在册即享基础功能'), `updated_at` = unixepoch() WHERE `rule_key` = 'card.claimWeiguang' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '注册用户免费档一键开通即可，无需进入支付流程。'), `updated_at` = unixepoch() WHERE `rule_key` = 'checkout.freePlanBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `member_plans` SET `label` = '会员档·注册用户：免费档（手机号即在册）；宠物建档不限；无回馈金、无服务折扣；安心包全员免费（钩子仅权益表述，注册用户不设钩子）', `value_json` = json_set(`value_json`, '$.included_pets', 100, '$.extra_pet_fen', 0, '$.max_pets', 100, '$.advance_book_days', 7), `updated_at` = unixepoch() WHERE `rule_key` = 'plan_weiguang' AND `active` = 1;
--> statement-breakpoint
UPDATE `member_plans` SET `value_json` = json_set(`value_json`, '$.advance_book_days', 14), `updated_at` = unixepoch() WHERE `rule_key` = 'plan_yinghuo' AND `active` = 1;
--> statement-breakpoint
UPDATE `member_plans` SET `value_json` = json_set(`value_json`, '$.advance_book_days', 14), `updated_at` = unixepoch() WHERE `rule_key` = 'plan_zhuguang' AND `active` = 1;
--> statement-breakpoint
UPDATE `commission_rules` SET `label` = '年费会员售卡定额：萤火199→5元/单、烛光299→10元/单、暖阳599→20元/单、注册用户免费档无提成', `value_json` = json_object('fixed_fen_by_plan', json_object('萤火199', 500, '烛光299', 1000, '暖阳599', 2000, '注册用户免费档', 0)), `updated_at` = unixepoch() WHERE `rule_key` = 'commission_card_fixed' AND `active` = 1 AND `store_id` IS NULL;
