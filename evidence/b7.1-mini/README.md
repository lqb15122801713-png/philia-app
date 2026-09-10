# 批次 7.1 证据卷宗说明（evidence/b7.1-mini/，不入库）

## 前置验证项

- **前置项 1（e2e 断言复核）**：`pre-e2e-baseline-fail.log` —— main@1d6bcbc 全量 e2e
  唯一失败 `event_outbox 事件齐全（共 17 条 / 期望 15 条）`，实测分布
  checkedin:2 / completed:2，差集恰为 B2-8（批次 2 已验收合并）为 checkedin/completed
  增发的 store 频道各 1 条。e2e.ts 断言最后修改于 P1 时代 f82e4af，从未同步
  → **过时断言，非真实回归**（与主 agent 前置验证项 1 结论一致）。
  修复：checkedin 1→2、completed 1→2、总数 15→17（注释注明 B2-8 双频道口径）。
  `pre-e2e-fixed-green.log` —— 修复后全绿（exit=0，全链路验收全部通过 ✅）。
- **前置项 2（postinstall / 全新 clone）**：根 package.json 加 postinstall
  （scripts/postinstall.mjs，Docker 清单层 server/package.json 不在场时跳过）。
  全新目录 clone 该分支实测：`pre-fresh-clone.log`（clone+checkout）、
  `pre-fresh-clone-install.log`（npm install exit=0，postinstall 自动装 server 依赖）、
  `pre-fresh-clone-build.log`（npm run build exit=0）、
  `pre-fresh-clone-e2e.log`（test:e2e 39 项 ✓ 全绿 exit=0）。

## 任务 A（Taro 工程骨架）

- `a-mini-install.log` —— 白名单内依赖安装（Taro 4.2.1 / React 18 /
  @nutui/nutui-react-taro 3.0.20 / weapp-tailwindcss 4.12.0 / tailwindcss 3.4.19）。
- `a-build-weapp.log` / `a-build-h5.log` —— 双产物构建 exit=0；产物实证 VI 色值
  .bg-canvas=rgb(246,241,227)(=#F6F1E3) / #FDC830 / #7FD8BE 双端在案。
- `a-h5-home-skeleton.png` —— 首页骨架 H5 渲染截图（VI 渐变/底色/卡片/4 栏 TabBar）。
- 版本选型说明：weapp-tailwindcss 最新 5.5.3 会把管线切到其内嵌 tailwind v4.3.3，
  v3 preset 失效 → 降 v4 线（对照实验：摘插件后 VI 类正常生成）。见 open-questions.md Q3。

## 任务 B（微信登录链路）

- `b-smoke-1-first-login.txt` —— mock 旁路首登：HTTP 200 + Set-Cookie philia_session，
  `{"ok":true,"created":true,"user":{...,"roles":["customer"]}}`（建用户 + customer 角色）。
- `b-smoke-2-second-login.txt` —— 二次登录：`created:false`，同人同 id
  （01M25F0FZ6ENVDF5T5QR3YR94Y）。
- `b-smoke-3-auth-me.txt` —— cookie 过 auth.me：返回同 id 用户 + wxOpenid + roles。
- `b-smoke-4-production-refuse.txt` —— NODE_ENV=production + WECHAT_MINI_MOCK_OPENID
  → 拒启动 exit=1，错误清单首条即「WECHAT_MINI_MOCK_OPENID（已设置）…production 下该
  变量存在即拒绝启动」。

## 任务 C（只读浏览四页 · 真实数据）

- `c-h5-shots.mjs` —— 截图驱动脚本（临时脚本按纪律存证据目录）。
- `c-h5-1-home.png` —— 首页：附近好店（菲丽亚宠物·示例店）+ 推荐服务横滑
  （基础洗护小型犬 ¥88.00 等，tRPC store.listNearby / getWithServices 真实种子数据）。
- `c-h5-2-store.png` —— 门店详情 + 服务项列表（7 项真实服务含价格/时长，
  未来 7 天可约 131 时段只读展示）。
- `c-h5-3-mall.png` —— 商城双列卡真实商品（全价成犬粮 ¥129.00 等 8 件 + 店名映射）。
- `c-h5-4-product.png` —— 商品详情（图/名/价/描述/库存/店名，购买按钮 disabled 7.3）。
- 真数据说明：H5 预览（7103）经 dev-login（H5 降级链路实证，输出见截图驱动日志）
  带 cookie 调 tRPC HTTP batch；商品图经批次 6 静态托管（SERVE_STATIC=1）同源分发 200。
- `c-build-weapp-final.log` —— weapp 终态构建 exit=0。
- `c-weapp-dist-structure.txt` —— **诚实缺口**：本机未安装微信开发者工具，weapp 导入
  截图无法提供；以 weapp 构建产物目录结构（7 页全部编译在案）+ H5 四页截图对照替代，
  未装任何软件。

## 回归与存疑

- `exit-codes.txt` —— 六项全绿：server typecheck / appointment.smoke / test:e2e(40✓) /
  三端根 build / build:weapp / build:h5 全 exit=0。
- `open-questions.md` —— 存疑清单：Q1 TabBar 简化方案、Q2 小程序字体口径、
  Q3 weapp-tailwindcss 选型自报、Q4 API base 口径自报。
