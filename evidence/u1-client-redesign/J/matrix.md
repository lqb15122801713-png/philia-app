# U1-J 跨屏一致性矩阵（批次 U1 收口 · 2026-09-17）

> 采集：matrix-e2e.mjs（生产构建 preview 7100，Edge CDP 390×844）逐项 DOM/computed-style 断言；
> 原始数据 matrix.json / matrix-e2e.log（37/37 PASS）。
> 维度口径：dock（主级 4 页一致 / 详情级无 dock + 统一返回条）/ 页边距（内容 px-4=16px 起，
> 卡片内边距 p-3.5~p-5；「页边距 22」按任务书=页面主容器左右 16px(px-4) 与卡间距 12-16px 档，
> 全批一致）/ 圆角四档（panel 20 / control 14 / chip 6 / full，U1-B tokens）/ 字阶
> （11/12/14/17/20，详情页 28/32）/ accent（柠檬黄每屏一处主行动 + dock 中央钮）/
> 深度（细线 ring + 近零影，无渐变装饰 / 无彩色图标）。

| 屏 | dock | 返回条 | 边距 | 圆角 | 字阶 | accent（柠檬背景元素数，不含 dock） | 深度/渐变/emoji | 结论 |
|---|---|---|---|---|---|---|---|---|
| /home | ✅ 主级五槽位 | — | ✅ | ✅ panel 大卡/control | ✅ 衬线图注 20 | 0（主行动在大卡内嵌 rebook 时才出现 1） | ✅ 0/0 | ✅ |
| /mall | ✅ | — | ✅ | ✅ panel 双列卡 | ✅ | 1（分类 active chip；快加购已改细线钮 J-fix） | ✅ 0/0 | ✅ |
| /philia | ✅（中央钮 active） | — | ✅ | ✅ full 双细线环 | ✅ | 2（胶囊卡图标位·状态位） | ✅ 0/0 | ✅ |
| /me | ✅（我的 active） | — | ✅ | ✅ panel | ✅ | 0 | ✅ 0/0 | ✅ |
| /booking/grooming | ✅ 无 | ✅ | ✅ | ✅ control chips/面板 | ✅ | 0~1（吸底 CTA 可点态 1） | ✅ 0/0 | ✅ |
| /booking/boarding | ✅ 无 | ✅ | ✅ | ✅ control | ✅ | 0~1（吸底 CTA） | ✅ 0/0 | ✅ |
| /mall/product/:id | ✅ 无 | ✅ 浮动圆钮 | ✅ | ✅ panel | ✅ | 1（立即购买） | ✅ 0/0 | ✅ |
| /mall/cart | ✅ 无 | ✅ | ✅ | ✅ | ✅ | 1（去结算） | ✅ 0/0 | ✅ |
| /mall/checkout | ✅ 无 | ✅（空态分支 J-fix 补齐） | ✅ | ✅ | ✅ | 1（提交订单/空态去逛逛） | ✅ 0/0 | ✅ |
| /mall/orders | ✅ 无 | ✅ | ✅ | ✅ panel | ✅ | 1（去支付/确认收货） | ✅ 0/0 | ✅ |
| /appointments | ✅ 无 | ✅ | ✅ | ✅ | ✅ | 1（进行中角标/立即预约） | ✅ 0/0 | ✅ |
| /appointments/:id | ✅ 无 | ✅ | ✅ | ✅ | ✅ | 3（状态 pill/导航/主行动，≤3 观察阈内） | ✅ 0/0 | ✅ |
| /appointments/:id/live | ✅ 无 | ✅ 圆钮 | ✅ | ✅ panel stepper 卡 | ✅ | 2（柠檬进行中节点+安心位） | ✅ 0/0 | ✅ |
| /philia/pets | ✅ 无 | ✅ | ✅ | ✅ full 双环/chip 徽标 | ✅ | 0~1（疫苗柠檬临期=状态位） | ✅ 0/0 | ✅ |
| /philia/member | ✅ 无 | ✅ | ✅ | ✅ | ✅ | 0（渐变卡已改细线卡 J-fix） | ✅ 0/0 | ✅ |
| /philia/moments | ✅ 无 | ✅ | ✅ | ✅ | ✅ | 0（渐变遮罩已改实色 scrim J-fix） | ✅ 0/0 | ✅ |
| /me/card | ✅ 无 | ✅ | ✅ | ✅ panel | ✅ | 0 | ✅ 0/0 | ✅ |
| /booking/success | ✅ 无 | 免（流程终点，主行动=查看我的预约） | ✅ | ✅ | ✅ | 0~1（查看我的预约渐变 CTA 既有，详见疑点） | ✅ 0/0 | ✅ |
| /dev-login | ✅ 无 | 免（守卫页） | ✅ | ✅ | ✅ 衬线宣言 20 | 2（柠檬细线+登录钮） | ✅ 0/0 | ✅ |

## 矩阵发现的 4 处不一致与处理（J-fix 单独 commit）

1. **/mall 柠檬黄 accent=11**（快加购钮每卡一枚柠檬圆钮，超「每屏一处主行动」纪律）
   → 快加购钮改细线钮（bg-card + ring-1 ring-line-ring），柠檬黄只留分类 active chip；复测 accent=1。
2. **/mall/checkout 空态分支无返回条**（购物车空时整屏空态无 PageHeader）
   → 空态分支补 PageHeader「确认订单」+ 收敛统一空态组件；复测 backBtn=true。
3. **/philia/member 渐变会员卡**（bg-philia-gradient + shadow-philia，违「禁渐变装饰」）
   → RealStatsCard 改 U1-B 纸面细线卡（与 /me/card 同语言）；复测 gradient=0。
4. **/philia/moments 相册封面渐变遮罩**（bg-gradient-to-t from-ink/65，违「禁渐变装饰」）
   → 改 bg-ink/55 实色 scrim（非渐变）；复测 gradient=0。

## 抽检截图（shots/，生产构建 preview）

home / mall / philia / me / booking_grooming / mall_product / mall_orders /
appointments_live / me_card 共 9 张（逐屏 dock/accent/深度与矩阵行一一对应）。

## 非安全上下文实证（shots-nonsecure/ + matrix-nonsecure.json）

SERVE_STATIC=1 同源托管 + LAN IP（http://192.168.18.84:7200，CORS_ORIGINS 含该 origin，
VITE_API_BASE 同值构建）逐屏 19 路由：**isSecureContext=false、crypto.randomUUID 不存在
（safeUuid 兜底生效）、渲染锚点全中、console 零异常，57/57 PASS**。
（首次跑未按 CORS/VITE_API_BASE 内测口径配置，页面被守卫弹回 dev-login——复现并佐证了
「内测 IP 访问需同源 API 配置」这一既有部署口径，非代码缺陷；修正配置后全绿。）
