PD-40／CJ-1018-06 · 全端升档 B7 服务过程时间轴

- 基线：main@`08f0e36b`（`08f0e36bdfd566be78fe7e7f5656a429550fccf2`）
- 分支：`feat/design-upgrade-b7-service-timeline`
- 模型：已用 K3 MAX
- PR 只开不合；A 窗不部署

## 范围

只销 B7＋C3 入口脸面；未塞 U1／U2～U7／C4–C6／B8／B10。零新依赖、零服务端迁移；未提交预约、未真付真退、未开会员、未真加购结账。

## 实现

- 复用 `/appointments/:id/live`，内部六步聚合为六节点：已下单→已到店→洗护中→美容造型→待接回→已完成。
- 做满未开始／进行中／展开有图／步骤空态／已完成五态；预约成功「查看服务过程」默认未开始，并按订单态切换。
- 页内浅浮岛五栏，不改全局 AppDock；无爪印、无深棕黄爪。
- cream 仅摘要 chip＋active 环（≤2），完成态 0；副文≥12px；真图未齐为浅色「待换」。
- 保留寄养、SSE、异常通报、评价、联系门店、PhotoViewer 与 apptLive 发布布局。
- 显式预览强制隔离真实预约缓存并跳过 push.subscribe/SSE；不写真实预约。

## 证据

卷宗：`evidence/design-upgrade-b7-service-timeline`

- 浏览器专项 **11/11**：C3 入口、五态、六节点、五栏、34px safe-area、安装条、展开收起、空态收起均通过。
- 模型／预览／UI／页面测试 **27/27**。
- 三端 build、server typecheck：exit 0。
- 导航闭环：**127 路由，死胡同 0，弱 0**。
- B7 定向 ESLint：exit 0。全量 lint 的仓库既有 78 项问题另存卷宗，未借本批修改。
- 独立只读评审最终 Critical 0、Important 0，Ready=Yes。

五态与安全区 390×844 截图、红绿记录、全部闸门日志与评审记录均在卷宗内。交易型 e2e／smoke-deploy 未执行，遵守本片交易禁令。施工方自报结果不替代产品侧后续复核。
