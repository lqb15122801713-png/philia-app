-- PD-74：商家端可见文案去规格口吻；仅更新本令明确的 active 文案键，重放零副作用。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '未读取到店主演示账号，请检查演示数据，或手动输入用户 ID'), `updated_at` = unixepoch() WHERE `rule_key` = 'auth.seedEmpty' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '本单涉储值/次卡：退款须店主办理（负债科目不设阈值）'), `updated_at` = unixepoch() WHERE `rule_key` = 'cashier.refundSvNotice' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '续费金额按当前档价与既有宠物只数核算，请先点「计算续费金额」确认应收再收款。'), `updated_at` = unixepoch() WHERE `rule_key` = 'cashier.memberRenewCalcNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '补差应收'), `updated_at` = unixepoch() WHERE `rule_key` = 'cashier.upgradeQuoteTotal' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '盲交中——账面金额已遮罩，实点先行，差异提交后揭晓'), `updated_at` = unixepoch() WHERE `rule_key` = 'cashier.blindCloseNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '端口配置与发布属店主专属；请切换店主账号。'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.ownerOnlyBody' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '进价/成本与毛利仅店主、店长可见'), `updated_at` = unixepoch() WHERE `rule_key` = 'inv.marginNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '标签/券/活动配置仅管理层可操作；请切换店长或店主账号。'), `updated_at` = unixepoch() WHERE `rule_key` = 'mk.guide.hint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '会员域暂无本店汇总数据（现仅按人查询），暂不展示汇总数值'), `updated_at` = unixepoch() WHERE `rule_key` = 'pass.statPendingNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '扣减只扣绩效不扣提成；当月累计最多扣 50%'), `updated_at` = unixepoch() WHERE `rule_key` = 'payroll.ded.aside' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '导出 CSV 仅覆盖已开放报表，预埋项暂不导出'), `updated_at` = unixepoch() WHERE `rule_key` = 'rpt.embed.outNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '今日格=截至当前已收 · 与财务统计同口径'), `updated_at` = unixepoch() WHERE `rule_key` = 'rpt.sparkNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '换班队列暂未接入，审批区待开放。'), `updated_at` = unixepoch() WHERE `rule_key` = 'sched.swap.noQueue' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '用于附近门店的距离排序'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.addrHint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '新预约自动接单 · 默认开启'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.autoAcceptHint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '门店新预约实时推送 · 声音提醒'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.notifyNewHint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '店主专属 · 后台可配置'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.portsAside' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '三端文案统一维护'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.entryCopyHint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '素材上传→待审→上线/回退'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.entrySlotsHint' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '后台可改，无需改代码'), `updated_at` = unixepoch() WHERE `rule_key` = 'set.portBornNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '在职 {a} · 美容师 {b} · 前台 {c} · 自动派单按排班与负荷'), `updated_at` = unixepoch() WHERE `rule_key` = 'staff.sub' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '技能标签暂为只读；排班请点员工行右侧的排班摘要编辑。'), `updated_at` = unixepoch() WHERE `rule_key` = 'staff.editSkillNote' AND `active` = 1;
