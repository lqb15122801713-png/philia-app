-- PD-51（L-CLOCK-COPY 续修 · O-OVERRIDE-WINS）：工位寄养照护 CTA「寄养打卡 ›」真落地。
-- 0090 已把码内默认（apps/staff/src/copy/today.ts）与 seed 单源（copySeedRows.ts）对齐「寄养打卡 ›」，
-- 但合部后生产库 copy_overrides active 旧行仍持「去打卡 ›」——0090 未在该库生效（或只改了 dist
-- 被压），覆盖层读取顺序=端口值优先（copyOverrides.ts）→ activeCopyTexts 透出旧词，工位 CTA 照旧。
-- 幂等改写：rule_key 命中且 active=1 的行一律重写为目标文案（清旧覆盖=改写为新值，键保留、
-- 行数不变，端口页/76.3 行数口径不动）；已对齐库零变化=重放零副作用（0088/0090 同工艺）。
-- 路由不动：Dock「打卡」→考勤（sk.dockPunch）、工位→/boarding/:id/checkin 均不在本令触碰面。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '寄养打卡 ›'), `updated_at` = unixepoch() WHERE `rule_key` = 'today.todo.boardingCareCta' AND `active` = 1;
