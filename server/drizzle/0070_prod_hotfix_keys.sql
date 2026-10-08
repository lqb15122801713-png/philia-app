-- 生产可用性急修 1008：copy 键 1 增 1 改
-- 增=canvas.previewPortMap（画布预览端口分端映射表，JSON 串，改拓扑零代码=两问闸①留口）；
-- 改=card.claimNuanyang 卡面标语去只数（参数面含 5 只 v6 与卡面不再打架；端口值同步）。
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'canvas.previewPortMap', 'merchant:canvas', json_object('text', '{"7202":"7200","7201":"7200"}'), '商家·开发者管理端', 'CanvasPortBody 组件内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'canvas.previewPortMap' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '多只毛孩子 · 都被叫得出名字'), `updated_at` = unixepoch() WHERE `rule_key` = 'card.claimNuanyang' AND `active` = 1;
