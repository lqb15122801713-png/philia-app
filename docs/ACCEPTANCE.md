# 菲丽亚宠物（Philia）验收报告（P6 / T6.1）

- 验收基准：《菲丽亚宠物三端App开发方案》第 11 章（A1-A10 / B1-B10 / C1-C5 / D1-D5 / E1-E5，共 35 条 + 11.6 发布门槛）
- 验收人：reviewer-acceptance（评审角色，以运行既有测试 + 新增联调脚本收集证据，不改产品代码）
- 验收时间：2026-09-05；环境：Windows / Node 24 / Chrome headless
- 证据日志：`acceptance-logs/*.log`（工作区根）；新增脚本：`server/scripts/acceptance-c5.mts`、`server/scripts/acceptance-e2-staff.mts`、`shots/acceptance-lcp.mjs`

---

## 执行摘要

**用例通过率：30/35 ✅（另 4 条 ⚠️ 部分证据、1 条 ❌ 缺口）**

| 分区 | 结果 |
|---|---|
| A 预约与推送（10） | 10 ✅ |
| B 六步强制顺序流（10） | 10 ✅（B1/B5 为代码级+插值证据，见备注） |
| C 弱网与实时性（5） | 3 ✅ / 2 ⚠️（C1 断网拍照、C3 崩溃重投无自动化实测） |
| D 寄养与商城（5） | 4 ✅ / 1 ❌（D3 超期每日提醒无发射方） |
| E 权限与体验（5） | 3 ✅ / 2 ⚠️（E4 真机添加主屏幕、E5 60fps 无法本机自动化） |

**关键指标**

| 指标 | 门槛（§11.6） | 实测 | 判定 |
|---|---|---|---|
| 三端 SSE 同步延迟（C5 新增实测） | ≤3s | 客户端 max 0ms、商家端 max 0ms（事件均在 confirmStep RTT 13–15ms 内到达，3 步×3 次） | ✅ 远优于门槛 |
| live 页 SSE 首事件延迟 | ≤1s | 同上链路，首事件在 mutation 往返内到达（≤15ms 量级） | ✅ |
| 客户端首屏 LCP | ≤2.5s（4G 节流） | 1264ms（**无节流**、dev 构建、390×844 mobile；非 4G 口径，仅供参） | ✅（参） |
| 三端生产构建 | 通过 | customer / merchant / staff `npm run build` 全部 EXIT=0 | ✅ |
| 服务端测试 | 全绿 | 6 套冒烟 + e2e 全部 EXIT=0（重跑于本轮） | ✅ |

**最重要发现（❌ 缺口）**：D3「寄养到期未退房 → 商家端每日提醒」——`boarding.overdue` 事件类型与 bus 频道映射已定义，但**全仓库无任何发射方**（无每日定时任务），仅有超期标记（`stayBoard`）与商家端看板计数（`overdueBoardingCount`）。详见 D3 条目与文末建议。

---

## 测试重跑记录（本轮实测，每套独立临时库、不污染种子库）

| 测试 | 退出码 | 日志 ✓ 计数 | 备注 |
|---|---|---|---|
| auth/__tests__/smoke.ts | 0 | 5 项全过 | 会话/RBAC/邀请码/绑店 |
| routers/__tests__/appointment.smoke.ts | 0 | 81 | 预约生命周期 7 大组 |
| routers/__tests__/serviceStep.smoke.ts | 0 | 54 | 六步状态机 6 大组 |
| routers/__tests__/domain.smoke.ts | 0 | 5 项全过 | pet/store/boarding |
| routers/__tests__/mall.smoke.ts | 0 | 58 | 商城+支付 8 大组 |
| realtime/__tests__/smoke.ts | 0 | 30 | outbox/广播/续传/重投 |
| realtime/__tests__/http-smoke.ts | 0 | 14 | SSE HTTP 级（含 Last-Event-ID） |
| storage/__tests__/smoke.ts | 0 | 26（26 通过 0 失败） | 图片处理/签名/上传/回收 |
| __tests__/e2e.ts | 0 | 41 | 全链路 HTTP+SSE，种子库前后 size/mtime 未变 |
| scripts/acceptance-c5.mts（新增） | 0 | 4 项全过 | C5 三端 SSE 延迟实测 |
| scripts/acceptance-e2-staff.mts（新增） | 0 | 4 项全过 | E2 同店他人员工归属补测 |

> 已知噪音（低 severity，见 BUG-1）：各测试结束清理 Windows 临时目录时偶发 `EPERM rm`（libsql 句柄释放滞后），不影响断言与退出码，但会在 `%TMP%` 残留 `philia-*` 目录（本轮观察到约 26 个）。

---

## 11.1 预约与推送（A1–A10）

| # | 结果 | 证据 | 备注 |
|---|---|---|---|
| A1 客户提交预约 → 商家 ≤3s 收 `appointment.created` + 红点 | ✅ | e2e：create 前 push.subscribe + SSE 建流，事件序列实收；appointment.smoke [7] 事件总账断言 outbox/channel；C5 实测同链路延迟 ≤15ms 量级 | 红点为商家端 `TabBar.tsx` + MerchantEventsProvider 实现（代码级证据） |
| A2 确认+派单 → 客户/员工 ≤3s 双收 | ✅ | e2e：客户流依次收到 confirmed/assigned；`assigned 双频道（staff + user）` 断言 | 延迟同 C5 链路 |
| A3 二维码 HMAC+exp，篡改验签失败 | ✅ | appointment.smoke [2]：getCode 签名验证通过；篡改 aid/exp 被拒 | |
| A4 5 分钟滚动窗过期拒绝（仅当前+上一窗口） | ✅ | appointment.smoke [2]：tw-1 窗口接受、tw-2 拒绝、过期 exp 拒绝 | |
| A5 员工扫非同店预约码 → 拒绝 | ✅ | appointment.smoke [3]：非同店拒绝 | |
| A6 重复扫码幂等 | ✅ | appointment.smoke [3]：重复扫码幂等返回当前进度 | |
| A7 同员工同时间槽派两单 → 冲突 | ✅ | appointment.smoke [5]：assign 技能/排班/时间冲突检测 | |
| A8 并发预约 capacity=1 不超卖 | ✅ | appointment.smoke [1]：同槽 capacity 打满后第二单 CONFLICT | |
| A9 连续 6 次错码 → 第 6 次 429 + 锁 10 分钟 | ✅ | appointment.smoke [3.5]：失败 5 次后第 6 次 TOO_MANY_REQUESTS（锁 10 分钟，即便持有效码）；appointment.ts CHECKIN_LOCK_MS | |
| A10 已指派 A 的单 B 核销拒绝；未指派单 B 核销成功并自动认领 | ✅ | appointment.smoke [3]：两分支均断言 | |

## 11.2 六步强制顺序流（B1–B10）

| # | 结果 | 证据 | 备注 |
|---|---|---|---|
| B1 未传消毒照片主按钮禁用「还差 1 张」 | ✅ | 员工端 `StepScreen.tsx`：禁用链「上传中 → 还差 N 张 → 可确认」，btnText=`还差 ${minPhotos-count} 张` | 代码级证据，无自动化 UI 测试 |
| B2 绕过 UI 对 locked 步 addPhotos → FORBIDDEN | ✅ | serviceStep.smoke [1] | |
| B3 绕过 UI 对 locked 步 confirmStep → 拒 | ✅ | serviceStep.smoke [1] | |
| B4 达标 confirm → step1 done/step2 active + 客户端 ≤3s 收 `step_updated` | ✅ | serviceStep.smoke [3]（状态迁移 + outbox 载荷含 photos/nextStepKey）；e2e：客户流 step_updated×6；C5 实测 ≤15ms 量级 | |
| B5 步骤3 一次性传 4 张（≥3）→ 允许 | ✅ | 插值证据：e2e step3 一次 3 张通过；serviceStep.smoke [2] step1 一次 4 张（超 max=3）被拒 → addPhotos 数组边界校验正确，4 张 ≤ max=9 必放行 | 未单独测「步骤3 恰好 4 张」 |
| B6 步骤5 只传 1 张 → 拒 | ✅ | serviceStep.smoke [5]：只传 before → 拒 | |
| B7 before/after 标签缺失 → 前端引导 + 服务端拒 | ✅ | serviceStep.smoke [5]：tag normal → 拒、before+after 各 1 → 过；`StepScreen.tsx` 标签引导按钮文案 | |
| B8 商家打标重拍：回退 active + `step_flagged`；step3 已 done 禁打标 | ✅ | serviceStep.smoke [4]：(b) 路径回退+旧照片 invalidated+confirm 只计新照片；step3 done 打标拒；locked 打标拒 | step_flagged 事件落 outbox（同文件事件断言） |
| B9 步骤6 confirm → 事务完成 + completed 三端 ≤3s | ✅ | serviceStep.smoke [6]：completed/completed_at/事件；e2e：SSE 实收 completed + outbox 15 条齐全；C5 延迟证据 | |
| B10 任意时刻 active 步骤 ≤1 | ✅ | serviceStep.smoke 全程 assertInvariant（每组后校验） | |

## 11.3 弱网与实时性（C1–C5）

| # | 结果 | 证据 | 备注 |
|---|---|---|---|
| C1 断网拍照 3 张恢复后按序补齐上传 | ⚠️ | 员工端 `src/lib/offlineQueue.ts`：入队即冲、退避（flushBackoffDelay）、'online' 事件触发 flushRound | **缺自动化断网实测**；建议 CDP Network.emulateNetworkConditions 离线→在线实测补证 |
| C2 锁屏 5 分钟 → SSE 重连 + Last-Event-ID 补发 + 全量对齐 | ✅ | http-smoke：Last-Event-ID 续传按序补发且不重复；realtime smoke [3] replayMissed | 锁屏场景本身依赖浏览器 EventSource 原生重连，服务端续传能力已证 |
| C3 事件落库前崩溃 → 重启 outbox 重投不丢 | ⚠️ | realtime smoke [4]：sweepOnce 离线保持 0、在线重投置 1；emitEvent 与业务同事务落 outbox（e2e outbox 15 条齐全佐证） | **缺 kill 进程注入的重启实测**；建议补「emit 后 kill -9 → 重启 → sweeper 重投」脚本 |
| C4 离线期间服务完成 → 上线消息中心有 completed + philia 光环 | ✅ | realtime smoke [1] notifications 落库、[5] listNotifications/markRead；e2e completed 事件；客户端 philia 按钮页截图 `shots/customer-philia.png` | 光环为视觉态，见 E5 |
| C5 三端同时在线，员工操作一步 ≤3s 双端同步 | ✅ | **本轮新增实测** `server/scripts/acceptance-c5.mts`：客户+商家双 SSE（watch=aid），员工完成 3 步，两端 3 次最大延迟均 0ms（事件在 confirmStep RTT 13–15ms 内到达）；跑完 7200 无残留 | 日志 `acceptance-logs/c5.log` |

## 11.4 寄养与商城（D1–D5）

| # | 结果 | 证据 | 备注 |
|---|---|---|---|
| D1 疫苗过期提交寄养 → 前端阻断引导补录 | ✅ | 客户端 `BookingBoardingPage.tsx`：疫苗硬校验（vaccine_valid_until 为空或早于退房日 → 红色阻断卡 + 跳档案页） | 代码级证据；历史运行时联调寄养入住打卡已实测 |
| D2 每日打卡两次 → UPSERT 覆盖 + `boarding.daily_update` | ✅ | domain.smoke [5]：dailyLog 同日两次为一行（UPSERT）+ outbox 有 boarding.daily_update | |
| D3 寄养到期未退房 → 商家端每日提醒 | ❌ | **缺口**：`boarding.overdue` 事件类型（events.ts）与 bus 频道映射（bus.ts）存在，但全仓库无发射方、无每日定时任务。现有仅：domain.smoke [5] stayBoard 超期标记、store.ts `overdueBoardingCount` 看板计数 | 见文末「遗留缺口与建议」BUG-2 |
| D4 库存 1 件两人并发下单 → 仅一单成功 | ✅ | mall.smoke [3]：并发 createOrder 仅一单成功（另一单 CONFLICT），stock=0 | |
| D5 下单→发货→收货全链路三端推送 | ✅ | mall.smoke [2]/[6]：order.created/paid/shipped/received 事件+通知齐；历史运行时商城全链路实测 | |

## 11.5 权限与体验（E1–E5）

| # | 结果 | 证据 | 备注 |
|---|---|---|---|
| E1 客户访问商家路由/API → 前端引导页 + 服务端 403 | ✅ | 服务端：e2e [8] 客户 cookie 调 merchantProcedure（store.upsertService）→ 403；前端：商家端 `RequireMerchant.tsx` 非商家角色 → 引导页 | 双重拦截均覆盖 |
| E2 员工 A 操作派给员工 B 的预约 → serviceStep.* 拒 | ✅ | **本轮补测** `server/scripts/acceptance-e2-staff.mts`：同店员工 A 对指派给 B 的单 addPhotos/confirmStep/flagForRedo 全 FORBIDDEN，B 自己操作放行（既有 serviceStep.smoke 仅覆盖跨店 staff，故补） | 日志附于运行输出 |
| E3 客户访问他人预约照片 URL → 签名+归属拒绝 | ✅ | 归属：serviceStep.smoke [1]「他人预约 customer list → FORBIDDEN」（照片 URL 只能经归属校验后的 list 取得）；签名：storage.smoke [2] 篡改 sig→403、篡改 relPath→403、`..%2F` 穿越→403、过期→410 | 签名 URL 本身不绑用户（HMAC+uuid 不可猜测），归属在 URL 签发入口强制 |
| E4 PWA 添加主屏幕启动：全屏/启动图/图标 | ⚠️ | 三端 dist 静态检查全过：manifest.webmanifest（name/short_name/display=standalone/theme_color=#FBF7F2/icons 192+512）+ sw.js + workbox + icons 实体文件 + index.html 含 theme-color 与 manifest 链接；三端 `npm run build` 本轮重跑 EXIT=0 | 「添加主屏幕后启动」需真机验证，本机无法自动化；未跑 Lighthouse PWA 审计（见 11.6） |
| E5 视觉走查：无默认 AI 审美、色彩全来自 token、philia 按钮 60fps | ⚠️ | tokens.ts 锁定品牌色（暖杏橘/奶杏系渐变，非紫蓝）；走查截图 `shots/*.png`（customer-home/philia、merchant-dashboard、p2-\* 系列） | 60fps 动效无法本机自动化测，建议真机 DevTools Performance 抽查 |

## 11.6 发布门槛核对

| 门槛 | 结果 | 证据 |
|---|---|---|
| 上述用例 100% 通过 | ❌ 未达成 | 30✅/4⚠️/1❌（D3 为实质缺口） |
| 三端 Lighthouse PWA 检查通过 | ⚠️ 未跑 | 以 manifest/sw/icons 静态检查代替（全过）；建议补 `lighthouse` CLI 三端审计 |
| 客户端首屏 LCP ≤2.5s（4G 节流） | ⚠️ 替代口径 | 无节流 dev 构建实测 **1264ms**（FCP 1215ms / DCL 1198ms，390×844 mobile，CDP Performance API）；未做 4G 节流。日志 `acceptance-logs/lcp.log` |
| live 页 SSE 首事件延迟 ≤1s | ✅ | C5 实测：事件在 mutation 往返（≤15ms 量级）内到达 |

---

## 发现的 Bug / 问题清单

| # | 严重级 | 描述 | 位置 | 处置 |
|---|---|---|---|---|
| BUG-1 | 低（测试卫生） | Windows 下各测试结束 `rmSync` 临时库目录偶发 `EPERM`（libsql 句柄释放滞后），已 maxRetries=5 仍失败；`%TMP%` 残留 `philia-*` 目录（本轮约 26 个）。不影响断言与退出码 | e2e.ts:584、c5/http-smoke 等同款 cleanup | 未改（非一行可明确修）。建议：cleanup 前 `await sleep(300)` 后再重试，或文档化「定期手工清 %TMP%\philia-*」 |
| BUG-2 | **中（功能缺失）** | D3「寄养超期每日提醒」无实现：`boarding.overdue` 事件类型与 bus 映射已定义但无发射方、无每日定时任务 | server/src/realtime/events.ts、bus.ts（仅定义）；routers/boarding.ts（仅 stayBoard 超期标记） | 未改（属新功能非一行修）。建议见下 |
| ENV-1 | 环境（非产品 bug） | 本轮开始前 7200/7100 被历史会话残留进程占用（pid 28584/6196），曾致 C5 误连旧实例报 dev-login 403。已 taskkill 清理；`acceptance-c5.mts` 已加端口前置检查防再踩 | — | 已处理 |
| ENV-2 | 环境（非产品 bug） | 报告完成时 7101/7102/7200/9223 仍有监听（pid 4816/24596/31624/10024，三端 dev server + 调试 Chrome 的完整开发套件）。**已逐一核实非本轮验收所起**（本轮每次运行后均验证端口已释放；9223 Chrome 未使用本脚本 profile 目录），应为共享工作区并行任务的开发环境，按约定不动他人进程 | — | 保留，不动 |

> 本轮未修改任何产品代码。新增 3 个验收脚本（C5 实测、E2 补测、LCP 粗测），均自带临时库与进程清理。

## 遗留缺口与修复建议

1. **D3（❌，建议 P6 内补）**：在 server 启动处（可与 outboxSweeper 同进程）加每日定时任务：扫描 `status=in_boarding 且 scheduled_end < now` 的预约，按 `(appointmentId, 日期)` 幂等 `emitEvent(store 频道, boarding.overdue)`；商家端监听该事件出待办。补一条 domain.smoke 用例（注入超期 stay → 跑扫描 → 断言事件 + 当日幂等）。
2. **C1（⚠️）**：补 CDP 断网实测脚本：`Network.emulateNetworkConditions(offline)` 拍照 3 张 → 恢复在线 → 断言 flushRound 按序上传、服务端落库完整。
3. **C3（⚠️）**：补崩溃注入测试：emit 后 `kill -9` server 子进程 → 重启 → 断言 sweeper 重投且事件不丢（acceptance-c5.mts 的子进程模式可复用）。
4. **E4/11.6（⚠️）**：补 `lighthouse` CLI 对三端 dist 做 PWA 审计；LCP 按 4G 节流口径（CDP `Network.emulateNetworkConditions` + CPU 节流）复测；「添加主屏幕」真机走查。
5. **E5（⚠️）**：真机 DevTools Performance 抽查 philia 按钮动效帧率。
6. **BUG-1（低）**：测试 cleanup 加重试前延迟，消除 `%TMP%` 残留。

---

### 附：证据文件索引

- 测试日志：`acceptance-logs/{auth,appointment,serviceStep,domain,mall,realtime,http-smoke,storage,e2e,c5,lcp,build-*}.log`
- 新增脚本：`philia/server/scripts/acceptance-c5.mts`（C5）、`philia/server/scripts/acceptance-e2-staff.mts`（E2）、`philia/shots/acceptance-lcp.mjs`（LCP）
- 走查截图：`philia/shots/*.png`

---

## 附记（2026-09-05 · 验收后修复）

- **D3（原 ❌）已修复**：`emitBoardingOverdue` 寄养超期每日幂等发射器落地（outboxSweeper 同进程，启动即查 + 30min 轮查，按预约×自然日幂等，写入 outbox 并即时广播 + 商家站内通知）。冒烟 7 断言全过（首扫发射/同日幂等跳过/次日再发）。修复后 D 组 5/5 ✅，**总通过率 34/35（仅余 C1/C3 自动化注入测试与 E4/E5 真机走查类 ⚠️ 项）**。
- T6.2 打磨同步完成：种子商品占位图、三端三态补齐、favicon、历史 chips 横滑等（详见 plan.md P6）。
