-- PD-72：员工口语与真实视界空态；幂等对齐码内默认和 seed 单源，重放零副作用。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '选择过去的日期，可回看当天的服务单'), `updated_at` = unixepoch() WHERE `rule_key` = 'sk.apptHistoryNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '现在没有要你接待的预约——本店新单会自动派到队列'), `updated_at` = unixepoch() WHERE `rule_key` = 'today.frontdesk.empty' AND `active` = 1;
