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

## 构建

```bash
npm run build               # 构建全部三端
npm run build:customer      # 仅构建某一端
```
