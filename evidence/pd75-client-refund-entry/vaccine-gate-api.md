# PD-75 疫苗闸 server 拒确认 · API 直证（2026-10-22）

口径：无苗／临期（vaccineValidUntil 空或 < 退房本地日）寄养单，server `appointment.create` 一律 BAD_REQUEST（非仅前端置灰）。

## 负向：无苗宠寄养 → 拒

```
POST /trpc/appointment.create
{ storeId, petId: 无苗测试犬(01M5HG4891N37NZPK14T0W5A88), serviceId: boardingSvc,
  type: 'boarding', scheduledStart: 2026-10-23T11:00Z, scheduledEnd: 2026-10-25T11:00Z,
  paymentMode: 'pay_at_store', medicalAuth: { agreed: true } }

→ 400 BAD_REQUEST：「该宠物疫苗证明缺失或有效期未覆盖寄养退房日，请更新疫苗信息后再预约」
```

## 正向：疫苗覆盖住宿期 → 可下

e2e 67.7 实证（全量 e2e run5 绿）：咪咪 vaccineValidUntil=2026-12-01 覆盖 d+1~d+3 住宿期 → confirmed；
同窗负向断言「67.7 PD-75 疫苗闸 server 拒确认（无苗宠寄养 → BAD_REQUEST）」同绿。

## 落点

- `server/src/routers/appointment.ts` `assertBoardingVaccine()`（create 寄养分支 + confirm 寄养分支双闸）
- 口径与客户端 PetPicker 同帧：ISO 日串字典序，退房日按门店规范时区（+8）取日（storeWallclock）
