# 批次 W1 证据卷宗 · 走查可用性修复（导航闭环）

- 工作分支：`feat/w1-navfix`（基线 main@`0c3950b2`，M1-补2 已合）
- 真相源：《批次W1-走查可用性修复任务书》冻结版（含补丁③量化标准）+ 施工令
- 日期：2026-09-20 ｜ 施工：K3 集群 work
- 边界照守：只修可用性与导航闭环，不动视觉皮肤、不动业务逻辑与权限；零新依赖；三端只动必要文件
- 分支命名报备：施工令原文 feat/w1-nav，任务书 §四为 feat/w1-navfix——按「以文件为准」取后者（无提交期改名，零成本）

## 验收闸门逐项（含施工令增补）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build exit 0 | ✅ | gates/build-all.log |
| server typecheck exit 0 | ✅ | gates/server-typecheck.log |
| smoke-routes | ✅ **39/39**（36→39：/booking/success 双出口锚点 ×2 + staff checkin 弱出口按钮化锚点） | gates/smoke-routes.log/.json |
| smoke-deploy | ✅ 全绿（含新增「商品单冲正库存 +1」用例：settle −N → reverseBill +N，stock 35→36 实证） | gates/smoke-deploy.log |
| e2e-nav-check（新增常备） | ✅ 全绿 12 项：真实造单→成功页返回键/双出口/核销码区/改期快捷入口/一击回首页（落 /home）；选宠物弹层点文字区选中收层；R-Nav-2 tab 保持（?tab=history）；底栏中位文字标签 | gates/e2e-nav-check.log |
| check-nav-closure（常备入仓） | ✅ **51 路由：死胡同 0 · 弱 0 · 豁免 6**（门禁页） | gates/check-nav-closure.log |
| 禁令 grep（diff + 行） | ✅ 珊瑚粉=0 / text-white=0 / 渐变=0；零新依赖 | gates/grep-gate.log |
| diff 范围 | ✅ apps/customer 9 + apps/staff 2 + scripts 4 + README 1 | PR diff |

## 缺陷修复落点（任务书 §一/§二 + 补丁③）

| 项 | 落点 | 实证 |
|---|---|---|
| D1 预约成功页死胡同 | 四件套：单据摘要卡（服务/门店/宠物/时间）+ 核销码区（工作文档形态）+ 双出口（查看我的预约=柠檬主钮 / 返回首页=细线白底）+ 改期快捷入口（→详情页改期面板真实链路）；PageHeader 返回键（固定落 /home，不回已消耗下单页） | shots/01；e2e 七项断言 |
| D1 商城支付成功页同构 | 摘要卡（订单号/实付/收货快照）+ 双出口（查看订单/返回首页）+ 返回键 +「再逛逛商城」安静链；顺手退掉 legacy 渐变钮（禁令内收敛） | shots/02 |
| D2 选择器整行可点 | 选宠物弹层整行 button（行高实测 78px≥44、间距 8px——线上走查版本落后于 repo，补 min-h 护栏）；PetsPage 物种/绝育 ≥44px；CartPage 勾选钮命中区扩 44×44（负边距零视觉差）；员工端 DailyLogForm 喂食 segment ≥44px | shots/03a/03b/04；e2e 整行点选断言 |
| 员工端 checkin 弱出口 | 三处异常态守卫页「返回任务台」= 柠檬主钮（唯一主出口）；「已取消」页=细线白底次钮 | shots/06 |
| D3 PageHeader 返回兜底 | BackButton 读 history.state.idx：idx>0 维持原行为（10 处在用页零回归）；idx===0（直访/栈底）兜底 to ?? '/home'；只兜 SPA 无栈场景，不与系统后退冲突 | e2e 返回链路 |
| R-Nav-2 返回保状态 | AppointmentsPage + MallOrdersPage：tab 入 URL（?tab=，replace 不污染栈，非法值回退默认）；滚动位置 sessionStorage 会话级记忆（rAF 节流、数据就绪恢复一次） | e2e：返回后 ?tab=history 保留 |
| R-Nav-3 底栏全标签 | AppDock 中位 60px 爪印下补「philia」文字标签（与其余四槽同字号字重口径） | shots/05；e2e 断言 label=philia |

## 制度化（防再犯）

- `scripts/check-nav-closure.mjs` 入仓：51 路由体检表（任务书 §五全量），四要素检测（返回键/底栏/首页链接/出口钮），死胡同阻断 exit 1；
- `scripts/e2e-nav-check.mjs` 入仓：Chromium 真机实证（成功页四要素+整行可点+返回保状态+底栏标签）；
- README 验收固定清单第五条=导航闭环（每批七步复核必查）。

## K3 自查疑虑报备（顺手件①）

| # | 内容 |
|---|---|
| W1-Y1 | **构建陷阱（运维向，建议入宪章）**：`VITE_API_BASE=x npm run build:customer && npm run build:staff` 中环境变量只对第一条命令生效——staff 一度被烤入 localhost:7200 致跨子域 cookie 失效。本次三端分别带变量重建核验。建议后续批次构建命令写进脚本或逐端带变量。 |
| W1-Y2 | 成功页返回键固定落 /home（而非 navigate(-1)）：避免返回已消耗的下单页，与双出口语义一致；其余页维持 D3 兜底口径不变。 |
| W1-Y3 | 残留 sub-44 触控目标（性格 chips ~33px、tab pills py-2 等多选/签类控件）：D2 冻结口径只点名单选行，未扩面，登记待裁定是否入下一批。 |
| W1-Y4 | harness「按钮形」判定口径：`<a>` 带按钮样式（柠檬/墨底/圆角块级）按任务书「按钮样式」原文计为按钮形出口——checkin 守卫页 Link+柠檬样式据此判 OK（样式即任务书所求，非降级）。 |
| W1-Y5 | 体检 harness 基建两处加固：每端独立浏览器实例 + /api/events 拦截中止（headless SSE socket 占满 per-host 上限致数据页假死——M1 批已定性根因，此处复用同款口径）。 |
| W1-Y6 | 全路由自查表=任务书 §五巡检地图（产品侧 harness 首跑存档）；本批无新增路由，无新增申报项。 |

## 施工口径备注

- 本批零 server/packages 改动；type 推导零手写；
- 非安全上下文：全部实拍于 http://app.beta.local:7200 / s.beta.local:7200（isSecureContext=false）不崩；
- 管线工具（u4-pipeline/ 下 w1-shoot 等）为一次性走查工具不入库。
