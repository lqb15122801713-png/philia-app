# 监控僵尸 P1×2（D-47→D-48 · PD-22）卷宗 · evidence/monitor-zombie-p1

- 开工令：产品-1013-监控僵尸P1（任务书=冻结版 V1.0，老板 10-13「那就现在安排修」；开口①～④按推荐收死；本批只修 D-44 残留）
- 档位：K1（清淤脚本 dry-run+白名单；无新支付通道）；同片两刀（片内序 D-47→D-48）
- 基线：生产 main@`8bbba6da`（全 8bbba6da01b4e4191bd6ec78151697addf0c6e66；PD-21 已合部亲验尖）
- 分支：feat/monitor-zombie-p1（PR 只开不合，base=main）；本卷宗=evidence/monitor-zombie-p1

## 一、两刀明细

| 刀 | 面 | 改动 | 实证 |
|---|---|---|---|
| D-47 清淤/截流 | server appointment.forceCompleteStale 新端点 + server/scripts/monitor-zombie-cleanup.mts 新脚本 + MonitorHubPage 桶内动作行 | 端点：merchantManager 本店闸；in_service+≥24h 未翻步（checkedInAt 兜底 scheduledStart，与读时分桶同口径）才可强完；翻 completed+completedAt+outbox appointment.completed 事件留痕（by/forced/note/beforeStatus/checkedInAt=谁/何时/单号/前后状态齐）；幂等（已 completed=idempotent）；真慢单<24h=400 不误伤；寄养 in_boarding=400 不适用；零物理删零翻六步逐行。脚本：dry-run 只列、apply 走真端点（单源留痕零双轨）、白名单=演示/走测标记（%【测试】%/%演示单%/wtshot% 前缀）、JSON 报告、可重复跑。UI：异常待清桶内单卡出「强制完成」动作行（确认+toast） | e2e 104 族五断言（阈值 400/clerk 403/强完+留痕/幂等/寄养 400）；实尺 J1a（桶内 2 僵尸+动作行）/J1b（强完一卡+事件落库）/J1c（脚本 dry-run 零写+apply 白名单收口+真在服零误伤+桶归零）+脚本日志/报告入卷 |
| D-48 去处理真跳 | MonitorHubPage 预警行 | 异常待清聚合行「去处理」由原地切滤签（PD-21 残留的空跳）改为 `to=/monitor/<首只僵尸 id>` 真链（WAlert 既有 to 工艺）；目标页=AppointmentMonitorPage（六步进度/快捷操作/照片墙=该单可排障页，施工回执选定路由）；真跳=URL+页内容双变；可回=返回 monitor 桶语境在 | 实尺 J2（跳转前/后帧：/monitor → /monitor/mzshotA…，监视墙在屏+可回桶在） |

## 二、迁移申报（键入码必随迁移）

- `server/drizzle/0082_monitor_zombie_p1.sql`（journal idx 82）：copy 键 **5 增**（mon.forceCompleteCta/Confirm/Note/Toast/Fail）；幂等 NOT EXISTS；生成件单源逐字；staging 用后已删。
- copy active=**4260**/72 域（生成件 4259+seed 手补 1；e2e 计数四处+双链注释同步）。
- 清淤脚本=运维件不入 journal。

## 三、闸门表（栈=7130/7131/7132 preview + 7200 API，CORS 显式三端；库=mz-gate.db 新库 migrate+seed，0082 实证 4260 键）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck / 全仓 build 零参版 / 栈版 | 绿 | typecheck.log / build-gate.log / build-stack.log |
| e2e 连跑 | **两绿**（104 族五断言全绿；另 1 红=ECONNRESET 环境件早夭，净场复跑即绿） | e2e-green-1/2.log + e2e-env-econnreset-note.log |
| nav 闭环 | 126 路由 · 死胡同 0 · 弱 0（零新路由） | nav.log / nav.json |
| smoke-routes | 110/110 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 5 帧 SHOTS_ALL_GREEN（9 断言） | shots/ + shots.log + checks.json |

## 四、实尺截图清单（shots/）

1. J1a-bucket-two-zombies.png —— 异常待清桶 2 僵尸（真在服不入桶）
2. J1b-force-complete-one.png —— 桶内单卡「强制完成」后：completed 落库+留痕事件（by/forced/note/前后状态齐）
3. J1c-bucket-clean-zero.png —— 清淤后桶归零（演示店=0 可解释）+真在服单留在主列表
4. J2-after-goto-monitor-detail.png —— 「去处理」真跳后帧：/monitor/mzshotA… 该单监视墙（六步/快捷操作/照片墙=可排障）
5. （清淤留痕件）zombie-cleanup-dryrun.log / zombie-cleanup-apply.log / zombie-cleanup-report.json

## 五、候裁明面（四件照实报）

1. **D-48 路由选定=商家端 `/monitor/:id`（AppointmentMonitorPage 单约监视页）**：六步进度+快捷操作+照片墙=可排障；预警聚合行跳「首只僵尸」单；桶内单卡点击=既有 /monitor/:id 同口；如要跳客户侧交付详情=另裁；
2. D-47 强制完成=店长可点（merchantManager）；端点幂等+阈值 24h 写死与读时分桶同根；**六步逐行零翻**（不伪造步骤证据，步骤留空=诚实）；
3. 清淤脚本=HTTP 走真端点（单源留痕零双轨），须 API 在跑；白名单=演示/走测标记，生产真实慢单永不命中；
4. 强制完成不动金额联动（无退款/无结算触碰）——钱域零触。

## 六、纪律自查

零新依赖 ｜ 迁移幂等+申报（0082 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 零无留痕物理删 ｜ 真支付/真退零触 ｜ D-31 关未碰 ｜ D-34 坐标未动 ｜ D-29 守卫族每跑照绿 ｜ PD-21 分桶保留零回退 ｜ 不扩 K2/K3/K5 及其他 P1/P2 ｜ 不重做监控 IA ｜ 不判美 ｜ 清淤脚本 dry-run+白名单+留痕+可重复 ｜ 收摊必净（PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
