# 批次 M1-补2 证据卷宗 · 收银台修复包 R1~R6（冻结版 · 决策 #32/#33 + 补丁①②）

- 工作分支：`feat/m1-fix2`（基线 main@`9b89ca4f`，M1 已合）
- 真相源：《批次M1-补2修订单-收银台修复包》冻结版（含补丁①权限矩阵会签稿）+ 补丁②（防假退款硬条件）+《Philia三端权限矩阵表 V1.1》+ 台账备件 CSV
- 日期：2026-09-19 ｜ 施工：K3 集群 work
- 边界照守：UI 不评审（决策 #30）；会员四档售卖不动（决策 15）；储值新售冻结（无充值入口全域回归保护）；次卡扣次永不计入已收（铁律）

## 验收闸门逐项

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build exit 0 | ✅（客户/员工端零改动，shared 类型连带编译通过） | gates/build-all.log |
| server typecheck exit 0 | ✅ | gates/server-typecheck.log |
| smoke-routes | ✅ **36/36**（新增 /cashier/close 锚点） | gates/smoke-routes.log/.json |
| smoke-deploy | ✅ 全绿（新增修复包 15 用例：同源三处同数/clerk 遮罩+403 矩阵/日结/反结账/储值导入 preview 校验位；演示单按天顺延防满槽加固） | gates/smoke-deploy.log |
| 契约实证 | ✅ m1fix2-check **31/0**（R1 聚合+R2 三级）+ m1fix2b-check **55/0**（R3/R5/R5b/反结账）+ m1-contract-check **67/0**（M1 回归） | gates/*.log |
| 禁令 grep（diff + 行） | ✅ 珊瑚粉=0 / text-white=0 / 渐变=0；零新依赖 | gates/grep-gate.log |
| diff 范围 | ✅ apps/merchant 22 + server 13 + packages/shared 2 + scripts 2；apps/customer、apps/staff 零改动 | PR diff |
| 日志入卷 | ✅ 全部 `git add -f`（.gitignore 第 25 行教训已纠） | 本目录 |

## R1~R6 落点对照

| 项 | 落点 | 实证 |
|---|---|---|
| R1 账目口径统一 | `store.todayTenderStats` 唯一聚合出口（已收=Σ现金+微信+支付宝支付段；pass/储值参考列永不计入；**回馈金 rebateFen 列位预留**（决策 #33，恒 0 不实现））；总览/收银台头部/财务头部三处同数同源；笔数=合并流水行数（「洗护 0 笔」矛盾消除）；voided 零聚合回归保护 | shots/01-03 三页同数三连拍（¥4,522）；smoke 6.1/6.2 同源断言 |
| R2 三级账号 | `merchant_clerk` 全套（VALID_ROLES/SessionUser/staff 绑店口径/SSE 订阅）；merchantProcedure 放行 clerk（开单/结账/扣次/撤单未支付）；merchantManagerProcedure（owner\|manager：改价/折扣/日结）；merchantOwnerProcedure（反结账/导入/导出）；撤单 operatorId 留痕 | shots/30-34（clerk）/ 20-23（manager）；smoke 6.3；m1fix2-check 逐项 403/放行 |
| R3 交接班/日结 | shifts 表+懒建开班（首笔收银自动开班留痕 lazy:true）；收银单挂当班 shift_id；/cashier/close 日结页（账面 vs 实点差异红字、微信/支付宝/次卡/储值分列）；日结单冻结+留痕+CSV 导出（**仅 owner**，补丁①收紧）；clerk 无入口（引导页） | shots/07-10；smoke 6.4 |
| R3b 反结账双件 | 日结反结账（拆箱，仅 owner，强制原因，原单永存不涂改，冲正关联单含前后值快照双向可查，可重新日结）；收银台反结账单（已支付单冲正，仅 owner，强制原因+关联原单号，库存/财务/次卡/储值自动回补，冲正单不计当日已收——聚合排除被冲正单+冲正单实证 Δcash=−12600） | shots/11/12；smoke 6.5；m1fix2b-check 逐项 |
| R4 断网不静默 | 离线状态条常显（navigator.onLine+SSE 双信号）+本地暂存单数；结账离线先 hold 取号本地暂存（bill_no 幂等，M1-Y1 口径落地）明示「已暂存，待补传」；恢复自动补传+结果明示（成功 N 单/失败原因） | shots/40-42 三连（离线暂存→恢复→补传成功 1 单） |
| R5 存量储值 | stored_value_accounts（本金/赠送分列）+stored_value_logs（前后余额+单号+操作人）；支付胶囊五分列（储值余额小字/不足禁用+原因/可混搭/Σ=应收不变）；**不计入已收**（storedValueFen 参考列实证）；无充值入口（探针 404 实证） | shots/04-06（储值胶囊/混搭/成功态）；m1fix2b-check |
| R5b CSV 导入接口 | storedValue.previewImport（零写入对账报告：行数/人数/本金合计/唯一手机号/门店分布/次卡夹带/编号缺失/赠送全零校验位）+executeImport（批次留痕）+listImportBatches+clearImportBatch（试导可标记清除；已产生消费批次拒绝清除）；**仅 owner**；手机号主键；门店映射必做；次卡映射预留 | shots/13/14（对账报告+批次列表）；真台账 preview 逐位吻合（1290 行/907 人/¥671,264.42/贝肯山728·生活馆328·生态城234/次卡夹带 150）——**只交付不执行，真台账未导入未入库未外发** |
| R6-1 流水标签全显 | 组合支付单显全部方式（现金+微信等） | shots/50 |
| R6-2 挂单刷新延迟 | 根因=invalidate 微任务空窗+SSE 一跳延迟；修法=hold onSuccess 乐观 setQueryData+invalidate+SSE 三保险（实测 120ms 出卡） | shots/51 |
| R6-3 洗护 0 笔 | 并入 R1（笔数=合并流水行数） | shots/01-03 |

## 补丁①②落点

- 补丁①：clerk 撤单未支付单放行（撤 M1 置灰）；clerk 无交接班/日结入口；反结账双件；**clerk 不看营业额**（收银台头部+右栏流水隐藏，server restricted 硬遮罩金额全 null）；**一切导出仅 owner**；导入仅 owner+成功/失败行数报告；clerk 收银识别可见余额/次卡、不可翻台账。
- 补丁②（防假退款）：owner/manager 见退款入口 → 点击=明文「退款功能随专项批开通，如需冲正请店主使用反结账」**纯前端零接口调用零写入**；clerk 无入口；无白屏/死按钮；server 无任何伪退款写入端点（契约探针在案）。
- 实拍：shots/16（owner 拦截弹层）/ 21（manager）/ 30-34（clerk 无入口）。

## 三角色矩阵实证（节选）

| 能力 | owner | manager | clerk |
|---|---|---|---|
| 开单/挂单/取单/结账（组合支付/扣次/储值混搭） | ✓ | ✓ | ✓ |
| 撤单（未支付） | ✓ | ✓ | ✓（补丁①放宽） |
| 改价/免单 | ✓ | ✓（放宽实证） | 置灰+403 |
| 反结账（单/日结拆箱） | ✓ | 无入口+403 | 无入口+403 |
| 退款 | 明文拦截（零写入） | 明文拦截（零写入） | 无入口 |
| 日结/交接班 | ✓ | ✓ | 无入口（引导页） |
| CSV 导出/台账导入 | ✓ | 403 | 403 |
| 营业额/流水/看板 | ✓ | ✓ | 隐藏（硬遮罩）/引导页/403 |

## seed_clerk 演示店员号（裁定②同口径）

- users.id=`01M2VYN9NPJX4S665BECMRJV4M`（kimi_id=`seed_clerk`，演示店员，13900000010）；roles=merchant_clerk；staff 行=`01M2VYN9NR5Q8QGV3YB4WM1WZG`（示例店，frontdesk，active）
- SQL 卷宗：`seeds/m1fix2-seed-clerk.sql`（三段 NOT EXISTS 幂等）；dev-login 仅 seed_ 前缀不扩面
- 演示台账：`seeds/m1fix2b-demo-ledger.csv`（试导证据用；批次 X2C2X7 保留未清除，示例客户储值余额即由此来——重复试导过一次，验收演示时口径以批次列表为准）

## 疑点清单（立项待裁，均不阻塞）

| # | 内容 |
|---|---|
| Y1 | clerk 继承面：merchantProcedure 放行 clerk 后，定价/员工管理/预约审批等其余 merchantProcedure 端点 clerk 理论可调（本批闸门表未含未动）；建议下批按矩阵逐端点收紧（定价/账号创建/系统设置矩阵实为仅 owner，manager 现状可调亦在案） |
| Y2 | clerk/seed_clerk 的 staff 行 role=frontdesk（同 seed_manager 口径）→ 具备员工端入口与前台核销资格；如需收紧另批裁定 |
| Y3 | 班次账=收银域支付段口径：预约域 markPaid 直收（历史通道）不进班次账面；v1 收款全量经收银台（注释在案）；若重开 markPaid 直收，日结口径需复审 |
| Y4 | 懒建开班：无开班时首笔收银写自动开班（事件 lazy:true）；班次与日未强制 1:1（跨天班次允许，日结按班次冻结） |
| Y5 | executeImport 无文件级幂等（重复执行重复入账）：试导流程=清除后重导；正式执行等老板令一次性导入（接口注释写明） |
| Y6 | 储值扣减顺序=先本金后赠送（台账赠送全零，v1 简化在案） |
| Y7 | 冲正单不含行项/支付段副本（金额镜像+原单号链接满足双向可查）；行级快照下批可加 |
| Y8 | 日结表单账面预览=全日口径（R3② 原文「当日现金支付段 Σ」），冻结值=当班口径；多班场景两者不同（实拍 09 实例：预览 ¥2834/冻结 ¥515）；UI 已标注「冻结以当班口径为准」；如需预览=当班口径需 server 增当班账面端点（下批） |
| Y9 | 测试库今日流水含调试期重复 ¥68 单若干（僵尸 tab 共享 localStorage 的补传污染，非产品 bug）；如需整洁可店主反结账冲正 |
| Y10 | provision 夹具预约在「生成→消费」秒级窗口可能被走查链路抢先拉入（自供给已压到最小；绝对免疫需 server 加创建人过滤，另批） |

## 部署提醒

含新迁移 **0010**（shifts/day_closes/stored_value_* 五表 + cashier_bills 冲正列 + shift_id 启用）。VPS 升级后按 DEPLOY §9：`docker compose exec app sh -lc 'cd server && npm run db:migrate'`（幂等），再 `node scripts/smoke-deploy.mjs` 自检（含修复包 15 用例）。
