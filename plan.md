# Philia 菲丽亚宠物 · 主代理编排计划（plan.md — 单一事实来源）

> 依据：《菲丽亚宠物三端App开发方案.md》v1.0（工作目录根下）
> 本文档由主代理维护，每个 Phase 完成后勾选并记录偏差。

## 本地适配声明（与原文档的差异）

| 项 | 原文档 | 本地执行 | 原因 |
|---|---|---|---|
| 后端运行环境 | backend-building-swarm + MySQL + Kimi 登录 | P1 阶段再定（本地无该 swarm；MySQL/Kimi 登录需适配，可能用本地 MySQL/SQLite 或 docker + 会话 stub） | 平台技能本地不可用 |
| GitHub 仓库 | P0 建 philia-app 仓库 | 先本地 git init；推送 GitHub 需用户确认后执行 | 外部可见操作需确认 |
| 视觉资产 | image_generation 插件 | 用 openart-agent MCP 生成 | 本地可用插件 |
| 预览 | website_version_manager 版本卡 | Kimi Work 本地预览卡（dev server，customer 端口 7100） | 平台能力差异 |
| 端口约定 | — | customer=7100 / merchant=7101 / staff=7102 | 客户端预览规则 |

## 技术栈（锁定）

Monorepo（npm workspaces）：apps/customer、apps/merchant、apps/staff（React18+Vite+TS+Tailwind3.4+shadcn/ui+vite-plugin-pwa+React Router），packages/shared（tokens/组件/常量/类型），packages/config（共享 tsconfig/tailwind preset），server/（P1 建：Hono+tRPC+Drizzle）。

---

## P0 — 地基与设计系统 〔已完成 ✅ 2026-09-04〕

里程碑 M0：三端 `npm run dev` 可起；客户端空壳带完整 5 栏凸起 TabBar；设计 token 三端生效。**全部达成。**

- [x] T0.1 `coder-scaffold`：Monorepo 脚手架（apps×3 + packages×2 + server/ 占位），vite PWA 配置，三端空路由+布局壳。首次 commit `7b39abc`
- [x] T0.2 `designer-brand`：tokens.ts + Tailwind preset + docs/DESIGN.md。⚠️ musepool 因本机无 agent-gw 网关凭证（KIMI_API_KEY 未配置）不可用，按方案 §8.1 锁定色板降级，衍生色用 HSL 同温同饱和推导；凭证恢复后可补跑检索做方向校准
- [x] T0.3 `designer-assets`：4/4 资产落盘 assets/（logo-512 / tab-icon-256 / 空状态插画 / 首页 banner），Seedream 4.5 生成+本地去水印；OpenArt CDN 需走本机 SOCKS5 127.0.0.1:1081 下载（后续代理沿用）
- [x] T0.4 `coder-tabbar`：ConvexTabBar（SVG 凹口+64px 凸起按钮+呼吸光环+按下回弹）、StepTimeline、PhotoWall（packages/shared），接入客户端壳；四张资产拷入 customer/public/brand/
- [x] T0.5 集成冒烟：三端构建通过；CDP 真机视口截图验证（shots/）。修复项：①三端 tailwind content 未扫描 packages/shared 导致共享组件样式缺失；②员工端 TabBar flex 布局改 grid-cols-3。⚠️ 本机 Chrome `--screenshot` 受系统 120% DPI 影响会右偏裁切，截图须走 CDP setDeviceMetricsOverride（shots/cdp-shot.mjs）
- [ ] （待用户确认）GitHub 建仓库 + main/dev 分支 + PR 模板

### P0 遗留偏差记录
- staff「执行」Tab 暂指向 /execute/demo 占位，P3 改由今日任务进入
- merchant「管理」Tab 暂指向 /boarding，管理聚合导航 P4 定
- React 18.3 + react-router-dom v6.30（模板原为 React 19/RRv7，已按方案降级）
- npm 安装需 `--registry=https://registry.npmmirror.com`（npmjs 直连超时）

## P1 — 后端与数据模型 〔已完成 ✅ 2026-09-05〕

里程碑 M1：真实后端可用。**全部达成。**（本地适配：libsql/SQLite 嵌入式替代 MySQL，dev-login 会话替代 Kimi 登录，结构保留切换路径，见 server/README.md 与 CONTRACTS.md）

- [x] T1.1 `coder-db`：Drizzle schema 18 表（libsql/SQLite dialect）+ 迁移（幂等）+ 种子（1 门店/3 员工/10 服务/10 商品/154 槽位）；scripts/verify-db.mjs
- [x] T1.2 `coder-auth`：dev-login 签名会话（SESSION_SECRET）、RBAC procedure 四件套、assertAppointmentAccess、auth.me/bindStaff（24h 单次邀请码）/bindStore；冒烟 5 组全过
- [x] T1.3a `coder-appt`：appointment router 全 13 过程（槽位事务防超卖、滚动时间窗二维码 tw±1、checkin 限流 5/min 锁 10min、核销认领、type 分支初始化六步/boarding_stays、markPaid 幂等）；71 断言全过
- [x] T1.3b `coder-step`：serviceStep router 5 过程（状态机规则 1-5 服务端强制、active 唯一不变量事务守护、flagForRedo 唯一回退边+照片失效化）；53 断言全过
- [x] T1.3c `coder-domain`：pet/store/boarding router（邀请码 24h、寄养打卡 UPSERT+事件、退房幂等、在店看板超期标记）；5 组全过
- [x] T1.4 `coder-realtime`：EventType 18 常量、emitEvent/broadcastNow/频道解析、内存 SSE Hub、outbox 30s 重投+7 天归档、/api/events（Last-Event-ID 续传+watch 动态订阅）、push router；30+13 断言全过
- [x] T1.5 `coder-upload`：/api/upload（jimp 管线：≤10MB、最长边 2000、400px 缩略图、jpeg q82）、签名 URL（IMG_SECRET）、孤儿回收 cleanup；26 断言全过
- [x] T1.6 `coder-integration`：Hono 入口（7200，CORS 三端、sessionMiddleware、/trpc、/api/events、/api/upload、/api/img、health、outboxSweeper、优雅退出）+ appRouter 7 域合并；**e2e 40 断言全绿**：三角色登录→建单→确认→派单→扫码核销→六步（含真实上传）→completed→markPaid→review；SSE 实收事件序列与期望精确一致（confirmed→assigned→checkedin→step_updated×6→completed）；权限负例 401/403；种子库零污染
- 集成期真 bug 修复：末步 confirm 事件发射序（completed 挪到 step_updated 之后，保证 outbox id 单调序=广播序，修复续传去重误吞 completed）

### P1 遗留事项
- `appointment.paid` 已入 EventType（T1.6 补）；emitEvent 形参收窄为事务兼容类型待 T1.4 后续重构（现各调用点局部 cast，运行时无差异）
- webp 只进不出（jimp 缺解码器；客户端本就走 canvas→jpeg，影响为零）
- 核销限流/SSE Hub 为单实例内存方案（v1 明确边界）
- CORS 白名单硬编码开发端口，生产前改环境变量
- dev-login 仅限种子用户，生产必须移除并配置 SESSION_SECRET

## P2 — 客户端 〔已完成 ✅ 2026-09-05〕

里程碑 M2：客户可下单可看进度。**达成。**（商城前端按方案并入 P5）

- [x] T2.0 `coder-client-foundation`：packages/shared API 层（createPhiliaClient/useMe/useEventSource（退避 1/2/5/15s 封顶）/uploadImage（canvas 压缩 2000px）/devAuth）+ EventType 18 常量同步 + AppProviders + RequireAuth + /dev-login 页；api-smoke 12/12（真实 server 联调含 SSE 心跳帧）
- [x] T2.1 `coder-home-philia`：首页（附近好店真实数据+距离、推荐服务横滑）、PhiliaPage（全屏仪式感转场/时段问候/宠物大头像横滑/三胶囊卡/菲丽亚日记）、PetsPage（档案 CRUD+头像上传+疫苗临期警示）、MemberPage（真实聚合数据+会员体系 v2 占位，**缺口：方案无积分/次卡表**）、MomentsPage（before/after 成册+Web Share）、TabBar activeService 呼吸光环接线 + 长按一键复购
- [x] T2.2 `coder-booking`：洗护/寄养双流程 ≤4 屏（步骤条+摘要胶囊回跳）、时间槽选择器（日分组+满槽灰显+按服务时长过滤）、预约成功页二维码（qrcode 本地生成+60s 跨窗自动刷新+6 位人工码+ics 下载）、疫苗过期硬阻断、取消 4h 双分支、服务端新增 `store.listStaffPublic`
- [x] T2.3 `coder-live`：live 页（StepTimeline+PhotoWall 真实数据、step_updated 乐观 append+按 id 去重、onReconnect 全量对齐、断连 30s progressSummary 轮询兜底、visibilitychange 对齐、完成庆祝动效+评价+分享、boarding 变体（入住卡+每日打卡））、服务端新增 `boarding.myStay`
- [x] T2.4 集成验证：`tsc -b && vite build` 全绿（修 1 个未使用常量）；运行时联调：server(7200)+customer(7100) 真实环境，scripts/demo-live.ts 造"服务进行到第 4 步"演示单（真实下单→确认→派单→核销→3 步拍照上传），CDP 登录态截图 8 页（home/philia/pets/booking×2/appointments/detail/live）全部渲染正确、真实数据可见、philia 光环生效

### P2 遗留事项
- 会员体系（等级/积分/次卡/优惠券）无表，MemberPage 为真实聚合+v2 占位 → 需 schema 扩展（P5 评估）
- `appointment.create` 无 preferredStaffId 入参，选员工结果暂以备注前缀传达
- `stores` 无 phone 字段，"联系门店"tel: 恒隐藏 → 建议 schema 加列
- 寄养价格按整单快照（不按晚数乘算），定价语义待产品确认
- 日记/相册为 N+1 复合查询（≤12 条逐个 serviceStep.list），后续可加 listBatch
- sseClientId 用 localStorage（多 tab 共享，v1 可接受）

## P3 — 员工端与六步流 〔已完成 ✅ 2026-09-05〕★ 核心阶段

里程碑 M3：业务闭环跑通。**达成。**

- [x] T3.1 `coder-today`：员工端基建（Providers/RequireStaff/dev-login 员工版）+ 今日任务时间轴（四状态卡片+扫码大按钮+SSE assigned/flagged）+ 历史（`appointment.listForStaff` 新增）+ 我的（排班/消息/登出）
- [x] T3.2 `coder-scan`：QrScanner（BarcodeDetector 优先 / jsQR+canvas 5fps 降级 / 权限拒绝态）、ManualCodeInput（6 位大写）、useCheckin（429/FORBIDDEN/过期/幂等错误映射）；jsQR 解码冒烟通过（21.8ms/帧）
- [x] T3.3 `coder-sixstep`：六步执行页（一步一屏横滑、6 段进度条、拍照九宫格、before/after 双卡槽、禁用链"上传中→还差 N 张→可确认"、flagged 横幅、完成庆祝）+ IndexedDB 弱网队列（upload→register→remove 三段保序、退避 2/5/15/60s、永久拒绝防毒化；冒烟 22/22）
- [x] T3.4 `coder-boarding-staff`：寄养两段式页（入住登记：房间/称重/物品拍照清单 → checkinStay；每日打卡：喂食多顿/遛弯/备注/≤6 照片 UPSERT 明示 + 历史列表 + 超期横幅）；`boarding.stayForStaff` 新增
- [x] T3.5 集成与联调（主代理）：QrScanner 接线恢复、TabBar「执行」→/execute/current（ExecutePage 包装解析）、/me 入口（今日页头）、sonner Toaster 挂载、staff tsconfig 补 node 类型、修 ref 类型错 1 处、**三端 vite 加 /api 开发代理**（签名图片相对路径统一转发，生产同源反代）；构建全绿
- [x] 运行时验证：演示洗护单（第 4 步续跑 → 六步走完 completed）+ 寄养演示单（核销→入住登记 A-102→今日打卡带照片）真实数据 CDP 截图 7 页：今日任务（双单状态正确）/ 六步执行（进度条+禁用链）/ 寄养打卡（已入住+UPSERT 提示）/ 历史 / 我的 / 客户端 live 完成态（全步骤打勾+照片墙+时间戳推进）/ 服务相册（after 封面成册）

### P3 遗留事项
- iOS 真机扫码验证（Safari/微信 WebView jsQR 降级路径、playsinline、授权弹窗）→ P6 清单
- `boarding.daily_update` 不发 appointment 频道，员工端收不到他人代打卡（60s 轮询兜底）；根治：dailyLog 加发 appointment 频道或 staff 订 store 频道
- `boarding.overdue` 事件无发射源（超期提醒任务未实现）→ P4 商家端或后台任务补
- 员工端收不到 store 频道事件（v1 频道设计如此）
- 退房入口在商家端（P4），员工端仅提示

## P4 — 商家端 〔已完成 ✅ 2026-09-05〕

里程碑 M4：门店可运营。**达成。**

- [x] T4.1 `coder-dash`：商家端基建（Providers/RequireMerchant/dev-login 店主版/MerchantEventsProvider 全端单条 SSE）+ 仪表盘（`store.dashboardStats` 新增：今日预约/服务中/营业额/待办五件套/超期寄养）+ 待办红点区 + 今日时间轴 + TabBar 预约红点
- [x] T4.2 `coder-appt-admin`：预约管理（日历+列表双视图、状态/日期筛选、行内一键确认 ≤30 秒路径、SSE 新预约红点 toast）+ 详情操作（确认/派单弹层技能匹配排序+当日单数/改期槽位选择/取消审核）+ 监视页（StepTimeline+PhotoWall 只读+SSE 刷新、**打标重拍按钮镜像规则 5 禁用逻辑**、寄养变体）；`appointment.reschedule` 新增（事务：旧槽回减→新槽校验+1→写新时间，事件三端）
- [x] T4.3 `coder-staff-admin`：员工表格（技能/排班/绩效聚合）+ 邀请码弹层（明文一次展示+24h 提示+复用徽标）+ 排班周模板编辑器 + 寄养看板（在店卡片网格/超期红色标记/退房结算弹层含应收金额与待收款提示）+ 门店设置（信息/营业时间/服务项上下架与定价）；`store.update` 新增。缺口：员工技能/在职编辑无接口（只读+v2 注明）、merchant 无寄养历史打卡端点（留接入位）
- [x] T4.4 `coder-finance`：财务报表（日/周/月切换+翻页、服务收入/商城(恒0)/合计/完成单数/待收款五卡、按日堆叠柱状趋势图（纯 CSS）、收款方式拆分、员工维度明细、待收款列表行内 markPaid 闭环）；`store.financeStats` 新增（**对账一致性结构性保证**：区间合计=按日之和=员工之和=收款方式之和，同一次查询单循环聚合）
- [x] T4.5 集成验证（主代理）：构建全绿；运行时联调（新进行中洗护单）：8 页截图走查（仪表盘实时数字+红点、预约列表三单状态、监视页打标按钮禁用逻辑正确、财务/员工/寄养/设置）+ **API 实测三规则路径**：markPaid 收款入账（财务页 ¥88 营收+趋势柱）、flagForRedo(active)=成功且监视页显示"已打标，等待重拍"、flagForRedo(非最新 done)=FORBIDDEN 正确拒绝

### P4 遗留事项
- 客户昵称无 merchant 可读入口（列表显示 客户·id 后4位兜底）→ 建议 appointment.get/listForStore 补 customer.nickname
- pending「拒绝」无服务端入口（reviewCancel 仅受理 cancel_requested）→ 评估放宽或新增 merchant cancel
- 员工技能/在职状态编辑、merchant 寄养历史打卡端点、下架服务项全量列表、提成规则字段 → v2 评估
- 商城收入结构已预留（P5 接 orders）

## P5 — 商城后端与全链路 〔已完成 ✅ 2026-09-05〕

里程碑 M5：三业务线齐备。**达成。**

- [x] T5.1 `coder-mall-server`：mall router 9 过程（listProducts/getProduct/upsertProduct/createOrder/createPayment/listMyOrders/shipOrder/receiveOrder/listStoreOrders）+ PaymentProvider 适配层（§4.7 逐字接口；MockPayProvider 演示实现；WechatPayProvider 生产骨架缺配置即抛错；生产+mock 启动报错不静默降级）+ `payments` 流水表迁移（0001）+ 双回调端点（/api/pay/callback + mock 演示端点）；**库存条件更新防超卖、回调幂等闸、金额/签名校验**；57 断言全过。发现并规避 libsql 单连接并发事务中毒（进程内写锁）
- [x] T5.2 `coder-mall-merchant`：商品管理（含下架列表 `mall.listProductsForStore` 新增、元分严格转换、多图上传+封面、上下架 optimistic 回滚）+ 订单三队列（待发货红点/发货弹层/售后）+ TabBar 管理下拉
- [x] T5.3 `coder-mall-front`：商城列表（分类/搜索/无限滚动）/详情（多图横滑/库存警示）/购物车（context+useReducer 零依赖、localStorage 持久化、**单店限制冲突确认流**）/结算（地址表单+三步 mock 收银台演示流）/订单五 Tab（待支付继续支付/物流展示/确认收货）
- [x] T5.4 集成（主代理）：payCallbackRoute 挂载+assertPaymentConfig 启动校验、shared EventType 补 order.paid、**order.paid 加投 store 频道**（商家待发货实时可达）、libsql `PRAGMA busy_timeout=5000`、三端构建全绿
- [x] 全链路实测（真实种子库）：下单 ¥367 → mock 支付 SUCCESS → **回调二次投递幂等（idempotent=true，流水仍 1 条）→ 篡改签名 400 拒绝** → 商家待发货队列可见 → 发货 → 客户确认收货；双端 5 页截图（商城列表/详情/我的订单已完成 badge/商家订单队列/商品管理）

### P5 遗留事项
- 种子商品图指向 /brand/ 不存在路径（客户端降级爪印占位、商家端表格缩略图破图）→ P6 打磨：重新生成商品占位图或修正种子
- `order.received` 后订单移出商家队列（无 received 留痕队列）→ v2 评估
- 商城空态复用预约空态插画；商城收入 financeStats 结构已预留未接实
- 跨店下单 BAD_REQUEST（v1 单店限制，orders.store_id 单列）

## P6 — 推送联调、打磨与发布准备 〔未开始〕

---

## 执行日志

- 2026-09-04 17:18 主代理读取开发方案全文（1117 行），建立 plan.md，启动 P0。
- 2026-09-04 17:30 并行派出 T0.1/T0.2/T0.3 三个子代理。
- 2026-09-04 18:10 三子代理全部完成；派 T0.4 组件集成子代理。
- 2026-09-04 18:40 T0.5 集成冒烟完成（三端构建 + CDP 截图验证），修复 2 处集成问题。**P0 收官（M0 达成）**，GitHub 建仓待用户确认，待指令进入 P1。
- 2026-09-04 18:49 用户确认建 GitHub 仓库 + 进入 P1。建私有仓库 `lqb15122801713-png/philia-app`；本机 git 无凭证，推送改走 GitHub MCP push_files 小批量方案。
- 2026-09-04 晚 首轮子代理（gitops/coder-db）双超时 2h 零产出；调整策略：主代理预装依赖 + 硬超时 + 小批次。
- 2026-09-05 00:10 coder-db 完成 T1.1（libsql 选型验证：18 表/迁移/种子/幂等）。
- 2026-09-05 00:20 gitops 完成推送：main 全量文本 19 批 + dev 分支（PR 模板 + docs/BRANCHING.md）。**遗留：package-lock.json 超 MCP 通道上限未推 + 24 个二进制资产待本机 git 凭证补推；本地与远端 git 历史不同源（远端以批次 commit 为准），本机 git 通后以远端为基准 rebase/重克隆。**
- 2026-09-05 00:30-01:10 T1.2/T1.4/T1.5 并行完成 → T1.3a/b/c 并行完成 → T1.6 集成 + e2e 40 断言全绿。**P1 收官（M1 达成）**。
- 2026-09-05 上午 feat/p1-backend 推送 + PR #1（feat/p1-backend→dev）；用户确认合并，dev 已更新。
- 2026-09-05 11:00 进入 P2：T2.0 共享层 → T2.1/T2.2/T2.3 并行 → T2.4 运行时联调（demo-live 演示单 + CDP 登录态 8 页截图）。**P2 收官（M2 达成）**。
- 2026-09-05 12:51 用户确认合并 PR #2 + 进入 P3。T3.1-T3.4 四代理并行完成；主代理集成（扫码接线/TabBar current/Toaster//api 代理）+ 运行时联调（洗护单走完六步 completed + 寄养单入住打卡，7 页截图）。**P3 收官（M3 达成，业务闭环跑通）**。
- 2026-09-05 14:34 用户确认合并 PR #3 + 进入 P4 + **授权「后续自动继续」**（每阶段完成后自动合并 PR 并进入下一阶段，仅方案级决策/生产发布前停下确认）。T4.1-T4.4 四代理并行完成；主代理联调 8 页截图 + API 实测 markPaid/flagForRedo 三规则路径。**P4 收官（M4 达成）**。
- 2026-09-05 15:40 自动继续 P5：T5.1 mall 后端+支付适配层 → T5.2/T5.3 并行 → T5.4 集成修正 + 全链路实测（幂等/拒签/收发全通 + 5 页截图）。PR #4 已按授权自动合并。**P5 收官（M5 达成，三业务线齐备）**。
