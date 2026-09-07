# B2-7 复现记录（修复前 · 2026-09-07）

## 缺陷
次卡支付链路悬空：`appointments.payment_mode` 枚举含 `pass_deduct`，但全库无次卡表、无余额校验、无扣减——客户可零成本选「次卡抵扣」白嫖服务；且无卡用户选「次卡扣次」无任何提示（走查 W-6）。

## 复现步骤（复现脚本 `repro.sh`，全程动态取种子用户，无硬编码 ULID）

1. `GET /api/auth/dev-seed-users` → 取「路人客户」（customer 角色，名下无次卡）→ `POST /api/auth/dev-login` 登录（cookie）。
2. 路人客户建宠物「豆豆」（pet.upsert）→ 经 `store.listNearby` / `store.getWithServices` 取示例店与洗护服务「基础洗护（小型犬）」。
3. 调 `appointment.create`，`paymentMode: "pass_deduct"`，预约明天 10:00。

## 现象 ①（接口级）：无卡白嫖建单成功

`repro-create-pass-deduct.json`（原始响应）：

```json
[{"result":{"data":{"json":{"id":"01M1X61B4P1S7R98T5VM60BRF8","code":"SST7Y3","status":"pending","priceFen":8800,"paymentMode":"pass_deduct", ...}}}}]
```

无任何次卡的客户以「次卡扣次」直接建单成功（HTTP 200，status=pending）——服务端对 `pass_deduct` 零校验、零扣减，资损成立。

## 现象 ②（数据级）：全库无次卡相关表

`repro-tables.json`（`SELECT name FROM sqlite_master WHERE type='table'`）：全库 18 张表（appointments / store_slots / …），**无 member_pass、无 pass_deduct_log**。

## 现象 ③（UI 级 · W-6）：确认页「次卡扣次」无提示可直选

`repro-confirm-nopass.png`：路人客户（无卡）走到确认屏，「次卡扣次」按钮与「到店付」并列、完全可点击，无「剩余 N 次」、无置灰、无「暂无可用次卡」提示。

## 清理
复现产生的白嫖单已在复现脚本末尾取消并硬删（保持种子库干净）；路人客户的宠物「豆豆」保留，供修复后「无卡报错」验收用。
