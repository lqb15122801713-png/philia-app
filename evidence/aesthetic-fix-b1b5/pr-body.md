# PD-27／CJ-1016-01 · 拟人审美修调 B1–B5

已用 K3 MAX。

## 范围

- D-56：PHILIA「读本期」改为进入 `/philia/magazine/lead` 本期正文。
- D-57：两张杂志次卡分别进入 `02`／`03` 对应篇；未知 slug 有说明与返回出口。
- D-58：洗护师 snap 横轨在数据到位后、绘制前归零；首屏真实员工卡不再负 X，人员顺序与派单逻辑不变。
- D-59（含 O6）：确认栏改为不透明 `canvas` 衬底；时段区增加 fixed 确认栏滚动对齐安全边距。
- D-60：指定基线在 390×844 的初始屏、微滚与聚焦路径均未复现遮挡，未增加无效生产样式；两条路径均以五格完整／无遮／可点 5/5 留证，差异已报产品侧。

未扩其他 O 项，未改杂志 IA、派单规则、订单状态机；零新依赖、零迁移；未触真实支付／真实退款通道。

## 路由申报

新增 `/philia/magazine/:articleId`，已同步 `scripts/check-nav-closure.mjs` 与 `scripts/smoke-routes.mjs`。

## 验证

- PD-27 专项（生产 preview）：9/9；含逐篇唯一标题／正文、未知 slug、scrollLeft、O6 几何与热区、D-60 双路径。
- copy 动态覆盖：先红后绿；模块加载后写入 override 可读到新标题与正文。
- 三端 `npm run build`：exit 0。
- server `npm run typecheck`：exit 0。
- `smoke-routes`：119/119。
- 导航闭环：127 路由，死胡同 0，弱 0。
- `e2e-nav-check`：全部通过。
- `smoke-deploy`：本地 Mock 全部通过。
- 本批生产源码 ESLint：exit 0；diff 红线扫描无命中。

卷宗：`evidence/aesthetic-fix-b1b5/README.md` 与 `final-*.png`、`before-*.png`、`gates/*`。

## 既存问题与口径说明

- 客户端全量 lint 有 78 个未触文件既存问题；未扩批清理。新增 `.mts` copy 脚本被当前 ESLint 配置忽略，未声称其受 lint 检查。
- server 全链路 e2e 有 6 条未触服务端既存断言漂移（copy 数量、slot 数量、dockMe 文案）；未改这些断言，详见卷宗。
- D-60 当前基线未复现，未伪造修复 diff；如产品侧有不同设备／数据／布局复现参数，需另行核对。

PR 只开不合；A 窗未合并未部署。施工方自报结果不替代产品侧后续八步与 Argus／林晓窄回归。
