# 菲丽亚宠物 Philia · 品牌设计手册

> 版本：P0（T0.2 产出） · 适用端：客户端 / 商家端 / 员工端三端 PWA
> Token 落地：`packages/shared/src/tokens.ts`、`packages/config/tailwind-preset.js`

## 0. 参考检索说明

**musepool 不可用，方向板基于方案文档 §8.1 锁定值。**

执行阶段 musepool 检索服务因运行环境缺少网关凭证（API key 未配置）两次连接失败，按预案降级：本手册全部色彩、字体、质感决策以方案文档 §8.1 已锁定的基础色板与规格为唯一锚点，衍生色按「同色相温度、同饱和度、仅明度阶梯变化」的方法从锁定色推导（HSL 色彩空间计算），不引入凭空发明的新色相。后续若检索服务恢复，可用真实参考对衍生阶梯做一次验证性校准（只校准、不推翻锁定值）。

## 1. 设计方向与调性

**一句话：一家开在街角、有阳光和木香的高端宠物洗护小店，被装进手机里。**

四个调性关键词的落地翻译：

| 关键词 | 视觉翻译 |
| --- | --- |
| 温暖 | 全局米白暖底不用纯白；正文暖深棕不用纯黑；投影带棕/橘色温，不用中性灰 |
| 干净 | 大留白 + 发丝级暖色分隔线；卡片不套卡片，用间距和字重分层 |
| 可信赖 | 状态色克制（苔绿/陶红均降饱和）；价格、时间用等宽感数字纵向对齐；流程全程可视（六节点时间轴） |
| 柔软的精致感 | 16px 大圆角卡片 + 全圆角胶囊按钮；渐变只出现在 philia 主按钮一处；动效以「呼吸」为母题，克制、慢速、可预期 |

调性边界（不允许滑入的方向）：日式侘寂的「暖」是暖色温而非做旧肌理——不做纸张纹理、不做粗粝描边、不做高对比黑字海报风；也不做玻璃拟态、蓝紫渐变、荧光强调色。

## 2. 色板

### 2.1 锁定基础色（不可修改）

| Token | 色值 | 名称 | 用途 |
| --- | --- | --- | --- |
| `brand.primary` | `#D98E5F` | 暖杏橘 | 主按钮、active 态、philia 按钮渐变主色 |
| `brand.secondary` | `#F2C9A4` | 奶杏 | 渐变副色、标签底 |
| `bg.canvas` | `#FBF7F2` | 米白暖底 | 全局页面背景 |
| `bg.card` | `#FFFFFF` | 白 | 卡片 / 浮层底 |
| `text.primary` | `#3D3229` | 暖深棕 | 正文主色 |
| `text.secondary` | `#8A7A6B` | 暖灰棕 | 次级说明文字 |
| `success.base` | `#7FA87C` | 苔绿 | 成功 / 完成态 |
| `danger.base` | `#C96F5E` | 陶红 | 危险 / 错误态 |

### 2.2 衍生色（同温同饱、明度阶梯推导）

主色族（色相 23° 暖橘，与锁定主色同温）：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `brand.primaryHover` | `#D37D46` | 主按钮 hover（明度 −6） |
| `brand.primaryPressed` | `#C7692F` | 主按钮按下（明度 −13） |
| `brand.primaryLight` | `#F5E9E1` | 选中态浅底、轻强调区块 |
| `brand.secondaryLight` | `#F5E1CE` | 更浅的标签底 |
| `brand.secondaryDeep` | `#EEB47F` | 渐变 hover 副色端点 |

中性暖族：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `bg.sunken` | `#F8F0E6` | 输入区 / 凹陷分组底 |
| `text.placeholder` | `#BDB2A8` | 占位符 / 禁用文字 |
| `border.default` | `#EBE3DB` | 卡片描边、输入框边框 |
| `border.strong` | `#DDD0C6` | 锁定态描边 |
| `border.divider` | `#F0EBE5` | 列表发丝分隔线 |

状态衍生：

| Token | 色值 | 用途 |
| --- | --- | --- |
| `success.light` / `success.deep` | `#E8EFE8` / `#649160` | 成功徽章底 / 深底上的成功文字 |
| `danger.light` / `danger.deep` | `#F3E4E1` / `#B7503D` | 错误提示底 / 深底上的错误文字 |

### 2.3 渐变

| Token | 值 | 用途 |
| --- | --- | --- |
| `gradients.philia` | `linear-gradient(135deg, #D98E5F, #F2C9A4)` | philia 主按钮（唯一允许大面积渐变的元素） |
| `gradients.philiaHover` | `linear-gradient(135deg, #D37D46, #EEB47F)` | philia 按钮 hover |

**用色纪律**：渐变是品牌最高光资源，只给 philia 按钮和极个别品牌时刻（开屏、空状态插画）；普通主按钮用纯色 `brand.primary`。背景永远是 `#FBF7F2` 而不是白；正文永远是 `#3D3229` 而不是黑。

## 3. 字体

### 3.1 字族栈

- **全局**：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif`（纯系统栈，无外部字体 CDN，中文渲染有保证）
- **数字 / 价格**：`"Helvetica Neue", Helvetica, Arial, "PingFang SC", ...` + `font-variant-numeric: tabular-nums`（`numericStyle`），金额、倒计时、编号一律使用，纵向对齐
- **拉丁展示字体槽位**（`fontFamily.display`）：预留位，默认与全局栈一致；如未来引入授权拉丁展示字体，置于栈首，中文仍回落 PingFang / 雅黑

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
| `shadows.philia` | `0 6px 16px rgba(214,138,90,.35)` | philia 按钮（锁定） |

### 4.3 图标

- 风格：**1.5px 线性图标**（stroke=1.5，圆头 linecap/linejoin），不用面性填充图标、不用彩色方块底图标容器
- 默认色 `text.secondary`，active / 可点强调用 `brand.primary`；禁用用 `text.placeholder`
- 常用尺寸：列表内 20px、TabBar 24px、功能入口 28px；点击热区 ≥44px（员工端 ≥56px）
- 状态勾选用纯白色 ✓ 画在品牌色实心圆内；锁定用 1.5px 线性小锁

## 5. 动效规范

母题是「呼吸」：慢、轻、可预期，不用夸张弹跳和飞来飞去的转场。

| 场景 | 参数 |
| --- | --- |
| philia 按钮呼吸光环 | `animate-halo`：box-shadow 从 `0 0 0 0 rgba(217,142,95,.45)` 扩散到 `0 0 0 14px rgba(217,142,95,0)`，1.8s ease-out 无限循环（锁定） |
| Tab 按下反馈 | `scale(0.92)`，120ms（锁定），回弹用 `philia-spring` 缓动 |
| philia 页面转场 | 300ms ease-out（锁定，`duration-300 ease-philia-out`） |
| 常规颜色 / hover 过渡 | 160–200ms ease-out |
| 徽章弹出 | 200ms `philia-spring`，幅度克制 |

性能约束：光环动画只作用于 box-shadow/opacity/transform；同一时间屏内呼吸光环不超过 2 处（philia 按钮 + 时间轴 active 节点）。

## 6. 关键组件设计稿描述

### 6.1 ConvexTabBar（底部凸起导航）

- 结构：底部栏高 56px、白底（`bg.card`）、顶部 1px `border.divider` 发丝线、`z-tabbar`；5 个槽位，中间槽位留空给凸起按钮
- **SVG 凹口**：栏体背景由一条 SVG path 绘制，在中央下凹形成「怀抱」弧度接住圆形按钮——凹口宽约 76px、深约 14px，两侧用三次贝塞尔曲线平滑过渡回栏体直线边，曲率与按钮 64px 圆匹配，看起来像栏体被按钮轻轻压弯
- **凸起按钮（philia 按钮）**：直径 64px 正圆，中心与凹口圆心重合、上沿高出栏体约 28px；填充 `gradients.philia`，投影 `shadows.philia`，外圈常驻 `animate-halo` 呼吸光环；中央 28px 白色线性爪印图标
- 普通 tab：24px 线性图标 + 12px 标签；默认 `text.secondary`，active 时图标与标签同变 `brand.primary`（不加底色块）；按下 `scale(0.92)` / 120ms
- 进入 philia 页面：300ms ease-out 转场，按钮 icon 旋转 90° 过渡为关闭态

### 6.2 StepTimeline（服务进度六节点时间轴）

竖向主轴，用于「预约 → 服务 → 完成」全程可视，是「可信赖」的核心载体。

- 节点六态示例：已下单 → 已到店 → 洗护中 → 美容造型 → 待接回 → 已完成
- **done**：24px 实心品牌色圆（`brand.primary`）+ 白色 ✓（1.5px stroke）；节点标题 `text.primary`，右侧时间戳 12px `text.secondary`
- **active**：24px 品牌色圆点外罩 `animate-halo` 呼吸光环（与 philia 按钮同一母题），标题 600 字重 `brand.primary`，下方可展开一行当前操作说明（15px）
- **locked（未到）**：24px 圆仅 `border.strong` 1.5px 描边 + 中央 12px 线性小锁（`text.placeholder`）；标题 `text.placeholder`
- **连接线**：节点间 2px 竖线；done→done 段为 `brand.primary` 实线；active 之后未到达段为 `border.strong` 虚线（dash 4/4）
- 排版：节点行高 40px，轴线左偏 24px，内容区卡片化包裹（`radius.card` + `shadows.card`）

### 6.3 PhotoWall（服务照片墙）

- **九宫格缩略图**：3 列等宽网格，间距 4px，1:1 裁切，`radius.tag` 8px 圆角；最多 9 张，超过时第 9 张叠「+N」半透明暖棕蒙层（`rgba(61,50,41,.45)` + 白字）；点击进全屏查看器（黑底改为 90% 暖深棕底，保持色温）
- **before/after 并排双图**：洗护对比专用组件——两张 4:3 图并排（间距 8px），各带左上角标签：Before 用 `brand.secondaryLight` 底 + `text.primary`，After 用 `brand.primary` 底 + 白字；两图中央接缝处叠一个 24px 白圆 `→` 图标暗示变化方向；整组包裹在 `radius.card` 卡片内，下方 12px 时间戳 + 洗护师署名

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
- 改值纪律：token 两处（tokens.ts / preset）同名同值同步修改；锁定值改动需品牌评审
