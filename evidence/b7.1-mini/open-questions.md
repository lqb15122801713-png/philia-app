# 批次 7.1 存疑清单（报产品侧裁定）

## Q1. TabBar 简化方案（任务书任务 A 第 3 条点名）

**现状差异**：PWA 客户端为五栏凸起结构「首页 / 商城 / [philia 中央凸起按钮 φ64px] /
预约 / 我的」（docs/DESIGN.md §6.1，凸起按钮带呼吸光环、长按弹层一键复购、有进行中
预约直达 live）。小程序自定义 tabBar 无法承载原生凸起按钮（原生 tabBar 不支持
凸起；自定义 tabBar 组件可实现但审核与体验口径需产品侧确认）。

**本批实现（占位）**：原生 tabBar 标准 4 栏「首页 / 预约 / 商城 / 我的」，
selectedColor 取 VI token brand-primary-pressed #E8AD02（未自创色值）。

**请裁定（三选一或另行指定）**：
1. 维持标准 4 栏（本批占位，最稳、零审核风险）；philia 快捷入口改为首页悬浮按钮；
2. 自定义 tabBar 组件还原五栏凸起（需额外设计与审核口径评估，且 SSE 光环逻辑迁移）；
3. 标准 5 栏（首页/商城/Philia/预约/我的，Philia 为普通中间栏）。

## Q2. 小程序字体口径（任务书「明确不做」第 3 条点名）

**现状差异**：VI v1.1 规定拉丁展示字体 Montserrat（标题/数字）与 Poppins（正文），
PWA 端自托管 woff2；小程序端不可自托管 woff2 字体文件（wx.loadFontFace 仅支持
网络字体 URL，且包体积/审核不友好），中文 Noto Sans SC 走系统字无碍。

**本批实现（占位）**：font-display / font-number 类保留 token 类名但字体栈在小程序
端自然落到系统字体（中文 PingFang/系统黑体，拉丁系统默认），未引入任何网络字体。

**请裁定**：
1. 接受系统字体降级（本批占位，VI 色板/字号/字重不变，仅字族降级）；
2. 走 CDN 网络字体（wx.loadFontFace，需评估加载耗时、备案域名与审核口径）；
3. 数字/价格等关键位置用图片或组件级绘制替代（成本最高）。

## Q3.（工程侧自报）weapp-tailwindcss 版本选型

npm latest 为 5.5.3，但其 Taro 管线会把 tailwind 处理切到其依赖树内嵌的
tailwindcss v4.3.3，导致仓库冻结的 v3 preset（packages/config/tailwind-preset.js）
完全不生效（产物只剩 v4 banner、VI 工具类缺失，对照实验见 a-build-h5.log 排查过程）。
选用 v4 线最新 4.12.0（UnifiedWebpackPluginV5 + tailwindcss 3.4.19，与三端同大版本）。
白名单内选型，已实证双产物 VI 类与色值在案；若后续官方修复 v5 对 v3 preset 的兼容，
可再评估升级。

## Q4.（工程侧自报）小程序端 API base 与静态资产源

src/lib/config.ts 内测期硬编码 `http://localhost:7200`（商品图等 /products/*.svg 走
批次 6 静态托管同源分发）。正式上线时的域名/同域口径需随批次 8 上线计划一并裁定
（小程序 request 合法域名需备案配置）。
