-- 产品-1015 换皮 片4-运营商城（A4 端口轻批 · 任务书冻结版 V1.0 · 头子已准 10-16）：槽位 4 增 + copy 键 21 增
--   批C 杂志（philia.magazine.lead/.02/.03 三槽：选题卡内容端口，壳写死；PGC 非开放 Feed 口径不扩）；
--   批D 商城（mall.hero 促销横幅槽；新品角标=copy 键展示签，createdAt 视窗自动，不含真券核销）；
--   A4 半端口（类目 chip 展示名 6 键；我的标签兜底 1 键）；回馈金 hint=既有键本片只核不增（口径不扩）。
--   槽 url=NULL=渐变占位（R10 真图终摄非目标，不落假图），D-42 三行默认文案随种子（slotSeedRows.ts 同帧）。
-- 幂等：槽=slot_key NOT EXISTS 守卫；copy=rule_key AND active=1 NOT EXISTS 守卫（0071/0079/0083/0084/0085 范式）。
-- 键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）。
INSERT INTO `slot_contents` (`id`,`slot_key`,`version`,`content_json`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedslot_mall.hero', 'mall.hero', 1, json_object('url', NULL, 'alt', '商城促销横幅（渐变占位，待素材通道真件）', 'title_main', '本周上新', 'title_sub', '给它囤点好的 · 门店同价', 'cta_text', '去看看'), 'live', 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `slot_contents` WHERE `slot_key` = 'mall.hero');
--> statement-breakpoint
INSERT INTO `slot_contents` (`id`,`slot_key`,`version`,`content_json`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedslot_philia.magazine.lead', 'philia.magazine.lead', 1, json_object('url', NULL, 'alt', '杂志封面主打（渐变占位，待素材通道真件）', 'title_main', '秋日洗护季特刊', 'title_sub', '换季掉毛与皮肤干燥——给它一套入秋洗护方案', 'cta_text', '读本期'), 'live', 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `slot_contents` WHERE `slot_key` = 'philia.magazine.lead');
--> statement-breakpoint
INSERT INTO `slot_contents` (`id`,`slot_key`,`version`,`content_json`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedslot_philia.magazine.02', 'philia.magazine.02', 1, json_object('url', NULL, 'alt', '杂志条目二（渐变占位，待素材通道真件）', 'title_main', '猫咪换季软便怎么办', 'title_sub', '饮食过渡七日法 · 编辑部'), 'live', 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `slot_contents` WHERE `slot_key` = 'philia.magazine.02');
--> statement-breakpoint
INSERT INTO `slot_contents` (`id`,`slot_key`,`version`,`content_json`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedslot_philia.magazine.03', 'philia.magazine.03', 1, json_object('url', NULL, 'alt', '杂志条目三（渐变占位，待素材通道真件）', 'title_main', '狗狗脚掌护理入门', 'title_sub', '秋冬干裂预防 · 编辑部'), 'live', 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `slot_contents` WHERE `slot_key` = 'philia.magazine.03');
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.headTitle', 'magazine', json_object('text', 'PHILIA'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.headTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.headSub', 'magazine', json_object('text', '杂志 · 给它，也给自己'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.headSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.pgcNote', 'magazine', json_object('text', '编辑部出品 · 精选内容（不开放投稿）'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.pgcNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.leadTitle', 'magazine', json_object('text', '秋日洗护季特刊'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.leadTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.leadSub', 'magazine', json_object('text', '换季掉毛与皮肤干燥——给它一套入秋洗护方案'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.leadSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.leadCta', 'magazine', json_object('text', '读本期'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.leadCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.e2Title', 'magazine', json_object('text', '猫咪换季软便怎么办'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.e2Title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.e2Sub', 'magazine', json_object('text', '饮食过渡七日法 · 编辑部'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.e2Sub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.e3Title', 'magazine', json_object('text', '狗狗脚掌护理入门'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.e3Title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mag.e3Sub', 'magazine', json_object('text', '秋冬干裂预防 · 编辑部'), '客户·Philia 爪', 'PhiliaPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mag.e3Sub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.heroTitle', 'mall', json_object('text', '本周上新'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.heroTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.heroSub', 'mall', json_object('text', '给它囤点好的 · 门店同价'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.heroSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.heroCta', 'mall', json_object('text', '去看看'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.heroCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.badgeNew', 'mall', json_object('text', '新品'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.badgeNew' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.all', 'mall', json_object('text', '全部'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.all' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.staple', 'mall', json_object('text', '主粮'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.staple' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.snack', 'mall', json_object('text', '零食'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.snack' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.toy', 'mall', json_object('text', '玩具'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.toy' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.clean', 'mall', json_object('text', '清洁'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.clean' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cat.other', 'mall', json_object('text', '其他'), '客户·商城', 'MallPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cat.other' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.tagGuest', 'member', json_object('text', '菲丽亚宠友'), '客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.tagGuest' AND `active` = 1);
