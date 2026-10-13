# 强制完成 CTA P1（D-49 · PD-23）卷宗 · evidence/force-complete-cta-p1

- 开工令：产品-1013-强制完成CTA-P1（任务书=冻结版 V1.0，老板 10-14「现在修」；PD-22 收口=D-48 PASS；开口①～⑤按推荐收死；本批只修 D-47 残留）
- 档位：K1（清淤脚本 dry-run+白名单+BETA_GATE；无新支付通道）；单片一件
- 基线：生产 main@`27c15d4d`（全 27c15d4dbd8a7389724b2be0ff1434ab427ca69c；PD-22 已合部亲验尖）
- 分支：feat/force-complete-cta-p1（PR 只开不合，base=main）；本卷宗=evidence/force-complete-cta-p1

## 一、单件明细（D-49）

| 面 | 改动 | 实证 |
|---|---|---|
| CTA 稳定可见可点 | 缺口坐实：桶内 CTA 藏在滤签视图后+D-48「去处理」直飞详情页（详情快捷区零 CTA）=走测路径上零 CTA。修=**详情页（/monitor/:id）快捷操作区出「强制完成」**（闸=in_service+≥24h 未翻步，与读时分桶同口径；确认+sonner toast+双 invalidate）；桶内单卡 CTA（PD-22 件）保留不回退。端点=复用 `appointment.forceCompleteStale` 单源，零双轨零裸 UPDATE | 实尺 F1a（桶内 3 卡 3 钮）/F1b（详情快捷区 CTA 帧+点后 completed+forced 留痕事件落库）/F1c（退桶计数 3→2） |
| 脚本 BETA_GATE 硬化 | `monitor-zombie-cleanup.mts`：dev-login 体带 `BETA_GATE_CODE`（env 有则递）；缺码 401/错码 403 明文诊断退出（「内测口令门在跑时请带 BETA_GATE_CODE」），零临补 | 实尺 F2：口令门 server（7201）上 无码 apply=exit≠0 明文诊断+零写库（A 仍 in_service） / 带码 apply=白名单收口（A completed）/ 非白名单 D+真在服 F 零触 / dry-run 零写；日志+报告入卷 |
| 不回退守卫 | 读时分桶（PD-21）+去处理真跳（PD-22）双回退帧在卷 | F3a（去处理仍真跳 /monitor/:id）+桶计数链全绿 |

## 二、顺手修掉的基建时间雷（报备 · 非本批范围）

- **103.1 钉程**（PD-21 自家件）：预约提前期上限=注册用户 7 天，+7/+8 日钉程越限 400——钉程改 ≤+6d（断言口径不变）；
- **82.4 排期状态机**（主干既有件）：promoUpsert 把「本地今日」存成 **UTC 日界**（T00:00:00Z），本地 00:00–08:00 窗口内 effectiveStatus=scheduled 误红——e2e 夹具改钉昨日（断言目标不变）；**生产侧「今日起租=UTC 日界非本地日界」语义=P2 候裁报备（本批不动 marketing.ts）**。

## 三、迁移申报

**零迁移**——零新 copy 键（详情页 CTA 复用 PD-22 mon.forceComplete 族五键）；清淤脚本=运维件入仓不入 journal。

## 四、闸门表（栈=7130/7131/7132 preview + 7200 API + 7201 口令门实证件（CORS 显式）；库=fc-gate.db 新库 migrate+seed）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck / 全仓 build 零参版 / 栈版 | 绿 | typecheck.log / build-gate.log / build-stack.log |
| e2e 连跑 | **两绿**（1022 断言/跑，103/104 族照绿；另 1 红=ECONNRESET 环境件早夭净场即绿） | e2e-green-1/2.log + e2e-env-econnreset-note.log |
| nav 闭环 | 126 路由 · 死胡同 0 · 弱 0（零新路由） | nav.log / nav.json |
| smoke-routes | 110/110 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 5 帧 SHOTS_ALL_GREEN（10 断言） | shots/ + shots.log + checks.json |

## 五、实尺截图清单（shots/）

1. F1a-bucket-card-cta.png —— 异常待清桶 3 僵尸卡各带「强制完成」钮（稳定可见可点）
2. F1b-detail-quickaction-cta.png —— 详情页快捷区「强制完成」钮在屏（第7轮「详情未见」销项）
3. F1c-after-force-count-down.png —— 详情 CTA 点后：completed 落库+留痕事件+桶计数 3→2
4. F2-after-script-bucket-one.png —— 脚本收口后桶仅剩非白名单 D=1（可解释残留）
5. （清淤留痕件）zombie-cleanup-dryrun.log / zombie-cleanup-apply.log / zombie-cleanup-report.json

## 六、候裁明面（四件照实报）

1. 生产侧 promo「今日起租=UTC 日界非本地日界」语义（本地 00–08 点窗口内当日件=scheduled）=**P2 候裁报备**（本批仅拆 e2e 夹具雷，marketing.ts 零改动）；
2. 详情页 CTA=僵尸闸内才出（in_service+≥24h）；非僵尸单快捷区不加钮=口径写死不泛滥；
3. 脚本口令=env 递码（不落盘不入卷）；生产跑法=ROG 设 BETA_GATE_CODE 后 apply；
4. D=非白名单僵尸=「可解释残留」样例（真慢单席位保留=开口③）。

## 七、纪律自查

零新依赖 ｜ 零迁移（零新键） ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 端点复用零双轨 ｜ 零无留痕物理删 ｜ 真支付/真退零触 ｜ D-31 关未碰 ｜ D-34 坐标未动 ｜ D-29/D-39 守卫族每跑照绿 ｜ 读时分桶+D-48 真跳零回退 ｜ 不扩 K2/K3/K5 及其他 P1/P2 ｜ 不重做监控 IA ｜ 不判美 ｜ 清淤 dry-run+白名单+BETA_GATE+留痕+可重复 ｜ 收摊必净（PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
