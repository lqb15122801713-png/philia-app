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

## P3 — 员工端与六步流 〔未开始〕
## P4 — 商家端 〔未开始〕
## P5 — 商城后端与全链路 〔未开始〕
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
