# 卷宗 · 钱域寄养 P1（D-50～D-55 · PD-24 · 任务书冻结版 V1.0）

> 分支 `feat/money-boarding-p1` ｜ 基线=生产 main@`26282369` ｜ 档位 K1（涉钱演示路径；禁真退禁自动批）｜ 2026-10-14
> 令书三件套在区（`开工令-产品-1014-钱域寄养P1.md` 等）；开口①～⑤按推荐收死。

## 一、交付清单（片内序照令：D-50→D-51→D-52 核心必交，D-53→D-54→D-55 尽力=**全交**）

| 票 | 交付 | 实证 |
|---|---|---|
| **D-50** K3 RR 超期待批 | `refundRequest.listPending` 增 `slaHours`/`overdueHours` 透出（服务端单源算好）；收银退款页超期签=「超期待批 · 已超 N 天/小时」人话（title 附 SLA 口径）；仪表盘审批区行注「超期 N 天待批」；手动批/驳留痕既有链路不动（approve/reject 幂等+timeline+approverId），**零自动批、零真退、零碰支付通道** | F1/F2/F3/F4 + e2e 105.1 |
| **D-51** 黄条核实/演示收口 | 黄条 7 笔构成核实机制坐实（见 §四）；`refund-settle-cleanup.mts` 增「构成核实」段：dry-run 同报非白名单残留（只列不写），报告 JSON 增 `nonWhitelist` 字段；apply 仍只动白名单 | F2/F8 + dryrun/apply 日志+报告 + e2e 105.3 |
| **D-52** 寄养打卡 get 404 | 根因=`assertAppointmentAccess` staff 分支「未指派或指派给本人」闸把寄养单挡在非负责人外，与 boarding.ts 既有 `staffStorewide`（班次共享动作，PR-2 修正版）口径打架。修=`assertAppointmentAccess` 增 `staffBoardingStorewide` 选项，仅 `appointment.get` 传入：寄养单本店任意员工可读；非寄养单/写口/跨店闸零回退 | F7 + e2e 105.2（可达+两枚不回退钉） |
| **D-53** K12 计数撕裂（尽力） | 根因=仪表盘「历史待确认」=全量 pending 计数，深链 `?status=pending&from=todo` 却落「待到店」档（confirmed+pending 混合口径）。修=「待确认」独立档（pending-only），全量档计数=主列表全量 pending=仪表盘同数 | F1/F5（计数 2=行数 2） |
| **D-54** K13 改期审批（尽力） | 最小闭环透出：pending 且最近改约留痕来自客户 → 详情页横幅「客户改期申请待确认（原 X → 新 Y）」；批=既有「确认预约」CTA，调=既有「改期」代客路径，零新端点 | F6 |
| **D-55** K2 INJECT 店曝光（尽力） | `store.listMine`/`store.chainDashboard` 双口同闸（`injectStoreExclude()` 单源）：INJECT- 前缀（id/name 双闸）测试店不进现网连锁视图 | F1 + e2e 105.4 |

## 二、闸门（全绿）

| 闸 | 结果 |
|---|---|
| server typecheck / merchant tsc -b | 0 |
| e2e 全链路 | **1036 项 ✓ 全绿**（含 105.1 D-50 超期透出+零自动批+手动驳回、105.2 D-52 可达+闸不回退×2、105.3 D-51 构成核实+apply 零触非白名单、105.4 D-55 双口隔离；103.3 兼容钉程同步修订）——`e2e-green.log` |
| build 双版（零参录证 + `VITE_API_BASE=http://localhost:7200` 栈版） | 全绿 —— `build-zero.log` / `build-stack.log` |
| nav 闭环 | **126 路由 · 死胡同 0 · 弱 0** —— `nav-closure.log/.json` |
| smoke-routes | **110/110** —— `smoke-routes.log` |
| smoke-deploy | **78 ✓ 全过**（含 D-29 族守卫）—— `smoke-deploy.log` |
| 迁移 0083 | 幂等（INSERT NOT EXISTS×6 + UPDATE active=1×1）；闸门库核：copy active=**4266**/72 域；键入码必随迁移 ✓ |

## 三、实尺帧（shots/）

| 帧 | 内容 |
|---|---|
| F1-dashboard-alerts.png | 仪表盘：审批区退款行「超期 3 天待批」注 + 历史待确认=2 + 连锁卡无 INJECT 店（D-50/53/55 三证） |
| F2-cashier-refunds-overdue.png | 收银退款页：申请待办块「超期待批 · 已超 3 天/已超 6 小时」双签+批准/驳回 CTA + 黄条「3 笔超 24h 未登记实退」（D-50/51 前态） |
| F3-reject-dialog.png | 驳回弹层（原因必填） |
| F4-after-reject.png | 驳回后待办块退件（留痕落库 rejected+原因+审批人） |
| F5-appointments-pending.png | 「待确认」独立档 on + 计数 2=行数 2（跨日全量档含昨日单） |
| F6-detail-reschedule-banner.png | 改期待确认横幅（before→after 明面）+确认 CTA 同屏 |
| F7-staff-boarding-checkin.png | 员工端寄养打卡页（阿强=同店非负责人）：宠物卡+入住登记段可达，零 404 空崩 |
| F8-cashier-after-cleanup.png | D-51 后态：黄条回落=1 笔（真实样例可解释残留）+申请待办不受触 |
| refund-cleanup-dryrun.log / -apply.log / -report.json | D-51 脚本实证三件套（dry-run 构成核实零写 → apply 白名单 2 笔 settled 留痕 + 非白名单 1 笔零触） |
| shot-results.json | 15/15 帧内断言全绿 |

## 四、D-51 黄条构成核实结论（入卷）

- 机制坐实：黄条=收银退款页 `refund.pendingActual`（executed 超 24h 未 settled）待办条；生产 R6=4→R7=7 的增量=**smoke-deploy 每跑留 3 笔 executed**（reason 全为 `smoke R12 …` 前缀），验收轮次累加所致，非真实经营退款。
- 白名单口径 `reason LIKE 'smoke %'` 全覆盖 smoke-deploy 残留；脚本新增「构成核实」段把非白名单残留单列（只列不写）——生产跑法照 PD-23 登记=ROG 部署后 dry-run 审单→`--apply` 收口。
- 生产闸门库复现实证：夹具 2 smoke+1 真实 → dry-run 报告白名单 2/非白名单 1 → apply 后白名单 settled 留痕（署名 script:pd21-d43 口径沿承）、真实样例零触、黄条 3→1。

## 五、候裁明面（产品侧定夺，本批不擅动）

1. **D-55 过滤口径=INJECT- 前缀族**（id/name 双闸）：「隔离测试B店」类**无 INJECT 标记**的历史测试店不在闸内（不可盲猜名单误伤真实店）——建议：运营给存量测试店补 INJECT 标记，或另批扩闸口径。
2. **D-52 读口放宽面**：寄养单详情对「本店任意员工」可读（与 boarding.stayForStaff/dailyLog/checkout 既有 staffStorewide 同口径）；非寄养单与写口闸不动。若产品侧要收紧=一句话回退。
3. **D-53 chips 计数口径**：「待确认」chip 在全量档（from=todo）=全量 pending（与仪表盘同数）；今日/择日档=当日 pending（chips 既有今日口径沿承）。
4. **D-54 驳回路径**：改期「批」=确认预约、「调」=商家代客改期（均既有）；未新造「驳回改期」按钮（最小闭环够用；要独立驳回键=另批）。
5. **D-50 自动批/真退=红线写死未开**；生产存量超期 RR（RR-20261002-001 等）处置权=店长手动（系统永不自动批）。
6. 黄条生产残留处置=ROG 部署后按脚本跑（dry-run 审→apply）；脚本不碰 refund_requests 客户申请（另批口径沿承）。

## 六、报备偏差与红线自报

- 零新依赖；零新路由；零 schema 变更（0083 仅 copy 键）；零真退/零自动批/零碰支付通道；D-31 未开；D-34 未动；旧系统迁移未做；未判美；未拟人化布置走测 Bot；K5 未扩。
- e2e 103.3 断言随 D-51 输出格式修订（构成核实段会列出非白名单行号——原「002 零出现」断言改钉汇总行，语义更准）；红线闸（78.1 互盲/50.x 审批/104.x 僵尸）全绿零回退。
- 收摊：四端口 7130-7132/7200 已清（PORTS_ALL_CLEAR）。

— A 窗（施工方 · Kimi Code）2026-10-14
