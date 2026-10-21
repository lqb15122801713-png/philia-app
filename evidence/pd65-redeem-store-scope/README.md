# PD-65 · 核销店范围／前台 execute404（小美核销 toast 成功 → execute 404「预约不存在」）

- 分支：`feat/pd65-redeem-store-scope`
- 基线：main@`923b4b382d40a50a8d3a1b07a6035454b857be61`（短 `923b4b3`）
- 基线获取：git:443 阻塞（github.com TCP 不通）→ 绕行通道＝`ssh.github.com:443` + 临时 deploy key
  （gh API 可达，api.github.com/codeload 正常；`git fetch ssh://git@ssh.github.com:443/...` 拿到真 tip 对象，
  `git rev-parse HEAD`＝全 sha 核验一致；deploy key `pd65-a-window-temp` id=167171003，只开不合用后由头子侧裁撤）
- 范围：仅 `assertAppointmentAccess` staff 分支一行放宽（已核销单=本店班次共享）＋一条 PD-65 冒烟；
  **未动 drizzle／`_journal.json`（迁移号 0106 声明未占用）**、未动派单/收银/提成归属口径、未动前端
  （toast 本就以 mutation resolve 为准，无乐观成功路径——见下）。

## 根因与修复

**根因（口径撕裂）**：批次 S1-R1 把核销定义为「到店登记」——本店任意单可核销、**不认领、不改写
`staff_id`**（`server/src/routers/appointment.ts:1994-1995, 2069-2072`）；但 execute 读口
（`appointment.get`＋`serviceStep.list`）与六步写口（`addPhotos/confirmStep/deletePhoto`）共用
`assertAppointmentAccess`（`server/src/trpc.ts:229-268`）的 staff 分支＝**本店且（未指派或指派给本人）**。
小美（同店 frontdesk）核销派给阿强的 grooming 单后 `staff_id` 仍是阿强 → 核销 toast 真成功
（status→in_service、六步已初始化）→ 导航 `/execute/:id` 时归属闸在 `trpc.ts:268` 抛
NOT_FOUND「预约不存在」。boarding 单早已用 `staffBoardingStorewide` 放宽（PD-24 D-52，
照护=班次共享动作）；grooming 是唯一未对齐的类型——同店派单／核销可见性由此撕裂。

**修复（最小 diff·一行放宽）**：`server/src/trpc.ts` staff 分支追加 `appt.checkedInAt !== null`——
已核销单（in_service/completed 及此后各态）对本店任意在职员工放行（读＋六步写），与核销
「本店任意单」口径闭环：核销成功即可真正进服务，toast 与 execute 结果一致。责任/提成归属仍以
`appointments.staff_id` 为准（核销不认领纪律不动）；未核销单「未指派或指派给本人」闸不变；
跨店仍统一 NOT_FOUND（片 2 裁件①防探测口径不回退，冒烟反锚已断言）。
覆盖 `completed` 态是必要的：末步 confirmStep 后 ExecutePage invalidate 重取 `appointment.get`，
若只放 in_service 会在完成瞬间回 404 守卫页（庆祝层被 queryError 分支抢先）。

**前端零改动**：核销 toast 本就挂在 `await checkin(...)` resolve 之后
（`apps/staff/src/components/scan/QrScanner.tsx:80`、`ManualCodeInput.tsx:35`，失败走 catch →
`toast.error`）——无乐观成功路径；修复后成功路径两端一致（mutation 成功 ⇒ execute 可进），
失败路径 mutation 拒绝 ⇒ 只会 toast.error（无成功 toast 前提由冒烟失败路径断言兜底）。

## RED → GREEN

```text
RED（修复回滚 trpc.ts，仅留新测试）——02 之前见 01_red_execute404_appointment.smoke.txt：
  ✓ PD-65 失败路径：groomer 核销 → FORBIDDEN「核销需前台账号操作」
  ✓ PD-65 失败路径无脏状态
  ✓ PD-65 成功路径：同店前台核销他人单 → in_service 且 staff_id=st-e
  [smoke] 未捕获异常： TRPCError: 预约不存在
      at assertAppointmentAccess (server/src/trpc.ts:268:9)
      at appointment.ts:1321（appointment.get）        ← 令包缺陷原样复现
GREEN（修复后）——02_green_appointment.smoke.txt：
  ✓ PD-65 失败路径：groomer 核销 → FORBIDDEN「核销需前台账号操作」（无成功 toast 前提）
  ✓ PD-65 失败路径无脏状态：status 仍 confirmed / checked_in_at NULL / 六步 0 行
  ✓ PD-65 成功路径：同店前台核销他人单 → in_service（状态真变更）且原指派保留 staff_id=st-e
  ✓ PD-65：核销人 appointment.get 放行（execute 页数据源不再 404）
  ✓ PD-65：核销人 serviceStep.list 放行（六步就绪，step1 active）
  ✓ PD-65：核销人 confirmStep 可执行——step1 done、step2 active（成功则真正进服务）
  ✓ PD-65 反锚：跨店员工读同一已核销单仍统一 NOT_FOUND「预约不存在」
```

## 验证记录

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit`（server） | exit 0 |
| `npx tsx src/routers/__tests__/appointment.smoke.ts` | PD-65 七断言全 ✓；全程 0 ✗；末尾仍死于**基线既有**红（片 2 医疗授权闸后 boarding 建单夹具未更新：`寄养单须先签署医疗授权`，见 03 基线同错同位置），非本次引入 |
| `npx tsx src/routers/__tests__/serviceStep.smoke.ts` | 与基线完全同红 4 项（3 条跨店/客户归属断言停在 FORBIDDEN 旧口径＝片 2 裁件①后应为 NOT_FOUND 的既有漂移＋1 条 `service_certificates` 建表漂移崩溃；04 基线 vs 05 修后逐行一致），本修不新增红、且跨店 NOT_FOUND 口径保持不变 |
| `npx tsx src/routers/__tests__/mall.smoke.ts` | 全部通过 ✅（06） |
| `npx tsx src/routers/__tests__/domain.smoke.ts` | 基线即崩 `no such table: users`（夹具/建库漂移；07 基线 vs 08 修后同崩），与本次一行归属放宽无因果 |
| `npx tsx src/__tests__/e2e.ts`（全量） | 修后推进至 §86.5（09）；核销/S1-R1/六步推进/78.x 双店互盲全 ✓。7 条 ✗ 全为既有漂移：copy 种子计数 4279→4300（56.1/76.3 同族，基线同红 56.1）、wnav.dockMe 键值漂移（77.2）、效期分级时间雷（81.4 daysLeft=6 得 urgent，断言写死 warn）；两次运行均死于本地 undici fetch failed（in-process HTTP 层 flaky：基线更早崩于 §76.2，见 10），均与本 diff 无因果（本 diff 不碰 copy/stock/config 域） |

## 变更清单（2 文件，最小 diff）

```text
server/src/trpc.ts                                  +6/-1  staff 分支一行放宽 + PD-65 注释口径
server/src/routers/__tests__/appointment.smoke.ts   +75    [3b] PD-65 一条测试（成功路径状态变更
                                                            ＋execute 读/写贯通＋失败路径零脏状态
                                                            ＋跨店反锚）
```

## 清理

冒烟均为独立临时库（%TMP% mkdtemp），跑完自清；未触碰 `server/data/philia.db` 种子库；
未装新依赖（server/node_modules 由 pd62 同锁树 robocopy 复用，`package-lock.json` 逐字节一致）；
迁移号 **0106 未使用**（未动 drizzle／`_journal.json`）。
