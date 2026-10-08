-- 端口批收尾片 2（打回修一件）：copy_overrides 归屏/位置注增量回填（ann/prod/corr/cadm 新键+ann.reads.close 归屏修正）
-- 军规（本片立）：已部署迁移永不重写——0047 已复原 main 版逐字节，本文件=增量回填走新迁移先例；
--   生成器产物改道 server/drizzle/_backfill_staging.sql（staging 勿入卷，增量 diff 后挪下一号新迁移）。
-- 幂等：WHERE screen IS NULL 守卫（重放零副作用）；UPDATE=636 逐句（生成器产物 diff 抽行）。
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.badge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.editCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.editingHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.newCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.publishCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.removeConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.removeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.removed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.draft.sectionTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.archivedSection' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.expiredBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.pendingBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.publishedSection' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.confirmCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.endsAtLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.previewTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.startsAtLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.windowHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pubd.windowUnlimited' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.reads.close' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.agreementAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.agreementExport' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.billNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.blindClose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.blindCloseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.cashAdjustLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.cashMoveAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.cashMoveEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.cashMoveNoShift' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.cashMoveTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账 / 商家·收银台', `position` = 'LedgerPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.creditNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.creditSettleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.creditSettleTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.creditWriteoffNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.creditWriteoffTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.depositSummaryAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.diffNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.diffNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账 / 商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.discountOverNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.discountStatsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.floatLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.floatNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverConfirmCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverConfirmedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'HoldPanel 组件内文案' WHERE `rule_key` = 'cashier.holdOver24' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.ledgerEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.ledgerSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账', `position` = 'LedgerPage 页面内文案' WHERE `rule_key` = 'cashier.ledgerTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.lineNoteCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.lineNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.peripheralNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账 / 商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.priceNewNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickAdd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickAmountPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickCollect' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickCollectAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PickPanel 组件内文案' WHERE `rule_key` = 'cashier.quickNamePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银小票', `position` = 'ReceiptPage 页面内文案' WHERE `rule_key` = 'cashier.receiptNightLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银小票', `position` = 'PaySheet 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.receiptPrint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'BillDetailDialog 组件内文案' WHERE `rule_key` = 'cashier.receiptReprint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银小票', `position` = 'ReceiptPage 页面内文案' WHERE `rule_key` = 'cashier.receiptThanks' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银小票', `position` = 'ReceiptPage 页面内文案' WHERE `rule_key` = 'cashier.receiptTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账 / 商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.reverseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银小票 / 商家·收银流水', `position` = 'CartPanel 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.roundingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.scanPayNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·台账 / 商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.voidNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CarePackPortBody 组件内文案' WHERE `rule_key` = 'cadm.carePackExpired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CarePackPortBody 组件内文案' WHERE `rule_key` = 'cadm.carePackExpiryTh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CarePackPortBody 组件内文案' WHERE `rule_key` = 'cadm.carePackRecallNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainCommission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainDuration' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainMemberPlans' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainPay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainService' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictDomainXp' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictError' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictMoneyBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictSearchPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConfigDictBody 组件内文案' WHERE `rule_key` = 'cadm.dictTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killArm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killArmConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killArmNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killBannerOn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killRestore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.killRestoreConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CarePackPortBody 组件内文案' WHERE `rule_key` = 'cadm.portCarePack' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CarePackPortBody 组件内文案' WHERE `rule_key` = 'cadm.portCarePackNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portCorrection' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portDict' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portMarketing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.portProfileSave' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portRecycle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.profileChainTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.profileEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.profileEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.profileHqSelf' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ProfilePortBody 组件内文案' WHERE `rule_key` = 'cadm.profileSaved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleDomainAnnounce' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleDomainProduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleDomainPromo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleRestore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleRestored' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'RecycleBinBody 组件内文案' WHERE `rule_key` = 'cadm.recycleTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.approveConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.approveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.approved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.balanceLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.bonusLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.dateLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.fmtBonus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.fmtPrincipal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.formAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.formTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.kindRebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.kindStored' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.kindWorkHours' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.memberEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.memberPickLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.memberSearchPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.noteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.principalLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.proposed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.queueAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.queueEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.queueTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.recordEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.recordManualLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.recordPickLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.redlineNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.rejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.rejectNotePrompt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.rejectNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.staffPickLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.statusApplied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.tabRebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.tabStored' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.tabWorkHours' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'CorrectionBody 组件内文案' WHERE `rule_key` = 'corr.tsLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.m3ChainTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.m3SingleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.highBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.lowBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.stockHigh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.stockNow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.suggestQty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.alerts.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.createDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.createTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.fefoFirst' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.filterAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.noExpiry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.noLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.noPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.noRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.prodDateLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.productLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.batch.qtyInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.qtyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.batch.qtyUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.shelfLifeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.statusActive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.statusDestroyed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.statusQuarantined' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.batch.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.common.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.common.confirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.common.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.daysLeft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.destroyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.destroyDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.destroyReasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.destroyReasonRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.destroyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.expiredDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.gradeExpired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.gradeUrgent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.gradeWarn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.quarantineCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.quarantineDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.expiry.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.marginNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品 / 商家·库存 / 商家·调拨要货', `position` = 'ProductsPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.costLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.markCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.markDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.restockCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.restockDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.restockQtyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.restockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.stockLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.soldout.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.createDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.createTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.qtyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.reasonRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inv.writeoff.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.createDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.createTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.dirIn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.dirOut' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.fromLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.itemsSummary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.noStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.productLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.qtyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.receiveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.receiveDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.shipCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.shipDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.statusInTransit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.statusReceived' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.toLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.move.toStoreLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:inventory 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'trf.move.toStorePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·库存 / 商家·调拨要货', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'trf.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.createDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.fulfillCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.fulfillDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.statusFulfilled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.suggest' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.rep.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.hours' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.hoursUnknown' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.overdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·调拨要货', `position` = 'TransfersPage 页面内文案' WHERE `rule_key` = 'trf.transit.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.grantOwner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.grantPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.grantsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.grantsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.kindMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.kindPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.tierAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.tierDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.tierEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.tierThreshold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.tierTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.upcomingEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.bday.upcomingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.colCoupon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.colGranted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.colNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.colTarget' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.campaign.colTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.colTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.fCoupon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.fNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.fTargetKind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.fTargetValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.fTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.grantCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.grantedUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.campaign.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.noCoupon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.targetAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.campaign.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.common.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.common.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.common.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colQuota' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colThreshold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.colType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fQuota' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fThreshold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.fType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.coupon.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.quotaNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.statusOff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.statusOn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.thresholdNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeBirthday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeConsume' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeFestival' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeRecharge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeRegister' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.coupon.typeWakeup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.advanced' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colDiff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colNew' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colOperator' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colOps' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colOrig' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.colStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.confirmCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.diffMinus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.diffPlus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.diffZero' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.fDiff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.fNew' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.fNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.fOrig' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.exch.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.settleCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.stApplied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.stConfirmed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.stSettled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exch.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colMonth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colOperator' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colOps' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.colType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.deleteCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.deleted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.fAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.fMonth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.fNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.fType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.exp.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.monthAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.monthLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.summaryTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.typeOther' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.typeRent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.typeSalary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.exp.typeUtility' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.guide.hint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销 / 商家·营销台账', `position` = 'MarketingPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mk.guide.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colOperator' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colOps' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colProduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colQcNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colQty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.colTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.failCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.fNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.fProduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.fQcNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.fQty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.insp.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.passCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.reviewed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.reviewTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.stFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.stPassed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.stPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.insp.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.ledger.backMarketing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.ledger.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.ledger.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.page.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.page.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.page.toLedger' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colName' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colOps' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colRange' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colRules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.colType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.editCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fEndsAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fName' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fStartsAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fStatusDraft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fStatusScheduled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.fType' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.promo.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.modalCreate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.modalEdit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.rangeNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleDailyEnd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleDailyStart' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleGift' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleMinus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleRate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.ruleThreshold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.stActive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.stDraft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.stEnded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.stScheduled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.typeDiscount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.typeExchangeGift' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.typeFullMinus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.typeSecondPiece' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.promo.typeTimePromo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.colCreator' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.colKind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.colMonth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.colTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.fKind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.fMonth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.hint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.kindD1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.kindMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.monthAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·营销台账', `position` = 'MarketingLedgerPage 页面内文案' WHERE `rule_key` = 'mk.snap.working' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.campaignCoupon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.campaignMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.couponStack' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.multiCampaign' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.stack.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.colKind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.colMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.colTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.colValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.filterAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mk.tag.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.kind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.kindPref' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.kindSize' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.kindSpecies' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.modalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.prefHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.setCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.sizeLarge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.sizeMedium' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.sizeSmall' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.speciesCat' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.speciesDog' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.userId' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.userIdHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.value' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员营销', `position` = 'MarketingPage 页面内文案' WHERE `rule_key` = 'mk.tag.valueFilterPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.applicantLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.approveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.approveDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.approveTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.kindPurchase' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.kindReplenish' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.kindTransfer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.kindWriteoff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.rejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.rejectDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.rejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.stock.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkCarePackageRo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkDescCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkMaxCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkMinCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkPendingBar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkPriceOwnerOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkSave' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.bulkToggle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.costClerkMask' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.costCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvOptColsNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.deleteConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.deleteCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.deleteDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.costHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.costInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.costLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.limitHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.limitInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.maxStockLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductEditorDialog 组件内文案' WHERE `rule_key` = 'prod.editor.minStockLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9top.rankEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9top.rankTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9top.slowEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9top.slowTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.view.chain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.view.chainAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.view.store' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.view.storePick' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.view.stores' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.byDayTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.count' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.curCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.prevCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.serviceShop' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.toggle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.weekly.wowLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.commission_grooming_rate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.config_kill_switch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.duration_base_min' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.pay_channel_enabled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.pay_timeout_minutes' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.plan_yinghuo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.refund_threshold_fen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:rules 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'cfghelp.xp_daily_cap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalsAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalsError' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalStatusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalStatusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalStatusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approvalsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approveBtn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approveConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.approveDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.changeAfter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.changeBefore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.effectiveAtHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.effectiveAtLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.effectiveSectionTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.errorFixFirst' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.historyActiveBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.historyToggle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.inApprovalBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.moneyBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.proposeDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.proposeMixedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.proposeOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rejectBtn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rejectDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rejectNotePrompt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rejectNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.reviewSave' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rollbackBtn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rollbackConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.rollbackDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.saveBarMoneyNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.scheduledBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.scheduledCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.scheduledCancelDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.scheduledRowNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.scheduledSaveDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.searchEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.searchEmptyHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.searchPlaceholder' AND `screen` IS NULL;
