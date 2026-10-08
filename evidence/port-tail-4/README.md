# 卷宗 · 端口批收尾 片 4（OP-03 修复 8 件收口·批内末片）

> 令=开工令-产品-1007-端口批收尾片4.md ｜ 任务书=冻结版 V1.0 ｜ 附件=盘点表（片 0，八件定位实证在卷）｜ 基线=叠片 3 尖 f2f05456 ｜ 分支 `feat/port-tail-4` ｜ 施工=A 窗 2026-10-08 ｜ PR 只开不合｜ **末片=批齐口径**。

## 一、施工总账（八件全勾销，定位照盘点表指针）

1. **P1-1 注册即会员**：落档内核抽 `openFreeMembershipCore`（membership.ts；幂等+default_plan_key 端口化+回馈金账户预建）——**自助开户（auth/devLogin 手机号支路）与微信静默开户（auth/wechatMini）双口同事务连带落档**，openFree 本体改调同函数（**勿新写落档口照办**；e2e 86.1：新号 19900000086 开户即成会员 active+单档不重复+soldStoreId=NULL 骨架批口径；截图 01 新号直达会员中心有档）；
2. **P1-2 寄养折扣两值**：**裁=撤文案**——PerksWall 寄养折扣行整行撤（含片 3 挂的 CK 与 PERK_ICONS[6] 屋形图标，索引对齐），copy.ts 撤 perk.boarding/perk.boardingSub 两键出码内宇宙（**仓行留档=端口宇宙只增不改**）；**实值核查**（翻案口径照办）：在跑库 member_plans 四档 v1 种子值全量核——plan_weiguang service_discount_bp=**10000=门市价单源，无「9 折」实值残留无须清理**（若有=一并清的预案已在令，现值干净；e2e 86.2：读口两键零渲染+10000 断言；截图 02 权益墙无寄养折扣行）；
3. **P2-1 待办合计两值**：抽 `todoCountsOf` 唯一取数函数（**全量预约不按今日过滤**——未来 pending/confirmed/cancel_requested 与历史未收款 completed 同为待办；超期寄养=异常列不并入[自有透出区，不双计]），chainDashboard（撤今日过滤误帧）与 dashboardStats 同源；晨报卡「待办合计」UI 同口径（todoGrandTotal→todo.total，超期自 :279-283/:680 透出区不动）；**e2e 86.3 双位同值断言**（chain 本店行+合计 === stats todo.total+未来 pending 入待办实证；截图 03 API 双位 chain=3 stats=3）；
4. **P2-2 安心包要货口排除已下架**：TransfersPage 要货/调拨共用 productsQ 去 `includeCarePackage: true`（**与收银台选购同闸=care_package 全排除**；安心包=独立库存域只读件；e2e 86.4：不传 flag 零 care_package[off 件亦不见]+raw 口传 flag 文档行为在案；截图 04 下拉无安心包）；
5. **P2-3 营销页端口 key 裸露**：server promoStackRules 加性透出 `ruleLabel`（none→不叠加/allow→可叠加，非枚举值透原值不冒译）+页面键名收 `title={k}` Tooltip、公示只留人话（e2e 86.5 四键全中文映射+不含键名；截图 05）；
6. **P2-4 假保存拦截**：CopyConfigPage——pending>0 时 beforeunload+捕获阶段内导航 `window.confirm` 双拦截（pending=0 自动撤除）+「未确认变更 {N} · 复核并保存」danger 按钮态+行内「未确认」warn 章（testid 全配；截图 06 改字未确认态）；
7. **P3-1 挂单队列折叠/分页**：HoldPanel 照同文件今日流水区模式——默认前 5 张+「全部 {N} ›」展开+「收起 ›」（**保留标测试件不删**；截图 08 折叠钮在）；
8. **P3-2 端口列表显生效值**：server config.list copy 行加 `defaultText`（v1 种子原文透出）+页面双列（version>1=「码内默认 vs 当前生效」对照/version===1=默认单值；e2e 86.6 已改键默认≠生效双值+恢复件；截图 07 双列透出）。

## 二、申报件

1. 迁移 **0066**（copy 键 7 枚=脚本生成+INSERT 计数断言==7 ✓：cashier.holdExpand/holdCollapse+copyport.leaveConfirm/unsavedCta/pendingBadge/defaultLabel/currentLabel；**撤 perk.boarding 两键不写 DELETE=宇宙只增不改仓行留档**）；journal idx 66；dev 库手工追平（sha256=075cd6eb… 补登，migrows=67）；
2. e2e 族 86 新增（8 组 8 断言；既有断言零删改——**68.5 前提修正属裁定口径合法推翻**：devLoginPhone 注册路径新用户今起自带会员（P1-1 本意），「非会员 400」错误路径改由直插库用户（未经 HTTP 注册）守，同裁定两面不双标，注记在码）；56.1/76.3 计数 **3869→3874**（域 72 不变）同步；
3. **nav 双表零申报**（本片零新路由；归屏率 97.0%>90% 军规线，未归屏 115/3874=3.0%<10%）；
4. **已部署迁移永不重写军规零违例**（0066 全新件）；

## 三、闸门（2026-10-08 实跑）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（7201 轨）+根目录 build（Y1 轨） | 全 exit 0 | gate-build.log |
| server typecheck / 三端 tsc | 0 / 0 | （随改随跑终态 0） |
| e2e 全量 | **两绿采信 925 断言**（族 86 八组 8 连 ✓；51-85 零回退；56.1/76.3=3874/72；76.1 归屏率 97.0%；76.4 未归屏 3.0%；**82.4 时间窗照案 08:00 后绿**——排期 UTC 子夜口径×本地窗口件，复跑两绿采信，三勘记录在 gate-e2e-run1-triage.log/gate-e2e-tzutc.log） | gate-e2e-full.log（绿 2）+gate-e2e-green1.log（绿 1） |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | nav-closure.json+gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| **八件修复对照实录** | **八帧 PROBE_ALL_GREEN**（注册即会员直达/撤寄养折扣行/待办双位同值 chain=3/要货口无安心包/公示 ruleLabel 中文/未确认钮态/双列/挂单折叠） | 01-08-*.png+probe-result.json |

## 四、红线自查

零新依赖 / 禁令新增行命中=0 / 行尾 LF / 迁移幂等 / 多句 INSERT=脚本生成+计数断言（0066=7 ✓）/ 缺陷定位照盘点表指针 / openFree 落档逻辑复用不新写 / 68.5 前提修正=裁定口径两面不双标注记在码 / 隔离族不回退（86.7 权限闸+86.8 互盲）/ 收摊必净（四服务 TaskStop+netstat 复核+taskkill 补刀 PID 30416/38776/35732/27428 子树→残留监听=0）。

## 五、观察项与候裁

1. **83.5 自动回滚×「改+复原」对语义疣**（片 1 件 4b 观察项）：幂等锚「只撤最新一手」会把窗口内「改 A→B 再复原 B→A」的复原一并撤掉，停在测试值（本片 86.5 遇 coupon_stack_rule=with_member_discount 实证）——功能按锚语义正确但针对复原场景欠聪明，**候裁**：是否给幂等锚加「成对复原检测」（连续两手 after==前者 before 时整对豁免）——另批评估，本片未改 83.5 语义；
2. **promoUpsert 排期=UTC 子夜口径**（'T00:00:00Z' 明写）：与全仓 storeWallclock（+8 店时日界）不一致——本地 00:00-08:00 窗口内「当日件」显 scheduled（82.4 断言同名边界）；是否统一切店时子夜=**候裁**（本片未动，82.4=窗口环境件照案复跑）；
3. 画布注册表 mc.perksWall.propsJson.copyKeys 声明 perk.boarding=写死件留口（键不在码内=零渲染零副作用，同 home.entryNote 先例；画布里该行编辑显「—」兜底已配）。

— A 窗（施工方，角色卡⑧ V2.1）2026-10-08 凌晨
