# scripts/ 闸门与环境口径 README（修复包 PR-3 C1 · Y12 口径：不动 package.json，命令表落本文件）

> 用途：批次验收固定闸门的**唯一命令表**与环境口径合集。新窗口跑闸门前先读本文件——
> 判红先核环境口径，勿把环境件当回归缺陷上报。

## 一、闸门命令表（仓库根目录执行）

| 闸门 | 命令 | 说明 |
|---|---|---|
| 三端 build | `npm run build` | **只许此一条**（tsc -b 内嵌类型检查；customer → merchant → staff 串行） |
| server typecheck | `cd server && npm run typecheck` | server 非 npm workspace，须进 server/ 直跑（`tsc --noEmit`） |
| server e2e | `cd server && npm run test:e2e` | 临时库隔离全链路；跑前**核 7200 无残留监听**（脚本自检，占用即拒跑） |
| 路由级渲染冒烟 | `node scripts/smoke-routes.mjs` | 需三端 dev/preview（7100/7101/7102）+ server（7200）+ Edge/Chrome CDP；F1 口径见 §二.1 |
| 部署后自检冒烟 | `node scripts/smoke-deploy.mjs` | 需 server（7200，默认）；三端 URL 默认同 BASE，本地须显式传 `CUSTOMER_URL/MERCHANT_URL/STAFF_URL`；尾部自带收尾段（§二.2） |
| 导航闭环 | `node scripts/check-nav-closure.mjs` | 0 死胡同；Node ≥22（20/21 加 `--experimental-websocket`）；新路由须双表申报（本脚本路由表 + smoke-routes 锚点表） |
| 客户端评价 e2e | `node apps/customer/scripts/review-e2e.mjs` | 需 server(7200)+customer dev(7100)；夹具自足（寄养造单→核销→退房）；`SHOT_DIR` 必须预先存在 |
| 导航 e2e | `node scripts/e2e-nav-check.mjs` | 交互链路导航抽查（含「造单后取消」写法样例） |
| 商品占位图生成 | `node scripts/gen-product-placeholders.mjs` | 生成三端 `public/products/staple-*.svg` 占位素材 |

## 二、环境口径（判红前必读）

1. **F1（D-2 登记）**：smoke-routes 默认 `SMOKE_APPT_ID`=规范环境历史演示单 ULID，本地种子不造预约——fresh seed 库上员工端 `/execute/:id` **两条红=环境件非缺陷**。消红：先跑 smoke-deploy 造单，把单号传 `SMOKE_APPT_ID`；或接受该两条红为已知环境口径。
2. **冒烟残留（C2 已根治+收尾段）**：寄养退房历史不释放槽（PR-3 起 `boarding.checkout` 同事务释放退房日及之后剩余晚，提前接回=房间可再订）；smoke-deploy 尾部收尾段对本次运行新增 held 单逐个 `cashier.voidBill` 并断言「held 数 跑前=跑后」。**现库历史 held 单=保留标测试件不删（CJ-0926-03）**，note 标注「测试件勿动」，日结合计天然不含 held（防回归断言在收尾段+e2e）。
3. **端口纪律**：跑闸门前核 7100/7101/7102/7200 无残留进程占用——占用先看页面 `<title>` 是不是本仓应用（曾被「UX 预览台」类残留抢占致 smoke 假红）；e2e 前核 7200。
4. **dev 账号**：`dev-seed-users` 动态取数（口令门启用时带 `BETA_GATE_CODE`）；生产/类生产环境跑 smoke-deploy 前确认口令门口径（无码 401/错码 403/对码 200）。
5. **Node 版本**：≥20（check-nav-closure 建议 ≥22）；本机 Node 不在 PATH 时用 `tools/node`。
6. **smoke-deploy 目标环境变量名=`PUBLIC_BASE_URL`**（非 BASE；BASE 是 review-e2e 的口径，两脚本不同名——片 C 消缺报备②）：并行窗占用 7200 时 smoke-deploy 用 `PUBLIC_BASE_URL=http://localhost:<port>` 避让，e2e 用 `E2E_PORT` 避让（e2e.ts:207 既有）；三端页连非 7200 后端时构建须带 `VITE_API_BASE`（import.meta 构建期烧死，preview 不重读）。

## 三、新路由申报（check-nav-closure 纪律）

新页面路由=双表申报：`check-nav-closure.mjs` 路由表 + `smoke-routes.mjs` 锚点表；新 tRPC 过程不涉及路由表，但涉钱/权限的过程须在施工令登记。
