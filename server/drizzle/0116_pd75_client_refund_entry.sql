-- PD-75 客户端退款入口同批 copy（0116，本窗独占号；键入码必随迁移·台账新规）：
--   HP-CLIENT-02 对客登录去种子/工程语：devlogin 域 12 键改值（seed/userId/db:seed/内测口令→演示账号/访问口令人话）；
--   HP-CLIENT-04 收银台件数一致：mall.cashierItems 1 键增；
--   P-CLIENT-03 自提不写「发货」：mall.paySuccessSubPickup / mall.statusWaitPickup 2 键增 + mall.toastPaid 改「备货」中性口径；
--   协议正文同步：agr.docUser「种子账号」→「演示账号」。
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行（0084/0090 范式，重放同值无害）。
-- 键值=copySeedRows.ts 单源逐字（seed 手补先例：生成件全量重生成会拖入他窗未审键，本窗最小手补）。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '需要访问口令'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.gateTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '请输入访问口令后加载可登录账号；无口令或口令错误将无法登录。'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.gateBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '口令登录 ›'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.gateLink' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '选择演示账号登录'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.seedTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', ''), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.devOnly' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '演示账号拉取失败（{error}），请检查网络后重试；若有口令请先在上方验证'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.seedFail' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '暂无可登录的演示账号，请稍后再试'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.seedEmpty' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '账号 ID 登录'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.manualTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '演示环境重建后账号 ID 会变化，可向门店索取最新账号 ID。'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.manualBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '提示：演示账号一键登录，也可在口令通过后用手机号自助开户；登录状态保留 7 天。'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.seedNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '访问口令由门店发放'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.footerB' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '微信授权登录属小程序/资质批，PWA 端暂以手机号或演示账号登录'), `updated_at` = unixepoch() WHERE `rule_key` = 'devlogin.wechatNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '支付成功，门店会尽快为你备货'), `updated_at` = unixepoch() WHERE `rule_key` = 'mall.toastPaid' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '一、服务范围：内测期间，本应用提供宠物洗护、寄养预约与商城下单的线上入口，实际服务由线下门店履约，服务内容、价格与门店公示一致。\n二、账号：内测期使用手机号或门店发放的演示账号登录；请妥善保管登录状态，账号仅限本人使用。\n三、交易：线上支付通道为内测演示通道，不产生真实扣款；真实消费以门店收银与订单记录为准。\n四、变更与终止：内测期功能与规则可能调整，调整以应用内公告与门店公示为准；您可随时停止使用并申请注销账号。\n五、其他：本协议为内测期简版文本，未尽事宜以门店公示规则为准；正式上线版本协议发布后，以新版本为准。'), `updated_at` = unixepoch() WHERE `rule_key` = 'agr.docUser' AND `active` = 1;
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.paySuccessSubPickup', 'mall', json_object('text', '备货完成后会通知你到店自取，进度可在订单列表查看'), '客户·商城', 'CheckoutPage 支付成功页（自提分支）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.paySuccessSubPickup' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cashierItems', 'mall', json_object('text', '共 {count} 件'), '客户·商城', 'CashierModal 收银台件数行', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cashierItems' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.statusWaitPickup', 'mall', json_object('text', '待自取'), '客户·商城', 'MallOrdersPage/MallOrderDetailPage 状态胶囊（自提 paid 态）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.statusWaitPickup' AND `active` = 1);
