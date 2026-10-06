# 卷宗 · 商家端大批 片 2（老板端驾驶舱：三店六项日报+全局管控四件+17 张报表升三店+裁件三件）

> 令=开工令-产品-1006-商家端大批片2.md ｜ 任务书=冻结版 V1.0 ｜ 附件=片 0 盘点表+片 1 意见书（§三裁件照执）｜ **基线叠尖裁定明面报备**：令基线 main@238687f3 片 1 未合，叠片 1 尖 46d6a450（本地 bf4eabd 同树）立支 `feat/merchant-chain-2` ｜ 施工=A 窗 2026-10-06 ｜ PR 只开不合。

## 一、施工总账（39 文件+2 新建页+2 迁移）

### 裁件三件随带（片 1 意见书 §三照执）
1. **跨店按 id 取数统一 NOT_FOUND**（防探测）：`trpc.ts assertAppointmentAccess` 兜底分支 FORBIDDEN→NOT_FOUND + `cashier.getBill` 同步；e2e 78.1/78.2 断言收紧 + 71.1/72.1（非当事人）断言同步=申报件；
2. **换绑申诉队列加店域过滤**：`phone_change_requests+store_id`（0051；提交时落客户最近消费店；存量=最近消费单推导回填）+`listPhoneAppeals`/`reviewPhoneAppeal` 店域闸（越界=NOT_FOUND）。**口径修正记录**：初版「NULL 平台件=仅老板可见」撞 R13a 既有店长审批流（51.3 红）——**修=平台件（无归属店）=全店可见可受理（就近门店受理口径，裁定「B 店不见 A 店客户申诉」本意不动：归属店过滤严格成立）**，79.1 实证四象限（A 店申诉 B 不见/平台件老板店长皆可见/跨店审批 NOT_FOUND）；
3. **membership.forUser 加本店客户闸**：口径=店域内有预约单∪持店域次卡∪店域收银消费∪卡办在店域（与 pass.topUp 同族），越界=NOT_FOUND；79.2 实证。
4. 裁件④（clerk 读本店放行）=归片 3，本片未施工（照意见书）。

### 老板端三店六项日报看板
- server `store.chainDashboard`（owner 全域读口）：六项=今日营收已收（computeDayTender 同源）/今日预约/在店寄养/待办合计/异常（超期寄养）/退款红字（待审退款申请）；逐店分栏+合计条（聚合不写账，涉钱零新规）；
- DashboardPage M3 卡：owner=连锁视图（合计+分栏并列，「单店口径」注记撤改「连锁视图」真值=开口项 1 裁照办）；manager/clerk 单店卡零回归；
- 79.3 实证：分栏含 A+A2+合计=逐项算术和+A 行营收=todayTenderStats 同源对账+manager 403。

### 17 张报表升三店口径
- report.ts **21 读口** widen（15 张+A 区 5 口+exportCsv 透传）：入参 `{scope?:'store'|'chain', storeId?}`（缺省=单店零回归；chain=店域集合 inArray 聚合；storeId=店域内任选，越界=NOT_FOUND）；`reportStoreIds()` 单源；A 区 5 口入参 optional 化（56/73 族零参调用零回归）；
- 前端 ReportPage 三视图（单店=店域下拉/分店=逐店并列/合计=scope=chain）；manager 不出现切换；
- 79.4 实证：合计=A+A2 单店算术和+选店 A2 零值+越界 NOT_FOUND；
- 登记：`listMetricAppeals`/`contentEventStats`（写口族/N7N8 不出表）未 widen——口径候选下批。

### 全局管控四件
- **E1 门店档案端口点亮**：ConsolePage 右栏 ProfilePortBody（档案表单+连锁归属维护）+`store.update` 扩参（phone/groupName/hqId，hqId 越界=400 老板全域闸）；cadm.profileEmpty* 退役改值；
- **C2 安心包端口**：**编号撞车明面报备**——安心包立项名 C2 与控制台既有 C2 储值占用冲突，落 **C3**（CarePackPortBody：安心包商品+效期临期标，独立库存域只读 v1；回收登记流程=候补件注记）；
- **配置作用域分层**：六张规则表+store_id（0051；NULL=总部下发/门店覆盖）+`resolveScopedRules()` 单源解析（门店行优先）+config.save `scope:'store'|'hq'`（hq 仅 owner；member_plans/copy=中央件不分层传 scope=400）+14 读处线程店上下文。**语义登记**：版本化「单活跃行不变式」不动（e2e R9-F② 同向）；读助手 `storeId===undefined`=既有全量口径（public 公示口/全域滴答/支付链无店上下文必须如此，否则 53.7/55.6/67.3/69.6 必红）；他店无活跃行回各读处既有兜底；commission 历史时序多店语义=批 3 候裁；79.5 实证（全键组双写：覆盖生效期 A 在/B 兜底→hq 复辟 B 恢复+copy 中央件 400+resolveScopedRules 函数级解析序）；
- **门店分组/新店克隆**：stores+group_name（0051）+`store.cloneStore`（结构克隆=档案[服务/商品 stock 归零]+门店覆盖规则行复制；不带数据[订单/会员/员工/库存流水/账单]；源店越界=NOT_FOUND）；79.6 实证+E1 三参落值。

### 迁移（随码落库，均幂等）
- **0051_chain_console**：phone_change_requests+store_id（推导回填）/六规则表+store_id/stores+group_name；
- **0052_chain2_keys**：copy 键 16 增（三视图 5/E1 4/C3 4/dash 2/报备 1）+3 改值（dash.m3ChainNote/cadm.profileEmpty*）；**工艺事故自报**：初版 15 句缺 INSERT 前缀成空 SELECT（dev 库 0 行落）——修复重写全前缀版复套（NOT EXISTS 幂等），生成件同帧 copySeedRows 3149 行；56.1/76.3 计数 3134→3150 同步（域数 68 不变：merchant:report=既有域）。

## 二、闸门（2026-10-06 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令） | exit 0 | gate-build.log |
| server typecheck | 0 | gate-e2e-tail.log 头行 |
| e2e 全量 | **全链路验收全部通过 ✅**（族 79 十绿新增；78 互盲六组不回退；51.3/71.1/72.1 裁件断言同步；7220 无残留；种子库原样） | gate-e2e-tail.log |
| check-nav-closure | **118 路由 · 死 0 · 弱 0 · 豁免 6**（零新增路由——E1/C3/三视图均为既有页内嵌） | nav-closure-118.json |
| smoke-routes | **102/102**（复跑；首跑 100/102=F1 环境件照头注口径消） | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 5 帧 | 连锁视图分栏+合计/D1 三视图+合计命中/E1 表单+连锁归属/C3 只读 v1——逐屏目检已做 | 01-05-*.png |

## 三、申报件汇总

1. e2e 断言同步：78.1/78.2 收紧 NOT_FOUND（裁件①）+71.1/72.1 非当事人 403→NOT_FOUND（裁件①同族）+56.1/76.3 计数 3134→3150；
2. 新读口/写口：store.chainDashboard/store.cloneStore（零新路由，nav 双表零新增）；store.update 扩参（phone/groupName/hqId）；
3. 迁移 0051/0052（幂等；sha256 补登 dev 库；**生产追平后复核：phone_change_requests.store_id NULL 计数[无消费申诉人=平台件]、stored_value_import_batches 沿用 0050 口径**）；
4. copy 键 16 增 3 改（生成器重生成+0052 注册）；
5. C2→C3 编号改落（撞号报备）；配置分层「单活跃行不变式+他店兜底+历史时序批 3 候裁」语义登记；listMetricAppeals/contentEventStats 未 widen 登记；
6. dev 库夹具明面登记：探针 A 辖二店（store.cloneStore 正规通路造，截图分栏实证用）+探针 B 店主（片 1 留）；dbg 调试期间 duration_rules 同值改写 v2-v7（最终态=NULL 总部行同值=种子等价，守尾零副作用）。

## 四、收摊实证

（交付前补记。）

— A 窗（施工方）2026-10-06 夜

## 五、闸门锚点同步（申报）

裁件①统一 NOT_FOUND 后，staff /execute 对「前台进他人 groomer 单」场景由 403 守卫态「无法执行该预约」转为 404 守卫态「预约不存在」（ExecutePage 既有 notFound 分支，设计内）——smoke-routes.mjs F1 两行锚点集加「预约不存在」（`scripts/smoke-routes.mjs:165-166` 注记同步），四跑 102/102 全绿实证。

## 四、收摊实证（补记）

TaskStop×4（server 7201 / preview 7130-7132）→ netstat 复核：四端口残留 LISTENING（vite/tsx 子进程）→ `taskkill //PID //F //T` 补刀（PID 14144/23912/41340/58808 子树）→ 复核 ALL_CLEAR（CDP 9223/9224/9339/9417 同步无残留）。
