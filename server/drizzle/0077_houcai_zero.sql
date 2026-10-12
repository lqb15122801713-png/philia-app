-- 候裁清零批（CJ-1012-01 老板裁死）：membership_cancel_requests 新表（线上退会+审批闸）+ 新 copy 键种子
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS + INSERT NOT EXISTS 守卫；计数断言见头注尾。
-- 新表=退会申请单（折算快照锁定+审批闸+兑付回挂）；键种子值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）；INSERT 计数断言==27（键种子，表另计 3 句）。
CREATE TABLE IF NOT EXISTS `membership_cancel_requests` (
  `id` text PRIMARY KEY,
  `store_id` text NOT NULL REFERENCES `stores`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `membership_id` text NOT NULL REFERENCES `memberships`(`id`),
  `pay_order_id` text NOT NULL REFERENCES `pay_orders`(`id`),
  `pay_no` text NOT NULL,
  `plan_key` text NOT NULL,
  `paid_fen` integer NOT NULL,
  `refund_fen` integer NOT NULL,
  `months_remaining` integer NOT NULL,
  `reason` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `reviewer_id` text REFERENCES `users`(`id`),
  `review_note` text,
  `reviewed_at` integer,
  `refund_id` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_membership_cancel_requests_store_status` ON `membership_cancel_requests` (`store_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_membership_cancel_requests_user` ON `membership_cancel_requests` (`user_id`);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineTitle', 'member', json_object('text', '线上退会申请'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineBody', 'member', json_object('text', '你是线上支付开通的会员，可以直接线上退：提交申请 → 门店审批 → 批准后按原路退回。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineCalc', 'member', json_object('text', '按剩余整月折算退回 ¥{amount}（剩余 {months} 整月 × 月均价）'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineCalc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineReasonPh', 'member', json_object('text', '退会原因（必填，门店审批时可见）'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineReasonPh' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineSubmit', 'member', json_object('text', '提交退会申请'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineSubmit' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineSubmitting', 'member', json_object('text', '提交中…'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineSubmitting' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineConfirm', 'member', json_object('text', '确认提交退会申请？提交后门店审批，批准后按原路退回。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineConfirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineDoneSubmit', 'member', json_object('text', '退会申请已提交，门店审批中'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineDoneSubmit' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlinePendingBody', 'member', json_object('text', '批准后退款按原路退回；驳回会写明理由。审批结果会通知你。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlinePendingBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineApproved', 'member', json_object('text', '退会已批准，退款按原路退回'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineApproved' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineRejected', 'member', json_object('text', '退会申请被驳回'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineRejected' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineRebateNote', 'member', json_object('text', '退会后回馈金余额清零、档位终止，全程留痕。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineRebateNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'a3.quitOnlineFail', 'member', json_object('text', '提交失败，请稍后再试'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'a3.quitOnlineFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitTitle', 'merchant:ops', json_object('text', '会员退会审批'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitAside', 'merchant:ops', json_object('text', '线上退会申请 · 批准=会员终止+回馈金清零+通道退款原路联动'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitAside' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitEmpty', 'merchant:ops', json_object('text', '当前没有待审批的退会申请'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitEmpty' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitLoadFail', 'merchant:ops', json_object('text', '退会审批队列加载失败'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitLoadFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitApproveCta', 'merchant:ops', json_object('text', '批准退会'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitApproveCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitRejectCta', 'merchant:ops', json_object('text', '驳回'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitRejectCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitApproveConfirm', 'merchant:ops', json_object('text', '确认批准退会？批准后=会员终止+回馈金清零+退款按原路退回（通道联动执行）。'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitApproveConfirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitRejectNotePh', 'merchant:ops', json_object('text', '驳回理由（必填，客户可见）'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitRejectNotePh' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitDone', 'merchant:ops', json_object('text', '退会申请已处理'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitDone' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitFail', 'merchant:ops', json_object('text', '处理失败，请稍后再试'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitLine', 'merchant:ops', json_object('text', '{nick} · {planKey} · 拟退 ¥{amount}（剩余 {months} 整月）'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitReasonLabel', 'merchant:ops', json_object('text', '退会原因'), '商家·运营', 'OpsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitReasonLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'ops.quitRefundNo', 'merchant:ops', json_object('text', '退款单号'), NULL, '未在页面调用点命中（merchant:ops 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'ops.quitRefundNo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.canvasSheetsHideNote', 'merchant:consoleAdmin', json_object('text', '慎隐：藏了=改单直接提交无确认弹层'), '商家·开发者管理端', 'CanvasPortBody 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.canvasSheetsHideNote' AND `active` = 1);
