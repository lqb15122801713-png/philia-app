# U1-B 设计基件 diff 摘要（commit dabdc29）

口径：tailwind-preset / tokens 只增不改既有值（diff 100 insertions / 0 deletions）。

## 新增 token 清单（命名沿用现有风格，需产品侧备案）

| 类别 | preset（@philia/config） | tokens.ts（@philia/shared） | 值 | 说明 |
|---|---|---|---|---|
| 圆角四档 | borderRadius.panel | radius.panel | 20px | 卡（大卡/面板） |
| | borderRadius.control | radius.control | 14px | 控件 |
| | borderRadius.chip | radius.chip | 6px | 小签 |
| | （full 既有） | （full 既有） | 9999px | 全圆档沿用 |
| 细线 ring | colors.line.ring | colors.border.ring | rgba(74,59,46,.09) | 1px 暖墨细线（深度策略） |
| 近零软影 | boxShadow.hairline | shadows.hairline | 0 1px 2px rgba(61,50,41,.04) | 与细线 ring 配套 |
| 字阶补档 | fontSize.caption-xs | fontSize.captionXs | 11/15 | 字阶 11（12/17/20 既有档覆盖） |
| | fontSize.body-sm | fontSize.bodySm | 14/20 | 字阶 14（15 既有档保留供旧件） |
| | fontSize.detail | fontSize.detail | 28/36/600 | 详情页大字一档 |
| | fontSize.detail-lg | fontSize.detailLg | 32/40/600 | 详情页大字二档 |
| 衬线展示位 | fontFamily.serif-cn | fontFamily.serifCn | "Noto Serif SC","Songti SC",serif | woff2 产品侧随后入库，缺失静默回退 |
| cssVars | — | --radius-panel/--radius-control/--radius-chip/--border-ring/--shadow-hairline | 同上 | 运行时映射 |

## 基础类（apps/customer/src/index.css @layer components，全新增）
- .u1-ring = shadow-hairline + ring-1 ring-line-ring（深度策略组合）
- .u1-card = .u1-ring + rounded-panel + bg-card
- .u1-control = rounded-control
- .u1-chip = rounded-chip
- .u1-num = font-number + tabular-nums（数字 Montserrat 等宽核对：字族既有，本类固化 numeric 用法）
- .u1-serif = font-serif-cn（中文展示位衬线链）

## 字体
- index.css 新增 Noto Serif SC 400/700 @font-face 占位（/fonts/noto-serif-sc-chinese-simplified-*.woff2），
  文件未入库前静默 404 回退 Songti SC/serif，smoke 红线对 woff2 豁免（scripts/smoke-routes.mjs:197-203）。

## 验收输出
- diff 只增不改：`git diff --stat` = 3 files / +100 / -0（既有值零改动）
- grep #FFAAA5（改动域新增行）= 0；text-white（改动域新增行）= 0
- 越档圆角抽查：新增行全部 px 值 ∈ {6,11,14,15,20,28,32,36,40}（圆角仅 6/14/20 + 既有 full；其余为字号/行高），22px/18px/24px 圆角 = 0
- customer build（tsc -b && vite build）exit=0（build-u1b.log）
