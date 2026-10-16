# PD-27.1／CJ-1016-02 · D-60 续修

已用 K3 MAX。

## 范围

只销 D-60，未动 D-56～D-59，未扩其他 O 项；零新依赖、零迁移、零订单状态机改动，未触真实支付／真实退款通道。

## 修调

- 客户页与商家默认编辑稿共用 `ME_PAGE_DEFAULT_ORDER`：`me.orderrow` 前移到 `me.entries` 前；published／draft 显式顺序仍优先，其他 pageKey 不受影响。
- 退款售后接既有 `/refunds`；“全部订单”改落 `/appointments?tab=all`，并新增不重复计数／不重复渲染的 all 真筛选。
- 删除失效 slot CSS 与过时注释；`appointments.tabAll` 明确为零迁移静态 fallback。

## 验证

- 基线：主专项 4/7；390×700 五格全被遮、退款无链、全部只进 history；商家默认稿 0/1。
- 最终主专项 7/7：390×844 与 390×700 零滚五格完整、被遮 0、中心可命中；五入口均坐标点击并到达正确页面；目标签激活；all 的接口与渲染 ID 集合一致、无重复。
- 商家画布 3/3：默认稿顺序正确；实际保存并发布后 `liveLayout` 顺序正确；发布后 390×700 零滚仍无遮。默认稿检查带 `editing === null` 防污染断言，测试布局已清理。
- 三端 build、server typecheck：exit 0。
- `smoke-routes`：119/119；导航闭环：127 路由零死胡同；`e2e-nav-check` 全绿；`smoke-deploy` 本地 Mock 全绿。
- 商家 CanvasPortBody、AppointmentsPage／copy lint：exit 0。
- `MePage.tsx` 全文件 lint 仍只有续费倒计时处既有 `Date.now()` 纯度错误，不在本批 diff，未扩改。

卷宗：`evidence/aesthetic-fix-d60/README.md` 与前后截图、结果 JSON、闸门日志。

PR 只开不合；A 窗未合并未部署。施工方自报结果不替代产品侧后续八步与 Argus／林晓窄回归。
