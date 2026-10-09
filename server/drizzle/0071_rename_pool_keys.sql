-- 微光正名批 片 1（CJ-1009-06 流量池化+C 股扫尾）：copy 键 2 增 2 改
-- 增=j1.ctaCurrentFree（openFree CTA 退位注记）/j1.carePackAllFree（安心包明示行·老板 10-09 批延续）；
-- 改=j1.compareFooter（安心包明示行同口径）/home.idJoin（免费领个身份→开通会员 ›）。
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.ctaCurrentFree', 'member', json_object('text', '当前档 · 在册即享基础功能'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.ctaCurrentFree' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.carePackAllFree', 'member', json_object('text', '安心包：全员免费 · 注册用户在册即享（来 Philia 即享）'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.carePackAllFree' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '四档共通：七节点全程可视 · 美容报告 30 分钟 · 安心包全员免费（注册用户在册即享）
年费 ≠ 储值 · 到期不自动续费 · 权益只加不减'), `updated_at` = unixepoch() WHERE `rule_key` = 'j1.compareFooter' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '开通会员 ›'), `updated_at` = unixepoch() WHERE `rule_key` = 'home.idJoin' AND `active` = 1;
