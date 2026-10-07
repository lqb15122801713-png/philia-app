# 卷宗 · 端口批收尾 片 3（画布端口+薪资调整端口 4+聚合扫码闭环）

> 令=开工令-产品-1007-端口批收尾片3.md ｜ 任务书=冻结版 V1.0（画布=v1.1 冻结口径）｜ 附件=盘点表（片 0）｜ 基线=叠片 2 尖 7755b800 ｜ 分支 `feat/port-tail-3` ｜ 施工=A 窗 2026-10-07 ｜ PR 只开不合｜ 档位=K3·Max（新域起建）。

## 一、施工总账（三股全收，军规零扩缩）

### 股 1 · 画布端口（B 股 v1.1，本批重心）

- **block_registry 区块注册表**（0064 种子 **18 块三屏白名单**：home 9/memberCenter 8/cashierMarketing 1；**写死件**——canvas.blocks 只读公示，saveLayout 校验块∈注册表且属本页，未知块/缺块/重块一律 400（e2e 85.1），**自由排版不做**红线条入页）；
- **page_layouts 布局表**（店×页版本化+**草稿/发布两步流**=第六域同族：draft→published[事务内互斥]+archived 留痕+revertLayout 回上一版；draft 不透出[liveLayout 只透 published]，e2e 85.1 五连）；
- **画布页**=控制台 F 章 F1「画布端口」（CanvasPortBody）：**右栏真页面实时预览**（iframe 嵌真端 canvasPreview=1&canvasStore=店锚；双轨 URL 口径=localhost 走 vite 端口映射[7101→7100/7131→7130]，生产走 spa Host 前缀[app.*]）+**点选反查**（CanvasProbeMount 捕获 click→postMessage pick→左栏高亮定位+输入框聚焦；注册表 copyKeys 位 CK span 挂 data-copy-key）+**区块上下拖拽排序**（手写 pointer 零 dnd 库：down 记行高→move 按行高算位→up splice）+**显隐开关**+**换素材**（槽位块缩图+去槽位端口 link）+**改文案**（行内编辑→config.save 保存即生效+postMessage copy patch 预览即变）+草稿/发布/版本时间轴/回退；
- **渲染侧块数组化**：HomePage 九块/MemberCenterPage 八块（块内条件一字不动[live/idband/megacard 三元内收]；CanvasLayoutLoader 60s+120s 轮询 liveLayout∪注册表默认序尾补；缺省零改动兜底）；CartPanel 立省钩子=cs.savingsHook 布局显隐闸；
- **非工程师验收尺（红线一票否决）=全程实录入卷**（probe-canvas.json+六帧）：点句（预览点 home.entryGrooming→左栏 megacard 高亮 picked=true）→改字（保存即生效+patch→iframe 同帧显「画布改字实证」）→拖拽换位（megacard 升至首位，左栏+iframe 同序 patch 不刷新）→发布（publishLayout v6 在库）→客户端生效（首页首块=megacard+改字文本客户端可见）——**六帧连拍逐屏目检**。

### 股 2 · 薪资调整端口 4 件

- **提成试算**：`payroll.simulateCommission`（owner 只读零落库；computeMonth 加 `rulesOverride` 参[规则读取链不动，查表前先查 map]；全员两帧 baseline/simulated+delta 精确到分；e2e 85.2[降率至 0 全员 delta≤0 总差<0]+未知键/重键 400）；
- **单笔提成/工时手工调整**：`payroll.proposeAdjustment`→pay_adjust_proposals 载荷单+approval kind='pay_adjust'（不新建审批表）；
- **调整审批链（金额阈值分级）**：`payroll.reviewAdjustment`——service_rules 键 `pay_adjust_threshold_fen`{amountFen:10000}（端口留口）：|金额|≤阈值 manager 可复核、超阈值仅 owner（e2e 85.3 三连）；通过=同事务落 pay_adjustments active 行；驳回双 rejected 不落库；
- **调整后自动同步下游**：generateMonth 按 (staff,month,active) 合算进 adjustmentFen（与退款回冲同通道带符号；e2e 85.4 未来空月 500+20000=20500 精确+net 同值）+**只进当月未发单不回溯已发**（marked_at 在案月份应用帧 400 明文）；UI=PayrollPage 试算器区+手工调整区（发起表单+队列+阈值注记条，截图 07）。

### 股 3 · 聚合扫码闭环（仅 UI 半件）

- **会员码核验接通收银台**：ScanVerifyCard（录码框去空格→membership.verifyCardToken[server 68.5 已绿勿重做=消费面零改动]→forUser 同键缓存预热→CashierMember 映射[缺字段 null/0 占位+「码通道带出=档位/状态为主」注记不报假值]；挂点 canManage 闸=server merchantManager 同档）——与手机号检索**并列通道**不替换（截图 08/09 真核验：签发→录码→档位带出）；
- **A28 克隆口入口**：ProfilePortBody 门店操作区「新店克隆」+确认弹层（cloneStore {name} 已核）；
- **A31 员工端输码绑定**：TodayPage 无身份空态输码卡→auth.bindStaff→invalidate 身份自动翻工位+错误明文。

## 二、申报件

1. 迁移 **0064**（block_registry/page_layouts/pay_adjust_proposals/pay_adjustments 四新表+service_rules 阈值键+注册表 18 块种子=脚本生成+INSERT 计数断言==19 ✓）+**0065**（copy 键 106 枚=脚本生成+INSERT 计数断言==106 ✓：canvas 47+payroll 40+cashier.scan 8+cadm 11[含 payroll 键域归并口径注记]）；journal idx 64/65；seed.ts 补种阈值键；dev 库均手工追平（sha256=a8489409…/14ab84ca… 补登，migrows=66，blocks=18）；
2. e2e 族 85 新增（7 组 14 断言；既有断言零删改）；56.1/76.3 计数 **3763→3869**（域 71→72=canvas 新域）同步；
3. **nav 双表零申报**（本片零新路由：画布端口=控制台 F 章域内+页内区块；归屏率 97.0%>90% 军规线，未归屏 115/3869=3.0%<10%）；
4. **已部署迁移永不重写军规照行**（本片新增量全部新迁移，0047 军规零违例；staging 用后已删）；
5. **设计抉择报备七件**（代理报备照收，详 §五）：iframe 双轨 URL/forUser 字段映射/录码卡 canManage 闸/revert 单一上一版口/拖拽行高算法/home.entryNote 注册表声明键码内无此 copy 键（留口只读）/块化等价注记。

## 三、闸门（2026-10-07 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（7201 轨）+根目录 build（Y1 轨）+merchant 单轨重烧×2 | 全 exit 0 | gate-build.log |
| server typecheck / 三端 tsc | 0 / 0 | （随改随跑终态 0） |
| e2e 全量 | **两绿采信 917 断言**（族 85 七组 14 连 ✓；51-84 零回退；56.1/76.3=3869/72；76.1 归屏率 97.0%；76.4 未归屏 3.0%） | gate-e2e-full.log（绿 2）+gate-e2e-green1.log（绿 1） |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | nav-closure.json+gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| **画布验收尺实录** | **六帧连拍 PROBE_ALL_GREEN**（点句→改字→预览即变→拖拽换位→发布→客户端生效，非工程师验收尺过线） | 01-06-*.png+probe-canvas.json |
| 薪资四件+扫码实证 | 三帧 PROBE_ALL_GREEN（试算器两帧表/调整区/录码真核验档位带出） | 07-09-*.png+probe-pay-scan.json |

## 四、红线自查

零新依赖（拖拽=手写 pointer 工艺零 dnd 库）/ 禁令新增行命中=0 / 行尾 LF / 迁移幂等 / 多句 INSERT=脚本生成+计数断言（0064=19/0065=106 ✓）/ **区块注册表写死白名单**（未知块 400，自由排版不做）/ 涉钱件=留痕不碰真钱+审批链+只进当月未发单不回溯已发 / server 68.5 核验口零改动 / 隔离族不回退（85.6 权限闸+85.7 互盲）/ 收摊必净（四服务 TaskStop+netstat 复核+taskkill 补刀 PID 43860/39192/41504/820 子树→残留监听=0）。

## 五、环境件与施工注记

1. **iframe 双轨 URL 修正（施工件）**：画布预览 URL 初版仅 import.meta.env.DEV 判 dev——vite preview=生产构建恒 false 走生产分支致预览加载失败；修=localhost/127.0.0.1 一律走 vite 端口口径+7101→7100/7131→7130 双轨映射（生产 spa Host 前缀工艺不动）；
2. **CDP OOPIF 探针工艺**：跨端口 iframe（跨源）Target.getTargets 不列子帧——改 Page.getFrameTree+Page.createIsolatedWorld 在同 page session 内取帧执行上下文（探针工艺定型可复用）；
3. **拖拽探针六轮调参**：代理算法=按被拖行**自高**算目标位（megacard 行≈170px 高≠64px 行高）——探针落点须按真行高自适应（[data-canvas-row] 实测），双向拖拽（先下后上）破除起始态依赖；
4. **e2e 85.5 断言两件施工修正**：新用户补 user_roles（customerProcedure 403）+断言改读开档实档（83.5 自动回滚窗口内会滚动 default_plan_key 端口值——特性非缺陷，断言钉死值属误配）；
5. e2e 静默死一发（run3 ECONNRESET）照案清残留复跑两绿采信。

## 六、探针备数登记（dev 库明面）

画布发布 v6（megacard 首位+stats 隐+「画布改字实证」文案端口值，home 页布局在库）/ 示例客户微光档+会员码签发（openFree+myCardToken 正规通路）/ 画布改字=copy 端口值（home.entryGrooming=「画布改字实证」，可经文案端口复核改回）。

— A 窗（施工方，角色卡⑧ V2.1）2026-10-07 晚
