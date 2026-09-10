# 菲丽亚宠物 Philia · 品牌设计手册

> 版本：P1（批次 5.1 同步 v1.1） · 适用端：客户端 / 商家端 / 员工端三端 PWA
> **改色凭据以 `docs/BRAND-TOKENS-v1.1.md` 为准，本手册为引用副本。**
> Token 落地：`packages/shared/src/tokens.ts`、`packages/config/tailwind-preset.js`

## 0. 参考检索说明

**musepool 不可用，方向板基于方案文档 §8.1 锁定值。**

执行阶段 musepool 检索服务因运行环境缺少网关凭证（API key 未配置）两次连接失败，按预案降级：本手册全部色彩、字体、质感决策以方案文档 §8.1 已锁定的基础色板与规格为唯一锚点，衍生色按「同色相温度、同饱和度、仅明度阶梯变化」的方法从锁定色推导（HSL 色彩空间计算），不引入凭空发明的新色相。后续若检索服务恢复，可用真实参考对衍生阶梯做一次验证性校准（只校准、不推翻锁定值）。

> 批次 5.1 注：本节为 P0 历史背景；现行色板以 §2（v1.1 终值）为准。

## 1. 设计方向与调性

**一句话：一家开在街角、有阳光和木香的高端宠物洗护小店，被装进手机里。**

四个调性关键词的落地翻译：

| 关键词 | 视觉翻译 |
| --- | --- |
| 温暖 | 全局米白暖底 `#F6F1E3` 不用纯白；正文深棕墨 `#4A3B2E` 不用纯黑；投影带棕色温，philia 按钮投影为柠檬黄光晕，不用中性灰 |
| 干净 | 大留白 + 发丝级暖色分隔线；卡片不套卡片，用间距和字重分层 |
| 可信赖 | 状态色克制（苔绿 `#7FA87C` 原值保留；功能红 `#D92D20` 按功能色推导规则取定）；价格、时间用等宽感数字纵向对齐；流程全程可视（六节点时间轴） |
| 柔软的精致感 | 16px 大圆角卡片 + 全圆角胶囊按钮；渐变（135° 柠檬黄 `#FDC830` → 薄荷绿 `#7FD8BE`）只出现在 philia 主按钮一处；动效以「呼吸」为母题，克制、慢速、可预期 |

调性边界（不允许滑入的方向）：日式侘寂的「暖」是暖色温而非做旧肌理——不做纸张纹理、不做粗粝描边、不做高对比黑字海报风；也不做玻璃拟态、蓝紫渐变、荧光强调色。

## 2. 色板（v1.1 终值，引用自 BRAND-TOKENS-v1.1.md 一/三/四章）

### 2.1 VI 锁定基础色（不可修改）

| Token | 色值 | 名称 | 用途 |
| --- | --- | --- | --- |
| `brand.primary` | `#FDC830` | 柠檬黄 | 主按钮、active 态、philia 按钮渐变主色 |
| `brand.secondary` | `#7FD8BE` | 薄荷绿 | 渐变副色、辅助强调 |
| `bg.oak` | `#D4B896` | 浅木 | 空间色（寄养 / 房间场景） |
| `text.primary` | `#4A3B2E` | 深棕墨 | 正文主色 |
| `bg.canvas` | `#F6F1E3` | 米白 | 全局页面背景 |
| `bg.card` | `#FFFFFF` | 白 | 卡片 / 浮层底（保留） |
| `success.base` | `#7FA87C` | 苔绿 | 成功 / 完成态（原值保留） |
| `danger.base` | `#D92D20` | 功能红 | 危险 / 错误态 |

- **珊瑚粉 `#FFAAA5` 已从 VI 删除**，全域 0 命中（专项检查每次清剿必跑）。
- 品牌色面上的文字 / 图标一律 on-primary 深棕墨（`#4A3B2E`，对比度 6.89:1），禁 `text-white`；功能红面上保留白字（4.83:1）。

### 2.2 light 域衍生终值

推导规则（冻结，引用 v1.1 第二章）：

- 交互态同 H 同 S：hover 明度 **−6**、pressed **−13**（dark 域方向反转：hover **+6** / pressed **−6**）。
- 洗色 light：主色同 H、S−12、L=92；副色同 H、S−9、L=88；功能色同 H、S−7、L=92；浅木同主色规则。
- 加深 deep：副色同 H、S+2、L−8；功能色同 H 同 S、L−10。
- 中性族（secondary / border / muted）hue 一律对齐深棕墨 **27.9°**。

主色族：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `brand.primaryHover` | `#FDC012` | 主按钮 hover（明度 −6） |
| `brand.primaryPressed` | `#E8AD02` | 主按钮按下（明度 −13） |
| `brand.primaryLight` | `#FCF3D9` | 选中态浅底、轻强调区块 |
| `brand.secondaryLight` | `#D3EEE6` | 薄荷绿洗底、标签底 |
| `brand.secondaryDeep` | `#5ED1AF` | 渐变 hover 副色端点 |

中性暖族：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `bg.sunken` | `#F3ECD6` | 输入区 / 凹陷分组底 |
| `bg.oakLight` | `#F1EBE5` | 浅木洗底 |
| `text.secondary` | `#8A796B` | 次级说明文字 |
| `text.placeholder` | `#BDB2A8` | 占位符 / 禁用文字 |
| `text.inverse` | `#FFFFFF` | 深底反白文字 |
| `border.default` | `#EBE2DB` | 卡片描边、输入框边框 |
| `border.strong` | `#DDD1C6` | 锁定态描边 |
| `border.divider` | `#F0EAE5` | 列表发丝分隔线 |

状态衍生：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `success.light` / `success.deep` | `#E8EFE8` / `#649160` | 成功徽章底 / 深底上的成功文字（原值保留） |
| `danger.light` / `danger.deep` | `#F8DFDD` / `#AC2419` | 错误提示底 / 深底上的错误文字 |

### 2.3 渐变

| Token | 值 | 用途 |
| --- | --- | --- |
| `gradients.philia` | `linear-gradient(135deg, #FDC830, #7FD8BE)` | philia 主按钮（唯一允许大面积渐变的元素） |
| `gradients.philiaHover` | `linear-gradient(135deg, #FDC012, #5ED1AF)` | philia 按钮 hover |

**用色纪律**：渐变是品牌最高光资源，只给 philia 按钮和极个别品牌时刻（开屏、空状态插画）；普通主按钮用纯色 `brand.primary`。背景永远是 `#F6F1E3` 而不是白；正文永远是 `#4A3B2E` 而不是黑。

### 2.4 dark 域子表（v1.1 第四章，批次 5 起开启）

shadcn HSL 变量：

```
--background: 28 25% 12%;      /* #261E17 */
--foreground: 44 51% 93%;      /* 米白反相 #F6F1E3 */
--card: 30 23% 17%;            /* #352B21 */
--card-foreground: 44 51% 93%;
--popover: 30 23% 17%;
--popover-foreground: 44 51% 93%;
--primary: 44 98% 59%;         /* 柠檬黄原值（dark 10.53:1） */
--primary-foreground: 28 23% 24%;
--secondary: 162 44% 88%;
--secondary-foreground: 28 23% 24%;
--muted: 30 22% 9%;
--muted-foreground: 28 12% 68%;
--accent: 162 44% 88%;
--accent-foreground: 28 23% 24%;
--destructive: 4 74% 57%;      /* #E34A3F（+8 提亮） */
--destructive-foreground: 0 0% 100%;
--border: 27 20% 26%;
--input: 27 20% 26%;
--ring: 44 98% 59%;
```

dark 品牌 token：

| Token | 值 |
| --- | --- |
| `brand.primary` / `hover` / `pressed` / `light` | `#FDC830` / `#FDD04E` / `#FDC012` / `#5F4807` |
| `brand.secondary` / `light` / `deep` | `#7FD8BE` / `#225848` / `#5ED1AF` |
| `bg.canvas` / `card` / `sunken` / `oak` / `oakLight` | `#261E17` / `#352B21` / `#1C1712` / `#6D502C` / `#352B21` |
| `text.primary` / `secondary` / `placeholder` / `inverse` | `#F6F1E3` / `#B7ADA4` / `#8F7E70` / `#4A3B2E` |
| `border.default` / `strong` / `divider` | `#504135` / `#685545` / `#40352B` |
| `success` base / light / deep | `#97B895` / `#2D3A2C` / `#C1CEBF` |
| `danger` base / light / deep | `#E34A3F` / `#551511` / `#EEAEAA` |

sidebar-* 变量按同祖规则推导：background←card；foreground / primary / accent / border / ring 对齐同名主变量。

## 3. 字体

### 3.1 字族栈（v1.1 自托管口径）

- **全局 sans**：`Poppins` → `Noto Sans SC` → 系统栈（`-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`）
- **拉丁展示 display（标题）**：`Montserrat` → `Noto Sans SC`
- **数字 / 价格 number**：`Montserrat` → `Noto Sans SC` → 系统栈 + `font-variant-numeric: tabular-nums`（`numericStyle`），金额、倒计时、编号一律使用，纵向对齐
- 三款字体全部**自托管 woff2**，禁外链 CDN；拉丁字体只承接拉丁字符，**中文一律落 Noto Sans SC**，不落拉丁展示字体。

**中文禁斜体**：全品牌任何端不使用 `font-style: italic`（中文无真斜体，机械倾斜伪斜体伤害可读性）。强调手段优先级：字重 600 → 品牌色 → 字号对比 → 字距。

### 3.2 字号阶梯（锁定档 + 补充档）

| 档位 | 字号 / 行高 / 字重 | 用途 |
| --- | --- | --- |
| `titleLg` | 20 / 28 / 600 | 页面主标题（锁定） |
| `title` | 17 / 24 / 600 | 卡片与区块标题（锁定） |
| `body` | 15 / 22 / 400 | 正文（锁定） |
| `caption` | 12 / 16 / 400 | 辅助说明、时间戳、标签（锁定） |
| `bodyLg` | 16 / 24 / 400 | 员工端执行界面正文（≥16px 硬性要求） |
| `price` | 20 / 28 / 600 + 数字字族 | 价格大字 |

## 4. 圆角 · 投影 · 图标

### 4.1 圆角

| Token | 值 | 用途 |
| --- | --- | --- |
| `radius.tag` | 8px | 标签、缩略图、角标 |
| `radius.input` | 12px | 输入框（锁定） |
| `radius.card` | 16px | 卡片（锁定） |
| `radius.sheet` | 20px | 底部动作面板 |
| `radius.full` | 9999px | 按钮全圆角胶囊（锁定） |

### 4.2 投影（暖色系，禁中性灰）

| Token | 值 | 用途 |
| --- | --- | --- |
| `shadows.card` | `0 2px 10px rgba(61,50,41,.05)` | 卡片静息 |
| `shadows.elevated` | `0 8px 24px rgba(61,50,41,.08)` | 浮层 / hover 浮起 |
| `shadows.philia` | `0 6px 16px rgba(253,200,48,.35)` | philia 按钮（柠檬黄光晕，锁定） |

### 4.3 图标

- 风格：**1.5px 线性图标**（stroke=1.5，圆头 linecap/linejoin），不用面性填充图标、不用彩色方块底图标容器
- 默认色 `text.secondary`，active / 可点强调用 `brand.primary`；禁用用 `text.placeholder`
- 常用尺寸：列表内 20px、TabBar 24px、功能入口 28px；点击热区 ≥44px（员工端 ≥56px）
- 状态勾选用深棕墨（on-primary）✓ 画在品牌色实心圆内（凭据第五章：品牌色面上图标一律深棕墨，禁纯白）；锁定用 1.5px 线性小锁

## 5. 动效规范

母题是「呼吸」：慢、轻、可预期，不用夸张弹跳和飞来飞去的转场。

| 场景 | 参数 |
| --- | --- |
| philia 按钮呼吸光环 | `animate-halo`：box-shadow 从 `0 0 0 0 rgba(253,200,48,.45)` 扩散到 `0 0 0 14px rgba(253,200,48,0)`，1.8s ease-out 无限循环（锁定） |
| Tab 按下反馈 | `scale(0.92)`，120ms（锁定），回弹用 `philia-spring` 缓动 |
| philia 页面转场 | 300ms ease-out（锁定，`duration-300 ease-philia-out`） |
| 常规颜色 / hover 过渡 | 160–200ms ease-out |
| 徽章弹出 | 200ms `philia-spring`，幅度克制 |

性能约束：光环动画只作用于 box-shadow/opacity/transform；同一时间屏内呼吸光环不超过 2 处（philia 按钮 + 时间轴 active 节点）。

## 6. 关键组件设计稿描述

### 6.1 ConvexTabBar（底部凸起导航）

- 结构：底部栏高 56px、白底（`bg.card`）、顶部 1px `border.divider` 发丝线、`z-tabbar`；5 个槽位，中间槽位留空给凸起按钮
- **SVG 凹口**：栏体背景由一条 SVG path 绘制，在中央下凹形成「怀抱」弧度接住圆形按钮——凹口宽约 76px、深约 14px，两侧用三次贝塞尔曲线平滑过渡回栏体直线边，曲率与按钮 64px 圆匹配，看起来像栏体被按钮轻轻压弯
- **凸起按钮（philia 按钮）**：直径 64px 正圆，中心与凹口圆心重合、上沿高出栏体约 28px；填充 `gradients.philia`（135° `#FDC830`→`#7FD8BE`），投影 `shadows.philia`，外圈常驻 `animate-halo` 呼吸光环；中央 28px 线性爪印图标用深棕墨（on-primary，凭据第五章）
- 普通 tab：24px 线性图标 + 12px 标签；默认 `text.secondary`，active 时图标与标签同变 `brand.primary`（不加底色块）；按下 `scale(0.92)` / 120ms
- 进入 philia 页面：300ms ease-out 转场，按钮 icon 旋转 90° 过渡为关闭态

### 6.2 StepTimeline（服务进度六节点时间轴）

竖向主轴，用于「预约 → 服务 → 完成」全程可视，是「可信赖」的核心载体。

- 节点六态示例：已下单 → 已到店 → 洗护中 → 美容造型 → 待接回 → 已完成
- **done**：24px 实心品牌色圆（`brand.primary`）+ 深棕墨 ✓（1.5px stroke，on-primary 口径）；节点标题 `text.primary`，右侧时间戳 12px `text.secondary`
- **active**：24px 品牌色圆点外罩 `animate-halo` 呼吸光环（与 philia 按钮同一母题），标题 600 字重 `brand.primary`，下方可展开一行当前操作说明（15px）
- **locked（未到）**：24px 圆仅 `border.strong` 1.5px 描边 + 中央 12px 线性小锁（`text.placeholder`）；标题 `text.placeholder`
- **连接线**：节点间 2px 竖线；done→done 段为 `brand.primary` 实线；active 之后未到达段为 `border.strong` 虚线（dash 4/4）
- 排版：节点行高 40px，轴线左偏 24px，内容区卡片化包裹（`radius.card` + `shadows.card`）

### 6.3 PhotoWall（服务照片墙）

- **九宫格缩略图**：3 列等宽网格，间距 4px，1:1 裁切，`radius.tag` 8px 圆角；最多 9 张，超过时第 9 张叠「+N」半透明深棕墨蒙层（`bg-ink/45`，凭据第五章蒙层口径 + 白字）；点击进全屏查看器（背景色见 §9 存疑清单第 1 条）
- **before/after 并排双图**：洗护对比专用组件——两张 4:3 图并排（间距 8px），各带左上角标签：Before 用 `brand.secondaryLight`（`#D3EEE6`）底 + `text.primary`，After 用 `brand.primary` 底 + 深棕墨字（on-primary 口径）；两图中央接缝处叠一个 24px 白圆 `→` 图标暗示变化方向；整组包裹在 `radius.card` 卡片内，下方 12px 时间戳 + 洗护师署名

## 7. 三端设计侧重

| | 客户端（宠主） | 商家端（店主） | 员工端（洗护师） |
| --- | --- | --- | --- |
| 设计取向 | **情感化** | **效率化** | **执行化** |
| 密度 | 低密大留白，照片墙主导 | 中高密，表格 / 看板 / 日历 | 极低密，一屏一任务 |
| 品牌浓度 | 最高：渐变 philia 按钮、呼吸光环、before/after 对比图 | 中：品牌色只给关键操作与状态 | 低：状态色优先于品牌色，减少干扰 |
| 关键组件 | ConvexTabBar、StepTimeline、PhotoWall、商城卡片 | 订单看板、排班日历、营收数字（数字字族） | 任务卡、StepTimeline 操作态、大按钮 |
| 硬性规格 | 常规阶梯 | 常规阶梯，表格可用 13px 辅助档 | **按钮高度 ≥56px、正文字号 ≥16px（`bodyLg` 起步）、点击热区 ≥56px**——戴湿手套也能准确操作 |
| 动效 | 完整呼吸母题 | 仅 hover/状态过渡，关光环 | 仅按下反馈，转场从简 |

## 8. 工程对接

- TS 常量：`packages/shared/src/tokens.ts`（`colors / gradients / radius / shadows / fontFamily / fontSize / numericStyle / zIndex / motion / componentSize / cssVars`，聚合导出 `tokens`）
- Tailwind：`packages/config/tailwind-preset.js`，各端 `tailwind.config` 以 `presets: [require('@philia/config/tailwind-preset')]` 引入；preset 不含 `content`，由各端自配
- 改值纪律：token 两处（tokens.ts / preset）同名同值同步修改；锁定值改动需品牌评审；**唯一改色凭据为 `docs/BRAND-TOKENS-v1.1.md`**

## 9. 存疑清单（批次 5.1 报产品侧裁定，未私自配色）

1. **全屏照片查看器背景**（§6.3）：P0 手册写「黑底改为 90% 暖深棕底，保持色温」。v1.1 终值表无此色——最接近的口径是凭据第五章「蒙层 / 遮罩一律 `bg-ink/<alpha>`」，但未定义 90% 档；dark 域 `bg.canvas #261E17` 亦非「暖深棕」。待产品侧裁定取值。
2. **active 态图标 / 标签文字直接使用 `brand.primary #FDC830`**（§4.3、§6.1、§6.2）：浅底（米白 `#F6F1E3` / 白卡）上柠檬黄文字对比度约 1.6:1，v1.1 未另定义 active 文字色。手册按冻结表如实引用，是否另设 active 文字色待产品侧裁定。
