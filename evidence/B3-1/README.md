# B3-1 证据包（A-P0-9 结构性：completed 预约「打标重拍」改重开 · 红标）

验收预约：`01M1XSQM5NQXE6S4QERMX49VFN`（门店 01M1WVC76NH73BZSP1KQ6SXBAC，员工 小美，客户 示例客户/旺财）。
回滚实证预约：`01M1XTJHBGG162JH9GDX9HCF5M`（pending→cancelled）。
种子用户均经 `GET /api/auth/dev-seed-users` 动态获取，未硬编码 ULID。

## 1. 复现（修复前，HEAD=823a729）

| 文件 | 内容 |
| --- | --- |
| `repro.md` | 复现记录：根因（serviceStep.ts:537-542 批次 1 止血守卫）+ 死局机理 + 步骤 |
| `repro-curl-before-fix.txt` | completed 单打标被拒原始 curl 输出（BAD_REQUEST「预约已完成，不可打标重拍」） |
| `snap-00-before-flag.json` / `snap-01-after-rejected-flag.json` | 打标前/被拒后查库快照（appointment+steps+photos+outbox） |
| `compare-snaps.py` | 快照逐项对比脚本；01 与 00 对比四项全等（拒绝守卫无写库副作用） |

## 2. 红标门禁 · 事务与回滚

| 文件 | 内容 |
| --- | --- |
| `curl-10-flag-reopen-success.txt` | 修复后 completed 打标放行：`{reactivated:true, reopened:true}` |
| `snap-11-after-flag-reopen.json` | **重开后快照**：预约 completed→in_service、completedAt 由 `11:23:24Z` 清空为 null；confirm 步 done→active、flagged=true、doneAt 清空；前五步保持 done |
| `curl-20-pending-flag-rejected.txt` | pending 单打标仍拒（NOT_FOUND「六步流未初始化」） |
| `curl-21-cancelled-flag-rejected.txt` | cancelled 单打标仍拒（BAD_REQUEST「预约已取消，不可打标重拍」） |
| `snap-20/21/22/23-*.json` | **回滚实证**：pending/cancelled 拒绝前后快照四项（appointment/steps/photos/outbox）逐字节一致（compare-snaps.py 输出见会话记录，均 True） |

事务性说明：重开的「预约回退 + completedAt 清空 + 步骤 reactivate + 旧照片作废 + outbox 事件」
全部在 `flagForRedo` 的同一 `db.transaction` 内；不变量校验失败/目标步不合法即抛错回滚。
失败路径（pending/cancelled/locked 步/非 frontier done 步）均为事务内抛错或前置拒绝，查库零变化。

## 3. 红标门禁 · 三频道 reopened 事件

| 文件 | 内容 |
| --- | --- |
| `outbox-12-reopened-3channels.json` | event_outbox 中 `appointment.reopened` 三条记录齐全：`appointment:{aid}` + `store:{storeId}` + `user:{customerId}`，payload 均含 appointmentId/stepKey/by（另带 petName 供通知文案） |

## 4. 二次完成全链路

| 文件 | 内容 |
| --- | --- |
| `staff-execute-reopened.png` | **员工端 7102 六步执行页（重开态）**：第 6/6 步 active + 顶部「商家要求重拍：完成确认」横幅 + 「确认服务完成」主按钮 |
| `staff-execute-second-complete.png` | 员工点击「确认服务完成」后：庆祝层自动收起并回到今日任务页（confirm 成功路径的 UI 证据） |
| `snap-30-after-ui-second-complete.json` | UI 二次完成后查库：completedAt 重写为 `11:41:58Z`（首次 `11:23:24Z`）；completed 事件 appointment/store 双频道各 ×2 |
| `curl-30-third-cycle-reopen-and-complete.txt` | 第三轮 curl 接口输出：重开 `{reopened:true}` → confirmStep 返回 `{appointmentCompleted:true}` |
| `snap-31-final-third-complete.json` | 第三轮完成查库：completedAt `11:43:09Z` 再重写；completed 事件双频道各 ×3、reopened 三频道各 ×2 |
| `curl-40-final-complete.txt` / `snap-40-final.json` | 第四轮（三端 UI 取证后）收尾完成：completedAt `11:47:52Z`，预约回到 completed 终态 |

## 5. 三端 UI 联动（重开态 = in_service 展示成立）

| 文件 | 内容 |
| --- | --- |
| `ui-reopened-customer-detail.png` | 客户端详情页：状态 pill「服务中」+ live 入口横幅 + 服务相册（10 张，按 done 步分组）+ 无「再次预约/评价」按钮（仅 completed 显示）——不破版 |
| `ui-reopened-merchant-monitor.png` | 商家监控页：徽标「服务中」，时间轴 5 步 done + 完成确认「进行中 · 已打标，等待重拍」，可继续打标 |
| `ui-reopened-merchant-list.png` | 商家预约列表：该单以「服务中」徽标归位（预约时间 9月8日 09:00 行） |

注：截图中照片占位为灰块/破图，系验收驱动使用假 URL 登记照片（未真实上传），非 UI 缺陷。

## 6. 配套校验（会话内已跑）

- `serviceStep.smoke.ts`：新增 [7] 节 12 项断言全绿（含三频道事件、回滚拒绝、二次完成重写）；
  顺带修复 B2-8 双频道落库后 [6] 节 `lastOutbox` 按频道取行的既有失败断言（修复前即红，与本次无关）。
- `appointment.smoke.ts` / `domain.smoke.ts` / `mall.smoke.ts`：全绿。
- `server tsc --noEmit`：exit 0；三端 `npm run build`（customer/merchant/staff）：全绿。
