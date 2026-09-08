# B4-3 默认值预填体系 · 验证说明

时间：2026-09-08 · 分支 feat/b4-booking-redesign
实现：`apps/customer/src/lib/bookingPrefill.ts`（localStorage 记忆读写 + 三个纯函数解析器），
消费方为新洗护单屏页 GroomingSinglePage；写入时机 = appointment.create onSuccess。
运行时证据脚本：`verify.mjs`（17/17 通过，汇总存 `verify-asserts.txt`）。

## 优先级链（任务书 B4-3）

URL ?storeId/?serviceId/?petId > localStorage 上次成功下单记忆 > 无历史默认
（最近门店 listNearby 第一家 / 该店首个在架洗护项 / 唯一宠物直选、多宠物不替选）。

## ① 上次下单记忆预填

真实 UI 下单成功 → localStorage `philia:lastBooking` 写入三参（见 txt 存档）→ 重进
/booking/grooming：宠物卡=旺财、服务 chip=记忆 serviceId、门店=记忆门店，按钮仅缺
「请选择时间」。截图 `B4-3-①上次下单记忆预填.png`。

## ② URL 参数优先级高于记忆

记忆为 {基础洗护（小型犬）, 旺财} 时，以 ?serviceId=基础洗护（中型犬）&petId=咪咪 打开：
选中被 URL 覆盖（服务=中型犬、宠物=咪咪）。截图 `B4-3-②URL参数优先级高于记忆.png`。

## ③ 无历史默认

清记忆后打开：门店=菲丽亚宠物·示例店（listNearby 第一家）、服务=基础洗护（小型犬）
（该店首个在架洗护项）、多宠物（旺财/咪咪）不替选显示「请选择宠物」。
唯一宠物直选：临时单宠物用户（seed_kimi_b4_nopet + pet.upsert「独苗」）打开即选中独苗。
截图 `B4-3-③无历史默认-多宠不替选.png` / `B4-3-③无历史默认-唯一宠物直选.png`。
临时用户验证后已清理（tmp-b4-nopet.mts --cleanup）。

## ④ 入口落点切新单屏（交互不变，预填同源）

运行时：
- 完成单「再次预约」（completed 洗护单 01M1Y81JT97VXWNZP3W921QFWQ，由 tmp-b4-complete.mts
  置完成）→ 落地 /booking/grooming?serviceId&storeId&petId 且新单屏渲染、预填生效。
- Philia 中按钮长按 →「再次预约同款服务」→ 落地 /booking/grooming 新单屏（rec2 录屏同源实证）。
截图 `B4-3-④完成单再次预约落点.png` / `B4-3-④长按一键预约落点.png`。

静态（grep 佐证，入口代码未改、仅路由落点切换）：
- TabBar.tsx:149 `const base = lastAppt.type === 'boarding' ? '/booking/boarding' : '/booking/grooming'`
- AppointmentDetailPage.tsx:516 同上（带 serviceId/storeId/petId 三参）
- App.tsx:43 `<Route path="/booking/grooming" element={<GroomingSinglePage />} />`

## 备注

- boarding 类入口仍落 /booking/boarding 旧向导（B4-2 范围，本任务未动）。
- 预填校验：URL/记忆中的失效 id（已删宠物/下架服务/无效门店）会被解析器拒绝并回退默认值
  （resolveStoreId/resolveServiceId/resolvePetId 均做存在性校验）。
