PD-30／CJ-1017-02 · 拟人验证修调 Obs4｜Obs6

- 基线：main@`1430ee7f`（`1430ee7fd97523be62ad00fe969bbb3b98a4f2a0`）
- 分支：`feat/aesthetic-fix-obs46`
- 模型：已用 K3 MAX
- PR 只开不合；A 窗不部署

## 范围

只销 Obs4｜Obs6。Obs1＝O7／Obs2＝O8／Obs3＝O10／Obs5 不施工；N1｜N2／PD-28 九项／D-56～60／O6 不扩业务；零新依赖、零迁移；未触外部真实支付或退款通道。

## 修调

- Obs4：寄养单屏接入与洗护同族 `booking-with-dock`／AppDock，预约项激活；ConfirmBar 上移 78px，并按 dock 后视口重算 N2 避让。仅寄养单屏局部抑制 PWA InstallBanner，避免确认按钮热区冲突。
- 房型价格只保留一个 DOM 节点：默认在照片胶囊，极短疫苗态移到底条；不扩寄养业务字段。
- Obs6：消息 chip 改为 flex-wrap，窄屏自然换行；消息筛选、查询、已读、删除和跳转语义不变。
- 新增 Obs4／Obs6 真实浏览器专项；PD-29 回归脚本按新现实要求 dock 存在，并新增价格节点与 ConfirmBar/dock 断言。

## 证据

卷宗：`evidence/aesthetic-fix-obs46`

- 基线 0/3：寄养两种视口无 dock；活动 chip 右缘 428px 超出 390px 视口。
- 最终 4/4：Obs4 844／700 dock 与关键操作无遮挡，iOS 安装条不遮确认按钮；Obs6 六 chip 完整且真实点击。
- PD-29 N1／N2 边界回归 17/17：含初始与疫苗多断点，间隙至少 8px，价格均为单一可见 DOM 节点。
- 三端 build、server typecheck、修改组件 ESLint：exit 0。
- `smoke-routes` 119/119；导航闭环 127 路由零死胡同；`e2e-nav-check` 与本地 Mock `smoke-deploy` 全部通过。
- PD-27 9/9、PD-27.1 7/7、PD-28 主专项 10/10、状态矩阵 8/8。
- 独立评审发现的 PWA 与价格 DOM 两项 Important 均已销项，复核可开 PR（仅开不合）。

详细量尺、前后截图、所有闸门日志及辅助脚本环境记录均在卷宗内。施工方自报全绿不替代产品侧后续复核。
