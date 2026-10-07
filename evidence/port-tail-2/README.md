# 卷宗 · 端口批收尾 片 2（数据 3+运营内容 2+Banner 认签）

> 令=开工令-产品-1007-端口批收尾片2.md ｜ 任务书=冻结版 V1.0 ｜ 附件=盘点表（片 0）｜ 基线=叠片 1 尖 11da63da ｜ 分支 `feat/port-tail-2` ｜ 施工=A 窗 2026-10-07 ｜ PR 只开不合。

## 一、施工总账（乙/丙区 5 件全收+认签 1 件+开口项片内裁照录）

1. **批量编辑器**（数据 3 之①）：`mall.bulkUpdateProducts`——网格白名单五字段（stock/priceFen/description/minStock/maxStock，**zod strict 硬拒白名单外字段=涉钱涉账永不进网格**=开口项 1 裁）+**价签仅店主**（manager 403 明文）+安心包行 400（独立域只读口径）+回收站行拒改；**留痕=每商品一行 stock_movements（sourceType='bulk_edit'，note=字段前后值 JSON）**；UI=ProductsPage 批量编辑模式（五列网格+脏行高亮+浮动条计数，截图 01；e2e 84.1 三连含权限/strict/安心包）。
2. **数据订正界面+审批流**（数据 3 之②）：approval_requests 加 kind='correction'（**不新建审批表**，载荷表=`data_corrections`）——三类：**储值余额**（principal/bonus 绝对值修正+stored_value_logs 前后值）/**回馈金**（balanceFen 绝对值+rebate_logs type='correction'[应用层枚举新取值报备]，sourceId=订正单）/**考勤工时**（打卡时刻修正+attendance_approvals type='adjust' 留痕行同 managerAdjust 工艺）；**owner 发起→复核通过才生效**（review=merchantManagerProcedure，before 应用帧重算防漂移）+**不回溯已封箱**（日结/月结快照/已结算期次一律不重算，红线条入页）；UI=ConsolePage D4「数据订正」（三类页签+发起表单+订正单队列+通过/驳回，截图 02；e2e 84.2-84.4 六连含驳回不落库）。
3. **回收站软删除**（数据 3 之③）：**白名单=运营件三域**（商品/活动/公告；restore 口 zod enum 硬拒白名单外=**账务/支付/账单类永不进**=开口项 3 裁+**无 purge 硬删口**）——products/promo_campaigns/announcements 加 deleted_at/deleted_by（0061），delete 口各域（mall.deleteProduct[owner]/marketing.promoDelete[manager]/announce.remove[manager]），**恢复=统一口 recycleBin.restore（owner）**，读侧 list 默认过滤（public/管理/staff 三视角同滤），编辑口拒回收站行；UI=ConsolePage D5「回收站」（三域行+删除人/时刻+恢复钮，截图 03；e2e 84.5 五连含双 list 不见/恢复回架/重复删 400）。
4. **店铺公告/全局广播**（运营内容 2 之④）：announcements 加 startsAt/endsAt（NULL=不限，**员工读口懒算过滤**同 promo 口径）+status 加 draft——**新建即带草稿·发布两步流**（`announce.saveDraft`→`announce.publishDraft`，照裁定 §二.2 同四域同族；发布步=store 频道事件+定向逐人通知与 publish 同工艺[抽 notifyAnnouncement 共用]）+**预览**（发布弹层公告卡片预览）+publish 旧直发兼容（起止可空，61 族零回退）+remove 软删；UI=AnnouncementsPage 草稿区/起止小字/懒算「待生效」「已截止」章（截图 04；e2e 84.6 五连含草稿不可见/窗口懒算/倒置 400）。
5. **草稿·发布两步流收口**（运营内容 2 之⑤）：四域已建件对齐口径**校形注记**（营销 draft→scheduled→active[懒算]／槽位 pending→live[+revert]／库存 draft→counted→confirmed→posted／退款 draft→executed→settled——公告域新建件=第五域同族入列；四域本体零改动，校形表见 §五）。
6. **Banner 认签件**：**收口不新施**（片 0 候裁 3 认签在案）——现槽位端口（七槽注册表+pending→live+revert，57 族）管 Banner 不另立；评估注记：增量空间=跳转 link/排期字段，若产品要则另立增量件。评估注记入卷本节即认签载体。

## 二、申报件

1. 迁移 **0061**（products/promo_campaigns/announcements 各+deleted_at/deleted_by+announcements+starts_at/ends_at+data_corrections 新表）+**0062**（copy 键 92 枚=脚本生成+INSERT 计数断言==92 ✓：corr 42+prod 14+ann 24+cadm 12）+**0063**（归屏/位置注增量回填 636 行=NULL 守卫幂等，重放实证 replay-identical）；journal idx 61/62/63；dev 库均手工追平（sha256=2d9b7d25…/b2198671…/3d8afc3f… 补登，migrows=64）；
   **军规（本片打回修一件后立，全批照行）：已部署迁移永不重写，增量回填走新迁移**——0047 曾随生成器重跑被整件重写（含既有行 position 文案漂移），已逐字节复原 main 版（sha256=8dae73d3…==main 版），增量 636 行挪 0063；生成器产物永久改道 `server/drizzle/_backfill_staging.sql`（staging 勿入卷，用后删，diff 增量挪下一号新迁移）；
2. e2e 族 84 新增（8 组 19 断言；既有断言零删改；61 族公告兼容实证在列）；56.1/76.3 计数 **3671→3763**（域 **70→71**=corr 新域）同步；
3. **nav 双表零申报**（本片零新路由：新增面=ConsolePage D4/D5 端口直嵌+既有页内模式；归屏率 96.9%>90% 军规线，未归屏 115/3763=3.1%<10%）；
4. **R11a① 扫描器零触及**（本片无互转类新口）；`taskCollabPort` 公告桥就近扩契约（桥退役=超范围留口，代理报备在卷）；
5. **选型报备三件**（代理施工报备照收）：①工时记录定位=exceptionQueue.flaggedRecords 过滤+手输 ID 兜底（商家侧无 staff+date 通用列表口）；②会员搜索=pass.listCustomers 全量取回本地过滤（无搜索参）；③correction.list=owner-only 与「manager 只读队列」字面差（ConsolePage 本身 owner 门，manager 实际不可达 D4）——候产品侧知会。

## 三、闸门（2026-10-07 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（7201 轨×2 轮）+根目录 build（Y1 轨×2 轮） | 全 exit 0 | gate-build.log |
| server typecheck / merchant tsc | 0 / 0 | （随改随跑终态 0） |
| e2e 全量 | **两绿采信 903 断言**（族 84 八组 19 连 ✓；51-83 零回退；56.1/76.3=3763/71；76.1 归屏率 96.9%；76.4 未归屏 3.1%） | gate-e2e-full.log（绿 2）+gate-e2e-green1.log（绿 1） |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | nav-closure.json+gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 4 帧 | 批量编辑网格（脏行+浮动条）/订正队列（pending+通过/驳回+红线条）/回收站（商品+活动行+恢复钮）/公告两步流（草稿区+发布弹层预览）——**逐屏目检已做** | 01-04-*.png+probe-result.json（PROBE_ALL_GREEN） |

## 四、红线自查

零新依赖 / 禁令新增行命中=0 / 行尾 LF / 迁移幂等（0061 runner 级+0062 NOT EXISTS）/ 多句 INSERT=脚本生成+计数断言（0062=92 ✓）/ 涉钱涉账永不进网格（strict+价签仅店主）/ 订正=留痕+审批+不回溯已封箱（台账字段修正零支付链）/ 回收站白名单=运营件（账务类永不进+无 purge 口）/ 硬删禁令照旧 / 隔离族不回退（84.7 权限闸+84.8 互盲）/ 收摊必净（四服务 TaskStop+netstat 复核+taskkill 补刀 PID 44088/44092/41312/44064 子树→残留监听=0）。

## 五、两步流五域校形对照表（件⑤收口认签载体）

| 域 | 状态机 | 生效口径 | 实证 |
|---|---|---|---|
| 营销 promo_campaigns | draft→scheduled→active/ended | 排期懒算（promoEffectiveStatus 纯函数） | e2e 82.4 |
| 槽位 slot_contents | pending→live（+revert） | 单事务换 live，待审不上线 | e2e 57.1-57.5 |
| 库存 inventory | draft→counted→confirmed→posted | posted 才入台账 | e2e 81 族 |
| 退款 refund | draft→executed→settled | 执行才动账 | e2e.ts:2422 族断言 |
| **公告 announcements（本片新入列）** | **draft→published（+archived）** | **发布步才可见+起止懒算** | **e2e 84.6** |

校形结论：五域同族（草稿态不上线/发布步单事务切换/全程留痕），公告域与四域口径对齐，无参差。

## 六、环境件登记

1. 截图首跑五连 ❌=**根 build 重烧 dist 覆盖 7201 轨**（build 顺序坑：root build→7201 轨截图前必须按轨重烧，与片 1 卷宗注同族）——7201 轨三端重烧后复跑三绿；
2. 探针路由误配（/announcements→正确=/settings/announcements）+选择器撞直发钮 testid（ann-publish-submit vs 草稿行 ann-publish-${id}）——探针工艺修正两件，非产品缺陷；
3. e2e 采信跑 1 一次失败=我计数同步漏替 `copyList0.rules.length`（3671→3763 的 `rules.length` vs `rows.length` 字面差）——修正后两绿，登记为施工件非环境件。

## 七、探针备数登记（dev 库明面）

订正 pending 单（示例客户储值 +500 分示范，留 pending）/ 回收站两行（幼犬奶糕粮 1kg+片2截图回收件活动）/ 公告草稿（周五消毒日通知，留 draft）。

— A 窗（施工方，角色卡⑧ V2.1）2026-10-07
