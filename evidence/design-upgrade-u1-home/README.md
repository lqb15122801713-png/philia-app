# PD-39 / CJ-1018-05 · U1 首页 IA ± U0 客浅浮岛卷宗

- 分支：`feat/design-upgrade-u1-home-ia`
- 基线：`main@08f0e36bdfd566be78fe7e7f5656a429550fccf2`
- 权威对照：figma bro 定稿＋Ready／Figma `ot5SBoqhKAw2UIZRVFzhel`；`170:38`／`170:184`／ClientTabBar／VI `193:2`
- 施工窗口：全端升档-U1-首页IA
- 模型：K3 MAX

## 本片销项

- A：客户端首页 IA 与客底栏。
- B1–B6：三主四次、精选横滑、限时活动宫格、守护故事、Banner 季主题＋立即预约＋门店 chip、服务中首屏进度卡。
- C1–C2：会员码一键；券包／团购／门店四次入口。团购接到诚实「团购活动待上线」落点，不伪造商品或活动。
- D2：首页固定骨架＋浅浮岛五栏；双栏白卡、注册用户厚卡、陪伴／毛孩子主轴、深棕底＋中心黄爪 FAB 均退出首页与底栏。

## 关键裁决留痕

- 首页 IA 按本片冻结，不让旧 published 画布布局把双栏主轴带回；新区块不再挂旧 `data-block-key`。
- Banner／精选／守护摄影未定稿，按令使用浅色「待换」，不以错犬种照片或爪印冒充。
- 活动三格按 Figma 定稿默认稿展示，仅做入口跳转；不领取、不抽奖、不触交易。
- 团购无既有业务页，本片只给诚实待上线页和返回商城出口，后续业务页另册。

## 验证记录

| 项 | 命令／方式 | 结果 |
|---|---|---|
| TDD 红 | `EVIDENCE_PREFIX=red node scripts/pd39-home-ia-check.mjs` | 初版 0/10，红因旧 IA／深底爪钮／缺模块 |
| 中间回归 | review1–review4 | 分别抓到旧端口文案、Banner 待换重叠、团购假落点、团购返回卡死 |
| PD-39 CDP | `EVIDENCE_PREFIX=final6 node scripts/pd39-home-ia-check.mjs` | 14/14 |
| 客户端构建 | `npm run build:customer` | exit 0 |
| 三端构建 | `npm run build` | exit 0 |
| Server 类型 | `npm --prefix server run typecheck` | exit 0 |
| 本片文件 lint | `npx eslint src/pages/HomePage.tsx src/pages/MallPage.tsx src/components/AppDock.tsx src/copy/home.ts src/copy/mall.ts` | 0 问题 |
| 路由渲染 | `node scripts/smoke-routes.mjs` | 119/119 |
| 导航闭环 | `node scripts/check-nav-closure.mjs` | 127 路由；死胡同 0；弱 0；豁免 6 |
| 禁色／旧值 | 检索 `#5C4330/#6B5238/#C4A574/#FAF8F4/text-white` | 本片修改文件 0 命中 |
| diff 卫生 | `git diff --check` | 0 问题 |

## 未运行的固定脚本与原因

- `scripts/smoke-deploy.mjs` 会真实下单、核销、收银、退款、储值与开会员，触本片禁令，未运行。
- `scripts/e2e-nav-check.mjs` 会真实建单／取消单，触本片禁令，未运行；仅同步其底栏断言名称。
- 全仓 lint 仍有 72 个基线错误，均不在本片修改文件；本片文件定向 lint 为 0。

## 主要证图／结果文件

- `red-idle.png`、`red-service.png`：旧 IA 红证据。
- `final6-idle.png`：空闲首页，390×844 移动视口长图。
- `final6-service.png`：服务中首页，390×844 移动视口长图。
- `final6-results.json`：PD-39 14 项结构、入口、字号、浅浮岛、五栏实点、双态骨架结果。
- `smoke-routes-results-final.json`：119 条路由渲染结果。
- `nav-closure-results.json`：127 条导航闭环结果。

## 另册待办（非本片塞项）

- Banner／精选／守护真图批次到位后恢复真实摄影与槽位接线。
- `HomeBookingPanel`／`InServicePanel` 孤儿组件、旧首页 copy 键清理。
- `.hv2-sub` 沿用 VI 次阶色，对比度是否登记 VI 特例，留待 VI 对账。
