# PD-77 · 拍照时间窗 · 卷宗

> 窗：PD-77-photo-time-window ｜ 分支 `feat/pd77-photo-time-window` ｜ 基线 main@`a73f02b2b7cc1fdb2f92398f640946546a7d4ec0`
> 范围：仅服务端 `serviceStep.addPhotos` 拍照时间窗判定＋拒收原因码（潘婧 R7 口径）；不改 PD-76 UI 状态机；零 schema（迁移号 0117 未实际占用，无迁移文件产生）。

## 判定公式（默认口径 · 合后可微调）

- 输入：照片项 `clientTakenAt`（Unix 秒，=上传口返回的 EXIF 拍摄时刻）；预约槽＝`appointments.scheduledStart`/`scheduledEnd`；店历＝门店规范时区 Asia/Shanghai 固定 +8（B8-B4 同帧，`server/src/lib/storeClock.ts`）。
- **闸① 拍摄窗**：`clientTakenAt*1000 ∈ [scheduledStart − 15min, scheduledEnd + 15min]`（闭区间）。窗外 → 400 `PHOTO_TIME_OUT_OF_SLOT`。
- **闸② 服务日**：`storeDayStartMs(storeWallclock(now)) === storeDayStartMs(storeWallclock(scheduledStart))`（即 now 与槽起同店历日；**不要求 now∈槽**）。非当日 → 400 `PHOTO_DAY_MISMATCH`。
- 两道闸仅对带 `clientTakenAt` 的照片生效；**缺 EXIF 放行留痕**（落 `flag_reason='EXIF 缺失或未提供'`，只标记不阻断）——与既有 B5-2 留痕政策一致，两道闸同免。
- 取代旧窗 `[step.startedAt−30min, now+5min]`（窗外/晚传均 400 且文案技术化）。

## 原因码表（供 PD-76 状态机透传）

| reasonCode | HTTP / tRPC | 员工口语文案（message 原文） | 触发 |
|---|---|---|---|
| `PHOTO_TIME_OUT_OF_SLOT` | 400 / BAD_REQUEST | 拍摄时间不在本次服务时段（含±15分钟容差），请重拍 | 拍摄时刻 ∉ 槽±15min |
| `PHOTO_DAY_MISMATCH` | 400 / BAD_REQUEST | 请在服务当日上传本次服务照片 | now 不在服务日（当日上传限制） |

透传通道：throw 时带 `cause:{reasonCode}`，`errorFormatter`（server/src/trpc.ts）转发至线上错误体 `error.data.reasonCode`（无 cause 的旧错误形态不变）。PD-76 侧读取 `err.data.reasonCode` 分支、`err.message` 直接展示（口语文案无技术词）。

## HIT 表

| # | 断言 | HIT/MISS | 证据路径 | 代码位置 |
|---|---|---|---|---|
| 1 | 拍摄∈槽±15min＋now∈服务日 → 上传成功 | HIT | `02_after_serviceStep.smoke.txt`（[8] 段三临界值全过）、`03_wire_addPhotos_HTTP.txt`（A 例 200） | serviceStep.ts addPhotos（窗①） |
| 2 | 拍摄∉槽±15min → 拒＋口语原因（非技术词） | HIT | 02（窗外 ±16min 两例）、03（B 例 400 envelope 全文） | serviceStep.ts（窗①）＋trpc.ts errorFormatter |
| 3 | now∉服务日 → 拒＋当日相关文案 | HIT | 02（明日单例）、03（C 例 400 envelope） | serviceStep.ts（闸②） |
| 4 | PD-76 状态机仍可展示拒收原因（本令未改 UI） | HIT | 03 envelope：`data.reasonCode`＋`message` 同帧透出，读取面与既有 `err.data.code`/`err.message` 约定一致；apps/staff 零改动 | trpc.ts errorFormatter |
| 5 | 最小 diff；未改 PD-76 UI／未碰夹具 `01M5EQVFSQCFZYXB6FB945DSQB` | HIT | `05_diff.txt`（4 改 1 新全在 server/；无 apps/staff、无 schema/seed 触碰） | — |

## 文件清单

| 文件 | 内容 |
|---|---|
| `01_baseline_serviceStep.smoke.txt` | 基线 a73f02b smoke 对照（3 项基线既有红：两条归属校验期望 stale＋[7] 段 service_certificates 唯一约束未捕获异常；与本令无关） |
| `02_after_serviceStep.smoke.txt` | 改后 smoke：[8] PD-77 段 6/6 全绿；其余段与基线完全一致（同 3 项基线红，无新增失败） |
| `03_wire_addPhotos_HTTP.txt` | 网络层实测：真 server＋真 HTTP，A/B/C/D 四例 envelope 原文（含 `data.reasonCode`） |
| `04_typecheck.txt` | `tsc --noEmit`：仅剩基线既有 `pd66EvidenceFixture.ts` TS1375（未触碰该文件） |
| `05_diff.txt` | 完整 diff＋stat＋新文件全文 |
| `06_e2e_全量回归.txt` | e2e 全量回归·改后（E2E_PORT=7277，完整跑通至 §107）：1042✓／4✗ |
| `07_e2e_基线对照.txt` | e2e 全量回归·基线 a73f02b（E2E_PORT=7288）：1042✓／4✗——✗ 清单与改后**逐项一致**（57.1 种子槽 live 注册／74.11 到期 cohort／77.2 dock 键值／81.4 效期批次，均为种子或日期型既有失败），**本令零新增失败** |

注：网络层实测脚本为一次性用品（`server/scripts/pd77-wire-check.mts`），跑完即删、不进 git（测完自清）。
