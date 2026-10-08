-- 会员链路修正小批 片 2（线上升级 mock 域+入口断链 · 任务书冻结版 V1.0）：copy 键 11 增 4 改
-- （撤牌 checkout.alreadyTitle/alreadyBody/alreadyBodyFree/alreadyCta 四键出码内宇宙=仓行留档不写 DELETE）。
-- 幂等：新增=rule_key active 行 NOT EXISTS 守卫；改值=UPDATE active=1 行（端口值与码内默认同步）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.compareRowCta', 'member', json_object('text', '开通 ›'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.compareRowCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.compareRowFreeCta', 'member', json_object('text', '免费开通'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.compareRowFreeCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.compareRowCurrent', 'member', json_object('text', '当前档'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.compareRowCurrent' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'up.payCta', 'member', json_object('text', '去支付 ¥{amount}'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'up.payCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.cardOpenCta', 'member', json_object('text', '开通 ›'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.cardOpenCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.cardRenewCta', 'member', json_object('text', '续费 ›'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.cardRenewCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'checkout.planLabelUpgrade', 'pay', json_object('text', '升级至档位'), '客户·会员收银台', 'MemberCheckoutPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'checkout.planLabelUpgrade' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'checkout.upgradeNoteNewPurchase', 'pay', json_object('text', '新购口径：应付=全档价，有效期自开通之日重起算'), '客户·会员收银台', 'MemberCheckoutPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'checkout.upgradeNoteNewPurchase' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'checkout.upgradeNoteDiff', 'pay', json_object('text', '期内升档：应付=补差价（剩余整月折算），到期日不变、新档即时生效'), '客户·会员收银台', 'MemberCheckoutPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'checkout.upgradeNoteDiff' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'state.paidTitleUpgrade', 'pay', json_object('text', '会员已升级'), '客户·支付状态', 'PayStatePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'state.paidTitleUpgrade' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'state.paidBodyUpgrade', 'pay', json_object('text', '{planLabel} · 补差成交，新档权益即时生效。'), '客户·支付状态', 'PayStatePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'state.paidBodyUpgrade' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '你已是会员（有效期至 {date}）。升档可线上自助办理，续费请到店收银台。'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.alreadyMember' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '你当前是微光免费档（永久有效）。选付费档开通即享回馈金与服务折扣——新购口径：全档价，有效期自开通重起算。'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.alreadyMemberFree' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '免费档即时生效{date}。升级萤火/烛光/暖阳可享商品回馈金与服务折扣，本页选档线上即可办理。'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.freeOpenedBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '当前为免费档，升档按新购口径办理：全档价、线上开通即时生效，有效期自开通重起算。'), `updated_at` = unixepoch() WHERE `rule_key` = 'up.freeTierGuide' AND `active` = 1;
