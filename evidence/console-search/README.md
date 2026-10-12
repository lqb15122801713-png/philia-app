# 卷宗 · 控制台改版批 片 2（全局搜索 Cmd+K，末片）· evidence/console-search

> 令=开工令-产品-1012-控制台改版批片2.md ｜ 任务书=冻结版 V1.0（老板 10-12 签）｜ 片 1 复核通过（意见书在区，零新裁死件）｜ 基线=片 1 尖 `7a52a556`（codeload 钉 sha）｜ 分支 `feat/console-ia-2`（PR 只开不合，base=feat/console-ia-1）｜ 纪律=PM-1008+红区补丁+拟人化死规+视觉零改动纪律 ｜ 2026-10-12

## 一、片 2 交付面（刀 2 令围全量）

**控制台顶栏全局搜索（照 Shopify Cmd+K）**：
- 顶栏搜索钮（MainScaffold actions 槽，既有件）+ **Cmd+K（Mac）/Ctrl+K（Win）唤起弹层**（既有 Modal 族件，Esc 关=内建）；
- **搜词直达**五族面：端口件 15 卡 / copy 域端口键全量 / 参数域字典键（config.dictionary）/ 画布 46 屏（canvas.blocks 注册表屏名）/ 素材位（slotPort.list）——**前端内存索引**（读端口数据自动生成，首开懒建一次，零建库零搜索引擎）；
- **命中即跳**：端口件→该端口视图 / 端口键→文案端口该键行（CopyConfigBody 壳层加 `initialSearch` 预选+命中行滚动聚焦高亮环）/ 画布屏→画布端口该页签（CanvasPortBody 壳层加 `initialPageKey` 预选）/ 素材位→槽位端口 / 直达真页卡（会员营销）=跳真页；
- **无命中=人话空态+近义词 chips**（「没有找到「XX」相关的开关或页面 · 试试这些词（点一下就搜）」；近义词族小静态表写死：提成/回馈金/押金/会员/文案/画布/素材/支付/券/退款/门店/员工/预约）；
- 片 1 高级层目录保留作穷举面（不删，一行未动）。

## 二、闸门实证（全绿在案）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build | 绿 | build-gate.log |
| server typecheck | 绿（零输出） | 会话在案 |
| e2e 全量（98 族） | **三连绿**（98.1 十三键对账+98.2 索引四读口） | e2e-green-1.log / e2e-green-2.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0（零新路由=零申报） | nav.log / nav.json |
| smoke-routes | 109/109 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 🎉 | smoke-deploy.log |
| 实尺截图 | 全绿五帧+性能读数 | shots/ + checks.json + shots.log |

**性能实测读数**（令闸 <100ms）：索引 **4352 项 · 构建 0.7 ms · 首筛 2.9 ms**（帧 S5 页脚透出实证；首跑 98.2 红=config.list 全版本行计数口径（族间 config.save 增生行），改 active 去重面后三连绿——口径坑在案）。

## 三、实尺截图清单（shots/；栈=7131 商家 preview+7200 API+ia2-gate.db）

- S1-cmdk-open.png：**Ctrl+K 唤起弹层**（顶栏搜索钮+弹层+页脚性能读数）；
- S2-search-commission.png：**搜「提成」命中面**（端口卡「改提成」+文案键提成族在列）；
- S2b-jump-commission-port.png：**命中即跳**（点「改提成」→ 提成端口配置位渲染）；
- S3-search-rebate.png：**搜「回馈金」**（画布屏「回馈金账本」+文案键 rec./rebate 族在列）；
- S4-search-empty.png：**无命中空态**（人话句+近义词 chips）；
- S5-search-perf.png：**性能读数帧**（索引 4352 项 · 构建 0.7 ms · 首筛 2.9 ms）。

## 四、迁移申报（本片一件，幂等）

`server/drizzle/0076_console_search.sql`（journal idx 76）：copy_overrides 13 枚新键种子（cadm.search 搜索件键族；值/screen/position=生成件单源逐字）；全 NOT EXISTS 守卫；临时库实证 4184 键全落（4171+13）、重放零副作用（计数断言==13 在文件头）。台账新规照走=键入码必随迁移。

## 五、候裁明面（不暗建）

1. **参数键命中→参数字典口**（dict 域定位=端口级，键级深链=字典口自带服务端搜索，跳后手搜一步）——键级直达=下批留口候裁；
2. **搜索结果键盘导航**（↑↓+Enter）未做=点击直达口径（令围外增强，候裁）；
3. 片 1 候裁照挂：全域留痕统一审计读口（候立项）；支付批/画布批候裁件零触碰；
4. 索引=staleTime 300s 会话内复用（端口改键后 5 分钟内索引追平；要即时=刷新即拉新，候知会）。

## 六、红线自查

零新依赖 ｜ 迁移幂等+申报（0076 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合 ｜ 视觉零改动（弹层=既有 Modal 族件） ｜ 端口件内核零改动（壳层小改=CopyConfigBody initialSearch/CanvasPortBody initialPageKey 两枚可选注入参，内核逻辑一行未动）。
