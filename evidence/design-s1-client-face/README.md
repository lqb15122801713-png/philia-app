# 卷宗 · design-s1-client-face（产品-1015 换皮 · 片1-客户端脸）

- **对象**：A1 首页空闲／服务中（READY `170:38`／`170:184`）；A2 预约 Default／已选／选人／成功（`174:38`／`174:138`／`174:346`／`174:428`）；A3 会员码全屏（`174:608`）
- **分支／基线**：`feat/design-s1-client-face` ＠ 基线生产 main@`a84397cc2503eb9c0ea67ff7cddf902372e9c9b9`
- **施工方**：A 窗（Kimi Code · 角色卡⑧ · 已用 K3 MAX）· 2026-10-15 Asia/Shanghai
- **实证环境**：本片 server :7201（本片独立库，跑前 db:seed 复位）＋ 三端 preview :7120/:7121/:7122（本片分支构建产物，`VITE_API_BASE=http://localhost:7201`）；headless Chrome CDP :9230–9233；视口 390×844 mobile 实尺。
- **错口纪律**：在跑的他窗栈未碰——7100-7102/7200（s0shell）与 7110-7112（s0base）全程零触碰；本片全程只用 7120-7122/7201/9230+。
- **画布/锚点纪律**：全部 `data-testid`、`data-block-key`、copy 键、路由、交互公式（2-tap／选人卡轨／随缘末卡）零改动；本批仅色值/圆角/发丝线层面换肤。

## 一、shots/（实尺七帧 · 全绿 · 真链路驱动）

| 文件 | 对应帧 | 驱动方式（不画假态） |
|---|---|---|
| 01-customer-home-idle.png | 首页·空闲 `170:38` | 净库后 dev-login 种子客户直访 /home（无服务中单；无下单记忆→降级入口卡） |
| 02-customer-booking-default.png | 预约·Default `174:38` | /booking/grooming 默认预填（宠物直选/首个在架服务/最近门店） |
| 03-customer-booking-selected.png | 预约·已选时段 `174:138` | 真点首个可约槽 `gs-slot-09:00`（日期=首个可约日自动预选） |
| 04-customer-booking-staff.png | 预约·选人 `174:346` | 真点轨内首张员工卡（选中=brand 深面边＋字像 cream） |
| 05-customer-booking-success.png | 预约·成功 `174:428` | 真点「确认预约」→ appointment.create 真实落库 → /booking/success?aid=01M4ZQW11M3YP1NVJQFF92NXK5 |
| 06-customer-member-card.png | 会员码全屏 `174:608` | membership.openFree 免费档真实开档 → 真 token 码区（5min 自刷） |
| 07-customer-home-inservice.png | 首页·服务中 `170:184` | API 真造单 create→confirm→getCode→checkin → in_service（id=01M4ZQW8FQHGDB6FAN0WCK2S38） |

截图脚本：`apps/customer/scripts/s1-face-shots.mjs`（零新依赖 CDP 实证器，随卷宗入库可复跑）；运行日志见 `gates/s1-face-shots.log`（全绿）。

## 二、gates/（闸门实证 · 全部零回退）

| 文件 | 闸门 | 结果 |
|---|---|---|
| `build-3apps.log` | 根 `npm run build`（三端 tsc+vite） | ✅ exit=0（三端全绿） |
| `smoke-routes.log` / `smoke-routes.json` | 三端构建产物路由级冒烟（110 路由锚点+console 红线） | ✅ 110/110 通过，exit=0 |
| `e2e-nav-check.log` | 真点击导航实证（成功页四要素/选宠弹层整行可点/tab 保状态/底栏爪标签） | ✅ 13 断言全绿，exit=0 |
| `check-nav-closure.log` | 导航闭环体检（126 路由四要素） | ✅ 死胡同 0 · 弱 0 · 豁免 6，exit=0 |
| `s1-face-shots.log` | 本片实尺截图脚本运行归档 | ✅ 全绿，exit=0 |
| `lint-customer.log` | `eslint .`（非令列闸门，自查项） | ⚠️ 存量 75 错（react-hooks 规则族等旧逻辑件）；经逐 hunk 核对本片 diff 行全在 flag 行之外，**本片零新增** |

## 三、红线自报（零触）

- 钱权／L2／账本口径／回馈金机制／会员档名与价格：零触（会员码屏仅 token 族置换档色谱，文案/数值/链路原样）。
- 底栏顺序、洗护六步、2-tap／Half 选人公式、零弹窗、SSE/数据链路/queryKey：零触。
- 零新依赖（package.json/lock 零改动）；零新迁移；零服务端改动。
- A 窗禁合禁部：PR 只开不合；未点「完成／完成任务／归档／中断」。
- CJ「读取 Philia 施工文件」与片0／片2–4 会话栈：未碰。

## 四、边界与报备（提请产品侧知悉，不擅自扩）

1. **174:346「Half 选人含近期作品」**：现网预约选人＝单屏内嵌 flat 卡轨（`gs-groomer-*` 为 e2e 契约锚；`listStaffPublic` 不透出作品字段）。新建半屏交互＝破锚＝现网回退，故本片按「选人态脸面」对照落地（卡轨选中态 VI 化），未新建 HalfSheet；若需 174:346 的半屏＋近期作品形态，需另令（含服务端作品数据口）。
2. **全局令牌分层**：tailwind preset / index.css :root / tokens.ts 属片0（三端壳·VI 令牌）范围，本片未动；本片脸面层（hv2-*／m2--vi／预约单屏件）已用 VI 显式值，片0 令牌合入后同值叠加不回退。
3. **寄养单屏**（Boarding* 件）：令围四态均为洗护帧，寄养脸面未在本片令围；仅共用 BottomSheet 顶角 26→24 一处随本片对齐（无行为变化）。寄养主钮等旧值若需拉齐，请另令。
4. **旧 4 屏向导**（`/booking/grooming/wizard` 隐藏回滚路由及 SlotPicker/StepIndicator/SummaryChips/PetPicker card 皮）：遗产回滚件，按「不留死代码≠拆既有回滚」处理——未动。
5. **真图终摄／icon 库全量／过程时间轴补帧**：非目标，未触；banner/卡面图槽沿用既有端口与占位资产。
