#!/bin/bash
# B2-7 复现（修复前）：无卡客户选 pass_deduct 可白嫖建单 + 确认页无任何提示
set -u
ROOT="D:/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560"
APP="$ROOT/philia-app"
EV="$ROOT/evidence/B2-7"
export PATH="$PATH:/d/KIMI.AI/resources/resources/runtime"
killport() { for port in 7100 7101 7102 7200; do for pid in $(netstat -ano | grep ":$port " | grep LISTEN | awk '{print $NF}' | sort -u); do taskkill //PID $pid //T //F >/dev/null 2>&1; done; done; }

cd "$APP"
killport
npm.cmd --prefix server run dev >/tmp/b27-server.log 2>&1 &
(cd apps/customer && npm.cmd run dev >/tmp/b27-customer.log 2>&1) &
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:7200/api/auth/dev-seed-users && break; sleep 1; done
for i in $(seq 1 90); do curl -s -o /dev/null http://localhost:7100/ && break; sleep 1; done
echo "== services up =="

# 1. 动态取种子用户（禁止硬编码 ULID）
curl -s http://localhost:7200/api/auth/dev-seed-users > "$EV/repro-seed-users.json"
C2=$(node "$EV/pick-user.mjs" "$EV/repro-seed-users.json" 路人客户)
echo "路人客户 id=$C2"

# 2. 登录路人客户（无卡用户）+ 建一只宠物（走到支付校验需要宠物归属通过）
curl -s -c "$EV/c2.cookie" -X POST http://localhost:7200/api/auth/dev-login -H 'Content-Type: application/json' -d "{\"userId\":\"$C2\"}" > /dev/null
PET2=$(curl -s -b "$EV/c2.cookie" 'http://localhost:7200/trpc/pet.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s)[0].result.data.json;console.log(j.length?j[0].id:'')})")
if [ -z "$PET2" ]; then
  curl -s -b "$EV/c2.cookie" -X POST 'http://localhost:7200/trpc/pet.upsert?batch=1' -H 'Content-Type: application/json' -d '{"0":{"json":{"name":"豆豆","species":"dog"}}}' > "$EV/repro-pet.json"
  PET2=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/repro-pet.json','utf8'));console.log(d[0].result.data.json.pet.id)")
fi
echo "路人客户 pet=$PET2"

# 3. 取门店与洗护服务（走 listNearby + getWithServices）
curl -s -b "$EV/c2.cookie" 'http://localhost:7200/trpc/store.listNearby?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%7D%7D%7D' > "$EV/repro-stores.json"
STORE=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/repro-stores.json','utf8'));console.log(d[0].result.data.json.stores[0].id)")
curl -s -b "$EV/c2.cookie" "http://localhost:7200/trpc/store.getWithServices?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22storeId%22%3A%22$STORE%22%7D%7D%7D" > "$EV/repro-services.json"
SVC=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/repro-services.json','utf8'));const s=d[0].result.data.json.services.find(x=>x.type==='grooming');console.log(s.id)")
echo "store=$STORE service=$SVC"

# 4. 无卡客户建单 paymentMode=pass_deduct（预期缺陷：无任何校验直接成功）
TS=$(node -e "const d=new Date();d.setDate(d.getDate()+1);d.setHours(10,0,0,0);console.log(d.toISOString())")
echo "scheduledStart=$TS"
curl -s -b "$EV/c2.cookie" -X POST 'http://localhost:7200/trpc/appointment.create?batch=1' -H 'Content-Type: application/json' \
  -d "{\"0\":{\"json\":{\"storeId\":\"$STORE\",\"petId\":\"$PET2\",\"serviceId\":\"$SVC\",\"type\":\"grooming\",\"scheduledStart\":\"$TS\",\"paymentMode\":\"pass_deduct\"},\"meta\":{\"values\":{\"scheduledStart\":[\"Date\"]}}}}" \
  | tee "$EV/repro-create-pass-deduct.json"
echo
AID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$EV/repro-create-pass-deduct.json','utf8'));console.log(d[0].result?.data?.json?.id ?? '')")
echo "created appointment id=$AID （修复前缺陷：无卡也建单成功）"

# 5. 全库表清单：无 member_pass / pass_deduct_log
cp "$EV/tmp-b27-db.mts" server/scripts/tmp-b27-db.mts
(cd server && ./node_modules/.bin/tsx scripts/tmp-b27-db.mts "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name") | tee "$EV/repro-tables.json"

# 6. 确认页截图（修复前：次卡扣次可选、无剩余次数/置灰提示）
node "$EV/drive-booking.mjs" 路人客户 "$EV/repro-confirm-nopass.png"

# 7. 清理：取消并硬删该白嫖单（保持种子库干净，便于修复后证据互不影响）
if [ -n "$AID" ]; then
  curl -s -b "$EV/c2.cookie" -X POST 'http://localhost:7200/trpc/appointment.cancel?batch=1' -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"appointmentId\":\"$AID\"}}}" > /dev/null
  (cd server && ./node_modules/.bin/tsx scripts/tmp-b27-db.mts "DELETE FROM appointments WHERE id='$AID'")
fi
rm -f server/scripts/tmp-b27-db.mts

killport
sleep 1
netstat -ano | grep -E ':(7100|7101|7102|7200) ' | grep LISTEN || echo "== all ports clear =="
echo "== repro done =="
