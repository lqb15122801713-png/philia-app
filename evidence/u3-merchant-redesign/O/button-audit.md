# U3 收口 · 花架子侦测（逐按钮真实链路 + 零新接口核对）

> 铁律：界面凡出现的功能必须真实做出来且三端互通。逐按钮核对；接口=全部现成（diff 零 server 改动）。

## 全域（墨轨 / 顶行）

| 控件 | 链路 | 证据 |
|---|---|---|
| 墨轨 10 项 | NavLink 直达（e2e 逐项 PASS） | A/rail e2e 日志 |
| 底部店主卡 | auth.me 真值（store.name + user.nickname） | 各屏左下角 |
| 顶行搜索框 | 各页真实过滤/跳转（预约=前端过滤、订单=前端过滤、商品=防抖查询、总览=跳 /appointments） | 各页截图 |
| 柠檬主钮（每屏至多一个） | 新增预约→toast 真口径 / 新增商品→编辑弹层 / 售卡→topUp / 邀请员工→inviteStaff 24h 码 / 去收款→markPaid / 审批取消→reviewCancel / 入住登记→toast（前台办理） | 逐页在卷 |

## 逐页动作

| 页 | 控件→链路 |
|---|---|
| 预约 | chips 前端筛选真计数；日期 › 原生 date 档换 from/to 真查询；行进 /appointments/:id |
| 预约详情 | 改期=reschedule（寄养双日期+逐晚余量）；改派=assign（写 assignSource=merchant 不回归）；确认=confirm 幂等；审批=reviewCancel 批准/拒绝；收款=markPaid（ConfirmDialog 防误触）；缩略墙=PhotoViewer |
| 监控 Hub | chips 过滤卡型；卡进 /monitor/:id；SSE 全局单连接 invalidate + 15s 慢轮询兜底（疑点 U3-1） |
| 单约监控 | 打标重拍=flagForRedo（含原因，B3-1 链路）；联系员工=就地展开 staffList 真值小卡；照片点击放大 |
| 寄养 | 行点击=详情侧栏（入住信息/物品/结算口径）；无商家退房按钮（checkout=staffProcedure 不造假） |
| 订单 | 发货 ›=ShipOrderDialog→shipOrder；已发货行显物流单号真值；售后队列只读（退款冻结不做） |
| 商品 | 卡点击=编辑弹层 upsertProduct；新增=同弹层；上下架走弹层 Switch 真链路 |
| 次卡 | 售卡/充次=topUp；记录=listLogs 弹层；状态三档真值（将尽 amber≤2 次） |
| 员工 | 编辑 ›=updateStaff；排班摘要点击=setSchedule；启用 ›=停职恢复；邀请=24h 码 |
| 财务 | chips 三档换 from/to 真查询；待收行「收款 ›」=markPaid；#pending-payments 深链滚动保留 |
| 设置 | 门店四行展开编辑=store.update/upsertService；三条 sw=localStorage 通知偏好真读写；自动接单仅口径展示（冻结，无开关） |

## 三端互通实证（在卷）

1. 商家改派（assign, by=merchant）→ 员工端 staff 频道 SSE：`appointment.assigned` 事件投递实测
   （curl 直连 /api/events 流在卷：事件 2s 内到达，payload 含 staffName/petName/by=merchant）。
   注：双 tab 同浏览器共享 cookie 罐会互相顶号（两次浏览器侧尝试均因此失真），故取 curl 直连实证 + 
   U2 已存档的双端视觉实证（员工确认→客户端 458ms）共同构成三端互通证据链。
2. 排班改动 → 客户端可约栅格联动：两美容师周六全休 → getWithServices 周六槽 17→0；恢复 → 0→17（API 级在卷）。
3. 打标重拍（flagForRedo）链路保留（单约监控页快捷操作）。

## 零新接口核对

diff 未触碰 server/ 与 packages/；新增查询均为现成过程（boardingAvailability 系首次被商家端消费的现成 public 过程，
非新增）。前端聚合点：总览在店寄养房型分组（listForStore in_boarding）、财务流水（listForStore paidAt+
pendingPayments）、次卡扣次计数（listLogs 区间过滤）、详情事件轨迹（appointment.get 现成字段合成）。

## 待裁定疑点（报产品侧，未擅自取舍）

- **U3-1**：step_updated 仅发 appointment 频道（serviceStep.ts 在案注释「防刷屏不改」）——监控 Hub 的 store 频道
  收不到翻步事件。施工=SSE 订阅照写（前向兼容）+ 洗护卡步骤查询 15s 慢轮询兜底（同接口零新增）。
  建议：下批服务端给 step_updated 增发 store 频道即可删轮询。
- **U3-2**：详情页「商家改派」轨迹行无独立时间戳（assignSource 会被后续写污染 updatedAt）——按「无时间戳不出行」
  规则不渲染该行，改派事实由信息卡员工行来源签承载。
- **U3-3**：财务「已收笔数」卡与流水表口径差：卡=paidAt 落区间（financeStats），表=listForStore 按 scheduledStart
  过滤后再看 paidAt——跨日收款（寄养次日结算）存在卡含表不含的尾差（任务书指定参数实装，未擅改）。
- **U3-4**：商品分类 chips 用代码真枚举（主粮/零食/玩具/清洁/其他），规格书所印「用品/洗护」与现枚举不一致
  （改枚举需动 format.ts 共享件，越本批授权范围，未动）。
- **U3-5**：员工绩效「完成 N 单」为 staffList 全量聚合（无月度维度）——绩效行未挂「本月」字样，避免虚标。
- **U3-6**：设置「寄养打卡提醒」sw 默认值按试样改为关（原 boardingOverdue 默认开）；键名沿用 localStorage
  boardingOverdue，文案正名留 v2 接服务端时一并处理。
