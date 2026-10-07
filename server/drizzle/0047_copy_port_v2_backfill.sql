-- 端口 V2 修正批：copy_overrides screen/position 存量回填（生成器扫三端调用点产物）
-- 幂等：WHERE screen IS NULL 守卫（重放零副作用；人工端口改过的 position 不被回填覆盖——
-- position 列=留口件，人工值 screen 非空语义下不再回填；screen IS NULL 时 position 一并刷新）。
-- 归屏率=96.7%（未归屏 105 键 screen 保持 NULL=「未归屏」诚实组）。
-- 生成件=scripts/gen-copy-overrides-seed.mts 重跑产物（server/src/db/copySeedRows.ts 同帧）。
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.agreements' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于 / 客户·设置', `position` = 'AboutPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'about.agreementsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.betaNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearCache' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearCacheDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.clearOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于 / 客户·设置', `position` = 'AboutPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'about.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.versionLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·关于', `position` = 'AboutPage 页面内文案' WHERE `rule_key` = 'about.versionValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.addPhoto' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.decidePrefix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.intro' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.linePhones' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.newPhoneLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.newPhonePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.noteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.notePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.oldPhoneLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.phoneInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.photoHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（account 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'appeal.photoLimit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.photoTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.removePhoto' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉 / 客户·注销账号', `position` = 'PhoneAppealPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'appeal.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉 / 客户·注销账号', `position` = 'PhoneAppealPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'appeal.statusSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.successBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.successTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.uploadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.uploading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑申诉', `position` = 'PhoneAppealPage 页面内文案' WHERE `rule_key` = 'appeal.whyPhoto' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.backSettings' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.codeInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.codePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.currentPhone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.devEcho' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.devEchoNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.needOldCode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.newPhoneLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.newPhonePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.noPhoneBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.noPhoneCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.noPhoneTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.phoneInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.resendIn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.sendCode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.sendFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.sending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.sentOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.step1Title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.step2Title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.successBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.successTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号', `position` = 'ChangePhonePage 页面内文案' WHERE `rule_key` = 'bind.whyCode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.approvedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.blockBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.blockGo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.blockNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.blockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.cancelFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.cancelOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.cancelPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.confirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.confirmCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.confirmOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.confirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.ctaSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactMemberDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactPets' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactPetsDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactRebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactRebateDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.impactTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.inflightBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.inflightTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.keepNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.rejectedPrefix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.rejectedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.reviewNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.submittedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.successBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.successTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·注销账号', `position` = 'DeactivatePage 页面内文案' WHERE `rule_key` = 'deact.whyReview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.channelAssisted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.channelSelf' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.current' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.firstSeen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.lastSeen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.logLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.logsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.newDeviceLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.newDeviceNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·登录设备', `position` = 'DevicesPage 页面内文案' WHERE `rule_key` = 'device.unnamed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.accountDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.accountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.footnote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.locationDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.locationNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.locationOffHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.locationTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.lockedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.lockedWhy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.marketingDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.marketingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.marketingOffHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.notifyUnread' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.serviceDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.serviceLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.toggleFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.tradeDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·权限与隐私', `position` = 'PrivacyPage 页面内文案' WHERE `rule_key` = 'privacy.tradeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.appeal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.appealSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.deactivate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.deactivateSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.devices' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.groupAccount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.groupCommon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.groupDanger' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.groupGeneral' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·换绑手机号 / 客户·换绑申诉 / 客户·设置', `position` = 'ChangePhonePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'settings.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.logout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.logoutFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.logoutSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.phoneBind' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.privacy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'settings.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.add' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.addTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.defaultBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delDefaultNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delete' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.delOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.detailLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.detailPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.detailRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.edit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.editTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.phoneInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.phoneLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.phonePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.receiverLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.receiverPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.receiverRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.regionLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.regionPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.regionRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.save' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.saveFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.saveOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·收货地址', `position` = 'AddressesPage 页面内文案' WHERE `rule_key` = 'addr.setDefault' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的 / 客户·收货地址 / 客户·设置', `position` = 'MePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'addr.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约成功', `position` = 'BoardingSinglePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'agreement.agreeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.agreeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.boarding_consent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.medical_auth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约成功', `position` = 'BoardingSinglePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'agreement.versionNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.betaMark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.betaNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'agr.boarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.memberService' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'agr.privacy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（agreements 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'agr.user' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·协议中心', `position` = 'AgreementsPage 页面内文案' WHERE `rule_key` = 'agr.version' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.addonsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.albumSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.albumTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceBelongings' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceLatestLog' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceLogDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceNoLog' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceRoom' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceUnsealEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceUnsealTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.assuranceWeight' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.backToList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelAskFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelAskLate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelCtaFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelCtaLate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelFeeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelFeeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelReasonTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelReviewing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelRuleFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelRuleLate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelSubmitFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.cancelSubmitLate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.codeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.detailLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.detailSheetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.detailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.emergencyContact' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentHandledLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentHandling' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentOccurredAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentToastHandled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentToastReported' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentTypeInjury' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentTypeStress' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.incidentTypeVetVisit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.liveBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.liveGrooming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.liveSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.materialQty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.materialsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.materialsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.medicalAuthLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.medicalAuthSigned' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.notFound' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.prepaidDeducted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.prepaidLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.prepaidPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.prepaidRefunded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.prepaidRegistered' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rebook' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rejectedPrefix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleHistory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleRoleCustomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleRoleMerchant' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleTitleBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.rescheduleTitleGrooming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'BoardingLive 组件内文案' WHERE `rule_key` = 'appointments.roomPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.servingCall' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.servingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.servingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.slotsLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.slotsLoading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.stepDoing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.stepDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.stepDuration' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.stepPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.tabEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.thinkMore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appointments.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·洗护全程', `position` = 'AppointmentLivePage 页面内文案' WHERE `rule_key` = 'appointments.unsealToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appointments.walkTimes' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.addCalendar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'GroomingSinglePage 页面内文案' WHERE `rule_key` = 'booking.addonPriceNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'ExtrasBlock 组件内文案' WHERE `rule_key` = 'booking.addonSummary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'ExtrasBlock 组件内文案' WHERE `rule_key` = 'booking.addonSummaryNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'ExtrasBlock 组件内文案' WHERE `rule_key` = 'booking.addonTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.backHome' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.boardingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.cancelNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.chooseCheckin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.chooseCheckout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetCardBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.choosePet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.chooseRoom' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'GroomingSinglePage 页面内文案' WHERE `rule_key` = 'booking.chooseService' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'StoreLineBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.chooseStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'GroomingSinglePage 页面内文案' WHERE `rule_key` = 'booking.chooseTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.codeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.ecIncomplete' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.ecNamePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.ecPhoneInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.ecPhonePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.ecRelationPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.emergencyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'BoardingSinglePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.fullSlotFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'BookingGroomingPage 页面内文案' WHERE `rule_key` = 'booking.groomingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.missingParam' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.needBoardingConsent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.needMedicalAuth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'BoardingSinglePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.needPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'ServiceChipsBlock 组件内文案' WHERE `rule_key` = 'booking.noGroomingSingle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'BookingGroomingPage 页面内文案' WHERE `rule_key` = 'booking.noGroomingWizard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BookingBoardingPage 页面内文案' WHERE `rule_key` = 'booking.noPetBodyBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetBodyPicker' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetCardBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetBodyWizard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetCardBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetCtaPicker' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetCardBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetSkip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.noPetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.noRoom' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'BookingGroomingPage 页面内文案' WHERE `rule_key` = 'booking.passHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'BookingGroomingPage 页面内文案' WHERE `rule_key` = 'booking.passNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.petPickHintBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetCardBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.petPickHintGrooming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.rescheduleLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'RoomTypeBlock 组件内文案' WHERE `rule_key` = 'booking.roomEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'RoomTypeBlock 组件内文案' WHERE `rule_key` = 'booking.roomLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.signedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.signPendingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'StaffPicker 组件内文案' WHERE `rule_key` = 'booking.staffAny' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'StaffPicker 组件内文案' WHERE `rule_key` = 'booking.staffAnyCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'StaffPicker 组件内文案' WHERE `rule_key` = 'booking.staffAnySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'StaffPicker 组件内文案' WHERE `rule_key` = 'booking.staffEarliest' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'GroomingSinglePage 页面内文案' WHERE `rule_key` = 'booking.staffNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'StoreLineBlock 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.storeCountNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BookingBoardingPage 页面内文案' WHERE `rule_key` = 'booking.storeLinePost' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BookingBoardingPage 页面内文案' WHERE `rule_key` = 'booking.storeLinePre' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.successSignEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.successSignView' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.successSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.successTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.summaryLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约洗护', `position` = 'GroomingSinglePage 页面内文案' WHERE `rule_key` = 'booking.toBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BoardingSinglePage 页面内文案' WHERE `rule_key` = 'booking.toGrooming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.vaccineBlockedNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.vaccineBlockedSuffix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.vaccineBlockedUntil' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养 / 客户·预约洗护', `position` = 'PetPicker 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'booking.vaccineFix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'BookingBoardingPage 页面内文案' WHERE `rule_key` = 'booking.vaccineRule' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约成功', `position` = 'BookingSuccessPage 页面内文案' WHERE `rule_key` = 'booking.viewAppointments' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.walkTimesLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'booking.walkTimesPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.centerEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.centerTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.claimCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.claimedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.claimedCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.claimFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.claimToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.mineEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.mineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.soldOutCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.stackTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.statusClaimed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.statusExpired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.statusUsed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.statusVoided' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.tabMine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券 / 客户·确认订单', `position` = 'CouponsPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cpn.threshold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券 / 客户·确认订单', `position` = 'CouponsPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cpn.thresholdNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.usedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.useNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'cpn.validDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.devOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.footerA' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.footerB' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.gateBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.gateHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.gateLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.gateTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.manualBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.manualTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.phoneBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.phoneTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.primaryCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.seedEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.seedFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.seedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.seedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.tagline' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'devlogin.wechatNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'fav.addToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'fav.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'fav.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'fav.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'fav.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'fav.mallEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'fav.pdpAdd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'fav.pdpAdded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·我的券', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'fav.removeToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的券', `position` = 'CouponsPage 页面内文案' WHERE `rule_key` = 'fav.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·我的券', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'fav.toggleFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.dueExpired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.dueOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.dueSoon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordAddTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordDateLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordDelete' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordDeleteConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordDeleted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordNextDueLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordNotePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordsTabEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordTitleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordTitlePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.recordTypeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.saveFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.tabDeworm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.tabMedication' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.tabVaccine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.tabVetVisit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightAddTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightDateLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightKgLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightKgPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightTrend' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·健康档案', `position` = 'PetHealthPage 页面内文案' WHERE `rule_key` = 'health.weightUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.casesMore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.casesTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.caseTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.entryBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.entryBoardingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.entryGrooming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.idFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.idJoin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.liveEta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.liveTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.liveViewAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.memberCode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.openMemberClaim' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.openMemberSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·首页', `position` = 'HomeBookingPanel 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'home.panelEntrySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·首页', `position` = 'HomeBookingPanel 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'home.panelEntryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.passStripPost' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.passStripPre' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.petsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.petsLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.petsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.preprowDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.preprowDoneAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.preprowTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（home 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'home.pwaInstallAction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（home 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'home.pwaInstallDismiss' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（home 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'home.pwaInstallIosGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（home 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'home.pwaInstallTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.rebateBalanceLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.rebateLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.rebateLedger' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.ringArrive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.ringPeriod' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.ringRule' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.statsDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.statsServices' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·首页', `position` = 'HomePage 页面内文案' WHERE `rule_key` = 'home.statsSpend' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.add' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.addTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头 / 客户·申请发票', `position` = 'InvoiceTitlesPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'invt.defaultBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delete' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.delOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.edit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.editTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'invt.pickCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'invt.pickTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.save' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.saveFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.saveOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.setDefault' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.taxNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.taxNoPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.taxNoRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头 / 客户·设置', `position` = 'InvoiceTitlesPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'invt.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.titleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.titlePlaceholderBusiness' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.titlePlaceholderPersonal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.titleRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头 / 客户·申请发票', `position` = 'InvoiceTitlesPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'invt.typeBusiness' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头', `position` = 'InvoiceTitlesPage 页面内文案' WHERE `rule_key` = 'invt.typeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票抬头 / 客户·申请发票', `position` = 'InvoiceTitlesPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'invt.typePersonal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.addrOptionalNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.backHome' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.cancelConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.cancelConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartCheckout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartEmptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartStoreNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·购物车', `position` = 'CartPage 页面内文案' WHERE `rule_key` = 'mall.cartTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.checkoutEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.checkoutEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.checkoutGoCart' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.checkoutGoMall' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.checkoutTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.confirmReceive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·商城', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.conflictBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·商城', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.conflictOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·商城', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.conflictTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.couponOff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.couponPick' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.couponPicked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.couponTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.couponUseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·确认订单', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.deliveryExpress' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.deliveryFreeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.deliveryMethod' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·确认订单', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.deliveryPickup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·确认订单', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.deliverySameCity' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.deliverySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.deliveryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.emptyBodyCategory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.emptyBodyKeyword' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.emptyClearSearch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.endLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.goPay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.headSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.headTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.keepShopping' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.listShip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.orderPreparing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.orderReceived' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.orders.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.orders.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.orders.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.ordersLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.ordersTabEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.ordersTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.orderSumLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.paySuccessSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.paySuccessTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpAddCart' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpBackMall' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpBuyNow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpDetailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpStockLeft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'mall.pdpStoreLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.priceNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.pullMore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.rebateLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.receiveConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.receiveConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'mall.reorder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商城', `position` = 'MallPage 页面内文案' WHERE `rule_key` = 'mall.searchPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情 / 客户·商城', `position` = 'ProductDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.soldOut' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.submitOrder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'mall.trackingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·确认订单', `position` = 'CheckoutPage 页面内文案' WHERE `rule_key` = 'mall.viewOrders' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ctaOtherTier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ctaRenew' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ctaRenewFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.frozenTip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.headNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.headTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ledgerBalance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ledgerPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ledgerSettleDay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.ledgerSettleDayValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.perksAllOn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.perksTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.quitLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.quitSheetBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.quitSheetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.remindExpire' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.renewSheetBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.renewSheetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.sheetGotIt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'a3.stampFrozen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'bk.multiPetSlot' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'bk.slotFull' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'bk.slotOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.claimNuanyang' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.claimWeiguang' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.claimYinghuo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.claimZhuguang' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.freePrice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.logo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'card.priceYear' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.actionFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.cancelCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.cancelling' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.entryCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.execNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.expireLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.freeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.freeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.headNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.headTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.nonMemberCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.nonMemberTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.priceFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.priceYear' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.scheduledAtLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.scheduledEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.scheduledLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.scheduledTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.targetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.toastCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.toastOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.windowClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'chg.windowOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'common.memberLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'common.plansLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'common.rebateLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.birthdayDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.birthdayTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.eyebrow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.growthSlotDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.growthTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.manifesto' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.statDays' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.statPhotos' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'f1.statServices' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.alreadyMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.alreadyMemberFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.backMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.compareFooter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.compareLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.compareNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.compareTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ctaAlreadyMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ctaOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ctaOpenFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ctaSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.doneGotoPets' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.estimateNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.freeOpenedBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.freeOpenedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.guideNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ledgerDaily' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ledgerPets' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.ledgerYearly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.perksFollow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.petsIncluded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storeBypass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayBack' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayStep1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayStep2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayStep3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.storePayTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.tierRowPaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'j1.upgradeEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'l1.manifestoA' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'l1.manifestoB' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'l1.manifestoC' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'l1.manifestoEm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'l1.wechatSlot' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'live.stepActive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'live.stepPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.rebateEarnCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.rebateEarnCardNoDay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.rebateEarnCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mall.rebateHook' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'o1.refundTab' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'p1.certSlotTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.archive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.archiveSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.birthday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.birthdaySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.boarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.boardingSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.discount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.discountNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.discountSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.grantedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.groomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.groomerSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindBirthdayOwner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindBirthdayPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindCarePack' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindNewbie' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindServiceDiscount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.kindUpgrade' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.ledgerNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.passTimesLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.pets' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.petsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.rebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.rebateNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.rebateSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.remainLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.renewOff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.skin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.skinSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.unusedEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.unusedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'perk.usedUp' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.codeFooter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.hint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.nonMemberClaim' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.nonMemberCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.nonMemberGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.nonMemberPrice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.passEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.passRemain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.passStoreFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.passTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.passUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.pendingBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.pendingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.refreshNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.tokenFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.tokenRetry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.tokenTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'q1.verifyNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r1Free' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r3Free' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r4' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r5' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r6' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r7' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.r8' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rules.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.discountLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.meSlotNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.noHypeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.rebateLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.rowLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.sheetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.slotTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.totalLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'saved.yearNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'slot.certSoon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'slot.soon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.currentTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.emptyTopTier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.entryCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.expireLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.formulaLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.formulaPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.formulaTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.freeTierGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.headNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.headTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.newPurchaseLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.newPurchaseTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.nonMemberBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.nonMemberCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.nonMemberTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.noteBalance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.noteEffective' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.noteInflight' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.noteNoDowngrade' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.notesTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.paidLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.storeGuideBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.storeGuideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'up.targetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.balanceFrozen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.balanceLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.emptyDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.fallbackTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.logsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.periodLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.ringCenter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.typeClawback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.typeClear' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.typeDeduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.typeFreeze' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.typeGrant' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·Philia 爪 / 客户·付了没开 / 客户·会员中心 / 客户·会员收银台 / 客户·会员码 / 客户·关于 / 客户·到期换档 / 客户·升级会员 / 客户·协议中心 / 客户·发票抬头 / 客户·商品详情 / 客户·商城 / 客户·回馈金 / 客户·开发登录 / 客户·开通会员 / 客户·我的 / 客户·我的券 / 客户·我的预约 / 客户·换绑手机号 / 客户·换绑申诉 / 客户·支付状态 / 客户·收货地址 / 客户·权限与隐私 / 客户·注销账号 / 客户·洗护全程 / 客户·消费记录 / 客户·登录设备 / 客户·确认订单 / 客户·编辑资料 / 客户·设置 / 客户·购物车 / 客户·预约寄养 / 客户·预约洗护', `position` = 'copy 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'w1.yearTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.archiveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.archived' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.archivedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.pinnedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.readCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.readCountNoTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.receiptsCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.list.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.bodyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.bodyPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.pinnedLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.published' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.publishing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.targetAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.targetFrontdesk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.targetGroomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.targetLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.titleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.pub.titlePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:announcements 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'ann.reads.close' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.reads.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.reads.readCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:announcements 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'ann.reads.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·公告', `position` = 'AnnouncementsPage 页面内文案' WHERE `rule_key` = 'ann.reads.unreadCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.boardingStayEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.createGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.detailNotFoundBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.detailNotFoundTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.dualOwnerNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowCancelled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowCheckin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowPaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowServing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowWaitCheckin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.flowWaitPay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioDiscount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioDiscountNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioDiscountPass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioNet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioNotYet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioPaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioPayMode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioPayState' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.folioUnpaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.hintPay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.hintPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.hintReassign' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.hintReview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.hintTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.infoTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.listEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.listSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.listSubAllDates' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.openDetail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.opsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.payDialogBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.payDialogConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.payDialogTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.progressActive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.progressCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.progressDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.progressWait' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'RescheduleSheet 组件内文案' WHERE `rule_key` = 'appt.rescheduleEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.reviewCancelBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thAction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thAmount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thCode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thPetService' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thStaff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约', `position` = 'AppointmentsPage 页面内文案' WHERE `rule_key` = 'appt.thTime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.trailAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.trailEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'appt.verifyCodeHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.agreement' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.devNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.enterCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.gateNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.manifestoA' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.manifestoB' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.seedEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.subtitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'auth.wordmark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.capCalError' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.capCalLoading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.capCalNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.checkinCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.checkinGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:boarding 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'board.checkoutConfirmNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:boarding 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'board.checkoutOverdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:boarding 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'board.checkoutPayNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.detailPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.m3Checkin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.m3Checkout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.m3InStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.m3Overdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.panelAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.roomVacant' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingStayDetail 组件内文案' WHERE `rule_key` = 'board.stayCheckoutLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingStayDetail 组件内文案' WHERE `rule_key` = 'board.stayCheckoutOther' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingStayDetail 组件内文案' WHERE `rule_key` = 'board.stayCheckoutPayStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingStayDetail 组件内文案' WHERE `rule_key` = 'board.stayLogsGap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·寄养', `position` = 'BoardingPage 页面内文案' WHERE `rule_key` = 'board.vaccineNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.adjustNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'BillDetailDialog 组件内文案' WHERE `rule_key` = 'cashier.billRefundDetailLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'BillDetailDialog 组件内文案' WHERE `rule_key` = 'cashier.billReversalNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'BillDetailDialog 组件内文案' WHERE `rule_key` = 'cashier.billReversedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.cartEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.closeShiftConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.closeShiftConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.closeSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.closeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.dayCloseEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.dayCloseFullNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.dayCloseListAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.discountOverNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'HoldPanel 组件内文案' WHERE `rule_key` = 'cashier.flowEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverCashLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverCashPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverComplaintsLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverComplaintsPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverKeysLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverKeysPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverLogEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverLogFromTo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverLogLoadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverLogNoTo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverLogTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverToLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverToPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.handoverWashingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'CashierClosePage 页面内文案' WHERE `rule_key` = 'cashier.handoverWashingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CashierPage 页面内文案' WHERE `rule_key` = 'cashier.headTenderRef' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'HoldPanel 组件内文案' WHERE `rule_key` = 'cashier.holdEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'HoldPanel 组件内文案' WHERE `rule_key` = 'cashier.holdFooter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importClearNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importClearReject' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importConfirmNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importConfirmPost' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importConfirmPre' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'ImportLedgerPanel 组件内文案' WHERE `rule_key` = 'cashier.importMappingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberAlreadyMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.memberDiscountUnknown' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MemberSearch 组件内文案' WHERE `rule_key` = 'cashier.memberNextPlanBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberPaySectionNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberPlansMissing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberRenewCalcNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberRenewNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberRulesNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MemberSearch 组件内文案' WHERE `rule_key` = 'cashier.memberSearchEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.memberStatusNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'OfflineBar 组件内文案' WHERE `rule_key` = 'cashier.offlineBar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'OfflineBar 组件内文案' WHERE `rule_key` = 'cashier.offlineFlushing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'OfflineBar 组件内文案' WHERE `rule_key` = 'cashier.offlinePending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payComboRule' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payGapOver' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payGapUnder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payNextCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payOfflineBar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payPassNoCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payPassNoGroom' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payPassNoMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payPassOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payPassShort' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payRebateCap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payRebateNoProduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payRebateNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payRebateZeroBalance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payRebateZeroDue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.paySuccessBack' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.paySvZeroDue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'PaySheet 组件内文案' WHERE `rule_key` = 'cashier.payTenderNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.priceNewNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'CashierRecordsPage 页面内文案' WHERE `rule_key` = 'cashier.recordsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'CashierRecordsPage 页面内文案' WHERE `rule_key` = 'cashier.recordsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'CashierRecordsPage 页面内文案' WHERE `rule_key` = 'cashier.recordsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundAllocNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundAmountNoRestock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundAnchorNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundBoardingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.refundCrossDayNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundDangerBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.refundDayAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水 / 商家·退款单', `position` = 'RefundDetailDialog 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.refundDraftEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundExecutedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水 / 商家·退款单', `position` = 'RefundDialog 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.refundExecuteNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundNoProductRestock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundOfflineMethod' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水', `position` = 'RefundDialog 组件内文案' WHERE `rule_key` = 'cashier.refundPassCancelNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundPolicyReject' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundPolicyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRejectNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestApproveConfirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestApproveConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestApproveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestRejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestRejectNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestRejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestSlaOverdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestTypeRefundOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundRequestTypeReturnRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsCreateHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsCreateLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundSettleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsGuideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsGuideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsPendingBold' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsPendingTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·退款单', `position` = 'CashierRefundsPage 页面内文案' WHERE `rule_key` = 'cashier.refundsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银流水 / 商家·退款单', `position` = 'RefundDialog 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.refundSvNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.reverseCloseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.reverseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.savingsCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.shiftEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CartPanel 组件内文案' WHERE `rule_key` = 'cashier.stockShort' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.tenderSplitAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.tenderSplitRef' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·日结·交接班', `position` = 'DayClosePanels 组件内文案' WHERE `rule_key` = 'cashier.tenderSplitTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'CashierPage 页面内文案' WHERE `rule_key` = 'cashier.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeBillIdempotent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeBillLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeDiffBase' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeDiffMonthsTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeDiffPet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeDoneTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeFormula' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeModeTab' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeNewPurchaseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeNewPurchaseTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeNoDowngradeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeQuoteLoading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeQuoteTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeSubmitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeSuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台', `position` = 'MembershipPanel 组件内文案' WHERE `rule_key` = 'cashier.upgradeSuccessIdempotent' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·收银台 / 商家·收银流水 / 商家·日结·交接班 / 商家·经营总览 / 商家·退款单', `position` = 'dialogs 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'cashier.voidNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.coexistNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.dangerFrozen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.dangerNoBackdate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.dangerPin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.groupA' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.groupC' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.groupD' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.groupE' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.logAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.logTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.ownerOnlyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.ownerOnlyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portCommission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portCopy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portPendingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portProfile' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portReportSpec' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portSlots' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portStored' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.portXp' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.profileEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.profileEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.pubNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.reportSpecEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.reportSpecEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.storedEmptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·开发者管理端', `position` = 'ConsolePage 页面内文案' WHERE `rule_key` = 'cadm.storedEmptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.appts' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.batchNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.boarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.cashier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.close' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockCashier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockMe' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockMeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockOverview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockReport' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.dockStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.finance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.footConsole' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.footRules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.groupAdmin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.groupBatch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.groupMall' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.groupOps' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.matrix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.monitor' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.ops' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.opsBatch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.opsBatchNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.orders' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.overview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.pass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.payroll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.placeholderBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.placeholderPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.products' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.refunds' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.schedules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.settings' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.staff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wnav.xpAdmin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.alertEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.alertGo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.capCalFull' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.capCalLegend' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.dangerTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:console 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'wsk.folioTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.logEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.matrixLocked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.matrixNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.matrixOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.matrixReadonly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.postcardEyebrow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.postcardMore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.postcardTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.pubDraft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.pubPreview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.pubPush' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.pubRollback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.redline1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.redline2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.redline3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.redline4' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.redlineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工 / 商家·在店监控 / 商家·寄养 / 商家·开发者管理端 / 商家·收银台 / 商家·权限矩阵 / 商家·经营总览 / 商家·财务 / 商家·预约详情', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'wsk.totalSpark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.changedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmHighRiskBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmHighRiskTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmMismatch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.confirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.defaultNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.editCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.editCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.emptyDomain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.filterChanged' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.filterHighRisk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.highRiskBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口 / 商家·槽位端口', `position` = 'CopyConfigPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'copyport.historyBy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.historyEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.historyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.historyVersion' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.keysCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.ownerOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.ownerOnlyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.pendingBar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.positionLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.positionPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.savedToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.saveFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.screenFilterAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.searchPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.unscreenedGroup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·文案端口', `position` = 'CopyConfigPage 页面内文案' WHERE `rule_key` = 'copyport.unscreenedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.liveBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.noLive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.ownerOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.ownerOnlyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.pendingBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.pendingCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.pendingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.placeholderBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.placeholderNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.publishCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.publishedToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.publishFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.revertCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.revertedToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.revertFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.uploadCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.uploadedToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.uploadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.uploading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·槽位端口', `position` = 'SlotPortPage 页面内文案' WHERE `rule_key` = 'slotport.versionInfo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistConfirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistNotePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealAssistSuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealBlockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealCancelCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealCountUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectNotePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectSuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealRejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'PhoneAppealSection 组件内文案' WHERE `rule_key` = 'dash.appealSlaOverdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.approvalEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.approvalListTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceAmountNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceBillLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceBlockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceDeliveryEmail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceDeliveryPickup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceLoadFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceNoPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceNoRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceRegisterCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceRegistering' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceRegisterSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceRegisterSuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceRegisterTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceTaxNoLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceTitleBusiness' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceTitleLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.invoiceTitlePersonal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.m3ChainNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.m3Title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.postcardFigCap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.postcardRowBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.postcardRowOverdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.postcardRowTodo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'InvoiceTodoSection 组件内文案' WHERE `rule_key` = 'dash.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.sparkEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statBoardingEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statCapAppt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statCapBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statCapMode' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statCapRevenue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statModePill' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.statModeValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketBlockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketContactNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketLoadFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketPhotoCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplyPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplyRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplySubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplySubmitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplySuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketReplyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketTypeComplaint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketTypeOther' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketTypePraise' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'TicketTodoSection 组件内文案' WHERE `rule_key` = 'dash.ticketTypeSuggest' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.timelineEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.timelineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todayListTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoAppealHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoAppealLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoCancelHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoCancelLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoInvoiceHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoInvoiceLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoOverdueHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoOverdueLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoOverdueLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoOverdueToday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoOverdueUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoPendingHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoPendingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoRefundRequestHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoRefundRequestLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoTicketHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoTicketLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:dashboard 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'dash.todoUnpaidHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.todoUnpaidLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.totalCap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.totalPaidCell' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营总览', `position` = 'DashboardPage 页面内文案' WHERE `rule_key` = 'dash.totalUnpaidCell' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.capDeduct' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.capPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.capReceived7d' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.capReceivedDay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.capReceivedMonth' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.deductNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.ledgerAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.ledgerEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.ledgerTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:finance 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'fin.pendingEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.refundNetLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.refundStripNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.refundStripTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'fin.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colCashier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colClose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colCopy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colMatrix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colReport' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colReverse' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colRules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colSlots' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colStaff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.colStock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.lockedPill' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteLocked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteMatrix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteMember' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteReport' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteSource' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.noteStock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.roleFront' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.roleGroomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.roleManager' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·权限矩阵', `position` = 'MatrixPage 页面内文案' WHERE `rule_key` = 'mtx.roleOwner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.alertOverdueLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.alertStuckLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'BoardingMonitorPanel 组件内文案' WHERE `rule_key` = 'mon.boardingLogsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.cancelledBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.cancelledTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.eta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.flagBodyActive' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.flagBodyDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.flagBodyReopen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.flagTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.hubBoardingOverdue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.hubEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.hubSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.hubTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.notStartedBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.notStartedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.parentViewAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.parentViewBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.parentViewTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.staffContactNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.staffUnassigned' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.stepsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·在店监控', `position` = 'MonitorHubPage 页面内文案' WHERE `rule_key` = 'mon.stuck' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·服务监控', `position` = 'AppointmentMonitorPage 页面内文案' WHERE `rule_key` = 'mon.wallEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.afterLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.afterPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.approveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.approveDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.approveNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.approveTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.beforeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.beforePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.correctionLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.correctionNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.correctionRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.rejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.rejectDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.rejectNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.rejectNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.rejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.reviewedAtLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.reviewedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.reviewNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.targetMetric' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.targetReview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.common.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.common.confirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.common.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.collapseCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.expandCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.filterAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.fixNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.recheckDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.recheckFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.recheckNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.recheckPass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.statusClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.statusFixing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.statusOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.statusRecheck' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.timelineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.pdca.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.collapseCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.expandCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.filledBy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.itemFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.itemPassed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.reviewCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.reviewDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.scoreLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.self.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.byCategory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.byStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.closed30d' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.emptyCategory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.storeScopeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·运营', `position` = 'OpsPage 页面内文案' WHERE `rule_key` = 'ops.sum.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.emptyAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.emptyPaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.emptyRefunding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.emptySearch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.emptyShipped' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.rebateCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.rebatePendingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商城订单', `position` = 'OrdersPage 页面内文案' WHERE `rule_key` = 'order.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.cardNoCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.dualHomeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.listAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.logsAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.logsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.sellCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statCards' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statPass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statPassSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statPendingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statRebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.statSv' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.threeBooksNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.tierNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.topUpCustomerHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·会员 · 次卡', `position` = 'PassPage 页面内文案' WHERE `rule_key` = 'pass.topUpTimesHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.approveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.approved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.approveNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.approveTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.collapseCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.evidenceLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.expandCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.filterAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.kindAdjustment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.kindDeduction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.kindSlipLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.monthLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.refundInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.refundLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.refundLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.refundPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.rejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.rejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.reviewLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.targetAmountLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.addCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.cancelEdit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.editCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.mainNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.readonlyNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.removeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.roleAssist' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.roleGroom' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.roleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.roleWash' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.splitInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.splitLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.staffPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.sumLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·预约详情', `position` = 'CollabSplitSection 组件内文案' WHERE `rule_key` = 'payroll.collab.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.common.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.common.confirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资 / 商家·预约详情', `position` = 'PayrollPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'payroll.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资 / 商家·预约详情', `position` = 'PayrollPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'payroll.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.common.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.amountInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.amountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.amountPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.created' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.monthLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.revertedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.revertLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.staffLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.staffPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.ded.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colAction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colAdjustment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colCommission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colDeduction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colDisburse' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colNet' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colPerformance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.colStaff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.confirmCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.confirmed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.confirming' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.disbursedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.generateCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.generated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.generating' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markedByLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.markTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.methodNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.monthLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.statusConfirmed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.statusGenerated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·薪资', `position` = 'PayrollPage 页面内文案' WHERE `rule_key` = 'payroll.slip.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.createCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvAllOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvClose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvExecuteCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvFileCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvImportTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvNoFile' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvPreviewCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvSummary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.csvTemplateCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.dailyCountCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.dailyCountNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.dailyCountYes' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.subFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·商品', `position` = 'ProductsPage 页面内文案' WHERE `rule_key` = 'prod.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.amortCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.amortSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.byDayTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.cashCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.cashSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.guestLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.memberLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.memberShareTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.momLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.noBase' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.nonCashNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d1.yoyLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d2.attachCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d2.attachSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d2.tableTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d3.active90Card' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d3.active90Sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d3.activeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d3.byPlanTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d3.newCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d4.deductedCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d4.grantedCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d4.remainCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d4.stockSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d4.trendTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d5.consumeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d5.liabilityCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d5.prepaidRow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d5.rechargeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.amountCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.byTypeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.countCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.linkedBad' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.reasonTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.rejectCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.rejectSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.spikeNa' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.spikeOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d6.spikeWarn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d7.tableTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.attachCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.nightsCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.occCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.occSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.overdueCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d8.perNightCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.byProductTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.ordersSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.salesCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.sellThroughCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.turnoverCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.d9.unitsCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.dirAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD4' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD5' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD6' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD7' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD8' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirD9' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.dirEmbedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN4' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN5' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN6' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN7' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表 / 商家·财务', `position` = 'ReportPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'rpt.dirN8' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.dirNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.dirTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev4' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev5' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev6' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev7' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev8' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.ev9' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.eventsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.intro' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.outNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.statsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.embed.statsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.ledgerAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.ledgerTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.monthCloseNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.cohortTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.downgradeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.exitCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.newTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.stockTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.upDownSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n1.upgradeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.cohortTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.paybackCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.paybackDetailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.paybackSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.warnEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n2.warnTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n3.closingCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n3.redeemCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n3.redeemSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n3.rollNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n3.rollTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.avgCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.badRateCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.byServiceTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.byStaffTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.correctedRow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.distTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.minutesVal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.recentAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.recentEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.recentTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.repliedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyRateCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replySubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyTagsLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.replyTimeCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n4.tagTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.actualCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucket120' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucket30' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucket5' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucketOver' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucketsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.bucketUnread' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.completedCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.photoCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.photoSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.sampleCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n5.stdCard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.gateTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.queueEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.queueGo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.queueTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.n6.tableTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.actionFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.backToDir' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.exportCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.exportDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.exportFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.exporting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:report 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'rpt.page.exportOwnerOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.loadError' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.monthLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.noteLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·经营报表', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'rpt.page.unknown' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadRebate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadRebateSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadRefundCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadRevenue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadStored' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadStoredSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadYesterday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadYesterdayClose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadYesterdayNoClose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.quadYesterdaySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.sparkNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.sparkTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·财务', `position` = 'FinancePage 页面内文案' WHERE `rule_key` = 'rpt.threeBooksNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.caliberNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.confirmDanger' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.confirmHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.confirmPhrase' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.confirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.discountHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.errorHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.noticeDuration' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.noticeMemberPlans' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.noticeRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.splitNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.versionsAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.versionsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.warnCommission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.warnDuration' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.warnMemberPlans' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.warnRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·规则配置管理', `position` = 'RulesConfigPage 页面内文案' WHERE `rule_key` = 'rules.warnXp' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.block.draft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.block.dragHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.block.manual' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.block.published' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.block.template' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班 / 商家·排班管理', `position` = 'MySchedulePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sched.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班 / 商家·排班管理', `position` = 'MySchedulePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sched.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.drop.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.drop.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.generateCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.generating' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.publishCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.published' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.publishing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.gen.publishNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.colDate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.colLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.colRange' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.colResult' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.colStaff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.executeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.executed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.previewCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.rowOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.summary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.import.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.skill.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.skill.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.skill.noTags' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.skill.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.skill.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.approve' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:schedule 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sched.swap.noQueue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:schedule 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sched.swap.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.openTarget' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.reject' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.resolved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.swap.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（merchant:schedule 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sched.tpl.days' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.deactivate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.deactivated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.namePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.tpl.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.draft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.next' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.prev' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.published' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.week.staffCol' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班 / 商家·排班管理', `position` = 'MySchedulePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sched.week.this' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.wifi.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·排班管理', `position` = 'ScheduleManagePage 页面内文案' WHERE `rule_key` = 'sched.wifi.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.addrHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.autoAcceptHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entriesAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryAnnouncements' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryAnnouncementsHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryCopy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryCopyHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryGo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entrySchedules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entrySchedulesHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entrySlots' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entrySlotsHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryTasks' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.entryTasksHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.hoursHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.noStoreHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.noStoreTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyBoardingHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyBoardingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyCancelHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyCancelLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyNewHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.notifyNewLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.panelEntries' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.panelPorts' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.panelRules' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.panelStore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.portBornNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.portsAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.servicesEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.servicesHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.servicesOffNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·设置', `position` = 'SettingsPage 页面内文案' WHERE `rule_key` = 'set.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.attFlagged' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.attNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'EditStaffDialog 组件内文案' WHERE `rule_key` = 'staff.editRoleHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'EditStaffDialog 组件内文案' WHERE `rule_key` = 'staff.editSkillNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'EditStaffDialog 组件内文案' WHERE `rule_key` = 'staff.editSuspendNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.exitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitDialogTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitHandoffKindAppointment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitHandoffPrevNext' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitHandoffsEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitHandoffsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitMemberNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitNoCandidates' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitNoTarget' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitReassigned' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitReassignHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitReassigning' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitReassignSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitReassignTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ExitHandoffDialog 组件内文案' WHERE `rule_key` = 'staff.exitToStaffPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'InviteStaffDialog 组件内文案' WHERE `rule_key` = 'staff.inviteCodeOnce' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.inviteCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'InviteStaffDialog 组件内文案' WHERE `rule_key` = 'staff.inviteGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'InviteStaffDialog 组件内文案' WHERE `rule_key` = 'staff.inviteNameHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.panelAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.permBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.permLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.permTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'ScheduleEditorDialog 组件内文案' WHERE `rule_key` = 'staff.scheduleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.sub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.suspendedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·员工', `position` = 'StaffPage 页面内文案' WHERE `rule_key` = 'staff.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.cancelEdit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.detailLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.detailPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.dueLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.freqDaily' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.freqLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.freqWeekly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.remindLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.remindPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.roleFrontdesk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.roleGroomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.scopeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.scopeRole' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.scopeStaff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.staffPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.titleEdit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.titleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.titleNew' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.form.titlePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.deactivateCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.deactivated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.dueLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.editCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.freqDailyLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.freqWeeklyLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.inactiveBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.remindLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.scopeRoleLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.scopeStaffLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.list.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.colDate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.colDoneBy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.colStatus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.colTemplate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.statusDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.statusMissed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·任务模板', `position` = 'TaskTemplatesPage 页面内文案' WHERE `rule_key` = 'tasktpl.runs.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.award.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.award.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.award.pointsLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.award.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.common.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.common.confirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.common.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.common.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.common.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.guideHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.guideTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.kindAward' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.kindRevoke' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.reviewedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.reviewLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.history.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.pageSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.pageTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.appliedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.approveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.approved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.approveTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.noteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.rejectCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.review.rejectTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.hedgeNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.originalLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.pointsLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '商家·XP 审核', `position` = 'XpAdminPage 页面内文案' WHERE `rule_key` = 'xpadmin.revoke.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.allTab' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.catAccount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.catMarketing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.catService' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.catTrade' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.delete' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.deleteConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.deleted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息 / 客户·订阅管理', `position` = 'NotifyCenterPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ntf.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.loadMore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.mandatoryDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.mandatoryLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.mandatoryNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.markAllRead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.marketingDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.marketingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.offToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.onToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·订阅管理', `position` = 'NotifyPrefsPage 页面内文案' WHERE `rule_key` = 'ntf.prefsHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息 / 客户·订阅管理', `position` = 'NotifyCenterPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ntf.prefsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（notify 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'ntf.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的 / 客户·消息 / 客户·首页', `position` = 'MePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ntf.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消息', `position` = 'NotifyCenterPage 页面内文案' WHERE `rule_key` = 'ntf.unreadTab' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.member_service' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.no_auto_renew' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约寄养', `position` = 'NoteFoldBlock 组件内文案' WHERE `rule_key` = 'agreement.not_prepaid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.agreeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.agreementGotIt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.agreementSheetNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.agreeMissing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.agreeTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.alreadyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.alreadyBodyFree' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.alreadyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.alreadyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（pay 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'checkout.amountExtra' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.amountPlan' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（pay 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'checkout.amountTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.amountTotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.channelOffBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.channelOffCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.channelOffTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台 / 客户·支付状态', `position` = 'MemberCheckoutPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'checkout.createFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.freePlanBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.freePlanCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.freePlanTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.headNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.missingPlanBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.missingPlanCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.missingPlanTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.payCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petCountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petCountValue' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petExtra' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petIncludedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petMinus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.petPlus' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.planLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.planPriceYear' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.quoteFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.timeoutNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台', `position` = 'MemberCheckoutPage 页面内文案' WHERE `rule_key` = 'checkout.validity' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·会员收银台 / 客户·支付状态', `position` = 'MemberCheckoutPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'mock.watermark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'payStatus.closed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'payStatus.created' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'payStatus.failed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'payStatus.paid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'payStatus.paying' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.btn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.doing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.empty1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.empty2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.empty3' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.hint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.success' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·付了没开', `position` = 'PayReconcilePage 页面内文案' WHERE `rule_key` = 'reconcile.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.amountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.closedHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.closedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.createdBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.createdTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.failedTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.failHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockDemoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockDrop' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockFailToast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockSuccess' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockTimeout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.mockWorking' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.orderNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.paidBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.paidCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.paidTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.payingBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.payingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.planLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.reconcileEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.reorder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·支付状态', `position` = 'PayStatePage 页面内文案' WHERE `rule_key` = 'state.retrying' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.addCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.chipNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.chipNoPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.coatColorLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.coatColorPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.healthEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.historyCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.historyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.rebook' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'ActivePetSwitcher 组件内文案' WHERE `rule_key` = 'pets.switcherAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'ActivePetSwitcher 组件内文案' WHERE `rule_key` = 'pets.switcherFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'ActivePetSwitcher 组件内文案' WHERE `rule_key` = 'pets.switcherSingleNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'ActivePetSwitcher 组件内文案' WHERE `rule_key` = 'pets.switcherTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineExpired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineNone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineProofAdd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineProofCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineProofNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineProofTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'pets.vaccineSoon' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.anonymous' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（productReviews 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'rev.anonymousName' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.more' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.needReceived' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单', `position` = 'MallOrdersPage 页面内文案' WHERE `rule_key` = 'rev.orderEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.photoAdd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.photoLimit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.ratingLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.sheetTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.summary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.textPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.toastOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品详情', `position` = 'ProductDetailPage 页面内文案' WHERE `rule_key` = 'rev.writeCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.avatarChange' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.avatarLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.birthdayLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.genderFemale' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.genderLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.genderMale' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.genderSecret' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的 / 客户·设置', `position` = 'MePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'profile.meEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的 / 客户·设置', `position` = 'MePage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'profile.meEntrySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.nicknameLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.nicknamePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.nicknameRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.save' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.saveFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.saveOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.saving' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.uploadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·编辑资料', `position` = 'ProfileEditPage 页面内文案' WHERE `rule_key` = 'profile.uploading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depHeld' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depHeldAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depositEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depositNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depositTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depRefunded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depRefundedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depRefunding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.depRefundReqAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.kindInvoice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.kindOrder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.kindPay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'rec.meEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'rec.meEntrySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.pushLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·消费记录', `position` = 'RecordsPage 页面内文案' WHERE `rule_key` = 'rec.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款详情', `position` = 'RefundApplyPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.amountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.appointmentNoBill' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.backToOrigin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.backToRefunds' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.cancelConfirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.cancelCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.cancelDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.descPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.detailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款/售后', `position` = 'RefundListPage 页面内文案' WHERE `rule_key` = 'refund.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款/售后', `position` = 'RefundListPage 页面内文案' WHERE `rule_key` = 'refund.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款/售后', `position` = 'RefundListPage 页面内文案' WHERE `rule_key` = 'refund.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·预约详情', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.entryCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'refund.entryHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.formTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.freeRegretNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.inflightNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款/售后', `position` = 'RefundListPage 页面内文案' WHERE `rule_key` = 'refund.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后', `position` = 'RefundApplyPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·申请退款 / 客户·预约详情', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.maintainNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.notFound' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.orderNotRefundable' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.originNotFound' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.originTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.originTotalLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.partialNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.photoCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·预约详情', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.progressCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款详情', `position` = 'RefundApplyPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.reasonLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.reasonPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.refundableLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.refundedSoFarLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.refundNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.rejectedLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.requestNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.slaNotice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.cancelled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.processing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.refunding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.settled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.status.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.submitDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.submitHintNoReason' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·退款详情', `position` = 'RefundDetailPage 页面内文案' WHERE `rule_key` = 'refund.timelineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.timingBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.timingTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.typeRefundOnly' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款 / 客户·退款/售后 / 客户·退款详情', `position` = 'common 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.typeReturnRefund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·申请退款', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'refund.viewProgressCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请退款', `position` = 'RefundApplyPage 页面内文案' WHERE `rule_key` = 'refund.voucherHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.inProgressNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'album.meEntrySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'album.meEntryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.petFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'album.petsEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书 / 客户·服务相册', `position` = 'CertListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'album.photoAlt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.serviceFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.shareCopied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.shareCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.shareText' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.shareTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·服务相册', `position` = 'MomentsPage 页面内文案' WHERE `rule_key` = 'album.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.backList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.brandMark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.cardTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'cert.detailEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertListPage 页面内文案' WHERE `rule_key` = 'cert.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertListPage 页面内文案' WHERE `rule_key` = 'cert.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertListPage 页面内文案' WHERE `rule_key` = 'cert.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·宠物档案', `position` = 'PetsPage 页面内文案' WHERE `rule_key` = 'cert.entryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertListPage 页面内文案' WHERE `rule_key` = 'cert.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.stepPhotos' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·安心证书', `position` = 'CertDetailPage 页面内文案' WHERE `rule_key` = 'cert.traceLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情', `position` = 'InvoiceDetailPage 页面内文案' WHERE `rule_key` = 'inv.amountLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.amountLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情', `position` = 'InvoiceDetailPage 页面内文案' WHERE `rule_key` = 'inv.appliedAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·预约详情', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.applyEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.applyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.backList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.billNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.billNotFound' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.billSummaryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.cashierUnsupported' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.deliveryEmail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.deliveryLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.deliveryPickup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情', `position` = 'InvoiceDetailPage 页面内文案' WHERE `rule_key` = 'inv.detailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.emailInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.emailLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.emailPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的发票', `position` = 'InvoiceListPage 页面内文案' WHERE `rule_key` = 'inv.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的发票', `position` = 'InvoiceListPage 页面内文案' WHERE `rule_key` = 'inv.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的发票', `position` = 'InvoiceListPage 页面内文案' WHERE `rule_key` = 'inv.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.honestLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情', `position` = 'InvoiceDetailPage 页面内文案' WHERE `rule_key` = 'inv.issuedAtLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情', `position` = 'InvoiceDetailPage 页面内文案' WHERE `rule_key` = 'inv.issuedNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.kindAppointment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.kindCashier' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.kindOrder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的发票', `position` = 'InvoiceListPage 页面内文案' WHERE `rule_key` = 'inv.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·商品订单 / 客户·预约详情', `position` = 'MallOrdersPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.progressEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.statusIssued' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·我的发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.statusSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.store' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.taxNoLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.taxNoPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.taxNoRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.titleBusiness' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.titleLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.titlePersonal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.titlePlaceholderBusiness' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.titlePlaceholderPersonal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·申请发票', `position` = 'InvoiceApplyPage 页面内文案' WHERE `rule_key` = 'inv.titleRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·发票详情 / 客户·申请发票', `position` = 'InvoiceDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inv.titleTypeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.abnormalTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·预约详情', `position` = 'AppointmentDetailPage 页面内文案' WHERE `rule_key` = 'report.detailEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.nextAdviceTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.notRecorded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.promiseLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.statusAbnormal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.statusAttention' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.statusNormal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.statusUnrecorded' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.traceLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalCoat' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalEar' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalNail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalSkin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalsTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·美容报告', `position` = 'ReportPage 页面内文案' WHERE `rule_key` = 'report.vitalWeight' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.backList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.contactLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.contactPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.descLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.descPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.descRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.detailTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服', `position` = 'TicketListPage 页面内文案' WHERE `rule_key` = 'ticket.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服', `position` = 'TicketListPage 页面内文案' WHERE `rule_key` = 'ticket.emptyCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服', `position` = 'TicketListPage 页面内文案' WHERE `rule_key` = 'ticket.emptyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateCancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalatedAtLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalatedBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateNoteLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateNotePlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateNoteTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateSubmit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.escalateTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.hoursLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.hoursTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服', `position` = 'TicketListPage 页面内文案' WHERE `rule_key` = 'ticket.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'ticket.meEntrySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'ticket.meEntryTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.newTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.photoAdd' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.photoRemove' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.photosLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.replyTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.statusClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.statusEscalated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.statusReplied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.statusSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.storeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.storeRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.submitFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情 / 客户·联系小棉花', `position` = 'TicketDetailPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.timelineClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.timelineEscalated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.timelineReplied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.timelineSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·工单详情', `position` = 'TicketDetailPage 页面内文案' WHERE `rule_key` = 'ticket.timelineTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情 / 客户·联系小棉花', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.typeComplaint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·联系小棉花', `position` = 'TicketNewPage 页面内文案' WHERE `rule_key` = 'ticket.typeLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情 / 客户·联系小棉花', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.typeOther' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情 / 客户·联系小棉花', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.typePraise' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '客户·小棉花客服 / 客户·工单详情 / 客户·联系小棉花', `position` = 'TicketListPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'ticket.typeSuggest' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（serviceloop 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'ticket.uploadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.appeal.cta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.appeal.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.appeal.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.appeal.toast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.confirm.cta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.confirm.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.confirm.toast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.confirmed.chip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.fence.noCoord' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.fence.range' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.field.ready' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.field.tip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.field.upload' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.field.uploading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.geo.denied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.geo.failed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.geo.timeout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.geo.unsupported' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.offline.banner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.offline.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.punch.allDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.punch.busy' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.punch.doneIn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.punch.doneOut' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.flagged' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.in' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.makeupPassed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.missing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.missingHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.records.out' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.shift.line' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.shift.none' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.source.field' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.source.offline' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.status.early' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.status.late' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.status.makeup' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.status.normal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.today.detail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.week.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.wifi.manual' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.wifi.none' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'attendance.wifi.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.backToday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.cancelled.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.cancelled.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.cancelRequested.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.action' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.confirm' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.confirmDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.confirmTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.checkout.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.completed.banner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.error.fallbackDesc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.error.notBoarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.error.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.night.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.night.mid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.night.tail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.overdue.dueLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.overdue.dueTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.overdue.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.preCheckin.action' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.preCheckin.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.preCheckin.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·寄养打卡', `position` = 'BoardingCheckinPage 页面内文案' WHERE `rule_key` = 'boarding.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'exec.draft.banner' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'exec.draft.discard' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'exec.draft.localNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'exec.draft.restore' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecuteStepper 组件内文案' WHERE `rule_key` = 'exec.photo.onsiteNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.advice.label' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.advice.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.delivery' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.note.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.status.abnormal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.status.attention' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.status.normal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.vital.coat' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.vital.ear' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.vital.nail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.vital.skin' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.vital.weight' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ReportCard 组件内文案' WHERE `rule_key` = 'exec.report.weight.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.boarding.action' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.boarding.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.boarding.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.cancelled.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.cancelled.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.cancelRequested.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.completed.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.completed.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.forbidden.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.forbidden.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.loadFailed.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.noCurrent.action' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.noCurrent.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.noCurrent.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notCheckedIn.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notCheckedIn.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notFound.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notFound.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notInitialized.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·服务执行', `position` = 'ExecutePage 页面内文案' WHERE `rule_key` = 'execute.guide.notInitialized.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.boarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.cancelled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.confirmed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.future' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.minutes' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.nights' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.now' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.axis.rating' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.clock.noShift' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.clock.shift' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.dayFoot.past' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:history 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'history.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'history.loadFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.aside.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.actualStock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.backList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.backListPlain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.blindNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.counted.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.counted.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.diffGain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.diffLoss' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.diffSame' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.execSuffix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.fallbackTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.guide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.inputPlaceholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.itemsAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.missing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.noItems' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.productFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.rejected.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.rejected.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.submitAgain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.submitNeedAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.submitPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.submitSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·盘点执行', `position` = 'InventoryCountPage 页面内文案' WHERE `rule_key` = 'inventory.count.systemStock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.expired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.leftLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.leftTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.stock' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.expiry.until' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.list.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.load.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存 / 员工·盘点执行', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inventory.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.status.counted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.status.draft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.status.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.task.countLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.task.countTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.task.created' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.task.rejectedEditable' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存', `position` = 'InventoryPage 页面内文案' WHERE `rule_key` = 'inventory.tasks.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存 / 员工·盘点执行', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'inventory.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.accounts.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.agreement' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.gate.hint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.gate.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.gate.required' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.gate.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.gateEntry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.loggedIn.enter' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.loggedIn.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.loggedIn.logout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.manifesto.line1' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.manifesto.line2' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.manual.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.primaryCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.role.frontdesk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.role.groomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.seed.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.seed.loadFailed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.seed.tip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.storeLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·开发登录', `position` = 'DevLoginPage 页面内文案' WHERE `rule_key` = 'login.wordmark' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.approve' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.counted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.dayclose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.movements' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.refundPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.aside.reviews' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.attendance.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.attendance.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.cancel.approve' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.cancel.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.guide.back' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.guide.desc' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.guide.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.inventory.countedEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.inventory.countedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.inventory.postedEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.loading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.movements.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.refund.draftNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.refund.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.refund.listNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.refund.pendingNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.reject' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.reviews.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.attendance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.dayclose' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.flagged' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.inventory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.movements' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.posted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.refund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.sec.reviews' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·店长台', `position` = 'ManagerPage 页面内文案' WHERE `rule_key` = 'manager.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.groupCollab' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.help.flowBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.help.flowTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.help.specBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.help.specTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.idcard.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.joined' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.myReviews' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.myReviewsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.offDuty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.onDuty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.reviewMonthLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:me 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'me.reviewSummary' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.reviewSummaryAvg' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:me 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'me.reviewSummaryLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.reviewSummaryUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.boarding' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.boardingSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.help' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.helpSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.inventory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.inventorySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.loggingOut' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.logout' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.manager' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.managerSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.notices' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.noticesSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.notifications' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.notificationsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.pay' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.paySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.pdca' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.pdcaSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.schedule' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.selfCheck' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.selfCheckSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.settings' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.settingsSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.voice' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.voiceSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.xp' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.row.xpSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.settings.sync' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.stat.boardingLogs' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.stat.done' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.stat.goodRate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'me.version' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.badgeRead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.badgeUnread' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.pinned' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·门店公告', `position` = 'NoticesPage 页面内文案' WHERE `rule_key` = 'ntc.unreadLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.markAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.markAllDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·通知', `position` = 'NotificationsPage 页面内文案' WHERE `rule_key` = 'snt.unreadLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.aside.frozen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.aside.realtime' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.deductions.creatorLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.deductions.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.deductions.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.empty.default' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.empty.product' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.empty.service' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.footer.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.expand' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.kind.commission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.kind.perf' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.loading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.quarterTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.history.settled' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.line.base' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.line.billNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.line.overwork' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.line.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.line.probation' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.load.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.base' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.coeff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.estimateLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.estimateTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.grade' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.na' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.noGrade' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.perf.quarterTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.pool.frontdesk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.pool.groomer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.probation.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.card' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.deductions' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.history' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.perf' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.product' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.service' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.store' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.sec.subtotal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.snap.commission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.snap.perf' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.snap.product' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.snap.service' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.snap.store' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.total.label' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.trio.card' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.trio.product' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'pay.trio.service' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.adjust.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.adjust.sourceLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.photoCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.photoFull' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.reasonRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.refundLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.reviewLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.slaNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.target.adjustment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.target.deduction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.appeals.target.slipLine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.deduction.appeal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.deduction.reverted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.line.splitLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.refund.row' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:payroll 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'prl.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.sec.myAppeals' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.sec.refund' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.sec.slip' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.adjustment' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.appeal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.commission' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.deduction' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.marked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.markNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.netLabel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.performance' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.slip.unmarked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.track.labor' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.track.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的工资', `position` = 'PayPage 页面内文案' WHERE `rule_key` = 'prl.track.sales' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.categoryPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.detailPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.fixNotePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.fixNoteRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.fixStarted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.fixSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.listTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.mine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.photoCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.photoFull' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.raiseTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.startFix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.submitFix' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.tabAll' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.tabClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.tabFixing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.tabOpen' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.tabRecheck' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.titlePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·问题上报', `position` = 'PdcaPage 页面内文案' WHERE `rule_key` = 'pdc.titleRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.anonymous' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.cta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.duplicated' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.placeholder' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.required' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.appeal.toast' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.aside.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.aside.tail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.callbackNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.customer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.footer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.load.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.loading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.more' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.noText' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.starUnit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:reviews 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'reviews.summary.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:reviews 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'reviews.summary.tail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.trio.avg' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.trio.bad' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的评价', `position` = 'MyReviewsPage 页面内文案' WHERE `rule_key` = 'reviews.trio.count' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.saveCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.saved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.avail.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.comp.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.comp.entries' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.comp.hours' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.comp.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.approved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.end' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.kindCompOff' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.kindLeave' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.myList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.pending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.rejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.start' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.leave.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'sched.meFullLink' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.myweek.draft' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:schedule 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sched.myweek.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.myweek.next' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.myweek.prev' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.myweek.published' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.cta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.invalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.openPool' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.pickTarget' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.submitCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.swap.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.week.mine' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的排班', `position` = 'MySchedulePage 页面内文案' WHERE `rule_key` = 'sched.week.rest' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.aside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.auditApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.auditPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.auditRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.doneTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.emptyBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.notePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.pass' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.photoCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.photoOn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.score' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·每日自检', `position` = 'SelfCheckPage 页面内文案' WHERE `rule_key` = 'sck.unmarked' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptGap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptHistoryNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.apptTomorrowNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声 / 员工·寄养打卡 / 员工·工位 / 员工·库存 / 员工·店长台 / 员工·开发登录 / 员工·我的 / 员工·我的 XP / 员工·我的工资 / 员工·我的排班 / 员工·我的评价 / 员工·打卡 / 员工·每日自检 / 员工·盘点执行 / 员工·通知 / 员工·门店公告 / 员工·问题上报 / 员工·预约', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.back' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.busPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.dayFoot' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声 / 员工·寄养打卡 / 员工·工位 / 员工·库存 / 员工·店长台 / 员工·开发登录 / 员工·我的 / 员工·我的 XP / 员工·我的工资 / 员工·我的排班 / 员工·我的评价 / 员工·打卡 / 员工·每日自检 / 员工·盘点执行 / 员工·通知 / 员工·门店公告 / 员工·问题上报 / 员工·预约', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.dockAppt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声 / 员工·寄养打卡 / 员工·工位 / 员工·库存 / 员工·店长台 / 员工·开发登录 / 员工·我的 / 员工·我的 XP / 员工·我的工资 / 员工·我的排班 / 员工·我的评价 / 员工·打卡 / 员工·每日自检 / 员工·盘点执行 / 员工·通知 / 员工·门店公告 / 员工·问题上报 / 员工·预约', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.dockMe' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声 / 员工·寄养打卡 / 员工·工位 / 员工·库存 / 员工·店长台 / 员工·开发登录 / 员工·我的 / 员工·我的 XP / 员工·我的工资 / 员工·我的排班 / 员工·我的评价 / 员工·打卡 / 员工·每日自检 / 员工·盘点执行 / 员工·通知 / 员工·门店公告 / 员工·问题上报 / 员工·预约', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.dockPunch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声 / 员工·寄养打卡 / 员工·工位 / 员工·库存 / 员工·店长台 / 员工·开发登录 / 员工·我的 / 员工·我的 XP / 员工·我的工资 / 员工·我的排班 / 员工·我的评价 / 员工·打卡 / 员工·每日自检 / 员工·盘点执行 / 员工·通知 / 员工·门店公告 / 员工·问题上报 / 员工·预约', `position` = 'skeleton 组件内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.dockWork' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.idleBody' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.idleTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.meGroupA' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.meGroupB' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'sk.meNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的', `position` = 'MePage 页面内文案' WHERE `rule_key` = 'sk.meTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.nextEmpty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.nextTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.offDuty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.onDuty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.pickDate' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.punchAgain' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.punchDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchFixNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchIn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.punchInFence' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchOut' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:skeleton 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'sk.punchOutFence' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·打卡', `position` = 'AttendancePage 页面内文案' WHERE `rule_key` = 'sk.punchWeek' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.queueTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.stepDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位 / 员工·预约', `position` = 'TodayPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.stepNow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位 / 员工·预约', `position` = 'TodayPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.stepTodo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·库存 / 员工·预约', `position` = 'InventoryPage 页面内文案（跨屏共用件，各屏组同列）' WHERE `rule_key` = 'sk.today' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.tomorrow' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioApproval' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioApprovalSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioInventory' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioInventorySub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioPunch' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.trioPunchSub' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.workCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.workCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.workCtaStart' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.workNo' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'sk.workTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·预约', `position` = 'SchedulePage 页面内文案' WHERE `rule_key` = 'sk.yesterday' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.doing' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.doneAt' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.doneCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.doneOk' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.due' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.statusDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'ttd.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.groupDone' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.groupPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.pendingCount' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.scanCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.scanHint' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.stats' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.frontdesk.tag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = NULL, `position` = '未在页面调用点命中（staff:today 域键表，端口运营复核挂载屏）' WHERE `rule_key` = 'today.groomer.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.noRole.bodyGuide' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.noRole.bodyLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.noRole.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.todo.boardingCareCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.todo.boardingIn' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.todo.boardingInCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.todo.reschedule' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·工位', `position` = 'TodayPage 页面内文案' WHERE `rule_key` = 'today.todo.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.descPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.descRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.formAside' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.formTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.myList' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.no' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.phonePh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.photoCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.photoFull' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.replyLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.slaNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.statusClosed' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.statusReplied' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.statusSubmitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·员工心声', `position` = 'VoicePage 页面内文案' WHERE `rule_key` = 'vce.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.appealCta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.appealReasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.appealTitle' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.cancel' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.cta' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.kindAppeal' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.kindAward' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.pointsInvalid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.pointsLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.pointsPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.reasonPh' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.reasonRequired' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.resolvedNote' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.reviewLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.sec.list' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.statusApproved' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.statusPending' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.statusRejected' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.submit' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.submitted' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.submitting' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.app.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.aside.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.badge.thresholdLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.board.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.board.note' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.board.self' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.billLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.boardingLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.boardingTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.droppedTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.empty' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.learningTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.loading' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.events.more' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.footer' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.level.gapLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.level.gapMid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.level.gapTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.level.max' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.load.fail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.retention.lead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.retention.mid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.retention.none' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.retry' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.disabledFallback' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.footCap' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.footExamMid' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.footExamTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.footReview' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.learningTag' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.rules.loadFail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.sec.badges' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.sec.board' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.sec.events' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.sec.today' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.title' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.today.capLead' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.today.capTail' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.today.fullBadge' AND `screen` IS NULL;
--> statement-breakpoint
UPDATE `copy_overrides` SET `screen` = '员工·我的 XP', `position` = 'XpPage 页面内文案' WHERE `rule_key` = 'xp.today.fullHint' AND `screen` IS NULL;
