# 走测修批 P0×4（D-45→D-46→D-44→D-43 · PD-21）卷宗 · evidence/walktest-p0-r5

- 开工令：产品-1013-走测修批P0（任务书=冻结版 V1.0，老板 10-13「冻走测修批任务书（P0×4）」；开口①～④按推荐收死）
- 档位：K2（D-43 涉钱抽核谨慎；无新支付通道）；同片四刀（片内序 D-45→D-46→D-44→D-43）
- 基线：生产 main@`bdb11de5`（全 bdb11de5d0a7d87eede0925b9f8ed497f557da34；PD-20 A5 已合部亲验尖）
- 分支：feat/walktest-p0-r5（PR 只开不合，base=main）；本卷宗=evidence/walktest-p0-r5

## 一、四刀明细

| 刀 | 面 | 改动 | 实证 |
|---|---|---|---|
| D-45 同宠重叠寄养拒单 | server/routers/appointment.ts | create 事务内同宠重叠闸：同宠「占床中」（pending/confirmed/in_boarding；已取消/已完成不占=提前接回后可再订）寄养单与新单 [start,end) 相交 → 400 人话（宠物名+原档期+出路）；客户端 friendlyError 首行透传（≤60 字在闸内） | e2e 103.1 四断言（首单可下/重叠拒/首尾相接放行/取消后可下）；实尺 W1（真会话首单成+重叠 400 人话+列表零双开）；既有族排雷=PR-3/67.2/67.8 各换夹具犬（来福/豆豆/皮皮，闸=同宠口径互不影响） |
| D-46 商城订单详情可达 | server mall.orderDetail 新读口 + customer MallOrderDetailPage 新页 + App.tsx 路由 + 列表卡可点 | 读口仅本人（不存在/跨人同 NOT_FOUND 不透存在性）；详情页=订单号/状态/门店/配送/地址/商品行/合计最小充分+异常人话卡+返回出口；路由 `/mall/orders/:id` 与 `:id/refund` 共存（静态段优先不互踩）；nav/smoke 注册表申报 | e2e 103.2（本人/跨人/无效三态）；实尺 W2a/W2b/W2d；nav 126 路由零死（+1 申报）；smoke-routes 110/110（+1 申报） |
| D-44 监控僵尸 24h 出列 | merchant MonitorHubPage + copy mon.zombie×4 | 写死 24h：未翻步（判定=checkedInAt 兜底 scheduledStart；无 active 步死单同兜住）→ 从默认「服务中」计数/主列表分离进「异常待清」桶（滤签+预警聚合行+卡徽+注记）；45min 亮红保留；**选型=标异常待清读时分桶（军规③优先，不自动 completed 不误伤真慢单）**；存量/smoke 残留僵尸=读时自动出列=零写清理达成 | 实尺 W3a（主列表=真在服，僵尸出列+滤签+预警行）/W3b（异常待清桶=僵尸卡+徽+注记）；非只改文案=三处联动分离 |
| D-43 退款实退 183（涉钱抽核） | server/scripts/refund-settle-cleanup.mts（新） | 运维清理脚本：dry-run 缺省只列不写；白名单 reason LIKE 'smoke %'（真实经营单永不命中）；--apply 演示收口（settled+settle_note 留痕署名，不发 outbox 不骚扰客户）；--report JSON 留痕（单号/金额/前后状态/时刻）；可重复跑；**零生产真退、零自动批准客户申请**；正向闭环=settleActual UI 链实证可走（按钮→备注弹层→登记 settled） | 实尺 W4a（黄条 3 笔）/W4b（清理后黄条消）/W4c（新 executed 单 UI 登记走完 settled）；脚本 dry-run/apply 日志+报告入卷（shots/refund-cleanup-*.{log,json}）；e2e 103.3（脚本真跑：dry-run 零写+apply 收口+非白名单零触+pendingActual 回落） |

## 二、迁移申报（键入码必随迁移）

- `server/drizzle/0081_walktest_p0_r5.sql`（journal idx 81）：copy 键 **10 增**（mall.orderDetail×6 详情页 + mon.zombie×4 僵尸桶）；幂等 NOT EXISTS；键值=生成件单源逐字；staging 用后已删。
- copy active=**4255**/72 域（生成件 4254+seed 手补 1；e2e 计数四处+双链注释同步）。
- 清理脚本非迁移件=运维脚本（server/scripts/），不入 journal。

## 三、闸门表（栈=7130/7131/7132 preview + 7200 API，CORS 显式三端；库=wt-gate.db 新库 migrate+seed，0081 实证 4255 键）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck / 全仓 build 零参版 / 栈版 | 绿 | typecheck.log / build-gate.log / build-stack.log |
| e2e 连跑 | **两绿**（1022 断言/跑；103 族七断言全绿；另 1 红=ECONNRESET 环境件早夭，净场复跑即绿） | e2e-green-1/2.log + e2e-env-econnreset-note.log |
| nav 闭环 | 126 路由（+1 申报=/mall/orders/:id）· 死胡同 0 · 弱 0 | nav.log / nav.json |
| smoke-routes | 110/110（+1 申报） | smoke-routes.log/json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 10 帧 SHOTS_ALL_GREEN（15 断言） | shots/ + shots.log + checks.json |

## 四、实尺截图清单（shots/）

1. W1-boarding-no-dup.png —— D-45：真会话首单成+重叠 400 人话「『旺财』10月18日–10月20日已有寄养单，档期重叠不可重复下单，请先取消原单或改期」，列表零双开
2. W2a-order-detail-from-list.png —— D-46：列表点卡进真详情（单号/待发货/商品行/合计透出）
3. W2b-order-detail-deeplink.png —— 深链 /mall/orders/{id} 直刷=详情页（不落 /home）
4. W2c-order-detail-notfound.png —— 无效 id=人话异常卡+返回订单列表出口
5. W3a-monitor-main-zombie-out.png —— D-44 主列表：服务中计数=真在服、异常待清滤签+预警行在屏
6. W3b-monitor-zombie-bucket.png —— 异常待清桶：僵尸卡+「异常待清」徽+口径注记
7. W4a-refunds-yellow-bar.png —— D-43 黄条「3 笔退款超 24 小时未登记实退」+待实退登记行在屏
8. W4b-refunds-bar-gone.png —— 清理后黄条消（pendingActual 归零）
9. W4c-settle-actual-closed.png —— 正向闭环：新 executed 单 UI 实退登记→settled（RB-20261013-005）
10. （清理留痕件）refund-cleanup-dryrun.log / refund-cleanup-apply.log / refund-cleanup-report.json

## 五、候裁明面（六件照实报）

1. **D-44 选型=标「异常待清」读时分桶**（军规③优先）：零写库零误伤；存量/smoke 残留僵尸 24h 后自动出列=清理达成；smoke 源头每跑留 1 单=演示链路固有（24h 自动出列），若要源头截流须加「强制完成」端点=状态机改动=另案；
2. **D-43 清理口径=演示收口**（开口①默认路径；批量 settleActual 未选=须产品复核且仅演示库）；脚本不发 outbox 事件（运维收口不骚扰客户推送=报备）；refund_bills 无 void 态（加态=枚举+e2e 冻结线改动，本批不动）；
3. **genRefundNo 按 created_at 计日序号**：老化夹具（created_at 拨昨日）会回退当日序号致撞 UNIQUE——本批实证 fixtures 全部用 RB-WT 前缀绕开日序号，且截图脚本起手拨回防毒（e2e §38 旧坑同型）；
4. D-45 闸=同宠+占床中（pending/confirmed/in_boarding）；completed（提前接回）不占闸=PR-3 C2 释放口径不动；grooming 不涉（按时长槽位既有闸）；
5. D-46 详情页退款入口=shipped/received/refunding 三态照列表卡口径；pending/paid 卡动作区（取消/继续支付）留列表不进详情（最小充分）；
6. D-45 客户端呈错= friendlyError 首行透传（≤60 字）；本闸明文实测 45 字内安全透出，超长宠名+长日期组合理论超 60 字落兜底「预约失败」=报备在册（文案键化=P2 另批）。

## 六、纪律自查

零新依赖 ｜ 迁移幂等+申报（0081 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ **零生产真退/零自动批准客户退款申请** ｜ 真支付通道零触 ｜ 回馈金比例/券核销零触 ｜ 退款状态机口径保持 ｜ D-31 关未碰 ｜ D-34 坐标未动 ｜ D-29 冻结守卫族每跑照绿 ｜ A5/PD-20 不重开 ｜ 不判美 ｜ 清理脚本 dry-run+白名单+留痕+可重复 ｜ 收摊必净（PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
