# 卷宗 · design-s2-staff-face（产品-1015 换皮 · 片2-员工服务）

- **对象**：A1 S-00 登录（READY `203:883`）；A2 S-01 工位台（`198:15`，六步已换新标）；A3 S-02 官方三态（`202:2` 全薄／`202:137` 半展=dock 默认／`202:272` 全展）；A4 S-03 打卡（`198:244`）；A5 S-04 我的（`198:296`）。员工页 `197:2`。
- **分支／基线**：`feat/design-s2-staff-face` ＠ 基线生产 main@`ca0ab5e9b174632914892afc591d9dcbee2cf2cb`
- **施工方**：A 窗（Kimi Code · 角色卡⑧ · 已用 K3 MAX）· 2026-10-16 Asia/Shanghai
- **实证环境**：本片 server :7231（本片独立库 `E:\KIMI_tmp\s2-staff\face.db`，跑前 db:seed 复位）＋ 三端 preview :7150/:7151/:7152（本片分支构建产物，`VITE_API_BASE=http://localhost:7231`）；headless Edge/Chrome CDP :9232–9235；视口 390×844 mobile 实尺。
- **错口纪律**：在跑的他窗栈未碰——7100-7112/7200-7201/9223-9230 全程零触碰；本片只用 7150-7152/7231/9232+。
- **画布/锚点纪律**：全部既有 `data-testid`（sk-workcard／sk-stepgrid／sk-appt-*／sk-punch／sk-idcard／staff-dock／login-* 等）、copy 键、路由、接口、交互链路零改动；**零新 copy 键（零新迁移）**；六步标签统一走 `SERVICE_STEPS` 全称（`getStepDef`），不用旧短标 `StepKeyLabel`（消毒→消毒工具确认之不齐随本片收齐）。

## 一、shots/（实尺九帧 · 全绿 · 真链路驱动）

| 文件 | 对应帧 | 驱动方式（不画假态） |
|---|---|---|
| 01-s00-login.png | S-00 登录 `203:883` | 净库未登录直访 /dev-login（login.hero.staff 槽位 live 值；serif 宣言 cream 刷底+cream 主钮=2 处封顶） |
| 02-s01-today-pending.png | S-01 工位台·待接 `198:15` | 客户真下单×2（create→confirm→assign 钉美容师阿强）→ /today：大卡=最近 confirmed，六步 stepgrid 全 future，主钮「开始执行」 |
| 03-s01-today-inservice.png | S-01 工位台·服务中 `198:15` | 前台小美人工码 checkin → in_service（六步初始化）：stepgrid ①消毒工具确认 now 态+cream 光晕，主钮「继续执行」 |
| 04-s02-thin.png | S-02 全薄 `202:2` | 核销前 /schedule：全列薄行；待接行内「开始执行」pill 可用（深棕底 cream 字深钮族，不占 cream 预算） |
| 05-s02-half.png | S-02 半展 `202:137`（dock 默认） | 核销后 /schedule：服务中卡默认半展（当前步「进行中 · 消毒工具确认」+六步进度 0/6+cream「继续执行」）；**互斥实证**：B 单「开始执行」停用灰态（同时仅一单服务中） |
| 06-s02-full.png | S-02 全展 `202:272` | 真点 caret → 全展六步只读全表（serviceStep.list 真数据）：消毒工具确认 进行中／预检·洗护·精修·交付检查·完成确认 待做 |
| 09-execute-sixsteps.png | 旅程 2 执行页（过程可走通） | /execute/:A 直通：摘要卡+竖向六步 stepper；硬序（②起「完成上一步后解锁」）+拍照门槛明面（1–3／2–6／3–9／2–6／before·after 各 1／无需照片），吸底主钮「传满1张后确认本步」 |
| 07-s03-attendance.png | S-03 打卡 `198:244` | /attendance：mono 大钟真实时钟+班次+围栏胶囊+cream「上班打卡」；本周记录缺卡日赭红透出；补卡口径注+本月还可补 3 次（每月限 3 次明面） |
| 08-s04-me.png | S-04 我的 `198:296` | /me：深棕身份卡（字像金边+mono 工号+trio 三格账真值）+行组（提成/XP/评价=链接行，内容页属片4/PIN 未触） |

截图脚本：`apps/staff/scripts/s2-staff-face-shots.mjs`（零新依赖 CDP 实证器，随卷宗入库可复跑）；运行日志见 `gates/s2-staff-face-shots.log`（九帧全绿）。

## 二、gates/（闸门实证 · 全部零回退）

| 文件 | 闸门 | 结果 |
|---|---|---|
| `build-3apps.log` | 根 `npm run build`（三端 tsc+vite） | ✅ exit=0 |
| `server-typecheck.log` | server `tsc --noEmit`（本片 server 零改动，照跑自证） | ✅ exit=0 |
| `smoke-routes.log` / `smoke-routes.json` | 三端构建产物路由级冒烟（110 路由锚点+console 红线） | ✅ 110/110 通过，exit=0 |
| `check-nav-closure.log` / `.json` | 导航闭环体检（126 路由四要素） | ✅ 死胡同 0 · 弱 0 · 豁免 6，exit=0 |
| `e2e-nav-check.log` | 真点击导航实证（成功页四要素/选宠弹层/tab 保状态/底栏爪标签） | ✅ 全绿，exit=0 |
| `s2-staff-face-shots.log` | 本片实尺截图脚本运行归档 | ✅ 九帧全绿，exit=0 |
| `lint-staff.log` | `eslint .`（非令列闸门，自查项） | ⚠️ 存量 28 错 2 警（react-hooks/react-compiler 规则族旧逻辑件）；本片 diff 逐 hunk 核对：flag 行（ExecutePage 132/179/224、AttendancePage 138、DevLoginPage 85、SchedulePage 236）全在本片 hunk 之外，**本片零新增** |

## 三、令围落点（A1→A5 同片序照令）

- **A1 · S-00 登录**：页级 VI 对齐成稿——宣言刷底暗域淡金 `#F2DFA6`→cream `#F2DC8C`（Ready §2.1 正值）；wordmark/门店行/角色签/口令行/协议小字旧墨 alpha `rgba(59,46,36,x)` 全量换令牌类（text-ink-secondary/placeholder）；`login.hero.staff` 槽位链路原样（已有）；种子登录/口令门/登出真链路零触。
- **A2 · S-01 工位台**：六步 stepgrid 硬序可视实证（六列+done/now/future 三态+全称新标=成稿）；无角色空态爪印→浅木底衬线字圈（E-补1 同族工艺，Ready §4 禁爪印占位）；任务行 cream 完成钮→深棕墨底 cream 字（cream 预算回归：本屏 cream=大卡主钮唯一）；workcard 圆角 22→18（Ready §2.3 卡档）；重拍 toast 步名改全称。
- **A3 · S-02 官方三态**：薄行/半展/全展三态落地——全薄=无服务中单全列薄行；**半展=dock 默认**（服务中卡摘要条+继续执行主钮）；全展=caret 切六步只读全表；**待接「开始」**：今日 confirmed 洗护单薄行行内「开始执行」pill，点才进服务中（/execute/:id 既有入口，未核销由执行页既有引导承接）；**互斥**：有在途单时其余待接「开始」停用灰态（同时仅一单服务中）；已完成/待接保持薄行（仅服务中卡可展）；旧稿 `198:104` 未施工。
- **A4 · S-03 打卡**：mono 大钟+围栏胶囊+主钮脸面随令牌（punch 卡圆角 20→18）；错误/外勤/WiFi/断网暂存/申诉/确认/补卡全链路零触；本屏 cream 预算回归——重试/上传/确认/申诉/补卡提交五钮 cream→深棕墨底 cream 字，cream 仅留打卡主钮；补卡算账规则（每月限 3 次/当月限日/审批流）明面不破。
- **A5 · S-04 我的**：身份卡圆角 22→18；行组旧墨 alpha 令牌化；提成/XP/评价/盘点/审批链接行原样（内容页=片4/PIN，不进本片）。
- **ExecutePage/ExecuteStepper（旅程 2 脸面随齐）**：摘要卡头像环 `#FFFDF6/#B9A482`→`#FFFFFF/#A89779`（card/oak 令牌族）；遮罩/分隔线旧墨 alpha→rgba(44,40,34,x)；寄养/无在途引导页爪印→BedDouble/ScanLine 线性 icon；六步硬序+拍照门槛+弱网队列+SSE 全零触。
- **RequireStaff**：身份引导页爪印→IdCard 线性 icon（片0 报备件「页面级爪印属片2」收口）。

## 四、红线自报（零触）

- 钱权／L2／账本口径／提成·XP（S-05～S-12）／寄养房型价疫苗（B6）：零触。
- 六步硬序＋拍照门槛（≥1/≥2/≥3/≥2/前后各≥1/0，核销到店后才启，不可跳步）：零触，实证帧 09 明面。
- Dock 四槽（工位·预约·打卡·我的，无爪印）：片0 已收口，本片未动。
- 零新依赖（package\*.json/lock 零改动）；零新迁移（零新 copy 键——三态文案全复用既有键）；零服务端改动；S-12 切日历史原样（后排非本片必达）。
- 不判美；不重做 IA；icon 库全量／真图终摄／过程时间轴补帧＝非目标未触。
- A 窗禁合禁部：PR 只开不合；未点「完成／完成任务／归档／中断」；勿碰 CJ「读取 Philia 施工文件」与片0／1／3／4 会话栈。

## 五、边界与报备（提请产品侧知悉，不擅自扩）

1. **Figma 帧不可直读**：本片无 Figma 读取通道（无 token/MCP；`figma.com/design/ot5SBoqhKAw2UIZRVFzhel` 公开访问为登录墙）。施工对照=READY-FOR-DEV-20261015（§2 令牌／§3 组件／§4 态规则／§6 写死）＋骨架批旧稿结构（UX-1006 包内 staff s00–s12）＋片0/片1 已合部工艺。若帧面与本片有出入，以产品侧对照 Ready 结论为准，本片听裁。
2. **S-02「半展=dock 默认」映射**：现网原行为=服务中卡默认全展六步；本片按令改为默认半展（摘要+继续执行）、caret 切全展。若成稿 202:137 的半展内容另有所指（如不含主钮），报备候裁。
3. **待接「开始」语义**：server 现行唯一 confirmed→in_service 通道=前台核销（checkin，groomer 不可自核销，批次 S1 写死）。本片「开始执行」pill 落点=/execute/:id 既有入口（未核销走「该预约尚未核销」引导页），未新建美容师自启通道（建通道=动 server=越令围）。若成稿「开始」=美容师直连启动，需另令开 server 口。
4. **stepgrid 六列全称**：点格名用 SERVICE_STEPS 全称（7.5px mono 窄格内「消毒工具确认」等长名折行）；若成稿点格用短标（消毒/交付/完成类），候裁后一档替换（stepgrid 单点取值处）。
5. **dock 高 58+safe**：Ready §2.3 写 ~64+safe；dock 属片0 壳层已验收合部，本片不翻壳层裁量。
6. **旧 deck 件**（components/today/deck/*、FrontdeskDesk/GroomerDesk 等骨架批前遗产）：按既有回滚保留口径未动（不留死代码≠拆既有回滚）。
