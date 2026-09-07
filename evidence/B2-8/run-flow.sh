#!/usr/bin/env bash
# B2-8 验收流程编排（证据脚本，不入库）
# 用法: bash run-flow.sh <outdir> <tag> [watch]
#   outdir: 证据输出目录；tag: 输出文件前缀（repro/fixed）；watch=1 时客户侧挂 appointment 频道流
set -u
OUTDIR="$1"; TAG="$2"; WATCH="${3:-0}"
ROOT="/d/KimiData/kimi/tasks/2026-09-07/02-22-13-267fc560"
APP="$ROOT/philia-app"
BASE="http://localhost:7200"
TSX="$APP/server/node_modules/.bin/tsx.cmd"

killport() { for port in 7100 7101 7102 7200; do for pid in $(netstat -ano | grep ":$port " | grep LISTEN | awk '{print $NF}' | sort -u); do taskkill //PID $pid //T //F >/dev/null 2>&1; done; done; }

cd "$APP"
killport
npm.cmd --prefix server run dev >/tmp/b2-8-server.log 2>&1 &
SRV=$!

# 等服务就绪
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/auth/dev-seed-users" || true)
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || { echo "SERVER NOT UP"; cat /tmp/b2-8-server.log; killport; exit 1; }
echo "== server up =="

# 1. dev-seed-users 动态取账号（禁止硬编码 ULID）
curl -s "$BASE/api/auth/dev-seed-users" > "$OUTDIR/$TAG-seeds.json"
pick() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);const u=(d.users||d).find(u=>$1);console.log(u.id)})"; }
MERCHANT_UID=$(pick "u.roles.includes('merchant_owner')" < "$OUTDIR/$TAG-seeds.json")
CUSTOMER_UID=$(pick "u.roles.includes('customer')&&!u.roles.includes('merchant_owner')&&!u.roles.includes('staff')" < "$OUTDIR/$TAG-seeds.json")
STAFF_UID=$(pick "u.roles.includes('staff')" < "$OUTDIR/$TAG-seeds.json")
echo "merchant=$MERCHANT_UID customer=$CUSTOMER_UID staffUser=$STAFF_UID"

# 2. 解析 storeId/petId/serviceId/staffId
IDS=$(cd "$APP/server" && ./node_modules/.bin/tsx.cmd scripts/b2-8-resolve.mts "$MERCHANT_UID" "$CUSTOMER_UID" "$STAFF_UID")
echo "ids=$IDS"
STORE_ID=$(echo "$IDS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).storeId))")
SERVICE_ID=$(echo "$IDS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).serviceId))")
PET_ID=$(echo "$IDS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).petId))")
STAFF_ID=$(echo "$IDS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).staffId))")

# 3. 三账号登录
curl -s -c "$OUTDIR/$TAG-m.jar" -H 'Content-Type: application/json' -d "{\"userId\":\"$MERCHANT_UID\"}" "$BASE/api/auth/dev-login" > /dev/null
curl -s -c "$OUTDIR/$TAG-c.jar" -H 'Content-Type: application/json' -d "{\"userId\":\"$CUSTOMER_UID\"}" "$BASE/api/auth/dev-login" > /dev/null
curl -s -c "$OUTDIR/$TAG-s.jar" -H 'Content-Type: application/json' -d "{\"userId\":\"$STAFF_UID\"}" "$BASE/api/auth/dev-login" > /dev/null
echo "== logged in =="

# 4. 商家 push.subscribe + 挂 store 频道 SSE（商家角色自动含 store:{storeId}）
CID_M=$(node -e "console.log(crypto.randomUUID())")
SUB=$(curl -s -b "$OUTDIR/$TAG-m.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"clientId\":\"$CID_M\",\"appType\":\"merchant\"}}}" "$BASE/trpc/push.subscribe?batch=1")
echo "merchant subscribe($CID_M): $SUB"
curl -s -N --max-time 60 -b "$OUTDIR/$TAG-m.jar" "$BASE/api/events?client_id=$CID_M" > "$OUTDIR/$TAG-sse-store.txt" 2>&1 &
SSE_M=$!

# 4b. 客户侧 appointment 频道回归流（可选）：subscribe + watch=<aid>（aid 待 create 后才知道，先 subscribe，create 后再挂流）
CID_C=$(node -e "console.log(crypto.randomUUID())")
SUBC=$(curl -s -b "$OUTDIR/$TAG-c.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"clientId\":\"$CID_C\",\"appType\":\"customer\"}}}" "$BASE/trpc/push.subscribe?batch=1")
echo "customer subscribe($CID_C): $SUBC"

sleep 2

# 5. 客户创建洗护预约（明天 10:00，superjson Date meta）
START=$(node -e "const d=new Date();d.setDate(d.getDate()+1);d.setHours(10,0,0,0);console.log(d.toISOString())")
END=$(node -e "const d=new Date();d.setDate(d.getDate()+1);d.setHours(11,0,0,0);console.log(d.toISOString())")
CREATE_BODY=$(node -e "
const s='$START',e='$END';
console.log(JSON.stringify({'0':{json:{storeId:'$STORE_ID',petId:'$PET_ID',serviceId:'$SERVICE_ID',type:'grooming',scheduledStart:s,scheduledEnd:e,paymentMode:'pay_at_store'},meta:{values:{scheduledStart:['Date'],scheduledEnd:['Date']}}}}))")
CREATE_RES=$(curl -s -b "$OUTDIR/$TAG-c.jar" -H 'Content-Type: application/json' -d "$CREATE_BODY" "$BASE/trpc/appointment.create?batch=1")
echo "create: $CREATE_RES" > "$OUTDIR/$TAG-flow.log"
AID=$(echo "$CREATE_RES" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s)[0];const j=r.result.data.json;console.log(j.appointment?j.appointment.id:j.id)})")
echo "AID=$AID" | tee -a "$OUTDIR/$TAG-flow.log"

# 5b. 客户挂 appointment 频道回归流
if [ "$WATCH" = "1" ]; then
  curl -s -N --max-time 50 -b "$OUTDIR/$TAG-c.jar" "$BASE/api/events?client_id=$CID_C&watch=$AID" > "$OUTDIR/$TAG-sse-appointment.txt" 2>&1 &
  SSE_C=$!
fi

sleep 1

# 6. 查核销码 → 商家 confirm → 商家 assign → 员工 checkin
CODE_JSON=$(cd "$APP/server" && ./node_modules/.bin/tsx.cmd scripts/b2-8-code.mts "$AID")
CODE=$(echo "$CODE_JSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).code))")
echo "code=$CODE" | tee -a "$OUTDIR/$TAG-flow.log"

curl -s -b "$OUTDIR/$TAG-m.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"appointmentId\":\"$AID\"}}}" "$BASE/trpc/appointment.confirm?batch=1" >> "$OUTDIR/$TAG-flow.log"; echo >> "$OUTDIR/$TAG-flow.log"
sleep 1
curl -s -b "$OUTDIR/$TAG-m.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"appointmentId\":\"$AID\",\"staffId\":\"$STAFF_ID\"}}}" "$BASE/trpc/appointment.assign?batch=1" >> "$OUTDIR/$TAG-flow.log"; echo >> "$OUTDIR/$TAG-flow.log"
sleep 1
echo "--- checkin ---" >> "$OUTDIR/$TAG-flow.log"
curl -s -b "$OUTDIR/$TAG-s.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"code\":\"$CODE\"}}}" "$BASE/trpc/appointment.checkin?batch=1" >> "$OUTDIR/$TAG-flow.log"; echo >> "$OUTDIR/$TAG-flow.log"
sleep 2

# 7. 六步走完
photo() { echo "{\"url\":\"/api/img/b2-8/$1-$2.jpg\",\"tag\":\"$3\"}"; }
run_step() { # stepKey photosJsonArray
  local key="$1"; local photos="$2"
  if [ "$photos" != "[]" ]; then
    curl -s -b "$OUTDIR/$TAG-s.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"appointmentId\":\"$AID\",\"stepKey\":\"$key\",\"photos\":$photos}}}" "$BASE/trpc/serviceStep.addPhotos?batch=1" >> "$OUTDIR/$TAG-flow.log"; echo >> "$OUTDIR/$TAG-flow.log"
    sleep 1
  fi
  curl -s -b "$OUTDIR/$TAG-s.jar" -H 'Content-Type: application/json' -d "{\"0\":{\"json\":{\"appointmentId\":\"$AID\",\"stepKey\":\"$key\"}}}" "$BASE/trpc/serviceStep.confirmStep?batch=1" >> "$OUTDIR/$TAG-flow.log"; echo >> "$OUTDIR/$TAG-flow.log"
  echo "--- step $key done ---" >> "$OUTDIR/$TAG-flow.log"
  sleep 1
}
run_step disinfection "[$(photo disinfection 1 normal)]"
run_step precheck "[$(photo precheck 1 normal),$(photo precheck 2 normal)]"
run_step grooming "[$(photo grooming 1 normal),$(photo grooming 2 normal),$(photo grooming 3 normal)]"
run_step detail "[$(photo detail 1 normal),$(photo detail 2 normal)]"
run_step before_after "[$(photo before_after 1 before),$(photo before_after 2 after)]"
run_step confirm "[]"

# 8. 等 SSE 收割完毕
wait $SSE_M
[ "$WATCH" = "1" ] && wait $SSE_C
killport
sleep 1
netstat -ano | grep -E ":(7100|7101|7102|7200) " | grep LISTEN || echo "== ports clean =="
echo "== flow done, AID=$AID =="
