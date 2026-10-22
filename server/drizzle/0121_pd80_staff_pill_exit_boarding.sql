-- PD-80（员工端 pill 绑区间＋退出确认＋寄养收写）：去 SSE 工程外露文案落库。
-- 码内默认（apps/staff/src/copy/me.ts）已改人话，但生产库 copy_overrides active 旧行仍持
-- 「SSE 长连接…60s 轮询兜底」工程口吻——端口值优先（withCopyOverrides）→ 透出旧词。
-- 幂等改写：rule_key 命中且 active=1 的行重写为目标文案（键保留、行数不变，0092 同工艺）；
-- 已对齐库零变化=重放零副作用。零 schema 变更（纯数据行改写）。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '实时同步：派单、改期、取消即时推送到本机；断网恢复后自动补齐。'), `updated_at` = unixepoch() WHERE `rule_key` = 'me.settings.sync' AND `active` = 1;
