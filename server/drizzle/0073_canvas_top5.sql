-- 画布全屏批 片 2（高频五屏入册+抽键小批 · 任务书冻结版 V1.0）：block_registry 五屏 34 块种子 + copy_overrides 新键 63 枚种子
-- 五屏=me(我的 6 块)/mall(商城首页 7 块)/bookingGrooming(预约洗护 8 块)/bookingBoarding(预约寄养 7 块)/memberOpen(开通会员 6 块)
-- 幂等：全部 INSERT 带 NOT EXISTS 守卫（多句 INSERT=脚本生成+INSERT 计数断言==97[34 块+63 键]）。
-- copyKeys=各屏施工回报「各块实查 copy 键」照抄（CK 锚挂不上的组件内键如实列入，画布可改字、预览即变以 CK 锚件为限）。
-- 63 键=本批抽键 40 枚 + 支付批漏件补种 23 枚（支付批片 1-3 合 main 时键入码未入迁移，种子生成器重跑 diff 扫出：
--   cadm 通道端口 2/rec 记录透出 3/renew 续费线上化 16/state 支付状态 2；值=生成件单源逐字，候裁明面件随回执报备）。
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.apphead', 'me', '我的·页头', '{"toggleable":true,"copyKeys":["me.appTitle","me.appNo"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.apphead');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.hero', 'me', '我的·身份大卡', '{"toggleable":true,"copyKeys":["me.rebateLabel","me.renewCountdown","me.openUnlock","me.qrTitle","me.qrSub","me.cardOpenCta","me.cardRenewCta","saved.slotTitle","saved.meSlotNote","me.freeValidityValue","me.freeValidityNote"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.hero');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.notify', 'me', '我的·消息通知行', '{"toggleable":true,"copyKeys":["ntf.title"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.notify');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.entries', 'me', '我的·资料与记录入口', '{"toggleable":true,"copyKeys":["profile.meEntry","profile.meEntrySub","rec.meEntry","rec.meEntrySub"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.entries');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.orderrow', 'me', '我的·订单五格', '{"toggleable":true,"copyKeys":["me.orderConfirmed","me.orderServing","me.orderHistory","me.orderRefund","me.orderAll","me.slotSoon"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.orderrow');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'me.grid', 'me', '我的·功能网格', '{"toggleable":true,"copyKeys":["me.gridPets","me.gridPetsGo","me.gridPetsCount","me.gridRebate","me.gridBoarding","me.gridBoardingSub","me.gridCoupons","me.gridCouponsSub","me.gridSettings","me.gridSettingsSub","album.meEntryTitle","album.meEntrySub","ticket.meEntryTitle","ticket.meEntrySub","addr.title"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'me.grid');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.head', 'mall', '商城·头部大题', '{"toggleable":true,"copyKeys":["mall.headTitle","mall.headSub"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.deliverySlot', 'mall', '商城·配送条槽位', '{"toggleable":true,"copyKeys":["mall.deliveryTitle","mall.deliverySub"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.deliverySlot');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.entries', 'mall', '商城·右上入口钮组', '{"toggleable":true,"copyKeys":["fav.mallEntry"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.entries');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.search', 'mall', '商城·搜索框', '{"toggleable":true,"copyKeys":["mall.searchPlaceholder"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.search');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.categories', 'mall', '商城·分类签', '{"toggleable":true,"copyKeys":[]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.categories');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.productGrid', 'mall', '商城·商品瀑布卡流', '{"toggleable":true,"copyKeys":["mall.loadFail","mall.reload","mall.emptyTitle","mall.emptyBodyKeyword","mall.emptyBodyCategory","mall.emptyClearSearch","mall.rebateLine","mall.soldOut","mall.rebateHook"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.productGrid');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mall.feedTail', 'mall', '商城·空态与尾行', '{"toggleable":true,"copyKeys":["mall.loadingMore","mall.pullMore","mall.endLine"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mall.feedTail');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.header', 'bookingGrooming', '预约洗护·顶部返回条', '{"toggleable":true,"copyKeys":["booking.groomingTitle","booking.toBoarding"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.petCard', 'bookingGrooming', '预约洗护·宠物卡', '{"toggleable":true,"copyKeys":["booking.petPickHintGrooming","booking.noPetTitle","booking.noPetBodyWizard","booking.noPetCta","booking.noPetSkip","booking.choosePet","booking.groomingLastLine"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.petCard');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.serviceChips', 'bookingGrooming', '预约洗护·选择服务', '{"toggleable":true,"copyKeys":["booking.groomingServiceTitle","booking.noGroomingSingle"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.serviceChips');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.storeLine', 'bookingGrooming', '预约洗护·门店单行', '{"toggleable":true,"copyKeys":["booking.groomingStoreTitle","booking.chooseStore","booking.storeCountNote"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.storeLine');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.staffRail', 'bookingGrooming', '预约洗护·洗护师横卡', '{"toggleable":true,"copyKeys":["booking.groomingStaffTitle","booking.staffNote"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.staffRail');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.dateTime', 'bookingGrooming', '预约洗护·日期与时段', '{"toggleable":true,"copyKeys":["booking.groomingDateTitle","booking.advanceNote","booking.fullSlotFallback","booking.groomingSlotSummaryTitle","booking.groomingSlotSummaryDuration"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.dateTime');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.extras', 'bookingGrooming', '预约洗护·折叠区', '{"toggleable":true,"copyKeys":["booking.addonTitle","booking.addonSummaryNone","booking.addonSummary","booking.addonPriceNote"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.extras');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingGrooming.confirmBar', 'bookingGrooming', '预约洗护·吸底确认条', '{"toggleable":true,"copyKeys":["booking.needPet","booking.choosePet","booking.chooseStore","booking.chooseService","booking.chooseTime"]}', 8, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingGrooming.confirmBar');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.header', 'bookingBoarding', '预约寄养·顶部返回条', '{"toggleable":true,"copyKeys":["booking.boardingTitle","booking.toGrooming"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.petCard', 'bookingBoarding', '预约寄养·宠物卡', '{"toggleable":true,"copyKeys":["booking.petPickHintBoarding","bk.multiPetSlot","booking.noPetTitle","booking.noPetBodyWizard","booking.noPetCta","booking.noPetSkip","booking.choosePet"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.petCard');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.dates', 'bookingBoarding', '预约寄养·入住退房日期格', '{"toggleable":true,"copyKeys":["booking.boardingDatesTitle"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.dates');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.roomType', 'bookingBoarding', '预约寄养·寄养房型区', '{"toggleable":true,"copyKeys":["booking.boardingRoomTitle","booking.fullSlotFallback","booking.roomLoadFail","booking.roomEmpty"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.roomType');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.storeLine', 'bookingBoarding', '预约寄养·门店单行', '{"toggleable":true,"copyKeys":["booking.boardingStoreTitle","booking.chooseStore","booking.storeCountNote"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.storeLine');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.extras', 'bookingBoarding', '预约寄养·折叠区', '{"toggleable":true,"copyKeys":["booking.emergencyTitle","booking.ecNamePh","booking.ecPhonePh","booking.ecRelationPh","booking.ecPhoneInvalid","booking.ecIncomplete","booking.walkTimesLabel","booking.walkTimesPh","booking.needMedicalAuth","booking.needBoardingConsent"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.extras');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bookingBoarding.confirmBar', 'bookingBoarding', '预约寄养·吸底确认条', '{"toggleable":true,"copyKeys":["booking.needPet","booking.choosePet","booking.chooseCheckin","booking.chooseCheckout","booking.noRoom","booking.chooseRoom","booking.chooseStore","booking.ecIncomplete","booking.ecPhoneInvalid","booking.needMedicalAuth","booking.needBoardingConsent"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bookingBoarding.confirmBar');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.tip', 'memberOpen', '开通·已是会员提示条', '{"toggleable":true,"copyKeys":["j1.alreadyMemberFree","j1.alreadyMember","j1.upgradeEntry"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.tip');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.deck', 'memberOpen', '开通·选档卡池', '{"toggleable":true,"copyKeys":["j1.guideNote","card.freePrice","card.priceYear","card.claimWeiguang","card.claimYinghuo","card.claimZhuguang","card.claimNuanyang"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.deck');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.ledger', 'memberOpen', '开通·三格账', '{"toggleable":true,"copyKeys":["j1.ledgerDaily","j1.ledgerYearly","j1.ledgerPets","j1.estimateNote","j1.compareLink","j1.petsIncluded","j1.petsUnlimited"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.ledger');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.perksWall', 'memberOpen', '开通·权益墙', '{"toggleable":true,"copyKeys":["a3.perksTitle","j1.perksFollow"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.perksWall');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.rules', 'memberOpen', '开通·规则明面', '{"toggleable":true,"copyKeys":["rules.title","rules.r1","rules.r1Free","rules.r2","rules.r3","rules.r3Free","rules.r4","rules.r5","rules.r6","rules.r7","rules.r8"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.rules');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mo.cta', 'memberOpen', '开通·吸底 CTA', '{"toggleable":true,"copyKeys":["j1.ctaAlreadyMember","j1.ctaSub","j1.ctaCurrentFree","j1.ctaOpenFree","j1.ctaOpen","j1.storeBypass"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mo.cta');
--> statement-breakpoint
-- 抽键小批种子（40 枚新键；screen=屏名/position=区块位，照 0072 工艺）：
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.appTitle', 'member', json_object('text', '我的'), '客户·我的', '我的·页头（me.apphead 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.appTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.appNo', 'member', json_object('text', 'MY PHILIA'), '客户·我的', '我的·页头（me.apphead 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.appNo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.rebateLabel', 'member', json_object('text', '回馈金'), '客户·我的', '我的·身份大卡（me.hero 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.rebateLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.renewCountdown', 'member', json_object('text', '续费倒计时'), '客户·我的', '我的·身份大卡（me.hero 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.renewCountdown' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.openUnlock', 'member', json_object('text', '开通会员解锁'), '客户·我的', '我的·身份大卡（me.hero 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.openUnlock' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.qrTitle', 'member', json_object('text', '出示会员码'), '客户·我的', '我的·身份大卡（me.hero 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.qrTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.qrSub', 'member', json_object('text', '到店即扫'), '客户·我的', '我的·身份大卡（me.hero 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.qrSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.orderConfirmed', 'member', json_object('text', '待到店'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.orderConfirmed' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.orderServing', 'member', json_object('text', '服务中'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.orderServing' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.orderHistory', 'member', json_object('text', '待评价'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.orderHistory' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.orderRefund', 'member', json_object('text', '退款售后'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.orderRefund' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.orderAll', 'member', json_object('text', '全部订单'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.orderAll' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.slotSoon', 'member', json_object('text', '即将点亮'), '客户·我的', '我的·订单五格（me.orderrow 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.slotSoon' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridPets', 'member', json_object('text', '宠物档案'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridPets' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridPetsGo', 'member', json_object('text', '去建档'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridPetsGo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridPetsCount', 'member', json_object('text', '{n} 只'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridPetsCount' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridRebate', 'member', json_object('text', '回馈金账本'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridRebate' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridBoarding', 'member', json_object('text', '寄养预约'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridBoarding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridBoardingSub', 'member', json_object('text', '按晚'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridBoardingSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridCoupons', 'member', json_object('text', '优惠券'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridCoupons' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridCouponsSub', 'member', json_object('text', '领券 · 心愿单'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridCouponsSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridSettings', 'member', json_object('text', '设置'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridSettings' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'me.gridSettingsSub', 'member', json_object('text', '账号 · 安全'), '客户·我的', '我的·功能网格（me.grid 区块）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'me.gridSettingsSub' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.reload', 'mall', json_object('text', '重新加载'), '客户·商城', '商城·商品瀑布卡流（加载失败重试钮）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.reload' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.loadingMore', 'mall', json_object('text', '正在加载更多…'), '客户·商城', '商城·空态与尾行（上拉加载中行）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.loadingMore' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.quickAddToast', 'mall', json_object('text', '已加入购物车'), '客户·商城', '商城·商品瀑布卡流（快加购提示条）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.quickAddToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.replacedToast', 'mall', json_object('text', '已清空原购物车并加入本商品'), '客户·商城', '商城·跨店确认后提示条', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.replacedToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.storeFallback', 'mall', json_object('text', '菲丽亚门店'), '客户·商城', '商城·店名兜底', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.storeFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.otherStore', 'mall', json_object('text', '其他门店'), '客户·商城', '商城·跨店确认弹层店名兜底', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.otherStore' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingServiceTitle', 'booking', json_object('text', '选择服务'), '客户·预约洗护', '预约洗护·选择服务（serviceChips 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingServiceTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingStoreTitle', 'booking', json_object('text', '门店'), '客户·预约洗护', '预约洗护·门店单行（storeLine 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingStoreTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingStaffTitle', 'booking', json_object('text', '洗护师'), '客户·预约洗护', '预约洗护·洗护师横卡（staffRail 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingStaffTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingDateTitle', 'booking', json_object('text', '选择日期'), '客户·预约洗护', '预约洗护·日期与时段（dateTime 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingDateTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingSlotSummaryTitle', 'booking', json_object('text', '已选时间'), '客户·预约洗护', '预约洗护·时间摘要卡主行前缀', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingSlotSummaryTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingSlotSummaryDuration', 'booking', json_object('text', '约 {min} 分钟'), '客户·预约洗护', '预约洗护·时间摘要卡副行', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingSlotSummaryDuration' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.groomingLastLine', 'booking', json_object('text', '上次洗护 {date} · {service}'), '客户·预约洗护', '预约洗护·宠物卡上次洗护摘要行', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.groomingLastLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.boardingDatesTitle', 'booking', json_object('text', '入住 / 退房日期'), '客户·预约寄养', '预约寄养·入住退房日期格（dates 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.boardingDatesTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.boardingRoomTitle', 'booking', json_object('text', '寄养房型'), '客户·预约寄养', '预约寄养·寄养房型区（roomType 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.boardingRoomTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'booking.boardingStoreTitle', 'booking', json_object('text', '门店'), '客户·预约寄养', '预约寄养·门店单行（storeLine 区块题）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'booking.boardingStoreTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'j1.openFail', 'member', json_object('text', '开通失败，请稍后再试'), '客户·开通会员', '开通·吸底 CTA（开通失败提示条）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'j1.openFail' AND `active` = 1);
--> statement-breakpoint
-- 支付批漏件补种 23 枚（生成件单源值逐字；本批顺带补种，候裁明面件）：
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portPayChannel', 'merchant:consoleAdmin', json_object('text', '支付通道'), '商家·开发者管理端', 'ConsolePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portPayChannel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portPayChannelNote', 'merchant:consoleAdmin', json_object('text', '高危件 · 口令复核'), '商家·开发者管理端', 'ConsolePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portPayChannelNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rec.onlinePaidLine', 'records', json_object('text', '线上支付 {payNo} · {demo}{status}'), '客户·消费记录', 'RecordsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rec.onlinePaidLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rec.payChannelMock', 'records', json_object('text', '演示'), '客户·消费记录', 'RecordsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rec.payChannelMock' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rec.payNoLine', 'records', json_object('text', '支付单 {payNo}'), '客户·消费记录', 'RecordsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rec.payNoLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.amountLabel', 'pay', json_object('text', '续费金额'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.amountLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.channelOff', 'pay', json_object('text', '线上支付通道维护中，请到店办理续费。'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.channelOff' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.createFail', 'pay', json_object('text', '续费下单失败'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.createFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.ctaPay', 'pay', json_object('text', '去支付 ¥{amount}'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.ctaPay' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.currentPlan', 'pay', json_object('text', '当前档'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.currentPlan' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.freePlanBody', 'pay', json_object('text', '当前档免费，续期自动顺延，无须线上支付。'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.freePlanBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.freePlanTitle', 'pay', json_object('text', '免费档续期无须缴费'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.freePlanTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.headNo', 'pay', json_object('text', 'RENEW'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.headNo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.noMemberBody', 'pay', json_object('text', '开通会员后才可续费；去选档开通 ›'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.noMemberBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.noMemberTitle', 'pay', json_object('text', '还没有会员档案'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.noMemberTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.noteLine', 'pay', json_object('text', '成交后到期日顺延 {days} 天；如已冻结，回馈金即时解冻可用。'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.noteLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.petLine', 'pay', json_object('text', '含宠物 {n} 只'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.petLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.pushLabel', 'pay', json_object('text', '会员中心'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.pushLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.scheduledChange', 'pay', json_object('text', '本次续费将按预约档「{planLabel}」执行（到期换档生效）。'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.scheduledChange' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.title', 'pay', json_object('text', '续费'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'renew.toExpiry', 'pay', json_object('text', '顺延至'), '客户·线上续费确认页', 'MemberRenewPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'renew.toExpiry' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'state.paidBodyRenew', 'pay', json_object('text', '{planLabel} · 有效期已顺延，冻结的回馈金已解冻可用。'), '客户·支付状态', 'PayStatePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'state.paidBodyRenew' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'state.paidTitleRenew', 'pay', json_object('text', '续费成功'), '客户·支付状态', 'PayStatePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'state.paidTitleRenew' AND `active` = 1);
