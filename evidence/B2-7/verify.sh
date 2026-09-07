#!/bin/bash
# B2-7 修复后验收（①~⑤ + 回归），全程 curl + DB + CDP 截图留证
set -u
ROOT="D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560"
APP="$ROOT/philia-app"
EV="$ROOT/evidence/B2-7"
export PATH="$PATH:/d/KIMI.AI/resources/resources/runtime"
killport() { for port in 7100 7101 7102 7200; do for pid in $(netstat -ano | grep ":$port " | grep LISTEN | awk '{print $NF}' | sort -u); do taskkill //PID $pid //T //F >/dev/null 2>&1; done; done; }
trap killport EXIT
dbq() { cp "$EV/tmp-b27-db.mts" "$APP/server/scripts/tmp-b27-db.mts"; (cd "$APP/server" && ./node_modules/.bin/tsx scripts/tmp-b27-db.mts "$1"); rm -f "$APP/server/scripts/tmp-b27-db.mts"; }
mut() { curl -s -b "$1" -X POST "http://localhost:7200/trpc/$2?batch=1" -H 'Content-Type: application/json' -d "$3"; }

cd "$APP"
killport
npm.cmd --prefix server run dev >/tmp/b27-v-server.log 2>&1 &
(cd apps/customer && npm.cmd run dev >/tmp/b27-v-customer.log 2>&1) &
(cd apps/merchant && npm.cmd run dev >/tmp/b27-v-merchant.log 2>&1) &
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:7200/api/auth/dev-seed-users && break; sleep 1; done
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:7100/ && break; sleep 1; done
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:7101/ && break; sleep 1; done
echo "== services up =="

# ---- 0. 复位（清掉历次验收产生的次卡/预约痕迹，保证可重跑） ----
dbq "DELETE FROM pass_deduct_log" > /dev/null
dbq "DELETE FROM member_pass" > /dev/null
dbq "DELETE FROM appointment_steps WHERE appointment_id IN (SELECT id FROM appointments WHERE note LIKE 'B27%')" > /dev/null
dbq "DELETE FROM appointments WHERE note LIKE 'B27%' OR payment_mode='pass_deduct'" > /dev/null
# 槽位计数自愈重算（booked_count = 非 cancelled 预约数；completed 仍占位，与 releaseSlot 语义一致）
dbq "UPDATE store_slots SET booked_count=(SELECT COUNT(*) FROM appointments a WHERE a.store_id=store_slots.store_id AND a.scheduled_start=store_slots.slot_start AND a.status!='cancelled')" > /dev/null
echo "== reset done =="

# ---- 登录三个角色（动态取 id，无硬编码 ULID） ----
curl -s http://localhost:7200/api/auth/dev-seed-users > "$EV/seeds.json"
C1=$(node "$EV/pick-user.mjs" "$EV/seeds.json" 示例客户)
C2=$(node "$EV/pick-user.mjs" "$EV/seeds.json" 路人客户)
M=$(node "$EV/pick-user.mjs" "$EV/seeds.json" 菲丽亚店主)
S1=$(node "$EV/pick-user.mjs" "$EV/seeds.json" 小美)
curl -s -c "$EV/c1.cookie" -X POST http://localhost:7200/api/auth/dev-login -H 'Content-Type: application/json' -d "{\"userId\":\"$C1\"}" > /dev/null
curl -s -c "$EV/c2.cookie" -X POST http://localhost:7200/api/auth/dev-login -H 'Content-Type: application/json' -d "{\"userId\":\"$C2\"}" > /dev/null
curl -s -c "$EV/m.cookie" -X POST http://localhost:7200/api/auth/dev-login -H 'Content-Type: application/json' -d "{\"userId\":\"$M\"}" > /dev/null
curl -s -c "$EV/s.cookie" -X POST http://localhost:7200/api/auth/dev-login -H 'Content-Type: application/json' -d "{\"userId\":\"$S1\"}" > /dev/null
STORE=$(dbq "SELECT id FROM stores LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
SVC=$(dbq "SELECT id FROM services WHERE type='grooming' ORDER BY price_fen LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
STAFF=$(dbq "SELECT id FROM staff WHERE name='小美' LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
PET1=$(dbq "SELECT id FROM pets WHERE name='旺财' LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
PET2=$(dbq "SELECT id FROM pets WHERE name='咪咪' LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
PET_C2=$(dbq "SELECT id FROM pets WHERE owner_id='$C2' LIMIT 1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
echo "store=$STORE svc=$SVC staff=$STAFF pet1=$PET1 pet2=$PET2 petC2=$PET_C2"
mkts() { node -e "const d=new Date();d.setDate(d.getDate()+$1);d.setHours($2,0,0,0);console.log(d.toISOString())"; }
T1000=$(mkts 1 10); T1030=$(mkts 1 10); T1200=$(mkts 1 12); T1400=$(mkts 1 14); T1500=$(mkts 1 15); T1500_D2=$(mkts 2 15)
# 1030 单独：30 分粒度
T1030=$(node -e "const d=new Date();d.setDate(d.getDate()+1);d.setHours(10,30,0,0);console.log(d.toISOString())")

E1200=$(node -e "console.log(Math.floor(new Date('$T1200').getTime()/1000))")
E1400=$(node -e "console.log(Math.floor(new Date('$T1400').getTime()/1000))")

echo; echo "########## ① 无卡客户建单 pass_deduct → 明确报错 ##########"
mut "$EV/c2.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET_C2\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1000\",\"paymentMode\":\"pass_deduct\",\"note\":\"B27-V1\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" | tee "$EV/v1-no-pass-error.json"
echo

echo; echo "########## ② 商家充 10 次 → 建单 pass_deduct 成功 → remain=9 且 log -1 ##########"
mut "$EV/m.cookie" pass.topUp "{\"0\":{\"json\":{\"userId\":\"$C1\",\"times\":10}}}" | tee "$EV/v2-topup.json"
echo
dbq "SELECT user_id, store_id, total_times, remain_times, status, expires_at FROM member_pass" | tee "$EV/v2-db-after-topup.txt"
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET1\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1000\",\"paymentMode\":\"pass_deduct\",\"note\":\"B27-A\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" | tee "$EV/v2-create.json" > /dev/null
AID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v2-create.json','utf8'));console.log(d[0].result?.data?.json?.id ?? '')")
echo "created A=$AID"
dbq "SELECT total_times, remain_times FROM member_pass" | tee "$EV/v2-db-after-deduct.txt"
dbq "SELECT pass_id, appointment_id, delta, created_at FROM pass_deduct_log" | tee "$EV/v2-logs.txt"

echo; echo "########## ⑤a UI：有卡客户确认页显示「剩余 9 次」 ##########"
node "$EV/drive-booking.mjs" 示例客户 "$EV/v5a-confirm-remain9.png" "(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('次卡扣次')); return { text: b?.textContent?.replace(/\\s+/g, ' '), disabled: b?.disabled }; })()"

echo; echo "########## ⑤b UI：无卡用户次卡扣次置灰 ##########"
node "$EV/drive-booking.mjs" 路人客户 "$EV/v5b-confirm-nopass-grayed.png" "(() => { const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.includes('次卡扣次')); return { text: b?.textContent?.replace(/\\s+/g, ' '), disabled: b?.disabled }; })()"

echo; echo "########## ③ 取消该单 → remain=10 且 log +1 ##########"
mut "$EV/c1.cookie" appointment.cancel "{\"0\":{\"json\":{\"appointmentId\":\"$AID\"}}}" | tee "$EV/v3-cancel.json" > /dev/null
cat "$EV/v3-cancel.json" | head -c 400; echo
dbq "SELECT total_times, remain_times FROM member_pass" | tee "$EV/v3-db-after-refund.txt"
dbq "SELECT delta, appointment_id FROM pass_deduct_log WHERE appointment_id='$AID' ORDER BY created_at, id" | tee "$EV/v3-logs.txt"

echo; echo "########## ④ 红标：扣次后建单失败（容量 CONFLICT）→ remain 不变（事务回滚） ##########"
# 填满明天 12:00（capacity=2）：两单 pay_at_store
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET1\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1200\",\"paymentMode\":\"pay_at_store\",\"note\":\"B27-F1\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" > "$EV/v4-filler1.json"
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET2\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1200\",\"paymentMode\":\"pay_at_store\",\"note\":\"B27-F2\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" > "$EV/v4-filler2.json"
dbq "SELECT slot_start, capacity, booked_count FROM store_slots WHERE slot_start=$E1200" | tee "$EV/v4-slot-full.txt"
echo "-- 槽已满后再以 pass_deduct 建单（扣次先于占槽，占槽 CONFLICT 应整体回滚） --"
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET1\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1200\",\"paymentMode\":\"pass_deduct\",\"note\":\"B27-ROLLBACK\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" | tee "$EV/v4-conflict.json"
echo
echo "-- 回滚后 remain_times 与流水（应仍为 10，且无 -1 新流水） --"
dbq "SELECT total_times, remain_times FROM member_pass" | tee "$EV/v4-db-rollback.txt"
dbq "SELECT delta, appointment_id FROM pass_deduct_log ORDER BY created_at, id" | tee "$EV/v4-logs.txt"
# 清理两单 filler（走正常取消，槽位回减）
for F in v4-filler1 v4-filler2; do
  FID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/$F.json','utf8'));console.log(d[0].result?.data?.json?.id ?? '')")
  [ -n "$FID" ] && mut "$EV/c1.cookie" appointment.cancel "{\"0\":{\"json\":{\"appointmentId\":\"$FID\"}}}" > /dev/null
done

echo; echo "########## ⑤c UI：会员卡页真实余额 ##########"
node "$EV/drive-page.mjs" 示例客户 /philia/member "$EV/v5c-member-pass.png" "document.body.textContent.includes('次卡') && document.body.textContent.includes('长期有效')" 390 844 1

echo; echo "########## ⑤d UI：商家次卡管理页充次生效 ##########"
node "$EV/drive-merchant-pass.mjs" 菲丽亚店主 示例客户 5 "$EV/v5d-merchant-pass-list.png" "$EV/v5d-merchant-pass-topup.png"
dbq "SELECT total_times, remain_times FROM member_pass" | tee "$EV/v5d-db-after-topup.txt"
dbq "SELECT delta, appointment_id FROM pass_deduct_log ORDER BY created_at, id" | tee "$EV/v5d-logs.txt"

echo; echo "########## 回归 1：pay_at_store 全链路（create→confirm→assign→checkin） ##########"
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET1\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1400\",\"paymentMode\":\"pay_at_store\",\"note\":\"B27-REG\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" > "$EV/v6-reg-create.json"
GID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-reg-create.json','utf8'));console.log(d[0].result?.data?.json?.id ?? '')")
GCODE=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-reg-create.json','utf8'));console.log(d[0].result?.data?.json?.code ?? '')")
mut "$EV/m.cookie" appointment.confirm "{\"0\":{\"json\":{\"appointmentId\":\"$GID\"}}}" > "$EV/v6-reg-confirm.json"
mut "$EV/m.cookie" appointment.assign "{\"0\":{\"json\":{\"appointmentId\":\"$GID\",\"staffId\":\"$STAFF\"}}}" > "$EV/v6-reg-assign.json"
mut "$EV/s.cookie" appointment.checkin "{\"0\":{\"json\":{\"code\":\"$GCODE\"}}}" > "$EV/v6-reg-checkin.json"
{
echo "regression booking G=$GID code=$GCODE"
node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-reg-confirm.json','utf8'))[0].result?.data?.json;console.log('confirm status=',d?.status)"
node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-reg-assign.json','utf8'))[0].result?.data?.json;console.log('assign staffId=',d?.staffId)"
node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-reg-checkin.json','utf8'))[0].result?.data?.json;console.log('checkin status=',d?.appointment?.status,'steps=',d?.steps?.length,'nextRoute=',d?.nextRoute)"
dbq "SELECT status, payment_mode, paid_at FROM appointments WHERE id='$GID'"
} | tee "$EV/v6-pay-at-store.txt"
# 清理 in_service 回归单（硬删 + 槽位回减）
dbq "DELETE FROM appointment_steps WHERE appointment_id='$GID'" > /dev/null
dbq "DELETE FROM appointments WHERE id='$GID'" > /dev/null
dbq "UPDATE store_slots SET booked_count=booked_count-1 WHERE store_id='$STORE' AND slot_start=$E1400 AND booked_count>0" > /dev/null

echo; echo "########## 回归 2：B2-6 改期 × pass_deduct 状态机一致（改期不退次、取消仍回补） ##########"
mut "$EV/c1.cookie" appointment.create "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET1\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$T1500\",\"paymentMode\":\"pass_deduct\",\"note\":\"B27-R\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" > "$EV/v6-r-create.json"
RID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-r-create.json','utf8'));console.log(d[0].result?.data?.json?.id ?? '')")
mut "$EV/c1.cookie" appointment.reschedule "{\"0\":{\"json\":{\"appointmentId\":\"$RID\",\"scheduledStart\":\"$T1500_D2\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" > "$EV/v6-r-reschedule.json"
{
echo "R=$RID 建单后 remain（15→14）："; dbq "SELECT remain_times FROM member_pass"
echo "-- 改期到后天 15:00 --"
node -e "const d=JSON.parse(require('fs').readFileSync('$EV/v6-r-reschedule.json','utf8'))[0].result?.data?.json;console.log('status=',d?.status,'staffId=',d?.staffId,'start=',d?.scheduledStart)"
echo "改期后 remain（应仍 14，改期不退次）："; dbq "SELECT remain_times FROM member_pass"
echo "改期后该单流水（应只有 -1，无 +1）："; dbq "SELECT delta FROM pass_deduct_log WHERE appointment_id='$RID'"
echo "-- 取消改期后的单（应回补 14→15） --"
mut "$EV/c1.cookie" appointment.cancel "{\"0\":{\"json\":{\"appointmentId\":\"$RID\"}}}" > /dev/null
dbq "SELECT remain_times FROM member_pass"
dbq "SELECT delta FROM pass_deduct_log WHERE appointment_id='$RID' ORDER BY created_at, id"
} | tee "$EV/v6-reschedule.txt"

echo; echo "########## 终态快照 ##########"
dbq "SELECT u.nickname, mp.total_times, mp.remain_times, mp.status FROM member_pass mp JOIN users u ON u.id=mp.user_id" | tee "$EV/final-pass.txt"
dbq "SELECT l.delta, l.appointment_id, a.code, l.created_at FROM pass_deduct_log l LEFT JOIN appointments a ON a.id=l.appointment_id ORDER BY l.created_at, l.id" | tee "$EV/final-logs.txt"

killport
sleep 1
netstat -ano | grep -E ':(7100|7101|7102|7200) ' | grep LISTEN || echo "== all ports clear =="
echo "== verify done =="
