-- 画布全屏批 片 3（剩余 38 屏扫尾入册+随屏抽键 · 任务书冻结版 V1.0 末片）：block_registry 38 屏 164 块种子 + copy_overrides 新键种子
-- 幂等：全部 INSERT 带 NOT EXISTS 守卫（多句 INSERT=脚本生成+计数断言见文件尾注释）。
-- 幂等：全部 INSERT 带 NOT EXISTS 守卫（多句 INSERT=脚本生成+INSERT 计数断言==343（块 164+键 179）；生成器未归屏新键=0）。
-- 键种子=台账新规「键入码必随迁移」：本片新键全量入迁移；screen/position/label=种子生成件 copySeedRows.ts 单源逐字（生成器先重跑）。
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.gallery', 'pdp', '商品详情·大图轮', '{"toggleable":true,"copyKeys":["fav.pdpAdd","fav.pdpAdded","fav.addToast","fav.removeToast","fav.toggleFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.gallery');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.info', 'pdp', '商品详情·名称价格库存与溯源行', '{"toggleable":true,"copyKeys":["mall.soldOut","mall.pdpStockLeft","mall.pdpStoreLine","mall.storeFallback"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.info');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.rebateCard', 'pdp', '商品详情·回馈金卡', '{"toggleable":true,"copyKeys":["mall.rebateEarnCard","mall.rebateEarnCardNoDay","mall.rebateHook"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.rebateCard');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.detail', 'pdp', '商品详情·详情区', '{"toggleable":true,"copyKeys":["mall.pdpDetailTitle"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.detail');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.reviews', 'pdp', '商品详情·评价区与写评价弹层', '{"toggleable":true,"copyKeys":["rev.title","rev.summary","rev.empty","rev.loadFail","rev.more","rev.writeCta","rev.needReceived","rev.sheetTitle","rev.ratingLabel","rev.textPlaceholder","rev.photoAdd","rev.photoLimit","rev.anonymous","rev.submit","rev.submitting","rev.toastOk","rev.submitFail","rev.photoUploadFail"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.reviews');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pdp.ctaBar', 'pdp', '商品详情·吸底购买栏', '{"toggleable":true,"copyKeys":["mall.pdpAddCart","mall.pdpBuyNow","mall.soldOut","mall.quickAddToast","mall.conflictTitle","mall.conflictBody","mall.conflictOk","mall.otherStore","mall.replacedToast"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pdp.ctaBar');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cart.head', 'cart', '购物袋·页头', '{"toggleable":true,"copyKeys":["mall.cartTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cart.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cart.empty', 'cart', '购物袋·空态', '{"toggleable":true,"copyKeys":["mall.cartEmptyTitle","mall.cartEmptyBody","mall.cartEmptyCta"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cart.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cart.storeNote', 'cart', '购物袋·单店提示条', '{"toggleable":true,"copyKeys":["mall.cartStoreNote"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cart.storeNote');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cart.rows', 'cart', '购物袋·商品行组', '{"toggleable":true,"copyKeys":["mall.cartStockNote"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cart.rows');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cart.ctaBar', 'cart', '购物袋·吸底结算栏', '{"toggleable":true,"copyKeys":["mall.cartCheckout","mall.rebateEarnCta","mall.rebateHook","mall.cartCheckAll","mall.cartTotalLabel","mall.cartNeedCheck"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cart.ctaBar');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mallOrders.head', 'mallOrders', '商品订单·页头', '{"toggleable":true,"copyKeys":["mall.ordersTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mallOrders.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mallOrders.tabs', 'mallOrders', '商品订单·状态签', '{"toggleable":true,"copyKeys":["mall.tabAll","mall.tabPending","mall.tabPaid","mall.tabShipped","mall.tabReceived","mall.tabAftersale","mall.ordersTabEmpty"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mallOrders.tabs');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mallOrders.cardList', 'mallOrders', '商品订单·订单卡流', '{"toggleable":true,"copyKeys":["mall.storeFallback","mall.deliveryExpress","mall.deliverySameCity","mall.deliveryPickup","mall.tabPending","mall.tabPaid","mall.tabShipped","mall.tabReceived","mall.statusCancelled","mall.statusRefunding","mall.orderSumLine","mall.orderPreparing","mall.trackingLabel","mall.trackingNote","mall.orderReceived","mall.cancelCta","mall.goPay","mall.confirmReceive","mall.reorder","refund.entryCta","refund.progressCta","refund.viewProgressCta","refund.maintainNotice","inv.applyEntry","inv.progressEntry","rev.orderEntry","mall.reorderToast","mall.toastPaid","mall.toastShipped"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mallOrders.cardList');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mallOrders.empty', 'mallOrders', '商品订单·空态', '{"toggleable":true,"copyKeys":["mall.orders.emptyTitle","mall.orders.emptyBody","mall.orders.emptyCta"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mallOrders.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mallOrders.sheets', 'mallOrders', '商品订单·二次确认弹层', '{"toggleable":true,"copyKeys":["mall.receiveConfirmTitle","mall.receiveConfirmBody","mall.confirmReceive","mall.cancelConfirmTitle","mall.cancelConfirmBody","mall.cancelConfirmCta","mall.receiveOk","mall.receiveFail","mall.cancelOk","mall.cancelFail"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mallOrders.sheets');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'refunds.head', 'refunds', '退款售后·页头', '{"toggleable":true,"copyKeys":["refund.listTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'refunds.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'refunds.list', 'refunds', '退款售后·申请卡流', '{"toggleable":true,"copyKeys":["refund.typeRefundOnly","refund.typeReturnRefund","refund.status.submitted","refund.status.processing","refund.status.refunding","refund.status.settled","refund.status.rejected","refund.status.cancelled","refund.loadFail","mall.storeFallback"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'refunds.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'refunds.empty', 'refunds', '退款售后·空态', '{"toggleable":true,"copyKeys":["refund.emptyTitle","refund.emptyBody","refund.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'refunds.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appointments.header', 'appointments', '我的预约·页头返回条', '{"toggleable":true,"copyKeys":["appointments.title"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appointments.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appointments.tabs', 'appointments', '我的预约·状态筛选条', '{"toggleable":true,"copyKeys":["appointments.tabPending","appointments.tabConfirmed","appointments.tabServing","appointments.tabHistory","appointments.tabCancelled","o1.refundTab","slot.soon"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appointments.tabs');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appointments.list', 'appointments', '我的预约·预约卡列表', '{"toggleable":true,"copyKeys":["appointments.tabEmpty","appointments.cardServingBadge","appointments.cardStoreFallback","appointments.cardPetFallback"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appointments.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appointments.empty', 'appointments', '我的预约·空态', '{"toggleable":true,"copyKeys":["appointments.emptyTitle","appointments.emptyBody","appointments.emptyCta"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appointments.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appointments.error', 'appointments', '我的预约·加载失败态', '{"toggleable":true,"copyKeys":["appointments.loadFail"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appointments.error');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.header', 'apptDetail', '预约详情·页头返回条', '{"toggleable":true,"copyKeys":["appointments.detailTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.liveEntry', 'apptDetail', '预约详情·服务中入口条', '{"toggleable":true,"copyKeys":["appointments.liveBoarding","appointments.liveGrooming","appointments.liveSub"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.liveEntry');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.code', 'apptDetail', '预约详情·核销码卡', '{"toggleable":true,"copyKeys":["appointments.codeTitle"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.code');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.info', 'apptDetail', '预约详情·预约信息卡', '{"toggleable":true,"copyKeys":["appointments.cancelReviewing","appointments.rejectedPrefix","appointments.infoTitle","appointments.dtType","appointments.dtService","appointments.dtRoomType","appointments.dtPet","appointments.dtTime","appointments.dtAmount","appointments.dtPaymentMode","appointments.dtPaid","appointments.paidSuffix","appointments.prepaidLabel","appointments.prepaidPending","appointments.prepaidRegistered","appointments.prepaidDeducted","appointments.prepaidRefunded","appointments.dtCheckedIn","appointments.dtCompletedAt","appointments.dtNote","appointments.emergencyContact","appointments.medicalAuthLabel","appointments.medicalAuthSigned","appointments.dtWalkTimes","appointments.walkTimes","appointments.dtId","appointments.addonsTitle","inv.applyEntry","inv.progressEntry","appointments.checkedInRoom"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.info');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.rescheduleHistory', 'apptDetail', '预约详情·改约历史', '{"toggleable":true,"copyKeys":["appointments.rescheduleHistory","appointments.rescheduleRoleCustomer","appointments.rescheduleRoleMerchant"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.rescheduleHistory');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.detailSheet', 'apptDetail', '预约详情·服务明细与耗材', '{"toggleable":true,"copyKeys":["appointments.detailSheetTitle","appointments.stepDone","appointments.stepDoing","appointments.stepPending","appointments.stepDuration","appointments.materialsTitle","appointments.materialsEmpty","appointments.materialQty"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.detailSheet');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.album', 'apptDetail', '预约详情·服务相册', '{"toggleable":true,"copyKeys":["appointments.albumTitle","appointments.albumSub","appointments.albumPhotoCount","appointments.albumNoPhoto","appointments.albumBeforeTag","appointments.albumAfterTag"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.album');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.store', 'apptDetail', '预约详情·门店与导航', '{"toggleable":true,"copyKeys":["appointments.storeTitle","appointments.navAmap","appointments.navTencent","appointments.callStore"]}', 8, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.store');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptDetail.actions', 'apptDetail', '预约详情·操作区', '{"toggleable":true,"copyKeys":["appointments.rebook","cert.detailEntry","report.detailEntry","appointments.rescheduleTitleBoarding","appointments.rescheduleTitleGrooming","appointments.rescheduleNote","appointments.fallbackService","appointments.fallbackPet","appointments.slotsLoading","appointments.slotsLoadFail","appointments.thinkMore","appointments.rescheduleSubmit","appointments.submitting","appointments.rescheduleCta","appointments.cancelAskFree","appointments.cancelAskLate","appointments.cancelRuleFree","appointments.cancelRuleLate","appointments.cancelFeeTitle","appointments.cancelFeeNote","appointments.cancelReasonTitle","appointments.cancelChipSchedule","appointments.cancelChipTime","appointments.cancelChipPrice","appointments.cancelChipOther","appointments.cancelNotePh","appointments.cancelCtaFree","appointments.cancelCtaLate","appointments.cancelSubmitFree","appointments.cancelSubmitLate","refund.maintainNotice","refund.entryHint","refund.progressCta","refund.entryCta","appointments.servingTitle","appointments.servingCall","appointments.servingNote","appointments.toastCancelled","appointments.toastCancelRequested","appointments.cancelFailFallback","appointments.reviewThanks","appointments.reviewFail","appointments.rescheduleToast","appointments.rescheduleFail","appointments.rescheduleNeedDates","appointments.shareTitle","appointments.shareText","appointments.shareCopied","appointments.shareCopyFail","appointments.createdLine"]}', 9, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptDetail.actions');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.header', 'apptLive', '洗护全程·返回条与宠物摘要卡', '{"toggleable":true,"copyKeys":["appointments.liveTitleGrooming","appointments.liveTitleBoarding","appointments.livePetFallback","appointments.liveServiceGrooming","appointments.liveServiceBoarding","appointments.liveMetaStaff","appointments.liveMetaEta","appointments.liveMetaBoarding"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.incident', 'apptLive', '洗护全程·异常通报条', '{"toggleable":true,"copyKeys":["appointments.incidentTitle","appointments.incidentTypeInjury","appointments.incidentTypeStress","appointments.incidentTypeVetVisit","appointments.incidentHandling","appointments.incidentOccurredAt","appointments.incidentHandledLine","appointments.incidentToastReported","appointments.incidentToastHandled"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.incident');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.stepper', 'apptLive', '洗护全程·六步进度流', '{"toggleable":true,"copyKeys":["appointments.liveStepsLoading","appointments.hintDisinfection","appointments.hintPrecheck","appointments.hintGrooming","appointments.hintDetail","appointments.hintBeforeAfter","appointments.hintConfirm","live.stepActive","live.stepPending","appointments.liveToastReopen"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.stepper');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.boardingStay', 'apptLive', '洗护全程·寄养安心卡与每日打卡', '{"toggleable":true,"copyKeys":["appointments.assuranceTitle","appointments.assuranceRoom","appointments.roomPending","appointments.assuranceWeight","appointments.assuranceBelongings","appointments.assuranceLatestLog","appointments.assuranceLogDone","appointments.assuranceNoLog","appointments.assuranceUnsealTitle","appointments.assuranceUnsealEmpty","appointments.assuranceEmpty","appointments.assuranceEmptyBody","appointments.liveToastCheckin","appointments.unsealToast"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.boardingStay');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.review', 'apptLive', '洗护全程·完成态评价区', '{"toggleable":true,"copyKeys":["appointments.liveReviewThanks","appointments.liveReviewFail","appointments.shareTitle","appointments.liveShareText","appointments.liveShareStoreFallback","appointments.fallbackService","appointments.shareCopied","appointments.shareCopyFail"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.review');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'apptLive.contact', 'apptLive', '洗护全程·联系门店条', '{"toggleable":true,"copyKeys":[]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'apptLive.contact');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certList.header', 'certList', '安心证书·页头返回条', '{"toggleable":true,"copyKeys":["cert.listTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certList.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certList.list', 'certList', '安心证书·证书行列表', '{"toggleable":true,"copyKeys":["album.photoAlt"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certList.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certList.empty', 'certList', '安心证书·空态', '{"toggleable":true,"copyKeys":["cert.emptyTitle","cert.emptyBody","cert.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certList.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certList.error', 'certList', '安心证书·失败态', '{"toggleable":true,"copyKeys":["cert.loadFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certList.error');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certDetail.header', 'certDetail', '证书详情·页头返回条', '{"toggleable":true,"copyKeys":["cert.cardTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certDetail.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certDetail.card', 'certDetail', '证书详情·证书卡', '{"toggleable":true,"copyKeys":["cert.brandMark","cert.stepPhotos","cert.traceLine"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certDetail.card');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'certDetail.error', 'certDetail', '证书详情·失败态', '{"toggleable":true,"copyKeys":["cert.loadFail","cert.backList"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'certDetail.error');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'report.header', 'report', '美容报告·页头返回条', '{"toggleable":true,"copyKeys":["report.title","report.loadFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'report.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'report.vitals', 'report', '美容报告·体征五项卡', '{"toggleable":true,"copyKeys":["report.vitalsTitle","report.vitalWeight","report.vitalSkin","report.vitalEar","report.vitalCoat","report.vitalNail","report.statusNormal","report.statusAttention","report.statusAbnormal","report.statusUnrecorded","report.notRecorded"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'report.vitals');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'report.advice', 'report', '美容报告·异常与建议', '{"toggleable":true,"copyKeys":["report.abnormalTitle","report.nextAdviceTitle"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'report.advice');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'report.promise', 'report', '美容报告·承诺与留痕', '{"toggleable":true,"copyKeys":["report.promiseLine","report.traceLine"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'report.promise');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketList.header', 'ticketList', '工单列表·页头返回条', '{"toggleable":true,"copyKeys":["ticket.listTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketList.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketList.list', 'ticketList', '工单列表·工单行', '{"toggleable":true,"copyKeys":["ticket.statusSubmitted","ticket.statusReplied","ticket.statusClosed","ticket.statusEscalated","ticket.typeSuggest","ticket.typeComplaint","ticket.typePraise","ticket.typeOther"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketList.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketList.empty', 'ticketList', '工单列表·空态', '{"toggleable":true,"copyKeys":["ticket.emptyTitle","ticket.emptyBody","ticket.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketList.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketList.error', 'ticketList', '工单列表·失败态', '{"toggleable":true,"copyKeys":["ticket.loadFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketList.error');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketNew.header', 'ticketNew', '联系小棉花·页头返回条', '{"toggleable":true,"copyKeys":["ticket.newTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketNew.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketNew.form', 'ticketNew', '联系小棉花·提单表单', '{"toggleable":true,"copyKeys":["ticket.typeLabel","ticket.typeSuggest","ticket.typeComplaint","ticket.typePraise","ticket.typeOther","ticket.storeLabel","ticket.storeRequired","ticket.descLabel","ticket.descPlaceholder","ticket.descRequired","ticket.photosLabel","ticket.photoAdd","ticket.photoRemove","ticket.contactLabel","ticket.contactPlaceholder","ticket.submit","ticket.submitting","ticket.submitFail"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketNew.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketNew.hours', 'ticketNew', '联系小棉花·客服时间公示卡', '{"toggleable":true,"copyKeys":["ticket.hoursTitle","ticket.hoursLine"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketNew.hours');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketDetail.header', 'ticketDetail', '工单详情·页头返回条', '{"toggleable":true,"copyKeys":["ticket.detailTitle","ticket.loadFail","ticket.backList"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketDetail.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketDetail.main', 'ticketDetail', '工单详情·工单主体卡', '{"toggleable":true,"copyKeys":["ticket.typeSuggest","ticket.typeComplaint","ticket.typePraise","ticket.typeOther","ticket.statusSubmitted","ticket.statusReplied","ticket.statusClosed","ticket.statusEscalated"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketDetail.main');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketDetail.reply', 'ticketDetail', '工单详情·门店回复区', '{"toggleable":true,"copyKeys":["ticket.replyTitle"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketDetail.reply');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketDetail.escalate', 'ticketDetail', '工单详情·店长介入区', '{"toggleable":true,"copyKeys":["ticket.escalatedBadge","ticket.escalateNoteTitle","ticket.escalatedAtLine","ticket.escalateTitle","ticket.escalateDesc","ticket.escalateNoteLabel","ticket.escalateNotePlaceholder","ticket.escalateCancel","ticket.escalateSubmit","ticket.submitting","ticket.escalateCta","ticket.escalateDone","ticket.escalateFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketDetail.escalate');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ticketDetail.timeline', 'ticketDetail', '工单详情·进度时间线', '{"toggleable":true,"copyKeys":["ticket.timelineTitle","ticket.timelineSubmitted","ticket.timelineReplied","ticket.timelineClosed","ticket.timelineEscalated"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ticketDetail.timeline');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'moments.header', 'moments', '服务相册·页头返回条', '{"toggleable":true,"copyKeys":["album.title"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'moments.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'moments.feed', 'moments', '服务相册·案例流双列网格', '{"toggleable":true,"copyKeys":["album.photoAlt","album.petFallback","album.serviceFallback","album.inProgressNote","album.shareCta","album.shareCopied","album.shareTitle","album.shareText"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'moments.feed');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'moments.empty', 'moments', '服务相册·空态', '{"toggleable":true,"copyKeys":["album.emptyTitle","album.emptyBody","album.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'moments.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'moments.error', 'moments', '服务相册·失败态', '{"toggleable":true,"copyKeys":["album.loadFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'moments.error');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.head', 'invoices', '我的发票·页头', '{"toggleable":true,"copyKeys":["inv.listTitle","inv.loadFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.list', 'invoices', '我的发票·发票申请列表', '{"toggleable":true,"copyKeys":["inv.statusSubmitted","inv.statusIssued","inv.kindAppointment","inv.kindOrder","inv.kindCashier"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.empty', 'invoices', '我的发票·空态', '{"toggleable":true,"copyKeys":["inv.emptyTitle","inv.emptyBody","inv.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.detailhead', 'invoiceDetail', '发票详情·页头', '{"toggleable":true,"copyKeys":["inv.detailTitle","inv.loadFail","inv.backList"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.detailhead');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.detail', 'invoiceDetail', '发票详情·申请信息回显卡', '{"toggleable":true,"copyKeys":["inv.kindAppointment","inv.kindOrder","inv.kindCashier","inv.statusSubmitted","inv.statusIssued","inv.billNo","inv.amountLabel","inv.titleTypeLabel","inv.titlePersonal","inv.titleBusiness","inv.titleLabel","inv.taxNoLabel","inv.deliveryLabel","inv.deliveryEmail","inv.deliveryPickup","inv.emailLabel"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.detail');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'inv.issued', 'invoiceDetail', '发票详情·已开具回显区', '{"toggleable":true,"copyKeys":["inv.issuedNoLabel","inv.issuedAtLine","inv.appliedAt"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'inv.issued');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mu.current', 'memberUpgrade', '升级会员·当前档卡', '{"toggleable":true,"copyKeys":["up.currentTitle","up.paidLine","up.expireLine","up.freeTierGuide","chg.priceFree"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mu.current');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mu.targets', 'memberUpgrade', '升级会员·目标档试算卡列', '{"toggleable":true,"copyKeys":["up.targetTitle","up.formulaLine","up.formulaPet","up.formulaTotal","up.newPurchaseTag","up.newPurchaseLine","up.payCta"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mu.targets');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mu.storeGuide', 'memberUpgrade', '升级会员·到店指引卡', '{"toggleable":true,"copyKeys":["up.storeGuideTitle","up.storeGuideBody"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mu.storeGuide');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mu.notes', 'memberUpgrade', '升级会员·办理说明', '{"toggleable":true,"copyKeys":["up.notesTitle","up.noteEffective","up.noteInflight","up.noteBalance","up.noteNoDowngrade"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mu.notes');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mu.empty', 'memberUpgrade', '升级会员·空态说明卡', '{"toggleable":true,"copyKeys":["up.emptyTitle","up.emptyTopTier","up.nonMemberTitle","up.nonMemberBody","up.nonMemberCta"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mu.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mch.windowTip', 'memberChange', '到期换档·窗口提示条', '{"toggleable":true,"copyKeys":["chg.windowOpen","chg.windowClosed","chg.expireLabel"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mch.windowTip');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mch.targets', 'memberChange', '到期换档·下期档选择列', '{"toggleable":true,"copyKeys":["chg.targetTitle","chg.priceYear","chg.priceFree","chg.submitCta","chg.submitting","chg.execNote"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mch.targets');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mch.scheduled', 'memberChange', '到期换档·预约单卡', '{"toggleable":true,"copyKeys":["chg.scheduledTitle","chg.scheduledLine","chg.scheduledAtLabel","chg.expireLabel","chg.execNote","chg.cancelCta","chg.cancelling"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mch.scheduled');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'mch.empty', 'memberChange', '到期换档·说明卡', '{"toggleable":true,"copyKeys":["chg.nonMemberTitle","chg.nonMemberCta","chg.freeNote","chg.freeCta"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'mch.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'w1.ring', 'rebate', '回馈金账本·结算环卡', '{"toggleable":true,"copyKeys":["w1.ringCenter","w1.balanceLabel","w1.balanceFrozen","w1.periodLine"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'w1.ring');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'w1.logs', 'rebate', '回馈金账本·明细列表', '{"toggleable":true,"copyKeys":["w1.logsTitle","w1.yearTotal","w1.typeGrant","w1.typeDeduct","w1.typeClawback","w1.typeFreeze","w1.typeClear","w1.fallbackTitle","w1.emptyTitle","w1.emptyDesc","w1.emptyCta"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'w1.logs');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'w1.rules', 'rebate', '回馈金账本·规则明面', '{"toggleable":true,"copyKeys":["rules.title","rules.r1","rules.r1Free","rules.r2","rules.r3","rules.r3Free","rules.r4","rules.r5","rules.r6","rules.r7","rules.r8"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'w1.rules');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'q1.cardFace', 'memberCard', '会员码·档色横卡', '{"toggleable":true,"copyKeys":["card.logo","card.freePrice","card.priceYear","q1.nonMemberPrice","q1.nonMemberClaim"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'q1.cardFace');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'q1.code', 'memberCard', '会员码·会员码区', '{"toggleable":true,"copyKeys":["q1.tokenTitle","q1.refreshNote","q1.verifyNote","q1.tokenFail","q1.tokenRetry","q1.nonMemberGuide"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'q1.code');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'q1.guide', 'memberCard', '会员码·非会员引导条', '{"toggleable":true,"copyKeys":["q1.nonMemberGuide","q1.nonMemberCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'q1.guide');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'q1.pass', 'memberCard', '会员码·次卡余额卡', '{"toggleable":true,"copyKeys":["q1.passTitle","q1.passUnit","q1.passRemain","q1.passStoreFallback","q1.passEmpty"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'q1.pass');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'q1.footer', 'memberCard', '会员码·品牌注脚', '{"toggleable":true,"copyKeys":["card.logo"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'q1.footer');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cpn.tabs', 'coupons', '优惠券·双签条', '{"toggleable":true,"copyKeys":["cpn.tabMine","fav.title"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cpn.tabs');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cpn.center', 'coupons', '优惠券·领用中心', '{"toggleable":true,"copyKeys":["cpn.centerTitle","cpn.claimCta","cpn.claimedCta","cpn.soldOutCta","cpn.threshold","cpn.thresholdNone","cpn.validDays","cpn.centerEmpty"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cpn.center');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cpn.mine', 'coupons', '优惠券·我的券', '{"toggleable":true,"copyKeys":["cpn.mineTitle","cpn.statusClaimed","cpn.statusUsed","cpn.statusExpired","cpn.statusVoided","cpn.claimedAt","cpn.usedAt","cpn.mineEmpty","cpn.useNote"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cpn.mine');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'cpn.stackRule', 'coupons', '优惠券·叠加规则公示卡', '{"toggleable":true,"copyKeys":["cpn.stackTitle"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'cpn.stackRule');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'fav.list', 'coupons', '优惠券·心愿单列', '{"toggleable":true,"copyKeys":["fav.loadFail","fav.emptyTitle","fav.emptyBody","fav.emptyCta","fav.removeToast","fav.toggleFail"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'fav.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'rec.deposit', 'records', '消费记录·押金进度区', '{"toggleable":true,"copyKeys":["rec.depositTitle","rec.depositNote","rec.depositEmpty","rec.depHeld","rec.depRefunding","rec.depRefunded","rec.depHeldAt","rec.depRefundReqAt","rec.depRefundedAt"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'rec.deposit');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'rec.list', 'records', '消费记录·记录列表', '{"toggleable":true,"copyKeys":["rec.title","rec.emptyTitle","rec.emptyBody","rec.emptyCta","rec.kindPay","rec.kindOrder","rec.kindInvoice","rec.payNoLine","rec.payChannelMock","rec.onlinePaidLine"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'rec.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntf.head', 'notifications', '消息中心·页头操作区', '{"toggleable":true,"copyKeys":["ntf.title","ntf.markAllRead","ntf.prefsTitle"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntf.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntf.chips', 'notifications', '消息中心·分类筛选条', '{"toggleable":true,"copyKeys":["ntf.allTab","ntf.unreadTab","ntf.catTrade","ntf.catService","ntf.catAccount","ntf.catMarketing"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntf.chips');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntf.list', 'notifications', '消息中心·消息列表', '{"toggleable":true,"copyKeys":["ntf.delete","ntf.deleteConfirm","ntf.loadMore","ntf.emptyTitle","ntf.emptyBody","ntf.emptyCta","ntf.catTrade","ntf.catService","ntf.catAccount","ntf.catMarketing"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntf.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntp.hint', 'notifyPrefs', '订阅管理·明示文案卡', '{"toggleable":true,"copyKeys":["ntf.prefsHint"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntp.hint');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntp.marketing', 'notifyPrefs', '订阅管理·营销开关卡', '{"toggleable":true,"copyKeys":["ntf.marketingLabel","ntf.marketingDesc","ntf.onToast","ntf.offToast"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntp.marketing');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'ntp.mandatory', 'notifyPrefs', '订阅管理·不可关组卡', '{"toggleable":true,"copyKeys":["ntf.mandatoryLabel","ntf.mandatoryNote","ntf.mandatoryDesc"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'ntp.mandatory');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.header', 'philia', '品牌空间·问候页头', '{"toggleable":true,"copyKeys":["f1.greetMorning","f1.greetNoon","f1.greetNight","f1.greetFallback","f1.welcome","f1.closeAria","f1.spaceAria"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.manifesto', 'philia', '品牌空间·宣言层', '{"toggleable":true,"copyKeys":["f1.eyebrow","f1.manifesto"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.manifesto');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.petrail', 'philia', '品牌空间·宠物形象位', '{"toggleable":true,"copyKeys":["f1.petLoadFail","f1.petEmptyTitle","f1.petEmptyDesc","f1.speciesDog","f1.speciesCat","f1.speciesOther"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.petrail');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.tristats', 'philia', '品牌空间·陪伴三数', '{"toggleable":true,"copyKeys":["f1.statDays","f1.statServices","f1.statPhotos"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.tristats');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.booking', 'philia', '品牌空间·一键预约卡', '{"toggleable":true,"copyKeys":[]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.booking');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.links', 'philia', '品牌空间·入口行组', '{"toggleable":true,"copyKeys":["f1.linkPets","f1.linkPetsDesc","f1.linkCard","f1.linkCardDesc","f1.linkMoments","f1.linkMomentsDesc","f1.passportTitle","f1.passportDesc","f1.passportBadge"]}', 6, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.links');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.growthslot', 'philia', '品牌空间·段位徽章槽', '{"toggleable":true,"copyKeys":["f1.growthTitle","f1.growthSlotDesc","slot.soon"]}', 7, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.growthslot');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.birthdayslot', 'philia', '品牌空间·生日特辑槽', '{"toggleable":true,"copyKeys":["f1.birthdayTitle","f1.birthdayDesc","slot.soon"]}', 8, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.birthdayslot');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'philia.diary', 'philia', '品牌空间·菲丽亚日记', '{"toggleable":true,"copyKeys":["f1.diaryTitle","f1.diaryLoadFail","f1.diaryEmptyTitle","f1.diaryEmptyDesc","f1.tipTag","f1.tip1Title","f1.tip1Desc","f1.tip2Title","f1.tip2Desc","f1.tip3Title","f1.tip3Desc"]}', 9, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'philia.diary');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pets.header', 'pets', '宠物档案·页头与多宠切换', '{"toggleable":true,"copyKeys":["pets.title","pets.switcherAll","pets.switcherTitle","pets.switcherSingleNote","pets.switcherFail"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pets.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pets.empty', 'pets', '宠物档案·空态引导', '{"toggleable":true,"copyKeys":["pets.emptyTitle","pets.emptyBody","pets.emptyCta"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pets.empty');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pets.card', 'pets', '宠物档案·宠物卡列表', '{"toggleable":true,"copyKeys":["pets.loadFail","pets.editEntry","pets.speciesDog","pets.speciesCat","pets.speciesOther","pets.neuteredLabel","pets.vaccineNone","pets.vaccineExpired","pets.vaccineSoon","pets.vaccineOk","pets.vaccineProofCount","pets.chipNoLabel","pets.coatColorLabel","pets.historyTitle","pets.historyCount","pets.historyServiceFallback","pets.rebook","pets.healthEntry","album.petsEntry","cert.entryTitle"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pets.card');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'pets.form', 'pets', '宠物档案·档案表单', '{"toggleable":true,"copyKeys":["pets.editTitle","pets.addCta","pets.avatarUpload","pets.avatarChange","pets.avatarNote","pets.avatarPreviewAlt","pets.nameLabel","pets.namePlaceholder","pets.speciesLabel","pets.breedLabel","pets.breedPlaceholder","pets.birthdayLabel","pets.weightLabel","pets.weightPlaceholder","pets.vaccineLabel","pets.chipNoPlaceholder","pets.coatColorPlaceholder","pets.vaccineProofTitle","pets.vaccineProofAdd","pets.vaccineProofNote","pets.proofRemove","pets.tagsLabel","pets.tagCustomPlaceholder","pets.tagLimitPlaceholder","pets.tagAdd","pets.formCancel","pets.formSaving","pets.formSubmit","pets.formSaveFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'pets.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'health.header', 'petHealth', '宠物健康·页头', '{"toggleable":true,"copyKeys":["health.title","health.loadFail"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'health.header');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'health.weight', 'petHealth', '宠物健康·体重趋势', '{"toggleable":true,"copyKeys":["health.weightTrend","health.weightUnit","health.weightEmptyTitle","health.weightEmptyBody"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'health.weight');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'health.weightform', 'petHealth', '宠物健康·记体重表单', '{"toggleable":true,"copyKeys":["health.weightAddTitle","health.weightDateLabel","health.weightKgLabel","health.weightKgPlaceholder","health.weightNoteLabel","health.weightSubmit","health.saving","health.saveFail"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'health.weightform');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'health.records', 'petHealth', '宠物健康·健康记录', '{"toggleable":true,"copyKeys":["health.recordsTitle","health.tabVaccine","health.tabDeworm","health.tabMedication","health.tabVetVisit","health.recordsTabEmpty","health.dueOk","health.dueSoon","health.dueExpired","health.recordDelete","health.recordDeleteConfirm","health.recordDeleted"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'health.records');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'health.recordform', 'petHealth', '宠物健康·记一笔表单', '{"toggleable":true,"copyKeys":["health.recordAddTitle","health.recordTypeLabel","health.recordTitleLabel","health.recordTitlePlaceholder","health.recordDateLabel","health.recordNextDueLabel","health.recordNoteLabel","health.recordNotePlaceholder","health.recordSubmit"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'health.recordform');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.head', 'settings', '设置·页头', '{"toggleable":true,"copyKeys":["settings.pushLabel","settings.title","settings.loadFail"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.groupaccount', 'settings', '设置·账号安全组', '{"toggleable":true,"copyKeys":["settings.groupAccount","profile.meEntry","profile.meEntrySub","settings.phoneBind","settings.appeal","settings.appealSub"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.groupaccount');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.groupgeneral', 'settings', '设置·设备与隐私组', '{"toggleable":true,"copyKeys":["settings.groupGeneral","settings.devices","settings.privacy"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.groupgeneral');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.groupcommon', 'settings', '设置·通用组', '{"toggleable":true,"copyKeys":["settings.groupCommon","addr.title","invt.title","about.title","about.agreementsSub"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.groupcommon');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.logout', 'settings', '设置·退出登录卡', '{"toggleable":true,"copyKeys":["settings.logout","settings.logoutSub","settings.logoutFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.logout');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'settings.groupdanger', 'settings', '设置·危险操作组', '{"toggleable":true,"copyKeys":["settings.groupDanger","settings.deactivate","settings.deactivateSub"]}', 5, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'settings.groupdanger');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'deact.head', 'deactivate', '注销账号·页头', '{"toggleable":true,"copyKeys":["deact.pushLabel","deact.title","deact.loadFail"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'deact.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'deact.status', 'deactivate', '注销账号·状态卡', '{"toggleable":true,"copyKeys":["deact.successTitle","deact.successBody","deact.inflightTitle","appeal.statusSubmitted","deact.submittedAt","deact.inflightBody","deact.cancel","deact.cancelPending","deact.cancelOk","deact.cancelFail","deact.approvedNote","deact.rejectedTitle","appeal.statusRejected","deact.rejectedPrefix"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'deact.status');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'deact.blocked', 'deactivate', '注销账号·阻断清单卡', '{"toggleable":true,"copyKeys":["deact.blockTitle","deact.blockBody","deact.blockGo","deact.blockNote"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'deact.blocked');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'deact.form', 'deactivate', '注销账号·影响明示与提交', '{"toggleable":true,"copyKeys":["deact.impactTitle","deact.impactRebate","deact.impactRebateDesc","deact.impactMember","deact.impactMemberDesc","deact.impactPets","deact.impactPetsDesc","deact.keepNote","deact.reviewNote","deact.whyReview","deact.ctaSubmit","deact.confirmTitle","deact.confirmBody","deact.confirmOk","deact.confirmCancel","deact.submitting","deact.submitFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'deact.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bind.head', 'changePhone', '手机号换绑·页头', '{"toggleable":true,"copyKeys":["bind.pushLabel","bind.title"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bind.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bind.step1', 'changePhone', '手机号换绑·第一步原号收码', '{"toggleable":true,"copyKeys":["bind.step1Title","bind.currentPhone","bind.whyCode","bind.sendCode","bind.sending","bind.resendIn","bind.sentOk","bind.sendFail","bind.devEcho","bind.devEchoNote","bind.codePlaceholder"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bind.step1');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bind.step2', 'changePhone', '手机号换绑·第二步新号收码与提交', '{"toggleable":true,"copyKeys":["bind.step2Title","bind.newPhoneLabel","bind.newPhonePlaceholder","bind.submit","bind.submitting","bind.submitFail","bind.phoneInvalid","bind.codeInvalid","bind.needOldCode"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bind.step2');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'bind.result', 'changePhone', '手机号换绑·结果卡', '{"toggleable":true,"copyKeys":["bind.successTitle","bind.successBody","bind.backSettings","bind.noPhoneTitle","bind.noPhoneBody","bind.noPhoneCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'bind.result');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appeal.head', 'phoneAppeal', '换绑申诉·页头导语', '{"toggleable":true,"copyKeys":["appeal.pushLabel","appeal.title","appeal.intro"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appeal.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appeal.form', 'phoneAppeal', '换绑申诉·申诉表单', '{"toggleable":true,"copyKeys":["appeal.oldPhoneLabel","appeal.newPhoneLabel","appeal.newPhonePlaceholder","appeal.photoTitle","appeal.photoHint","appeal.addPhoto","appeal.uploading","appeal.removePhoto","appeal.whyPhoto","appeal.noteLabel","appeal.notePlaceholder","appeal.submit","appeal.submitting","appeal.submitFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appeal.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appeal.result', 'phoneAppeal', '换绑申诉·提交成功卡', '{"toggleable":true,"copyKeys":["appeal.successTitle","appeal.successBody"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appeal.result');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'appeal.list', 'phoneAppeal', '换绑申诉·申诉记录列表', '{"toggleable":true,"copyKeys":["appeal.listTitle","appeal.statusSubmitted","appeal.statusApproved","appeal.statusRejected","appeal.linePhones","appeal.decidePrefix","appeal.emptyTitle","appeal.emptyBody","appeal.emptyCta","appeal.loadFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'appeal.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'device.head', 'devices', '登录设备·页头', '{"toggleable":true,"copyKeys":["device.pushLabel","device.title","device.loadFail"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'device.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'device.note', 'devices', '登录设备·新设备提醒条', '{"toggleable":true,"copyKeys":["device.newDeviceNote","device.newDeviceLink"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'device.note');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'device.list', 'devices', '登录设备·设备列表', '{"toggleable":true,"copyKeys":["device.listTitle","device.unnamed","device.current","device.lastSeen","device.firstSeen"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'device.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'device.logs', 'devices', '登录设备·换绑记录区', '{"toggleable":true,"copyKeys":["device.logsTitle","device.logLine","device.channelSelf","device.channelAssisted","device.emptyTitle","device.emptyBody","device.emptyCta"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'device.logs');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'privacy.head', 'privacy', '权限与隐私·页头', '{"toggleable":true,"copyKeys":["privacy.pushLabel","privacy.title"]}', 0, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'privacy.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'privacy.switches', 'privacy', '权限与隐私·权限开关组', '{"toggleable":true,"copyKeys":["privacy.marketingLabel","privacy.marketingDesc","privacy.marketingOffHint","privacy.notifyUnread","privacy.tradeLabel","privacy.tradeDesc","privacy.serviceLabel","privacy.serviceDesc","privacy.accountLabel","privacy.accountDesc","privacy.lockedNote","privacy.lockedWhy","privacy.locationTitle","privacy.locationDesc","privacy.locationOffHint","privacy.locationNote","privacy.toggleFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'privacy.switches');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'privacy.footnote', 'privacy', '权限与隐私·页脚合规注记', '{"toggleable":true,"copyKeys":["privacy.footnote"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'privacy.footnote');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'profile.head', 'profile', '编辑资料·页头', '{"toggleable":true,"copyKeys":["profile.pushLabel","profile.title","profile.loadFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'profile.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'profile.avatar', 'profile', '编辑资料·头像区', '{"toggleable":true,"copyKeys":["profile.avatarLabel","profile.avatarChange","profile.uploading","profile.uploadFail"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'profile.avatar');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'profile.form', 'profile', '编辑资料·资料表单', '{"toggleable":true,"copyKeys":["profile.nicknameLabel","profile.nicknamePlaceholder","profile.nicknameRequired","profile.birthdayLabel","profile.genderLabel","profile.genderMale","profile.genderFemale","profile.genderSecret","profile.save","profile.saving","profile.saveOk","profile.saveFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'profile.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'addr.head', 'addresses', '收货地址·页头', '{"toggleable":true,"copyKeys":["addr.pushLabel","addr.title","addr.loadFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'addr.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'addr.list', 'addresses', '收货地址·地址列表', '{"toggleable":true,"copyKeys":["addr.emptyTitle","addr.emptyBody","addr.emptyCta","addr.defaultBadge","addr.edit","addr.delete","addr.add"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'addr.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'addr.form', 'addresses', '收货地址·地址表单弹层', '{"toggleable":true,"copyKeys":["addr.addTitle","addr.editTitle","addr.receiverLabel","addr.receiverPlaceholder","addr.receiverRequired","addr.phoneLabel","addr.phonePlaceholder","addr.phoneInvalid","addr.regionLabel","addr.regionPlaceholder","addr.regionRequired","addr.detailLabel","addr.detailPlaceholder","addr.detailRequired","addr.setDefault","addr.save","addr.saving","addr.saveOk","addr.saveFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'addr.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'addr.del', 'addresses', '收货地址·删除确认弹层', '{"toggleable":true,"copyKeys":["addr.delConfirmTitle","addr.delConfirmBody","addr.delCancel","addr.delDefaultNote","addr.delOk","addr.delFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'addr.del');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'about.head', 'about', '关于·页头', '{"toggleable":true,"copyKeys":["about.pushLabel","about.title"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'about.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'about.version', 'about', '关于·版本卡', '{"toggleable":true,"copyKeys":["about.versionLabel","about.versionValue","about.betaNote"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'about.version');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'about.agreements', 'about', '关于·协议中心入口行', '{"toggleable":true,"copyKeys":["about.agreements","about.agreementsSub"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'about.agreements');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'about.clear', 'about', '关于·清除缓存区', '{"toggleable":true,"copyKeys":["about.clearCache","about.clearCacheDesc","about.clearConfirmTitle","about.clearConfirmBody","about.clearOk","about.clearCancel","about.clearing"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'about.clear');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'agr.head', 'agreements', '协议中心·页头', '{"toggleable":true,"copyKeys":["agr.pushLabel","agr.title"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'agr.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'agr.list', 'agreements', '协议中心·协议四件列表', '{"toggleable":true,"copyKeys":["agr.user","agr.privacy","agr.memberService","agr.boarding","agr.version","agr.betaMark"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'agr.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'agr.note', 'agreements', '协议中心·内测注脚', '{"toggleable":true,"copyKeys":["agr.betaNote"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'agr.note');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'agr.doc', 'agreements', '协议中心·协议正文', '{"toggleable":true,"copyKeys":["agr.docUser","agr.docPrivacy","agr.docBoarding"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'agr.doc');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'invt.head', 'invoiceTitles', '发票抬头·页头', '{"toggleable":true,"copyKeys":["invt.pushLabel","invt.title","invt.loadFail"]}', 1, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'invt.head');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'invt.list', 'invoiceTitles', '发票抬头·抬头列表', '{"toggleable":true,"copyKeys":["invt.emptyTitle","invt.emptyBody","invt.emptyCta","invt.typePersonal","invt.typeBusiness","invt.defaultBadge","invt.edit","invt.delete","invt.add"]}', 2, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'invt.list');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'invt.form', 'invoiceTitles', '发票抬头·抬头表单弹层', '{"toggleable":true,"copyKeys":["invt.addTitle","invt.editTitle","invt.typeLabel","invt.typePersonal","invt.typeBusiness","invt.titleLabel","invt.titlePlaceholderPersonal","invt.titlePlaceholderBusiness","invt.titleRequired","invt.taxNoLabel","invt.taxNoPlaceholder","invt.taxNoRequired","invt.setDefault","invt.save","invt.saving","invt.saveOk","invt.saveFail"]}', 3, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'invt.form');
--> statement-breakpoint
INSERT INTO `block_registry` (`id`,`block_key`,`page_key`,`label`,`props_json`,`sort_order`,`created_at`,`updated_at`)
SELECT 'seedblock_' || lower(hex(randomblob(8))), 'invt.del', 'invoiceTitles', '发票抬头·删除确认弹层', '{"toggleable":true,"copyKeys":["invt.delConfirmTitle","invt.delConfirmBody","invt.delCancel","invt.delOk","invt.delFail"]}', 4, unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `block_registry` WHERE `block_key` = 'invt.del');
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.pdpNotFound', 'mall', json_object('text', '商品不存在或已下架'), '客户·商品详情', 'ProductDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.pdpNotFound' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.pdpNotFoundAlt', 'mall', json_object('text', '商品不存在'), '客户·商品详情', 'ProductDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.pdpNotFoundAlt' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cartStockNote', 'mall', json_object('text', '库存 {n} 件'), '客户·购物车', 'CartPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cartStockNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cartCheckAll', 'mall', json_object('text', '全选'), '客户·购物车', 'CartPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cartCheckAll' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cartTotalLabel', 'mall', json_object('text', '合计'), '客户·购物车', 'CartPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cartTotalLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cartNeedCheck', 'mall', json_object('text', '请先勾选要结算的商品'), '客户·购物车', 'CartPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cartNeedCheck' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabAll', 'mall', json_object('text', '全部'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabAll' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabPending', 'mall', json_object('text', '待支付'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabPending' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabPaid', 'mall', json_object('text', '待发货'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabPaid' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabShipped', 'mall', json_object('text', '待收货'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabShipped' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabReceived', 'mall', json_object('text', '已完成'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabReceived' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.tabAftersale', 'mall', json_object('text', '售后'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.tabAftersale' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.statusCancelled', 'mall', json_object('text', '已取消'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.statusCancelled' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.statusRefunding', 'mall', json_object('text', '售后中'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.statusRefunding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.trackingLabel', 'mall', json_object('text', '快递单号'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.trackingLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cancelCta', 'mall', json_object('text', '取消'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cancelCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cancelConfirmCta', 'mall', json_object('text', '确认取消'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cancelConfirmCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.toastPaid', 'mall', json_object('text', '支付成功，门店会尽快发货'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.toastPaid' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.toastShipped', 'mall', json_object('text', '订单已发货{no}'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.toastShipped' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.receiveOk', 'mall', json_object('text', '已确认收货，感谢购买'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.receiveOk' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.receiveFail', 'mall', json_object('text', '确认收货失败'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.receiveFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cancelOk', 'mall', json_object('text', '订单已取消，库存已释放'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cancelOk' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.cancelFail', 'mall', json_object('text', '取消失败，请稍后再试'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.cancelFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.reorderToast', 'mall', json_object('text', '已按原单加入购物车'), '客户·商品订单', 'MallOrdersPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.reorderToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rev.photoUploadFail', 'productReviews', json_object('text', '上传失败，请稍后再试'), '客户·商品详情', 'ProductDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rev.photoUploadFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.tabPending', 'appointments', json_object('text', '待确认'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.tabPending' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.tabConfirmed', 'appointments', json_object('text', '已确认'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.tabConfirmed' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.tabServing', 'appointments', json_object('text', '服务中'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.tabServing' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.tabHistory', 'appointments', json_object('text', '已完成'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.tabHistory' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.tabCancelled', 'appointments', json_object('text', '已取消'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.tabCancelled' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cardServingBadge', 'appointments', json_object('text', '● 进行中'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cardServingBadge' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cardStoreFallback', 'appointments', json_object('text', '门店'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cardStoreFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cardPetFallback', 'appointments', json_object('text', '毛孩子'), '客户·我的预约', 'AppointmentsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cardPetFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.infoTitle', 'appointments', json_object('text', '预约信息'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.infoTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtType', 'appointments', json_object('text', '类型'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtType' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtService', 'appointments', json_object('text', '服务'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtService' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtRoomType', 'appointments', json_object('text', '房型'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtRoomType' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtPet', 'appointments', json_object('text', '宠物'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtPet' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtTime', 'appointments', json_object('text', '时间'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtTime' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtAmount', 'appointments', json_object('text', '金额'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtAmount' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtPaymentMode', 'appointments', json_object('text', '收款方式'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtPaymentMode' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtPaid', 'appointments', json_object('text', '实付'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtPaid' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.paidSuffix', 'appointments', json_object('text', '（已付）'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.paidSuffix' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtCheckedIn', 'appointments', json_object('text', '到店核销'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtCheckedIn' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtCompletedAt', 'appointments', json_object('text', '完成时间'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtCompletedAt' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtNote', 'appointments', json_object('text', '备注'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtWalkTimes', 'appointments', json_object('text', '遛弯次数'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtWalkTimes' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.dtId', 'appointments', json_object('text', '预约编号'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.dtId' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.checkedInRoom', 'appointments', json_object('text', '已入住房间：{room}'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.checkedInRoom' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.albumPhotoCount', 'appointments', json_object('text', '{n} 张'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.albumPhotoCount' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.albumNoPhoto', 'appointments', json_object('text', '无需照片'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.albumNoPhoto' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.albumBeforeTag', 'appointments', json_object('text', '服务前'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.albumBeforeTag' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.albumAfterTag', 'appointments', json_object('text', '服务后'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.albumAfterTag' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.storeTitle', 'appointments', json_object('text', '门店'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.storeTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.navAmap', 'appointments', json_object('text', '高德导航'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.navAmap' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.navTencent', 'appointments', json_object('text', '腾讯地图'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.navTencent' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.callStore', 'appointments', json_object('text', '联系门店'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.callStore' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelChipSchedule', 'appointments', json_object('text', '行程有变'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelChipSchedule' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelChipTime', 'appointments', json_object('text', '时间不合适'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelChipTime' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelChipPrice', 'appointments', json_object('text', '价格因素'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelChipPrice' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelChipOther', 'appointments', json_object('text', '其他'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelChipOther' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelNotePh', 'appointments', json_object('text', '补充说明（选填，100 字以内）'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelNotePh' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.submitting', 'appointments', json_object('text', '提交中…'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.submitting' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.rescheduleNeedDates', 'appointments', json_object('text', '请选择新的入住/退房日期'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.rescheduleNeedDates' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.toastCancelled', 'appointments', json_object('text', '预约已取消'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.toastCancelled' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.toastCancelRequested', 'appointments', json_object('text', '已提交取消申请，待门店审核'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.toastCancelRequested' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.cancelFailFallback', 'appointments', json_object('text', '取消失败，请稍后再试'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.cancelFailFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.reviewThanks', 'appointments', json_object('text', '感谢评价！'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.reviewThanks' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.reviewFail', 'appointments', json_object('text', '评价提交失败'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.reviewFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.rescheduleToast', 'appointments', json_object('text', '改期已提交，等待商家重新确认'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.rescheduleToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.rescheduleFail', 'appointments', json_object('text', '改期失败，请稍后再试'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.rescheduleFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.shareTitle', 'appointments', json_object('text', '菲丽亚服务相册'), '客户·洗护全程 / 客户·预约详情', 'AppointmentLivePage 页面内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.shareTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.shareText', 'appointments', json_object('text', '宝贝在菲丽亚完成了服务，全程照片可见～'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.shareText' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.shareCopied', 'appointments', json_object('text', '链接已复制，快发给家人朋友吧'), '客户·洗护全程 / 客户·预约详情', 'AppointmentLivePage 页面内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.shareCopied' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.shareCopyFail', 'appointments', json_object('text', '复制失败，请手动复制地址栏链接'), '客户·洗护全程 / 客户·预约详情', 'AppointmentLivePage 页面内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.shareCopyFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.createdLine', 'appointments', json_object('text', '预约于 {date} {week} 创建'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.createdLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.fallbackService', 'appointments', json_object('text', '服务'), '客户·洗护全程 / 客户·预约详情', 'AppointmentLivePage 页面内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.fallbackService' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.fallbackPet', 'appointments', json_object('text', '宠物'), '客户·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.fallbackPet' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveTitleGrooming', 'appointments', json_object('text', '洗护全程'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveTitleGrooming' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveTitleBoarding', 'appointments', json_object('text', '寄养全程'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveTitleBoarding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.livePetFallback', 'appointments', json_object('text', '宝贝'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.livePetFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveServiceGrooming', 'appointments', json_object('text', '洗护服务'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveServiceGrooming' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveServiceBoarding', 'appointments', json_object('text', '寄养服务'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveServiceBoarding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveMetaStaff', 'appointments', json_object('text', '{staff}服务中'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveMetaStaff' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveMetaEta', 'appointments', json_object('text', '预计 {time} 完成'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveMetaEta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveMetaBoarding', 'appointments', json_object('text', '寄养中 · 第 {n} 天'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveMetaBoarding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveStepsLoading', 'appointments', json_object('text', '正在接入服务进度…'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveStepsLoading' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintDisinfection', 'appointments', json_object('text', '工具消毒确认中，安心第一步'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintDisinfection' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintPrecheck', 'appointments', json_object('text', '正在做预检，确认皮肤与毛发状态'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintPrecheck' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintGrooming', 'appointments', json_object('text', '正在洗护美容，新照片会实时出现在这里'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintGrooming' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintDetail', 'appointments', json_object('text', '细节精修中，快要变美啦'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintDetail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintBeforeAfter', 'appointments', json_object('text', '正在做交付检查'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintBeforeAfter' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.hintConfirm', 'appointments', json_object('text', '洗护师正在为您完成最后确认'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.hintConfirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveToastCheckin', 'appointments', json_object('text', '{date}打卡已更新，快看看{pet}的今天'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveToastCheckin' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveToastReopen', 'appointments', json_object('text', '商家重新开启了本次服务，可继续查看进度'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveToastReopen' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveReviewThanks', 'appointments', json_object('text', '感谢评价，已转告门店与洗护师'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveReviewThanks' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveReviewFail', 'appointments', json_object('text', '评价提交失败，请稍后再试'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveReviewFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveShareText', 'appointments', json_object('text', '{pet}在{store}完成了{service}，全程照片可见～'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveShareText' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveShareStoreFallback', 'appointments', json_object('text', '菲丽亚'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveShareStoreFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveLoading', 'appointments', json_object('text', '加载中…'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveLoading' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveErrTitle', 'appointments', json_object('text', '打不开这个进度页'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveErrTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveErrForbidden', 'appointments', json_object('text', '这不是你的预约哦，请确认登录的账号是否正确。'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveErrForbidden' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveErrNotFound', 'appointments', json_object('text', '找不到这个预约，可能链接有误或已被删除。'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveErrNotFound' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveErrBackCta', 'appointments', json_object('text', '回到我的预约'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveErrBackCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.livePendingTitle', 'appointments', json_object('text', '服务尚未开始'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.livePendingTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveCancelReviewTitle', 'appointments', json_object('text', '取消申请审核中'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveCancelReviewTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveCancelReviewBody', 'appointments', json_object('text', '门店正在处理你的取消申请，结果会第一时间通知你。'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveCancelReviewBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.livePendingBody', 'appointments', json_object('text', '预约时间 {time}，到店后出示预约码，店员核销后即可在这里看到{kind}全程。'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.livePendingBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveKindGrooming', 'appointments', json_object('text', '洗护'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveKindGrooming' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveKindBoarding', 'appointments', json_object('text', '寄养'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveKindBoarding' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveShowCode', 'appointments', json_object('text', '出示预约码'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveShowCode' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveCancelledTitle', 'appointments', json_object('text', '预约已取消'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveCancelledTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveCancelledBody', 'appointments', json_object('text', '这次没能相见，期待下次再约。'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveCancelledBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appointments.liveRebook', 'appointments', json_object('text', '重新预约'), '客户·洗护全程', 'AppointmentLivePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appointments.liveRebook' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.greetMorning', 'member', json_object('text', '早安'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.greetMorning' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.greetNoon', 'member', json_object('text', '午安'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.greetNoon' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.greetNight', 'member', json_object('text', '晚安'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.greetNight' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.greetFallback', 'member', json_object('text', '铲屎官'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.greetFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.welcome', 'member', json_object('text', '欢迎来到 Philia 品牌空间 · 今天也要好好爱 TA'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.welcome' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.closeAria', 'member', json_object('text', '关闭'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.closeAria' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.spaceAria', 'member', json_object('text', 'Philia 品牌空间'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.spaceAria' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.petLoadFail', 'member', json_object('text', '宠物档案加载失败'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.petLoadFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.petEmptyTitle', 'member', json_object('text', '建立第一份宠物档案'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.petEmptyTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.petEmptyDesc', 'member', json_object('text', '记录 TA 的品种、生日与疫苗，开启菲丽亚之旅'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.petEmptyDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.speciesDog', 'member', json_object('text', '狗狗'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.speciesDog' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.speciesCat', 'member', json_object('text', '猫咪'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.speciesCat' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.speciesOther', 'member', json_object('text', '小可爱'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.speciesOther' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkPets', 'member', json_object('text', '宠物档案'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkPets' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkPetsDesc', 'member', json_object('text', 'TA 的小档案'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkPetsDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkCard', 'member', json_object('text', '会员卡'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkCard' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkCardDesc', 'member', json_object('text', '专属身份'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkCardDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkMoments', 'member', json_object('text', '服务相册'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkMoments' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.linkMomentsDesc', 'member', json_object('text', '变美记录'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.linkMomentsDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.passportTitle', 'member', json_object('text', '成长护照'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.passportTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.passportDesc', 'member', json_object('text', '护照盖章预告'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.passportDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.passportBadge', 'member', json_object('text', '9c 解锁'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.passportBadge' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.diaryTitle', 'member', json_object('text', '菲丽亚日记'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.diaryTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.diaryLoadFail', 'member', json_object('text', '日记加载失败'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.diaryLoadFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.diaryEmptyTitle', 'member', json_object('text', '日记还没有篇章'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.diaryEmptyTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.diaryEmptyDesc', 'member', json_object('text', '完成第一次洗护后，这里会留下 TA 的变美瞬间'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.diaryEmptyDesc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tipTag', 'member', json_object('text', '养宠小贴士'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tipTag' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip1Title', 'member', json_object('text', '定期驱虫'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip1Title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip1Desc', 'member', json_object('text', '体外驱虫建议每月一次，体内驱虫每三个月一次，守护毛孩子健康。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip1Desc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip2Title', 'member', json_object('text', '梳毛的好处'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip2Title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip2Desc', 'member', json_object('text', '每天梳毛 5 分钟，减少浮毛打结，还能增进和毛孩子的感情。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip2Desc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip3Title', 'member', json_object('text', '疫苗提醒'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip3Title' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'f1.tip3Desc', 'member', json_object('text', '疫苗有效期临近时记得及时续种，寄养前需提供有效疫苗证明。'), '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·健康档案 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·发票详情 / 客户·商品订单 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·安心证书 / 客户·宠物档案 / 客户·小棉花客服 / 客户·工单详情 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的发票 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·服务相册 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消息 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·线上续费确认页 / 客户·编辑资料 / 客户·美容报告 / 客户·联系小棉花 / 客户·订阅管理 / 客户·设置 / 客户·购物车 / 客户·退款/售后 / 客户·预约寄养 / 客户·预约洗护 / 客户·预约详情', 'copy 组件内文案（跨屏共用件，各屏组同列）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'f1.tip3Desc' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.editTitle', 'pets', json_object('text', '编辑档案'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.editTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.editEntry', 'pets', json_object('text', '编辑 ›'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.editEntry' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.avatarUpload', 'pets', json_object('text', '上传头像'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.avatarUpload' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.avatarChange', 'pets', json_object('text', '更换头像'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.avatarChange' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.avatarNote', 'pets', json_object('text', '上传前自动压缩，最长边 2000px'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.avatarNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.avatarPreviewAlt', 'pets', json_object('text', '头像预览'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.avatarPreviewAlt' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.nameLabel', 'pets', json_object('text', '名字 *'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.nameLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.namePlaceholder', 'pets', json_object('text', 'TA 的名字'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.namePlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.speciesLabel', 'pets', json_object('text', '物种 *'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.speciesLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.speciesDog', 'pets', json_object('text', '狗狗'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.speciesDog' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.speciesCat', 'pets', json_object('text', '猫咪'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.speciesCat' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.speciesOther', 'pets', json_object('text', '其他'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.speciesOther' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.breedLabel', 'pets', json_object('text', '品种'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.breedLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.breedPlaceholder', 'pets', json_object('text', '如：金毛'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.breedPlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.birthdayLabel', 'pets', json_object('text', '生日'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.birthdayLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.weightLabel', 'pets', json_object('text', '体重（kg）'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.weightLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.weightPlaceholder', 'pets', json_object('text', '如：4.5'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.weightPlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.vaccineLabel', 'pets', json_object('text', '疫苗有效期至'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.vaccineLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.neuteredLabel', 'pets', json_object('text', '已绝育'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.neuteredLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.tagsLabel', 'pets', json_object('text', '性格标签（最多 12 个）'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.tagsLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.tagCustomPlaceholder', 'pets', json_object('text', '自定义标签，回车添加'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.tagCustomPlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.tagLimitPlaceholder', 'pets', json_object('text', '标签已达上限'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.tagLimitPlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.tagAdd', 'pets', json_object('text', '添加'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.tagAdd' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.proofRemove', 'pets', json_object('text', '删除'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.proofRemove' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.formCancel', 'pets', json_object('text', '取消'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.formCancel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.formSaving', 'pets', json_object('text', '保存中…'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.formSaving' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.formSubmit', 'pets', json_object('text', '保存档案'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.formSubmit' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.formSaveFail', 'pets', json_object('text', '保存失败，请稍后重试'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.formSaveFail' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'pets.historyServiceFallback', 'pets', json_object('text', '洗护'), '客户·宠物档案', 'PetsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'pets.historyServiceFallback' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'agr.docUser', 'agreements', json_object('text', '一、服务范围：内测期间，本应用提供宠物洗护、寄养预约与商城下单的线上入口，实际服务由线下门店履约，服务内容、价格与门店公示一致。
二、账号：内测期使用手机号或门店发放的种子账号登录；请妥善保管登录状态，账号仅限本人使用。
三、交易：线上支付通道为内测演示通道，不产生真实扣款；真实消费以门店收银与订单记录为准。
四、变更与终止：内测期功能与规则可能调整，调整以应用内公告与门店公示为准；您可随时停止使用并申请注销账号。
五、其他：本协议为内测期简版文本，未尽事宜以门店公示规则为准；正式上线版本协议发布后，以新版本为准。'), NULL, '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'agr.docUser' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'agr.docPrivacy', 'agreements', json_object('text', '一、我们收集什么：手机号（登录与找回账号）、昵称/头像/生日/性别（个人资料，可选填）、收货地址与发票抬头（履约所需）、预约与订单记录（服务留痕）。
二、用于什么：仅用于登录鉴权、预约履约、订单履约与服务通知；不出售、不共享给无关第三方。
三、权限：消息通知与定位为可选权限，可在「设置 · 权限与隐私」随时关闭；营销类通知可单独关闭，交易/服务/账户通知为保障服务履约不可关闭。拒绝授权不影响基本功能使用（《个人信息保护法》最小必要口径）。
四、留存：订单与服务留痕依法保留；注销账号后个人资料删除，留痕记录按法规期限保留。
五、其他：本政策为内测期简版文本，正式政策以上线版本为准。'), NULL, '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'agr.docPrivacy' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'agr.docBoarding', 'agreements', json_object('text', '一、服务内容：寄养按晚计费，房型与价格以预约页与门店公示为准；寄养期间门店按约定频次照护并记录过程。
二、入住条件：宠物须完成门店要求的疫苗与驱虫核验，健康异常或具攻击性的宠物门店有权拒收或中止寄养。
三、押金：寄养可能收取押金，押金收取与退还由门店登记留痕，进度以「消费记录 · 押金进度」页为准。
四、风险告知：寄养期间如宠物突发疾病，门店将第一时间联系您并按您的指示处理；紧急情况下门店可先送医再通知，费用按门店公示口径结算。
五、其他：本协议为内测期简版文本，具体照护细则以门店现场签署的寄养单与公示为准。'), NULL, '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'agr.docBoarding' AND `active` = 1);
