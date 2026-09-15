# 批次 9a · 任务 B（一键再约 + 首页主区双态面板）证据索引

施工分支 `feat/b9a-booking`（任务 A = 2bc806b 之上）。全部证据为本地产出，不入库。

## ① 一键再约：全程 1 次点击 + 建单与单屏同参数一致
- 截图链：`oneclick-1-home-before-click.png`（首页常态面板，CTA「预约并支付 · ¥88」）
  → `oneclick-2-success.png`（单次点击后落既有 /booking/success）。
- DB 对比：`oneclick-db-before.json` / `oneclick-db-after.json`（客户单总数 14→16，面板 1 单 + 单屏 1 单）；
  `oneclick-db-row-panel.json`（面板建单）/ `oneclick-db-row-single.json`（单屏同参数建单）
  / `oneclick-db-compare.json`——storeId / serviceId / petId / scheduledStart / paymentMode / priceFen
  六字段逐一相等（`__allEqual: true`）；`oneclick-3-single-same-slot.png`（单屏选同一槽实证）。
- 另：首轮一键实证（12:30 槽，aid=01M2HHNNQCA239JSSS77PDKX0V）亦 1 次点击直达成功页，
  该轮槽位被其占满后，上面第二轮在 13:00 槽完成同槽对比。

## ② 降级三态（不替用户猜 → 「预约洗护 ›」入口卡）
- `degrade-1-no-memory.png/.txt`：无下单记忆 → data-reason=no-memory；
- `degrade-2-pet-undecided.png/.txt`：记忆缺 petId 且客户 2 只宠物 → data-reason=pet-undecided；
- `degrade-3-no-slot.png/.txt`：记忆指向全天休息测试店（造数后即删）→ data-reason=no-slot；
- 三态入口 href 均为 /booking/grooming（B4-3 预填链在单屏继续生效）。

## ③ 最早可约槽 = 单屏栅格首可用格（双环境）
- `tz-server-cst-compare.json`（服务端 TZ=Asia/Shanghai）/ `tz-server-utc-compare.json`（服务端 TZ=UTC）：
  面板 CTA data-slot-start = 单屏首个 data-available 格 data-slot-start = tRPC slots[0]，
  两环境各自全等且跨环境 epoch 相同（1789450200000 = 2026-09-15T05:30:00Z，B8「+8 规范时区」口径成立）；
- 同帧截图：`tz-server-cst-panel.png`/`tz-server-cst-single.png`、`tz-server-utc-panel.png`/`tz-server-utc-single.png`；
- 信息项（非闸门）：`tz-browser-utc-note.json` + `tz-browser-utc-single.png`——浏览器 TZ=UTC 时
  面板 epoch 保持一致（面板直接用服务端槽，TZ 无关）；单屏栅格在 UTC 浏览器下候选格按浏览器本地
  日界生成、与 +8 槽错位属 B4 单屏既有行为（本批不动单屏逻辑，见回报疑点）。

## ④ 幂等：同一事件循环三连击只产生一单
- `idempotent-compare.json`：客户单总数 16→17（+1），同槽同服务唯一新单 = 成功页 aid；
  `idempotent-success.png`。前端防线 = submittingRef 同步锁 + isPending 禁用；
  服务端 appointment.create 现状无幂等键（本批不动服务端，已如实上报）。

## ⑤ 服务中面板（in_service 时替换常态面板）
- `inservice-1-initial.png/.json`：当前步骤名「消毒工具确认」+ 第 1 步/共 6 步 + 细线进度条 +「查看实时直播 ›」；
- `inservice-2-step2-photo.png/.json`：页面零操作，员工 confirmStep 经 SSE step_updated 驱动——
  推进「预检 第 2 步」、doneCount=1、最新员工照片缩略出现（serviceStep.list 复用，零新接口）；
- `inservice-3-switch-b.json`：A 单完成后经 SSE 切到次选 in_service 单（多服务中单取最新）；
- `inservice-4-switch-rebook.png/.json`：全部完成后经 SSE appointment.completed 切回常态一键再约面板。

## ⑥ GroomingReminder 共存对照
- `coexist-entry-reminder-shown.png/.txt`：降级入口卡态 reminder 正常渲染（距上次洗护已 20 天）；
- `coexist-rebook-reminder-hidden.png/.txt`：rebook 态（数据条件满足时）reminder 被隐藏——
  一键路径已被主区面板覆盖；`coexist-verdict.json` PASS。
- 注：造数脚本将 3 个测试单 completedAt 拨至 -20 天取证后已还原（scripts/b9b-reminder-dates.mts）。

## ⑦ 回归闸门
- `exit-codes.txt`：三端 build 0 / smoke-routes 30/30（含新增 / 与 /booking/success）0 /
  server typecheck 0 / 既有 server e2e 0 / FFAAA5 apps 0 命中 / 本批新增 text-white 0；
- 日志：`build.log`、`server-typecheck.log`、`server-e2e.log`、`smoke-routes.json`；
- 复现（改造前）：`repro-home-with-memory.png/.txt`、`repro-home-no-memory.png`（主区无双态面板）。

## 验收脚本（可复跑）
`scripts/`：b9b-lib.mjs（CDP 库）、b9b-repro.mjs、b9b-inservice.mjs、b9b-oneclick.mjs、
b9b-idempotent.mjs、b9b-degrade.mjs、b9b-coexist.mjs、b9b-tz-compare.mjs、b9b-tz-browser-utc.mjs、
b9b-walk-steps.mts（六步流状态机走步）、b9b-appt-snapshot.mts（DB 快照）、
b9b-closed-store.mts（无可约槽测试店造/删）、b9b-reminder-dates.mts（共存造数）、b9b-dbstate.mts。
