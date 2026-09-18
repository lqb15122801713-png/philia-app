# U4 商家端逐格对照销项记录（diff-merchant）

每条格式：编号｜屏｜差异描述｜修法/口径｜状态（已销/豁免/疑点）
屏：01 登录 / 02 总览 / 03 预约 / 04 预约详情 / 05 监控 Hub（+1920 补拍）/ 06 寄养 / 07 订单 / 08 商品 / 09 会员·次卡 / 10 员工 / 11 财务 / 12 设置 / 13 单约监控（1440×900）
真相源：U3商家端全屏规格书-v1 + 试样（CSS 数值直接 grep）+ motion-detail-spec-v1；字阶闸门 11/12/14/17/20+26/32，圆角 20/14/6/full。

## 屏 01 登录

- F-1｜屏 01｜协议小字 text-[10px] 越字阶闸门（试样所印同为 10）｜text-caption-xs 11（员工端 E-19 同口径映射）｜已销
- F-2｜屏 01｜wordmark font-extrabold 800 超出自托管字重上限 700；口令字段 13px 越阶｜font-bold 700；text-body-sm 14（E-3/E-12 先例）｜已销
- F-3｜屏 01｜routes.json 等待的 [data-testid="login-gate"] 不存在（员工/客户端同 testid 在案）｜登录卡补 testid，管线 waitSelector 不再超时｜已销
- F-4｜屏 01｜屏下 dev-login 功能区（店主种子账号/口令门/手动 userId 兜底）试样未画；实拍为口令门强制展开真态｜内测真链路保留不造假（员工端 E-5/E-6 同口径）｜豁免（结构差异：真实功能）

## 屏 02 总览

- F-5｜屏 02｜服务中行胶囊「服务中」缺试样步进「服务中 3/6」｜新增 useStepProgress（listForStore 无步数 → 现成 serviceStep.list 一单一查，与 Hub/详情同 queryKey 共享缓存，零新接口；查询未回落裸「服务中」不伪造）｜已销（实拍「服务中 2/6」）
- F-6｜屏 02｜已完成未收款行胶囊缺「· 待收款」（试样「已完成 · 待收款」）｜TodayTimeline completed && paidAt==null → 「已完成 · 待收款」｜已销
- F-7｜屏 02｜待办行「历史待确认」vs 试样「历史待确认单」｜文案对齐试样｜已销
- F-8｜屏 02｜页标题 19/800 越字阶闸门+超字重上限（试样 .m-top h2 所印 19/800 同越）｜MainScaffold 全域 text-title-lg 20 + font-bold（闸门内最近档，E-2/E-47 映射先例）｜已销（全域一次落码）

## 屏 03 预约

- F-9｜屏 03｜服务中行胶囊缺「N/6」（同 F-5）｜AppointmentsPage 挂 useStepProgress(visible) 传入 AppointmentRow｜已销（实拍「服务中 2/6」）
- F-10｜屏 03｜金额 ¥88.00 两位小数（试样 ¥88 整数口径）｜appt-utils fenToYuan 整数元去 .00、带零头才两位（E-37 同口径）｜已销

## 屏 04 预约详情

- F-11｜屏 04｜六步 done 圆点内嵌 ✓ 图标（试样=纯薄荷圆点）｜摘除 Check 图标，u3-stepv 试样同值锁定｜已销
- F-12｜屏 04｜副行多挂状态胶囊（试样副行=单号·时间·时长纯文字）｜摘除 sub 内 u3-st（STATUS_ST/statusLabel 一并清）｜已销
- F-13｜屏 04｜疫苗有效未标 ✓（试样「有效期至 2027-03 ✓」）｜未过期补 ✓；日期保留真值全日 YYYY-MM-DD 不截断｜已销
- F-14｜屏 04｜金额卡 kv 格：¥88.00 小数、格值 13px 越阶、u3-kv .v 16px 越阶、cell 圆角 12 越四档｜fenToYuan 整数化（F-10 同法）；格值 text-body-sm 14；u3-kv .v→17/700、cell→14 圆角（index.css 一次落码）｜已销
- F-15｜屏 04｜动作区：试样静态陈列「改期/改派/去收款·¥128」，实现按态切换（in_service 仅细线「服务监视」）｜规格书 §4 文字口径「柠檬去收款待收款才出现」优先于试样静态全量陈列；assign/reschedule 服务端仅受理 pending/confirmed，不造假钮｜豁免（状态口径）
- F-16｜屏 04｜金额卡状态格「未收」vs 试样「待收款」红｜待收款动态口径=completed&&unpaid（dashboardStats.todo.unpaid 同口径）；试样为静态陈列与状态机冲突｜豁免（口径）

## 屏 05 监控 Hub（1440×900 + 1920×1080 补拍）

- F-17｜屏 05｜寄养卡 badge=纸面+木点（试样=墨底 #4A3B2E + 米白字、无点，inline style 锁定）｜CardPhotoHead 改 tone 双式：洗护=纸面+薄荷点 / 寄养=墨底米白字（墨轨同族浅色字，仅此两式，登记）｜已销（1440/1920 双拍佐证）
- F-18｜屏 05｜照片头 aspect-16/10（1440 下约 244px 高，卡面被照片主导）｜试样 .mon-card .ph=height:120px 定值优先（规格书「16:10」为裁切意图，试样为落地数值；1920 大屏保持紧凑）；骨架同构 120px｜已销
- F-19｜屏 05｜卡面 N/6 数字 text-caption 12 小于卡题（试样 .r1 同号 13）｜text-body-sm 14（13 越阶映射闸门最近档，与卡题同号）；font-extrabold→font-bold｜已销
- F-20｜屏 05｜【任务书疑点核实】管线初拍 Hub 卡「0/6 · 等待开工」而单约页 2/6，疑 Hub 不回读存量进度｜读码+实证：卡进度=每卡 serviceStep.list 回读存量（probe-hub 直调 200/4ms 返回 done×2+active；probe-hub2 新标签页实拍 2/6 正确）。真根因=headless Chrome 整页跳转后旧页 SSE EventSource 不立即归还 socket，同 host 6 连接上限占满 → 后续页 auth.me/steps 查询排队（同批 06/07/08 卡「加载中…」同源，probe-seq 复现）｜已销（管线销项：shoot.mjs/scrollshot 改每屏全新标签页，cookie profile 级共享无需重登；终拍全绿。业务代码不动、推送架构不动；U3-1「step_updated 仅 appointment 频道，Hub 挂 15s 慢轮询兜底」架构疑点仍在案，与本现象无关）
- F-21｜屏 05｜Hub 动态行步名「洗澡美容中」（共享包 steps.ts 运营向全称）vs 详情页冻结口径「洗护」｜规格书 §13「同 §4 stepper」→ 冻结步名表迁 appt-utils（STEP_ROWS/stepDisplayName），Hub 动态行/单约监控/打标文案统一；共享包 steps.ts 不动（客户端/员工端在用以上全称）｜已销（登记：共享包全称与 U3 冻结名差异上交产品侧备案）

## 屏 06 寄养

- F-22｜屏 06｜房型卡占用数字 text-[22px]/800 越字阶闸门（试样 .room .v 所印 22 同越）｜text-title-lg 20 + font-bold（E-39 同口径 22→20）｜已销
- F-23｜屏 06｜在店表横滑容器 overflow-x-auto 桌面露滚动条（F-补1 点名）｜挂 u3-noscrollx（scrollbar-width:none + ::-webkit-scrollbar{display:none} 双写）｜已销
- F-24｜屏 06｜右侧入住详情栏（点行展开 BoardingStayDetail）试样未画｜真实功能块保留（房间/称重/物品/打卡/应收全真值，scroll-06-sel 实拍佐证：点行柠檬 14% 选中+详情卡 A01/28.5kg/牵引绳/¥398）；工艺在闸｜豁免（结构差异：真实功能）

## 屏 07 订单

- F-25｜屏 07｜金额 ¥236.00 两位小数（试样 ¥236 整数）｜mall-admin fenToYuan/fmtMoney 整数元去 .00｜已销（实拍 ¥367）
- F-26｜屏 07｜筛选 chips 无「已完成」档（试样四档含已完成）｜listStoreOrders 仅 paid/shipped/refunding 三队列（零新接口红线，OrdersPage 头注在案），不造归档假数据｜豁免（无真实字段/接口）
- F-27｜屏 07｜已发货状态胶囊「已发货」（试样「已发货 · 顺丰」）｜shipOrder 链路仅 trackingNo 无 carrier 字段（server/routers/mall.ts 实证），不编造承运商｜豁免（无真实字段）
- F-28｜屏 07｜订单表横滑容器滚动条（F-补1）｜u3-noscrollx｜已销

## 屏 08 商品

- F-29｜屏 08｜商品图 aspect-4/3（1440 下约 207px 高）vs 试样 .prod .ph=110px 定值｜从试样 h-[110px] object-cover（规格书「4:3 图」为裁切意图；货架密度优先），骨架同构｜已销
- F-30｜屏 08｜价格 ¥118.00 小数（试样 ¥118 整数）｜mall fenToYuan 整数化（F-25 同法）｜已销
- F-31｜屏 08｜分类 chips=真实枚举「全部/主粮/零食/玩具/清洁/其他」（应用层枚举，服务端 category 过滤真值）vs 试样占位「全部/主粮/零食/用品/洗护」｜改标签即假筛选（枚举即接口入参），保留真实枚举｜疑点（上交产品侧：试样分类名与既有枚举口径不一，待裁定是否改枚举）

## 屏 09 会员·次卡

- F-32｜屏 09｜两栏 1.6fr:1fr（试样 .two-col=1.7fr:1fr）｜1.7fr 对齐试样｜已销
- F-33｜屏 09｜副行缺试样「本月扣次 N 次」｜pass.listLogs 上限 100 条，「本月扣次」为窗口内近似口径，不挂虚标数字（员工端绩效「本月」同口径先例）；「在效次卡 N 张 · 年费会员细则待定（冻结决策 15）」真值保留｜豁免（口径防虚标）
- F-34｜屏 09｜空态实拍（造数无次卡=真空态）｜「还没有客户买次卡——洗护 10 次卡是老客最爱」/「暂无扣次流水——…」原文 + u3-panel 细线暖底不死灰｜已销（核验无差异）

## 屏 10 员工

- F-35｜屏 10｜「编辑 ›」/「启用 ›」渲染为细线钮（试样=纯文字 11.5/700 墨字）｜文字钮 12/700 + active:scale-92 120ms（11.5 越阶映射 12）｜已销
- F-36｜屏 10｜头像占位带 UserRound 图标（试样无头像=纯墨 12% 圆，.av 无图时无底图）｜摘除图标留纯圆占位（staff 表无 avatarUrl 字段，不造假）｜已销
- F-37｜屏 10｜绩效行「完成 0 单 · 好评 —」无试样「本月」字样与「服务中 N 单」｜staffList 聚合无本月维度/在服务数（头注口径在案），不挂虚标｜豁免（无真实字段）

## 屏 11 财务

- F-38｜屏 11｜金额 ¥88.00/¥0.00 两位小数（试样 ¥1,884/¥897 整数口径）｜formatYuan 整数元去 .00、千分位保留｜已销（实拍 ¥88/¥0；scroll-11b 佐证流水表 ¥88 已收 live）
- F-39｜屏 11｜收款流水不含商城订单行（试样含「商城订单 · 在线支付 · 已支付」行）｜页面口径=收款登记（到店付），financeStats/listForStore 均不含商城在线支付明细；是否并入待产品侧裁定（商城收款是否计入营业额口径未定）｜疑点（上交，不改聚合口径、零新接口）

## 屏 12 设置

- F-40｜屏 12｜服务项与时长行动作「编辑 ›」（试样「管理 ›」）｜ExpandRow 补 actionLabel，服务项行「管理 ›」，其余行「编辑 ›」不变｜已销
- F-41｜屏 12｜通知开关/行工艺核验｜Switch 38×22 薄荷开/墨 12% 关+纸面钮=试样 .sw 同值；set-row 13px  padding/顶线/副行 11px 对格；通知偏好 hint 三行逐字=试样｜已销（核验无差异）

## 屏 13 单约监控

- F-42｜屏 13｜初拍为骨架入镜（照片墙/六步为二级查询，routes 无等待锚点）｜页面补 data-testid="monitor-wall" + routes.json waitSelector/settleMs 1500｜已销（管线口径；终拍照片墙 5 张+六步全渲染）
- F-43｜屏 13｜六步行步名=共享包全称（消毒工具确认/洗澡美容/细节对比照）vs §4 冻结口径｜统一 stepDisplayName（F-21 同表）；实拍 消毒/预检/洗护/精修/前后对比照/完成确认｜已销
- F-44｜屏 13｜active 步副行「进行中 · 2/9 张」（maxPhotos 分母）vs 试样「进行中 · 2/3 张 · 2 分钟前更新」｜分母改 minPhotos（与详情页 requiredPhotos 同口径）；补相对时间后缀（取该步最新照片 takenAt 真值，无照片不缀）｜已销（scroll-13b 实拍「进行中 · 2/3 张 · 6 小时前更新」）

## 全域 / 动效纲领 / F-补1

- F-45｜全域｜prefers-reduced-motion 无降级（纲领 §四.7 可访问性红线）｜index.css 新增全域 reduce 降级（动画/过渡 0.01ms、单次迭代、scroll-behavior auto；员工端 E-43 同构）｜已销
- F-46｜全域｜自研 toast 自消 3.2s/3.6s/3.6s（纲领 §四.1=2.5s）｜appointments/Toast、finance/Toast、staff-admin/ui 三处 → 2500ms（E-42 先例；sonner 全域 Toaster 默认时长两端先例均未动，不越界）｜已销
- F-47｜全域｜按下态/行 hover/骨架/弹层抽验（任务书点名）｜墨轨项 scale-92+120ms+spring ✓；柠檬钮/chips scale-92~0.98+120ms ✓（0.98 档员工端 E-36 已登记）；u3-tbl 行 hover 160ms standard 曲线 ✓；各屏骨架=内容轮廓 pulse 无页面级转圈 ✓（ProductEditorDialog 上传中 Loader2=按钮内联态，登记同 E-45）；弹层无显式过渡即时呈现（≤250ms 上限内）✓｜已销
- F-48｜全域｜F-补1 横滑容器滚动条隐藏｜命中三处：寄养在店表/订单表/改期弹层日期横滑（RescheduleSheet）→ 全挂 u3-noscrollx（双写隐藏，桌面同样干净）；chips 行均为 flex-wrap 不横滑；预约/财务表 1440 下不溢出无横滑容器｜已销
- F-49｜全域｜F-补1 空表/空卡工艺｜逐屏核：空态原文=规格书 §2/§3/§5/§6/§7/§8/§9/§10/§11 逐字（09 双空态实拍真态佐证）；均 u3-panel 细线暖底+墨 62%/42% 文字，不死灰；商品空态含行动钮「＋ 新增商品」真链路｜已销
- F-50｜全域｜守卫引导页旧工艺（🐾 emoji、text-body 15 越阶）｜PawPrint 墨色线图标+沉底暖圆（emoji 禁令口径，E-46 先例）+ text-body-sm｜已销
- F-51｜全域｜字重 800（font-extrabold）超出自托管上限 700 存量｜详情/次卡/商品/员工/寄养详情 7 处归一 font-bold（视觉不变，浏览器本就回退 700；E-3 口径）｜已销
- F-52｜全域｜禁令核验｜改动文件 diff 新增行 grep（FFAAA5/text-white/gradient/text-shadow）=0 命中；弹层/表单族 text-body 15px 为 T4/T5 期存量（试样未画弹层，不在 13 屏表面）｜已销（弹层族 15px 登记后续批次统一）

---

验证记录：`npx tsc -b` exit 0（全部改动落码后终态）；`VITE_API_BASE=http://app.beta.local:7200 npm run build:merchant` ✓；禁令 diff grep 新增行 0 命中（F-52）。`node shoot.mjs merchant` 14/14 ✓（每屏全新标签页，SSE socket 占用根治）+ `python combine.py merchant` 重合成，13 屏并排图逐张自查销项；监控 1920×1080 补拍 ✓（05-monitor-1920.png：三列卡紧凑、双 badge 式正确）。屏下区域与交互态用 u4-pipeline/scrollshot-merchant.mjs（临时辅助，不入 repo）实拍 4 张：scroll-04b（详情屏下：事件轨迹卡+金额卡 ¥88 整数+疫苗 ✓+56×42 缩略墙）、scroll-13b（照片墙 128×96 最新在前+六步冻结名+「进行中 · 2/3 张 · 6 小时前更新」+快捷操作双细线钮）、scroll-06-sel（点选在店行→柠檬 14% 选中+右侧入住详情卡全真值）、scroll-11b（财务流水表整数金额+已收 live）。管线工具修复（不入 repo）：baseline.mjs 商家端视口 2600+解开 .stage 限宽（试样 .board 固定 2×1240 列超出 stage 1500 限宽，左列负 x 致初拍左图整批裁歪）；shoot.mjs 每屏新标签页（headless SSE socket 不归还致同 host 连接占满，旧序列 06/07/08 卡「加载中…」、05 卡 0/6 的同一根因）。
