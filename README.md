# 菲丽亚宠物 Philia

宠物服务平台三端 PWA Monorepo（npm workspaces）。

## 目录结构

```
philia/
├── apps/
│   ├── customer/     # 客户端 PWA（宠物主人），dev 端口 7100
│   ├── merchant/     # 商家端 PWA（门店管理，平板横屏优先），dev 端口 7101
│   └── staff/        # 员工端 PWA（服务执行，手机竖屏单手优先），dev 端口 7102
├── packages/
│   ├── shared/       # @philia/shared — 三端共享（tokens / 组件 / 类型）
│   └── config/       # @philia/config — 共享配置（tsconfig.base / Tailwind preset）
├── server/           # 后端占位（P1 阶段：Hono + tRPC + Drizzle + MySQL）
└── assets/           # 设计/静态资产占位
```

## 技术栈

React 18 · Vite · TypeScript · Tailwind CSS 3.4 · shadcn/ui · React Router v6 · vite-plugin-pwa

## 启动

```bash
npm install                 # 根目录一次安装（workspaces 提升）

npm run dev:customer        # 客户端  http://localhost:7100
npm run dev:merchant        # 商家端  http://localhost:7101
npm run dev:staff           # 员工端  http://localhost:7102
```

## 验收固定清单（每批七步复核必查）

1. 三端 build exit 0 + server typecheck exit 0；
2. smoke-routes 全绿（`node scripts/smoke-routes.mjs`）；
3. smoke-deploy 全绿（`node scripts/smoke-deploy.mjs`）；
4. 禁令 grep=0（珊瑚粉 #FFAAA5 / text-white / 渐变，diff + 行口径）；
5. **导航闭环**（批次 W1 起制度化）：每页有出口、无死胡同、交易成功页双出口、选择器整行可点——常备 harness：`node scripts/check-nav-closure.mjs`（51 路由体检）+ `node scripts/e2e-nav-check.mjs`（真机实证）。

## 构建

```bash
npm run build               # 构建全部三端
npm run build:customer      # 仅构建某一端
```
