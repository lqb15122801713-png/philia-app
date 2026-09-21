# 卷宗 · 批次 员工端 2.0（R7~R10）— feat/staff-2 / evidence/staff-2

> K3 集群 work 模型施工。基线 main@9fe0a80d。PR 只开不合（决策 #31）。部署**含新迁移**（0011+0012），须 db:migrate。

## 一、闸门实证（全部本机真跑，日志随卷宗 git add -f）

| 闸门 | 口径 | 结果 | 日志 |
|---|---|---|---|
| 三端 build | 根目录 `npm run build` 单命令（Y1 裁定） | **exit 0** | gates/build.log |
| server typecheck | `npm run typecheck --prefix server` | **exit 0** | gates/server-typecheck.log |
| smoke-routes | 47 路由（含本批新申报 8 行） | **47/47 exit 0** | gates/staff2-smoke-routes.log/.json |
| check-nav-closure | 63 路由体检（新路由 0 死胡同） | **死胡同 0 · 弱 0 exit 0** | gates/staff2-nav.log/.json |
| smoke-deploy | 全量自检 55 项（含新增**库存流水三类来源** cashier/reversal/count 前后值验证） | **exit 0** | gates/staff2-smoke-deploy.log |
| e2e | §七清单 11 段 50+ 断言 | **exit 0 全链路通过** | gates/e2e.log |
| 禁令 grep | #FFAAA5 / text-white / 渐变，diff 增量口径 | **=0** | 本卷宗§五 |
| 零新依赖 | package.json 零变更（扫码复用既有 jsqr/QrScanner，定位用浏览器原生 API） | **=0** | — |

## 二、e2e §七清单映射（evidence: gates/e2e.log §14~§24）

打卡两击+围栏外拒写零落行 / 补卡申请审批流（限当月+≤3 次/月+补卡标记回链）/ 盘点差异红字店长确认才入账（confirm 前零库存写入实证+确认后流水前后值）/ 提成·XP·评价仅本人越权拒绝 / 扣减 50% 超限 FORBIDDEN「已达当月扣减上限」（扣绩效不扣提成）/ XP 榜尾不可达（查询层裁剪≤5 行）/ 考试 XP 不受日上限（学习通道单列+每级每月限 1 次）/ 评价提交（星级必填+一句话选填 140 字+匿名同权+≤2 星差评提示到店频道）/ 接待人域（默认=开单人/核销改挂留痕前后值/无接待人硬排除/同源双计两池分列）/ 配置端口（owner 改参留痕版本化/新参只影响新单 rule_version 实证/clerk+manager 六连 403/未知键拒/拉新置灰拒写）。

## 三、交付范围对照（冻结任务书 V1.1）

- **R7**：≤2 击幂等打卡/围栏 300m（haversine，门店未配坐标明示不校验）/容差 10min 四态比对/围栏外拦截不写异常/异常审批+补卡双流/月表导出仅老板（CSV+留痕事件）/防代打标记（同设备同日>2 账号，只标记不阻断）。
- **R8**：stock_movements 地基（收银扣减/冲正回补/盘点/消毒四来源+前后值+操作人）；盘点状态机 draft→counted→confirmed→posted（驳回退回重盘）；单价≥100 日盘/全量周盘/盲盘标记；安心包单独成类+效期≤30 天预警只读；消毒步联动扣减落流水。
- **R9**：V1.3 全表 22 行落 commission_rules（售卡定额规则先行、源单随 R11 页面明示"随会员前置批开通"不悬空）；只读计算按源单时间取规则版本；接待人域四规则写死；Philia 绩效两池分列；仅本人硬过滤；扣减 50% 硬闸门；月度快照每月 1 日 02:00+季度绩效快照定时器（onConflictDoNothing 不动历史）。
- **R10**：xp_events/levels/rules 三表+发放服务（日上限 60 超限丢弃留痕/学习通道单列/拉新 server 拒写/防刷两档）；五段位门槛+月度保级固定值 150/300/500/700（每月 1 日定时结算）；榜单查询层裁剪；最小评价域（reviews 表+匿名+差评提示+本人列表）。
- **规则配置管理端口**：/settings/rules 仅 owner（墨轨入口收起+页内引导页+server merchantOwnerProcedure 硬 403）；提成+XP 全参数页面可改、保存即生效、版本化+前后值留痕、重确认 D 套、新规不回溯。
- **店长视图**（员工端 /manager）：考勤异常与补卡审批/取消审批/日结确认手机办/盘点派单与确认/差评提示/库存流水/退款审批=补丁②拦截口径"退款功能随专项批开通"零写入零接口。

## 四、迁移

- `server/drizzle/0011_ambiguous_lifeguard.sql`：九域 15 新表 + cashier_bills.receptionist_id（回填=operator_id）+ staff.grade + products 效期/消毒耗材列。
- `server/drizzle/0012_hot_sharon_carter.sql`：staff.probation + appointments.receptionist_id + reception_logs 挂预约可空 + overwork_approvals。

## 五、判断点/偏差报备（默认处置已写死，老板一句话可翻）

1. **学习中心/考试域不存在**：XP 学习通道 server 全量支持（recordExamPass 端点即学习通道入口，每级每月 1 次硬约束），考试中心本体不建；页面不放自报考试入口（防假功能第三态）。
2. **安心包回收登记不存在**：本批只做效期预警只读（任务书 R8④ 本批口径）。
3. **补卡月限 3 次为代码常量**（注释标"任务书称可配置"；配置端口 V1.3 范围=提成+XP 不含考勤参数）。
4. **洗护/造型无类目列**：G0 学徒 5% 对全部 grooming 行计提（services 表无 category）。
5. **冲正单接待人镜像原单**（非 =操作人店主），负单对冲原接待人绩效不误挂。
6. **拒写证据口径**：拉新无 HTTP 端点（xp 路由零入口），证据=rulesView 置灰行+xpAward 源码硬拒。
7. **次卡售卡/寄养提成默认不计**（任务书§九写死）；**师徒带教**规则已落配置，源单域（带教组合单）不存在，同售卡口径不虚构。
8. **G0/试用期/产能批准**：staff.probation 新列（0012）；产能 1.5 倍默认 1 倍、店长批准落 overwork_approvals 后加计。
9. **种子两修**（闸门修复非需求变更）：补 clerk 三级账号种子（smoke-deploy 既有 seed_clerk 断言）+ CLEAR_ORDER 补 M1-补2 域五表（FK 787 清表崩溃修复）。
10. **check-nav-closure 头注释原计数 51 已失真**（实际 55），本批修正为真实计数 63。
11. e2e 既有 §11 outbox 断言 20→21：R10 review 同事务增发 review.submitted 为冻结行为，期望已更新。

## 六、事故记录（已归零）

并行施工中段一代理误用 `git worktree remove --force` 级联删除工作树，未提交前端文件丢失；当场恢复 tracked 文件+原作者代理重写三件页面+重放骨架接线，损失归零后全量提交。已对后续代理禁用 git 恢复/清理类命令。另有一次 e2e 与本地 dev server 7200 端口争用导致污染开发库，已重种+流程修正（e2e 前清端口）。

## 七、部署提示

含新迁移（0011/0012），部署须先 db:migrate；月度快照/XP 月结为 server 内置定时器（每月 1 日），幂等可重跑。

---

# 复核补改①（2026-09-21 · 七步复核第一轮打回两条）

## 打回① 补充令①（时长配置化）——转发断档，非漏干
实证：会话消息流/工作区 inbox/_briefs 全程无此件（开工包三件+补件两件之外无第六件）。K3 未收到即未施工，终报无隐瞒。已请产品侧补发原文，件到照单施工（duration 域同构接入规则配置端口）。

## 打回② 提成回溯（真·钱实证，认账）
- 根因：computeMonth 用当前生效规则全月重算，"按源单时间取规则版本"没落计算路径。
- 修法：`resolveRulesAt` 逐行按源单 settled_at 取 effective_from≤该行时间最新规则行（失效行全参与，同秒边界宁旧勿新）；服务/商品/产能/G4/P3/试用倍率/perf_base/SABCD 全金钱行逐行；扣减 cap 与口径小字取当前值（当下动作不回溯，语义分离注释写死）。
- e2e §24 回归 11 断言：改率前单按旧率（商品 5%/服务 20%/perf 5%）金额逐行精确、改率后单按新率双向证明；全绿（gates/e2e.log）。
- 自纠：原"新参只管新单"断言误验 XP 事件流（落库即冻结天然不回溯），提成只读计算与事件流是两个世界——回归段已按只读计算口径补牢。
## 裁定③ G0 学徒 5%（产品侧授权 K3 拍板）
按 V1.3 原文"仅洗护不含造型"：`isWashService` 关键词判别（命中洗/浴、剔除造型/修剪/剪毛/美容），集中一处导出，时长供给表批次落地正式类目后换装。e2e 同步断言（洗护计/造型不计）。
## 备案知悉（行为不动）
计提时点=结账时（月末微差）/散客服务单不计个人提成（无归属链，宁漏计）/补卡月限 3 次代码常量（建议下批入配置端口）。
## 复跑闸门
typecheck exit 0 / e2e exit 0（含 §24 新段）/ smoke-deploy 复跑 exit 0（55 项，日志已刷新）；build/smoke-routes/nav 表面无变更沿用首轮实证。
