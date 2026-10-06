# 卷宗 · 商家端大批 片 4（库存域+调拨要货·含审批流）

> 令=开工令-产品-1006-商家端大批片4.md ｜ 任务书=冻结版 V1.0 ｜ 附件=片 0 盘点表 ｜ 基线=叠片 3 尖 b7d56839（本地 e2a9865 同树）｜ 分支 `feat/merchant-chain-4` ｜ 施工=A 窗 2026-10-06 ｜ PR 只开不合。

## 一、施工总账（22 文件，+4937/−24；迁移 0055/0056 均幂等）

### 库存域主建（盘点表 14 行全收）
- **进价/成本+毛利权限隔离**：products+cost_fen/min_stock/max_stock（0055）；`mall.listProductsForStore` server 闸=clerk 三列全 null（e2e 81.1）+页面级=商品页 clerk 引导页（截图 04）双层（开口项 1 裁，矩阵锁死区未动）；upsertProduct/编辑器三字段；**涉钱零新规=成本=台账字段不写支付链**（开口项 4 裁）；
- **库存上下限预警**：stockAlerts（缺=stock<min 含建议量 max−stock/溢=stock>max；e2e 81.2 建议量精确）；
- **缺货禁售·估清**：markSoldOut（stock 归零+movements 留痕，商城下单 stock>=qty 既有闸拦零 e2e 81.3）/restockProduct 恢复（前后值）；
- **批次管理**：product_batches（批号/生产日期/保质期天数；同品同店批号唯一；手工入批+采购收货入批[重号自动并批]）；
- **效期自动计算+临期分级**：expiry=production+shelfLifeDays 自动；分级 expired/urgent(≤7)/warn(≤30)/ok（expiry_urgent_days/expiry_warn_days 端口留口）；expiryBoard 看板（仅非安全行+隔离/销毁口）；
- **FEFO 先到期先出**：fefoSuggestion（active 且 qty>0 批按效期升序，首行=建议先出；**开口项 2 裁=建议+预警不强制改扣减链**——行为零变更，e2e 81.5）；
- **过期隔离·禁售·销毁**：batchQuarantine（批次 qty 同步扣出 products.stock+流水，隔离批次不计可售；幂等）/batchDestroy（限已隔离，qty 清零留痕）；e2e 81.6 前后值精确；
- **采购订单·供应商管理**：suppliers CRUD + purchase_orders（draft→submitted[进审批]→approved→received[逐行生成批次+stock 累加+成本回写+流水]；e2e 81.8 全链前后值）；
- **报损**：writeoffCreate（当场录入 pending 进审批）→approvalReview approve 扣库存（products.stock+batch.qty 同步+流水；e2e 81.7 前后值）；
- **期初库存导入**：商品导入族扩可选尾列 进价（元）/库存下限/库存上限（六列模板向后兼容；preview dry-run+execute 全量或零既有工艺；e2e 81.9 三值落库+失败行零落账）；
- **调拨要货**：transfer_orders（发起[pending 进审批，目标店限老板全域，越界 NOT_FOUND]→approved→ship[转出扣 stock，**在途归属**=双侧不可售]→receive[**成对确认**，转入店按商品名匹配/无则档案复制，stock 累加+双侧流水]；transferInTransit 在途视图+超时预警 transfer_in_transit_warn_hours=24 端口留口；e2e 81.11 双侧前后值）+replenish_requests（建议量=max(0,maxStock−stock) 读口+申请进审批+履约入库；e2e 81.10）；
- **审批流**：approval_requests 通用四类（purchase/replenish/transfer/writeoff；timeline 只增不改）+approvalListPending/approvalReview（owner|manager 批+note 留痕）+OpsPage 区 5 队列+**rail 角标同族合并计数**（stock2.approvalPendingCount 并入既有「审批+申诉」合并口径，截图 rail 角标=3 实证）。

### nav 申报（rail 十九口冻结不改=新裁定，页面互链口径）
新路由 2 个：/inventory（库存域五区）/transfers（调拨要货三区）——check-nav-closure 122 路由+smoke-routes 106 冒烟双表入行；可达性=页面互链（ProductsPage「库存 →」+库存⇄调拨互链），rail 零改动。

## 二、申报件汇总

1. 迁移 **0055**（products 三列+七新表[product_batches/suppliers/purchase_orders/stock_writeoffs/transfer_orders/replenish_requests/approval_requests]+service_rules 三键）+**0056**（copy 键 152 枚注册=脚本生成+INSERT 计数断言==152，立规矩照办；生成件 copySeedRows 3344 行同帧）；
2. e2e 族 81 新增（13 组断言；既有断言零删改）；56.1/76.3 计数 3193→3345（域 68→69：merchant:inventory 新域）同步；
3. **R11a① 端点扫描器口径细化**（结构转正件申报：互转红线 convert/transfer/exchange 匹配，店间调拨 stock2.transfer*=片 4 合法件登记，红线口径不变）；
4. seed.ts service_rules 补种三键（重置后存续）；
5. transferShip/transferReceive 店域闸=店域集合（老板全域两店互调可发可收；店长=本店单值）；transferCreate 发起=当前 session 店转出（登记）。

## 三、闸门（2026-10-06 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令） | exit 0 | gate-build.log |
| server typecheck / merchant tsc | 0 / 0 | gate-e2e-full.log 头行 |
| e2e 全量 | **全链路验收全部通过 ✅**（850 断言：族 81 十三组全绿；78/79/80 不回退；R11a① 扫描器细化后绿；56.1 3345 键/69 域；终跑第二绿同值） | gate-e2e-full.log |
| check-nav-closure | **122 路由 · 死 0 · 弱 0 · 豁免 6**（新路由 2 申报） | nav-closure-122.json + gate-nav-closure.log |
| smoke-routes | **106/106** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | （tail 段全绿见交付回执） |
| 实尺截图 4 帧 | 库存五区（效期分级徽已过期/临期+报损待审批+rail 角标=3）/调拨在途视图/ops 区 5 审批队列/clerk 商品页引导页（毛利页面级闸）——逐屏目检已做 | 01-04-*.png |

## 四、红线自查

零新依赖 / 禁令新增行命中=0 / 行尾 LF / 迁移幂等 / 多句 INSERT 迁移=脚本生成+计数断言（0056=152==152 ✓）/ 涉钱零新规（成本=台账字段不写支付链）/ FEFO 不强制改扣减链（行为零变更）/ 隔离族不回退（81.13 抽查绿）/ 收摊必净（TaskStop×4+netstat 复核+taskkill 补刀 PID 25208/32448/58152/56840 子树→ALL_CLEAR）。

## 五、环境件登记

- e2e 二跑「fetch failed」=静默死环境件（照案复跑三跑全绿+终跑第二绿采信）；
- 探针备数=API 正规通路（带成本商品/临期+过期批次/报损 pending/调拨发起到探针 A 辖二店+审批发货在途，dev 库明面登记）。

— A 窗（施工方）2026-10-07 凌晨
