# 片2-员工服务（产品-1015 换皮 · 任务书冻结版 V1.0 · 头子已准 10-16）

> PR **只开不合**：合＋部署＝产品经理走 ROG；验收＝产品侧对照 Ready＋现网（施工方自报全绿≠验收通过）。

## 令围（A1→A2→A3→A4→A5 同片序）

员工端服务过程脸面按 Ready 成稿落地：S-00 登录（`203:883`）／S-01 工位台（`198:15`）／S-02 官方三态（`202:2` 全薄·`202:137` 半展=dock 默认·`202:272` 全展）／S-03 打卡（`198:244`）／S-04 我的（`198:296`）。

- **A1 登录**：宣言刷底 `#F2DFA6`→cream `#F2DC8C`；页级旧墨 alpha `rgba(59,46,36,x)`→令牌类；`login.hero.staff` 槽位与种子登录/口令门链路零触。
- **A2 工位台**：六步 stepgrid 硬序可视（全称新标=成稿：消毒工具确认/预检/洗护/精修/交付检查/完成确认）；无角色空态爪印→衬线字圈；任务完成钮 cream→深棕族（cream 预算回归：本屏 cream=大卡主钮唯一）；workcard 圆角 22→18。
- **A3 预约三态**：SkApptCard 升 `level` 三态＋行内行动槽——全薄（无服务中单全列薄行）；**半展=dock 默认**（服务中卡：当前步摘要+六步进度+「继续执行」主钮）；**全展**（caret 切六步只读全表）；**待接「开始」**：今日 confirmed 洗护单薄行内「开始执行」pill，点才进服务中；**互斥**：有在途单时其余待接 pill 停用（同时仅一单服务中）；已完成/待接保持薄行；六步标签统一 `SERVICE_STEPS` 全称（`getStepDef`），弃 `StepKeyLabel` 短标。
- **A4 打卡**：punch 卡圆角 20→18；重试/上传/确认/申诉/补卡五钮 cream→深棕族（cream=打卡主钮唯一）；打卡/补卡算账规则（每月限 3 次等）与 WiFi/外勤/断网/申诉链路零触。
- **A5 我的**：身份卡圆角 22→18；行组令牌化；提成/XP/评价/盘点链接行原样（内容页=片4/PIN 不进本片）。
- **随齐**：RequireStaff/ExecutePage 引导页爪印→线性 icon（IdCard/BedDouble/ScanLine）；ExecuteStepper 旧墨 alpha→rgba(44,40,34,x) 族；头像环色令牌化。六步硬序+拍照门槛（≥1/≥2/≥3/≥2/前后各≥1/0）+弱网队列+SSE 全零触。

## 闸门（实证在卷 `evidence/design-s2-staff-face/`；施工方自报全绿≠验收通过）

| 闸门 | 结果 |
|---|---|
| `npm run build`（三端 tsc+vite） | ✅ exit=0（`gates/build-3apps.log`） |
| server `tsc --noEmit`（本片 server 零改动） | ✅ exit=0（`gates/server-typecheck.log`） |
| smoke-routes（110 路由锚点+console 红线） | ✅ 110/110（`gates/smoke-routes.log/.json`） |
| check-nav-closure（126 路由四要素） | ✅ 死胡同 0·弱 0·豁免 6（`gates/check-nav-closure.log/.json`） |
| e2e-nav-check（真点击导航） | ✅ 全绿（`gates/e2e-nav-check.log`） |
| 实尺截图（390×844，真链路驱动：真下单/真派单/真核销造 in_service） | ✅ 九帧全绿已目检（`shots/01–09`＋`gates/s2-staff-face-shots.log`） |
| eslint（自查，非令列） | 存量 28 错 2 警均旧逻辑件；本片 diff 逐 hunk 核对零新增（`gates/lint-staff.log`） |

实证环境：本片独立栈 server :7231＋preview :7150-7152（本片分支构建产物）；与他窗栈（7100-7122/7200-7201/9223-9230）错口零触碰。

## 红线（零触）

钱权／L2／账本口径／提成·XP（S-05～S-12=片4/PIN）／寄养 B6 口：零触。零新依赖（package\*.json/lock 零改动）；零新迁移（零新 copy 键）；零服务端改动。不判美；不重做 IA；icon 库全量/真图终摄/时间轴补帧＝非目标。未点「完成/完成任务/归档/中断」。

## 报备（判断件，候裁；详=卷宗 §五）

1. **Figma 帧不可直读**（无 token；文件为登录墙）：施工对照=READY-FOR-DEV-20261015＋骨架批旧稿结构＋片0/片1 工艺；帧面出入以产品侧对照 Ready 为准，听裁。
2. **半展=dock 默认的映射**：现网原=服务中卡默认全展六步，本片按令改默认半展+caret 全展；若 202:137 半展内容另有所指，候裁。
3. **待接「开始」语义**：server 现行 confirmed→in_service 唯一通道=前台核销（groomer 不可自核销，批次 S1 写死）；本片 pill 落点=/execute/:id 既有入口（未核销走既有引导页）。若成稿=美容师直连启动，需另令开 server 口。
4. **stepgrid 点格全称**：六列 7.5px mono 窄格内长名折行；若成稿点格用短标，候裁一档替换。
5. **dock 高 58+safe**（Ready 写 ~64+safe）：壳层属片0 已验收，本片不翻。

---

基线：生产 main@`ca0ab5e9`（全 `ca0ab5e9b174632914892afc591d9dcbee2cf2cb`）｜ 分支 `feat/design-s2-staff-face` ｜ 模型 **K3 MAX** ｜ A 窗禁合禁部。
