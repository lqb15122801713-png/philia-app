# 卷宗 · 走测修批 P1-R8（D-49→D-47 · PD-26 · 任务书冻结版 V1.0）

> 分支 `feat/force-cta-list-zombie-p1` ｜ 基线=生产 main@`be3ab1fa`（全 `be3ab1fa864d3be92ae27a76a099204b3d80353a`；PD-25 已合）｜ 档位 **K1** ｜ 2026-10-15
> 令书四件+回执话本在区；开口①～⑤收死；CJ-1015-02 未入本片。

## 一、交付清单（片内序照令：D-49 列表 CTA → D-47 月级僵尸清淤）

### D-49（P1）· 列表强制完成 CTA（续修）

**先查清再动手（红线=先搜再写）**：基线原样探针实证——异常待清**桶内单卡 CTA 基线已在**（PD-22 落码，PD-23 生产实证 5 卡均见；本批探针帧 `probe-2-bucket.png`：桶 10 卡 10 钮含 35 天月级夹具）。R8「列表单卡仍无 CTA」缺口语境=**预警聚合行**（监控第一屏·异常待清 N 单·唯一动作=去处理直飞详情）——走测主路径上列表语境无 CTA（PD-23 卷宗 §一亦注此发现性缺口：「桶内 CTA 藏在滤签视图后+D-48 去处理直飞详情」）。

**修（零 IA 改动·零新键·零双轨）**：
- `WAlert` 增可选 `extraAction` 次动作槽（仅传入行渲染；他行零影响）；
- 监控 Hub 异常待清预警行内补「**强制完成**」次钮（与详情/桶内**同端点同确认同留痕同语义**=复用 `appointment.forceCompleteStale`；作用目标=该行「去处理」同目标首只僵尸，点后原地出桶、计数可解释下降）；
- 桶内单卡 CTA／详情快捷区 CTA／读时分桶（D-44）／去处理真跳（D-48）**全不回退**（帧证）。

### D-47（P1）· 月级僵尸清淤（续修）

- 既有 `monitor-zombie-cleanup.mts` 口径零改动（dry-run→apply／白名单【测试】·演示单·wtshot／BETA_GATE 照 PD-23 硬化既有）；
- 闸门库实证：月级僵尸（40 天档）白名单命中→apply 经真端点 completed 留痕；非白名单对照单（无标记 40 天）**零触**；
- 生产月级僵尸（第8轮 max≈48928 min 量级）：白名单者同法可清（ROG 部署后 dry-run→apply）；**无白名单标记者=可解释残留**（脚本 dry-run 只列不写，呈产品侧定夺，不擅自扩白名单）。

## 二、闸门（全绿）

| 闸 | 结果 |
|---|---|
| merchant tsc -b / server typecheck | 0 |
| e2e 全链路 | **1039 项 ✓ 全绿**（零回退；本批零 copy 键零迁移，计数链 4266/72 不动）——`e2e-green.log`（另：`e2e-63x-timemine-note.log`＝拆雷前红日志留证） |
| build 双版（零参录证 + 栈版 VITE_API_BASE=7200） | 全绿 —— `build-zero.log` / `build-stack.log` |
| nav 闭环 / smoke-routes / smoke-deploy | 见 `nav-closure.log` / `smoke-routes.log` / `smoke-deploy.log` |
| 实尺帧 | 5 帧全绿（12 断言）——shots/ + shot-results.json |

### 顺手拆掉的基建时间雷（报备 · 非本批范围 · PD-23 同例）

- **63.2/63.3 钉程**（PD-21 主干既有）：63.x 把账单 settledAt 钉「当月 15 日正午」托月界，但提成按「源单 settled_at × 规则 effective_from 时序」解析——**每月 15 日正午过后跑批**，钉点早于 R9② 改率落账时刻→取率回落旧值（10-15 午后实证 63.2/63.3 误红：10000→8000 差 0.8 倍率差）。修=钉点不得早于改率时刻：`max(当月15正午, 此刻+1.5s)`，断言目标不变；红日志留证在卷。

## 三、实尺帧（shots/）

| 帧 | 内容 |
|---|---|
| F1-alert-row-force-cta.png | 监控预警行：异常待清 3 单 +「强制完成」次钮+「去处理」同框（D-49 新增面） |
| F2-after-alert-force.png | 预警行点强制完成：行目标 completed+forced 留痕事件落库+桶计数 3→2 |
| F3-bucket-cards-cta.png | 异常待清桶：单卡 CTA 不回退（余桶每卡 1 钮） |
| F3b-bucket-after.png | 桶卡点 CTA 再出桶（2→1，留痕） |
| F4-detail-cta-intact.png | 详情快捷区「强制完成」仍在（PD-23 不回退）+去处理真跳 /monitor/:id（D-48 不回退） |
| zombie-dryrun.log / zombie-apply.log / zombie-*-report.json | D-47 脚本实证三件套（dry-run 白名单 10 命中零写→apply 10/10 completed 留痕+非白名单对照零触） |

## 四、候裁明面（产品侧定夺）

1. **预警行次动作语义**：作用目标=该行「去处理」同目标首只僵尸（逐单原地清，点后行自动重算到下一只）；若要「一键清全桶」=另批（本批零扩）。
2. **非白名单月级僵尸**（生产若无【测试】/演示标记者）：脚本不误伤，残留=可解释，名单呈 ROG dry-run 报告定夺。
3. 桶内 CTA 对 clerk 可见但 server 闸=403（merchantManagerProcedure）——既有口径未动（改=另批）。

## 五、红线自报

禁真退／禁自动批／零物理乱删／零双轨端点／D-31 关／D-34 不动／不扩 K5·K3·K10·林晓·即将点亮·L2·钱权·设计升档／CJ-1015-02 未入／未叫醒三角色／未判美／未重做监控 IA／零新依赖／零新迁移（零 copy 键改动）／收摊 PORTS_ALL_CLEAR／**A 窗禁合禁部，PR 只开不合**。

— A 窗（施工方 · Kimi Code）2026-10-15
