# codebase 组件普查（换皮施工包·随包件二）

> 产品侧 2026-09-21，基线 main@22dcdde8（员工端 2.0 已合）。用途：换皮批"组件库先行"的家底盘点——哪些一次变全局、哪些逐件过验收尺、哪些先归并。

## 一、总量与分层

| 端 | 组件总数 | ui 基础库（三端同源） | 业务组件 |
|---|---|---|---|
| 客户端 customer | 97 | 53 | 44 |
| 商家端 merchant | 94 | 53 | 41 |
| 员工端 staff | 78 | 53 | 25 |
| **合计** | **269** | **53（三端同一套 shadcn 系）** | **110** |

## 二、换皮策略（按层定打法）

**① ui 基础库 53 件（button/card/dialog/sheet/input/badge/toast 等）——token 层一次变全局**：
这是"一次施工三端同换"的杠杆点。UX 定稿三色（深棕/卡其/淡黄 CJ-0921-10）+字号阶梯+间距刻度+圆角谱落 token（Tailwind theme+CSS 变量）后，53 件只改 token 引用不改结构——**换皮批 80% 的视觉变化在这一层完成**。

**② 业务组件 110 件——按本普查清单逐件过验收尺**：
色值对表/字号对阶梯/间距对 4·8 倍数/组件不重复造/对照图逐件附。重点件（高频曝光）：客户端 AppDock、PageHeader、booking 单屏 13 件、home 三面板、live 六件、mall 五件；商家端 MerchantRail、cashier 十件、dashboard 四件；员工端 StaffDock、execute/deck/boarding 各件。

**③ 同型异名归并件（先归并再换皮，防"五个页面五种黄"重演）**：

| 同型件 | 分布 | 归并建议 |
|---|---|---|
| Toast | customer(booking/mall)/merchant(appointments/finance)/staff(boarding/execute/today) 7+ 处 | 归并为 ui/toast 单件三端共用（规范 E 套轻提示四规则一把尺） |
| PhotoViewer | customer(live)/merchant(appointments)/staff(boarding) 3 处 | 归并单件 |
| PageHeader | customer/staff 各一（商家端走 Rail 体系） | 保留两件但统一 token（W1 已三态语义化） |
| CelebrationOverlay | customer(live)/staff(execute) 2 处 | 归并单件 |
| Stepper（LiveStepper/ExecuteStepper/StepIndicator） | 3 处 | 归并单件（步骤器同源） |
| 选择器族（PetPicker/PetPickerFlat/StaffPicker/StaffPickerFlat/BottomSheet 系） | booking 单屏 13 件 | W1 整行可点已统一交互，换皮时同一家族同一工艺 |

## 三、缺口感知（方向三定稿后补齐）

- 签名时刻组件（方向三"暖仪器"蓝图式宠物线稿位——UX 定稿件，不在普查内）；
- 会员四档卡组件（R11 设计件，会员页重做随批）；
- 骨架屏族（规范 E 套选型矩阵：列表看板骨架——现状 animate-pulse 占位散在各页，换皮批统一成件）。

## 四、验收尺五条（换皮批交付逐件过）

1. 色值对表（token 外色值=0，grep 闸门）；2. 字号对阶梯（阶梯外字号=0）；3. 间距对 4/8 倍数（野生 px 报警）；4. 组件不重复造（同型异名=打回）；5. 对照图逐件附（渲染截图 vs 施工示意图，产品侧忠实度验收，UX 审美抽审）。
