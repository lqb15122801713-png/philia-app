# U1-J 花架子侦测总表（铁则：每个按钮要么通真实链路、要么不存在）

> 汇总 U1 全批（B/A/C/D/E/F/G/H/I）各任务 e2e 的按钮点验结果 + J 批矩阵复扫。
> 判定口径：跳转=真实路由；行为=真实接口/状态变更；不存在=按任务书口径不渲染。
> 全批各 e2e「死链（#/javascript:/空 href）」断言均 0 命中；运行期 console 零异常。

## A · 全局 dock（dock-e2e.mjs 45/45）

| 按钮 | 位置 | 链路 | 判定 |
|---|---|---|---|
| 首页/预约/商城/我的 | AppDock 四槽 | /home、/booking/grooming、/mall、/me | ✅ 跳转 |
| philia 中央钮 | AppDock | 点击=/philia；长按 500ms=快捷弹层（迁移旧交互） | ✅ 行为 |
| 会员码 | 弹层 | /philia/member | ✅ 跳转 |
| 一键预约 | 弹层 | 最近非取消单预填 /booking/*（真实 listMine） | ✅ 行为 |
| 联系门店 | 弹层 | stores 表无 phone → 不渲染（铁则） | ✅ 不存在 |
| ←返回圆钮 | 15 个详情级页面 | navigate(-1) 或固定路径 | ✅ 行为 |

## C · 首页（home-e2e.mjs 17/17 + 16 元素点验）

banner 会员码→/philia/member；洗护/造型/寄养三入口→/booking/*（真实目录小字聚合）；
商城/会员卡次级行→/mall、/philia/member；提醒条（有 usable 次卡才渲染）→/philia/member；
降级入口卡/一键再约 CTA→真实 appointment.create；毛孩子头像/添加/管理→/philia/pets；
守护市集/联系门店=不存在。✅ 全真。

## D · 预约单屏（booking-e2e.mjs 20/20）

洗澡/造型大卡点选=真实服务选择；chips/更多服务=真实；随缘派单+员工卡=真实 staff；
日期横条（余 N/约满真实计数）+整月日历=真实；时段栅格=真实可约集；收款/备注折叠=真实；
吸底确认=真实下单（实证落 /booking/success?aid=…）；寄养房型/疫苗阻断条=真实链路。✅ 全真。

## E · 服务全程页（live-e2e.mjs 8/8+3/3）

步骤照片点击=PhotoViewer 真实查看；查看全程 ›=/appointments/:id/live；
SSE 推进（staff confirmStep 真实事件链）页面自更新；前后对比区保留。✅ 全真。

## F · philia 页（philia-e2e.mjs 10/10）

关闭钮/下滑手势=/home；三胶囊卡=/philia/{pets,member,moments}；一键预约卡=HomeBookingPanel
真链路；成长护照预告行=静态置灰（非按钮不挂链）；守护市集行=不存在；
喂食/玩耍/打扮/拍照四钮=未做；定制我的崽=未做。✅ 全真。

## G · 商城（mall-e2e.mjs 15/15）

分类 chips=真实过滤；快加购=真实入车（跨店 ConfirmSheet）；PDP 数量步进/加购/立即买=
真实 cartStore+结算链；提交订单=真实 createOrder；mock 收银台「模拟支付成功」=真实
mock-callback（mock 支付未动）；订单去支付/取消/确认收货/再来一单=真实 mutation/购物车重建；
「查看全程」无物流接口=不渲染。✅ 全真。

## H · 我的页 + /me/card（me-e2e.mjs 9/9）

GUARDIAN CARD→/me/card；入口列表 5 行全真实跳转；退出登录=真实 logout；
**意见反馈/关于菲丽亚（原 toast「即将上线」假按钮）已按铁则移除**；
/me/card 三档卡面=静态占位文案（非按钮）；次卡余额=pass.mine 真实。✅ 全真（1 处修复）。

## I · 档案/登录/空态（pets-login-e2e.mjs 10/10）

编辑/新增宠物=真实表单提交；同款再约=预填链直达单屏（storeId/serviceId/petId 三参）；
dev-login 种子登录/口令门=真实接口；空态「去逛逛/立即预约/清空搜索」=真实跳转/行为。✅ 全真。

## J 批复扫（matrix-e2e.mjs 37/37）

19 屏死链 0、假提示 0、console 异常 0。
**结论：全批无「点击无反应/假提示」按钮；历史两处（意见反馈/关于菲丽亚）已移除并单列。**
