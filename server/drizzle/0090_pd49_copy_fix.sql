-- PD-49（0090；0089 让予并行窗 PD-48 slotkey 修，跨窗撞号处置）（修三角色 L2）：L-CTA-MALL 客壳商城 hero CTA 与 liveMap 槽文案对齐「去逛逛」；
-- L-CLOCK-COPY 员工工位寄养照护待办 CTA 去「去打卡」与 Dock「打卡」撞车，消歧为「寄养打卡 ›」。
-- 0086 种子把 mall.hero 槽 cta_text 与 mall.heroCta 端口行写成「去看看」，与现网渲染主文案
-- mall.heroCtaU4=「去逛逛」（PD-39/PD-43 大测既定活文案）不一致；0027 种子把 today.todo.boardingCareCta
-- 写成「去打卡 ›」，与 dock 四槽「打卡」（考勤）同词，员工易从工位待办误入寄养打卡页。
-- 幂等：UPDATE live/active=1 行对齐 PD-49 码内默认；seed 单源 copySeedRows.ts / slotSeedRows.ts 同步更正。
UPDATE `slot_contents` SET `content_json` = json_set(`content_json`, '$.cta_text', '去逛逛'), `updated_at` = unixepoch() WHERE `slot_key` = 'mall.hero' AND `status` = 'live';
UPDATE `copy_overrides` SET `value_json` = json_object('text', '去逛逛'), `updated_at` = unixepoch() WHERE `rule_key` = 'mall.heroCta' AND `active` = 1;
UPDATE `copy_overrides` SET `value_json` = json_object('text', '寄养打卡 ›'), `updated_at` = unixepoch() WHERE `rule_key` = 'today.todo.boardingCareCta' AND `active` = 1;
