# Philia 客户端小程序（apps/customer-mini · 批次 7.1）

Taro 4.x + React 18 + TypeScript + NutUI（@nutui/nutui-react-taro）+ weapp-tailwindcss，
一份源码出双产物：微信小程序（`weapp`）+ H5（`h5`）。

## 依赖管理（与 server 同模式）

本端**不在根 npm workspaces 内**（根 package.json workspaces 以 `!apps/customer-mini`
排除）：Taro 依赖树重，独立 lock（本目录 package-lock.json 入库）避免卷入根 install
与 Docker fe-builder 的 `npm ci`。装依赖：

```bash
cd apps/customer-mini && npm install
```

## 构建

```bash
npm run build:weapp   # 微信小程序产物 → dist/（微信开发者工具导入本目录即可）
npm run build:h5      # H5 产物 → dist/
npm run dev:h5        # H5 预览（端口 7103，避开三端 7100-7102 / server 7200）
```

## VI 口径

Tailwind preset 相对路径引 `packages/config/tailwind-preset.js`（VI v1.1 冻结版），
色值零改动、零自创；TabBar / navigationBar 色值均取自同一 token 表。
