-- 客户端体验大批片 2：copy_overrides 增量种子（预约链路新增 ${delta.length} 键随批注册+seed 补种键 booking.fullAlternativesNote 一并在内；片 B 纪律=新键随批注册进端口表）
-- 幂等：rule_key active 行 NOT EXISTS 守卫（存量库只补差、重放零副作用）；created_by='system'
-- （迁移执行器 PRAGMA foreign_keys=OFF，惯例见 migrate.ts 头注）。
-- 生成件=scripts/gen-copy-overrides-seed.mts 重跑产物（server/src/db/copySeedRows.ts 同帧）。
WITH s(rule_key, label, text) AS (VALUES
  ('agreement.agreeCta', 'agreement', '已阅读并同意'),
  ('agreement.agreeLabel', 'agreement', '我已阅读并同意'),
  ('agreement.boarding_consent', 'agreement', '《寄养服务协议》'),
  ('agreement.medical_auth', 'agreement', '《医疗授权书》'),
  ('agreement.versionNote', 'agreement', '版本 {version}'),
  ('appointments.addonsTitle', 'appointments', '附加项'),
  ('appointments.cancelFeeNote', 'appointments', '以上为公示口径，暂不实际扣款'),
  ('appointments.cancelFeeTitle', 'appointments', '取消阶梯收费公示'),
  ('appointments.emergencyContact', 'appointments', '紧急联系人'),
  ('appointments.medicalAuthLabel', 'appointments', '医疗授权'),
  ('appointments.medicalAuthSigned', 'appointments', '已签署（{version}）'),
  ('appointments.prepaidDeducted', 'appointments', '已核销抵扣'),
  ('appointments.prepaidLabel', 'appointments', '预付台账'),
  ('appointments.prepaidPending', 'appointments', '预付登记中'),
  ('appointments.prepaidRefunded', 'appointments', '已退还'),
  ('appointments.prepaidRegistered', 'appointments', '已预付'),
  ('appointments.rescheduleHistory', 'appointments', '改约历史'),
  ('appointments.rescheduleRoleCustomer', 'appointments', '客户自助'),
  ('appointments.rescheduleRoleMerchant', 'appointments', '门店改期'),
  ('appointments.walkTimes', 'appointments', '每日遛弯 {n} 次'),
  ('booking.addonPriceNote', 'booking', '合计含附加项，最终金额以门店结算为准'),
  ('booking.addonSummary', 'booking', '已选 {count} 项'),
  ('booking.addonSummaryNone', 'booking', '选加附加项'),
  ('booking.addonTitle', 'booking', '附加项（选加）'),
  ('booking.ecIncomplete', 'booking', '请补全紧急联系人信息'),
  ('booking.ecNamePh', 'booking', '联系人姓名'),
  ('booking.ecPhoneInvalid', 'booking', '请输入 11 位手机号'),
  ('booking.ecPhonePh', 'booking', '11 位手机号'),
  ('booking.ecRelationPh', 'booking', '关系，如：家人'),
  ('booking.emergencyTitle', 'booking', '紧急联系人（建议填写）'),
  ('booking.fullSlotFallback', 'booking', '当日已约满，可改选其他日期或门店'),
  ('booking.needBoardingConsent', 'booking', '请阅读并勾选寄养协议'),
  ('booking.needMedicalAuth', 'booking', '请阅读并勾选医疗授权'),
  ('booking.signedBadge', 'booking', '已签署'),
  ('booking.signPendingNote', 'booking', '本单尚未完成签署，请到店补签'),
  ('booking.storeCountNote', 'booking', '当前仅 {count} 家门店可约，通用范围以门店列表为准'),
  ('booking.successSignEntry', 'booking', '寄养协议与医疗授权'),
  ('booking.successSignView', 'booking', '查看全文 ›'),
  ('booking.walkTimesLabel', 'booking', '每日遛弯次数（选填）'),
  ('booking.walkTimesPh', 'booking', '如：2'),
  ('pets.vaccineProofAdd', 'pets', '上传证明'),
  ('pets.vaccineProofCount', 'pets', '疫苗证明 {count} 张'),
  ('pets.vaccineProofNote', 'pets', '仅留证，寄养校验仍以疫苗有效期为准'),
  ('pets.vaccineProofTitle', 'pets', '疫苗证明')
)
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, s.rule_key, s.label, json_object('text', s.text), unixepoch(), 1, 'system', unixepoch(), unixepoch()
FROM s
WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = s.rule_key AND `active` = 1);
--> statement-breakpoint
-- seed 补种键（生成件重生成会丢，迁移并集须带）——booking.fullAlternativesNote=跨店满档推荐单店留口注记
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_0039_fullalt', 1, 'booking.fullAlternativesNote', 'booking', json_object('text', '当前单店在线，满档推荐待连锁批开通'), unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key`='booking.fullAlternativesNote' AND `active`=1);
