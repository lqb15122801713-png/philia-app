# 卷宗 · 画布全屏批 片 2（高频五屏入册+抽键小批）· evidence/canvas-top5

> 令=开工令-产品-1010-画布全屏批片2.md ｜ 任务书=冻结版 V1.0（老板 10-10 批准）｜ 基线=片 1 尖 `28e9029f`（codeload 钉 sha）｜ 分支 `feat/canvas-top5`（PR 只开不合，base=feat/canvas-perks）｜ 纪律=PM-1008+红区补丁+拟人化死规照走 ｜ 2026-10-11

## 一、片 2 交付面（令围全量）

1. **高频五屏入册**：我的（me 6 块）/商城首页（mall 7 块）/预约洗护（bookingGrooming 8 块）/预约寄养（bookingBoarding 7 块）/开通会员（memberOpen 6 块）——区块草案照片 0 清单落；五屏全部画布化（注册表块序+渲染器 map+useCanvasLayout+CanvasLayoutLoader+水印注记+CK 挂键，块内逻辑/查询/级联/提交链路零改动，data-testid 原值全保留）。
2. **抽键小批并入**：五屏写死文案抽键 40 枚（me 23+mall 6+booking 洗护 7/寄养 3+j1 开通失败 1），种子生成器单源重跑（3954 键）+迁移落库；会员档/支付金额类数值零抽键（读端口口径不动）。
3. **会员态预览**：示例客户视图三件套随屏套壳（探针参+水印注记+店锚 canvasStore；开通页已是会员态面）。
4. **裁死件照办**：条件块×画布显隐=「且」关系（块壳两式如实标注，见 §五候知会②）；共享键跨屏标注=注册表 copyKeys 登记+画布「共享键·改一键动多屏」徽（rules./card./perk. 三前缀推导单源）。
5. **共享基建**：server PAGE_KEYS 扩枚举五屏（+未知页 400 明文闸）+shared CanvasPageKey 同步+预览 URL 五屏路径映射（画布端口八页签）。

## 二、闸门实证（全绿在案）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build（根 `npm run build`） | 绿 | build-gate.log（VITE_API_BASE=7200 闸门栈版；另跑通零参版） |
| server typecheck（tsc --noEmit） | 绿（零输出） | 会话在案 |
| e2e 全量（95 族，含新 95 族四断言） | **两绿**（EXIT=0 两连） | e2e-run1.log / e2e-run2.log（尾部「全链路验收全部通过 ✅」） |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0 · 豁免 6（零新路由=零申报） | nav.log / nav.json |
| smoke-routes | **109/109 通过** | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 🎉 | smoke-deploy.log |
| 实尺截图（五屏逐屏四动作） | 全绿 | shots/ + shots/checks.json + shots.log |

e2e 95 族新增断言：95.1 五屏注册表种子在库（6/7/8/7/6+sortOrder+copyKeys 抽查）+PAGE_KEYS 扩枚举（五屏 200/未知页 400）；95.2 me 屏两步流（重排+显隐透出/未知块 400/缺块 400）+族尾复原；95.3 抽键读口（40 枚新键 config.list 全落库+非高危键即改即读复原）。

## 三、实尺截图清单（shots/；栈=7131 商家/7130 客户 preview（VITE_API_BASE=7200 重建）+7200 API+gate.db）

逐屏四动作（令 §四）：
- **① 预览出图**：M1-<屏>-preview.png（画布端口页签=左块表+右 iframe 真页预览同帧）；
- **② 点选反查**：C2-<屏>-probe-pick.png（探针侧真点 CK 锚=postMessage 契约实证）+M2-<屏>-picked.png（画布侧块行高亮 ring-2+copy 输入聚焦）；
- **③ 改文案即变**：M3-<屏>-copysaved.png（保存即效+预览 patch）+C3-<屏>-copy-live.png（探针侧重载读口透出新值）；开通会员屏加帧 M3-memberOpen-risk-modal.png（j1. 高危族口令复核弹层=涉会员口径闸内建实证）；
- **④ 发布生效对照**：C4-<屏>-before-publish.png / C4-<屏>-after-publish.png（藏一块→两步流发布→重载即消失；随后复原再发一版，栈面零残值已实证）。
- M0-tabs-eight.png=画布端口八页签（原三屏+新五屏）全貌。

## 四、迁移申报（本片一件，幂等）

`server/drizzle/0073_canvas_top5.sql`（_journal.json idx 73 登记）：
- block_registry 五屏 34 块种子（copyKeys=各屏施工回报实查键照抄，CK 锚挂不上的组件内键如实列入——画布可改字，预览即变以 CK 锚件为限）；
- copy_overrides 新键 63 枚种子=本批抽键 40+**支付批漏件补种 23**（见 §五①）；全部 NOT EXISTS 守卫；临时库 migrate+seed 实证：34 块/63 键全落+重放零副作用（计数断言==97 在文件头）。

## 五、候裁明面（不暗建）

1. **支付批漏件补种（已顺带补种，候追认）**：支付批片 1-3 合 main 时 23 枚 copy 键入码未入迁移（cadm 通道端口 2/rec 记录透出 3/renew 续费线上化 16/state 支付状态 2）——种子生成器重跑 diff 扫出，照「增量行 diff 挪进下一号新迁移」军规（0063 先例）并车 0073 补种（值=生成件单源逐字）。若不认可并车，裁示后拆 0074 单走。
2. **块壳两式（候知会）**：块显隐的 DOM 工艺五屏分两式——me/mall=整段不渲染，grooming/boarding/memberOpen=空壳段（无样式 section，视觉零差异）；发布对照断言以「可见内容消失」为准两式通吃。要统一成一式=下批一句话的事。
3. **mos.deck/mo.rules 等共享组件内键（CardFace/RulesBlock/PerksWall 内部渲染）无页内 CK 锚**：键已如实登记 copyKeys（画布可改字），点选反查与预览即变以页内 CK 锚件为限（子组件抽锚=下批留口）。
4. 候裁明面三件（支付批登记照挂）：线上退会/旧链 mall.createPayment 退役/续费优惠 bp 口径差——本片零触碰。

## 六、红线自查

零新依赖 ｜ 迁移幂等+申报（0073 一件） ｜ LF 行尾 ｜ 注释零 `*/` 序列（本片踩坑在案：CanvasPortBody 两处注释内含终结序列已修） ｜ 闸门栈端口 7130-7132+7200（CORS_ORIGINS 显式三端） ｜ 收摊必净（taskkill+netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力（全量落件） ｜ PR 只开不合。
