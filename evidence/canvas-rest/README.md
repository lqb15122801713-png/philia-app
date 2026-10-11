# 卷宗 · 画布全屏批 片 3（剩余 38 屏扫尾入册+随屏抽键 · 末片）· evidence/canvas-rest

> 令=开工令-产品-1011-画布全屏批片3.md ｜ 任务书=冻结版 V1.0（老板 10-10 批准）｜ 片 0/1/2 复核全过 ｜ 基线=片 2 尖 `625d33ef`（codeload 钉 sha）｜ 分支 `feat/canvas-rest`（PR 只开不合，base=feat/canvas-top5）｜ 纪律=PM-1008+红区补丁+拟人化死规照走 ｜ 2026-10-11

## 一、片 3 交付面（令围全量）

1. **剩余 38 屏入册**（43−5=38，客户端入册屏全量=46 屏含在跑三屏）：商城域 4（商品详情/购物袋/商品订单/退款售后）+预约服务域 10（我的预约/预约详情/洗护全程/证书×2/美容报告/工单×3/服务相册）+会员域 8（升级/换档/回馈金/会员码/优惠券/消费记录/消息/订阅管理）+账户域 16——**164 块**注册表种子落库，逐屏工艺同五屏（注册表块序+渲染器 map+useCanvasLayout+CanvasLayoutLoader+水印注记+CK 挂键；块内逻辑/查询/状态机/SSE/级联逐字零改动，data-testid 原值全保留）。
2. **抽键随屏**：38 屏写死文案抽键 **179 枚**（生成器单源重跑 3954→**4133**；数值类零抽键）；**台账新规照走=键入码必随迁移**（0074 全量 179 键入迁移，合部对账零缺口）。
3. **会员态屏套壳**：探针参+水印+店锚三件套随屏（店锚口径统一=?canvasStore= > readLastBooking 记忆 > listNearby 首店，零新增查询）。
4. **裁死件**：条件块「且」关系 / 共享键标注（三前缀徽） / 预览懒加载（选中屏才起 iframe=既有单 iframe 构造）/ **版本号键只读+提示行**（about.versionValue 只读徽，M4 帧实证）/ **协议正文长文位**（agr.docUser/docPrivacy/docBoarding 三件全文入键表，画布 >120 字自动 textarea，M4 帧实证）。
5. **带参路由预览**：`/mall/product/preview`、`/appointments/preview`（+`/live`）、`/philia/certs/preview`、`/philia/reports/preview`、`/support/preview`、`/invoices/preview`、`/philia/pets/preview/health`——preview 字面值+canvasPreview=1 时页面取本屏列表首条顶替（空则落原空态）。

## 二、闸门实证（全绿在案）

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build（根 `npm run build`） | 绿 | build-gate.log |
| server typecheck | 绿（零输出） | typecheck.log |
| e2e 全量（96 族） | **两绿采信**（实际四连绿：auto-2/3/4/5，992 ✓/跑） | e2e-green-1.log / e2e-green-2.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0（零新路由=零路由申报） | nav.log / nav.json |
| smoke-routes | 109/109 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 🎉 | smoke-deploy.log |
| 实尺截图 | 8 屏代表帧+46 屏机读探针过 | shots/ + shots/probe46.json + shots/checks.json |

e2e 96 族四断言：96.1 三十八屏注册表逐屏块数对账零差+216 块总账+46 屏 getLayout 全 200；96.2 appointments 两步流透出+族尾复原；96.3 179 新键全落库+长文位种子实证+码内默认同值抽查。
e2e 环境件在案：ECONNRESET 环境件早夭两跑（76/68 族边界随机点，红跑日志不入卷），净场后四连绿——与片 2 同族环境件，复跑即绿。

## 三、实尺截图清单（shots/；栈=7131 商家/7130 客户（VITE_API_BASE=7200 重建）+7200 API+rest-gate.db）

- **A 段=46 屏机读探针过**（全屏清单机读件）：逐屏画布侧块行渲染+预览 URL 推导（PATH_MAP 命中）+探针侧块流渲染——`probe46.json` 逐屏记录，46/46 全绿；
- **裁死件③两帧**：M4-about-readonly-version.png（版本号只读徽+提示行）/ M4-agreements-longtext.png（协议正文 textarea 长文框）；
- **B 段=8 屏代表帧**（预览出图 M1+点选反查 C2/M2+改文案即变 M3/C3）：商品详情 pdp / 我的预约 appointments / 洗护全程 apptLive（实时页壳控实证）/ 升级会员 memberUpgrade（up. 高危口令复核）/ 回馈金账本 rebate（w1. 高危口令复核）/ 品牌空间 philia（特别裁=只文案+显隐）/ 设置 settings / 协议中心 agreements。
- 记录页夹具（直库写，本条注明）：示例客户宠物 shotpet01+明日 confirmed 洗护单 shotappt01——带参屏预览顶替要有真记录（预约链路本身 e2e 已覆盖）；截图完毕栈面复原（文案改键全复原默认）。

## 四、迁移申报（本片一件，幂等）

`server/drizzle/0074_canvas_rest.sql`（journal idx 74）：block_registry 38 屏 164 块种子（块清单=六组施工回报机读段照抄，片 0 草案键逐字）+copy_overrides 179 键种子（值/screen/position=生成件单源逐字）；全 NOT EXISTS 守卫；临时库 migrate+seed 实证 216 块/4134 键全落、重放零副作用（计数断言==343 在文件头）。

## 五、候裁明面（不暗建）

1. **取消原因 chips 抽键=所见即所交**（施工员报备）：预约详情取消原因四枚 chips 抽键后，画布改词会随取消提交进 reason 文本；若要求提交恒为枚举原文，裁示后改回「写死提交+键仅控展示」。
2. **mallOrders.sheets 块慎隐**：二次确认弹层块被隐藏=confirm 点击直 mutation 无弹层（「且」关系裁死照走，运营侧慎隐藏注记建议入注册表 label 或端口提示——候裁）。
3. **共享件内文案无 CK 锚面**（EmptyState/ErrorState/BottomSheet/ConfirmDialog/PushBar/CardFace/StaffPickerFlat 等 prop 传文案）：键已全量如实入册（画布可改字），点选反查与预览即变以页内 CK 锚件为限；共享件加锚=下批留口（多组施工员同报）。
4. **AboutPage 一卡拆两块**（版本卡/协议入口行原同居一卡，按草案拆开，摘分隔线补卡距）+apptDetail 块序微调（store 块前提 actions）——DOM 级微调已双报备，默认序视觉零差。
5. **pdp 预览顶替复走补修**：原缓存读取冷启动恒落空（probe46 抓出），已换真查询件（listProducts 同端点 preview 态启用，页外零影响）——本片内闭环。
6. **带参记录屏预览=读当前会话人首单**（listMine 同源顶替）：店主画布 iframe 里 apptDetail/apptLive 等记录屏，若店主本人无预约则出「找不到记录」空态壳（探针侧客户会话有单即块流全出，B 段帧实证）；要「店主视角示例单」=需预览专用读口，候产品侧裁。
7. 片 2 候知会照挂：块壳两式（本片 38 屏统一「整段不渲染」式）/支付批候裁三件零触碰。

## 六、红线自查

零新依赖 ｜ 迁移幂等+申报（0074 一件） ｜ 键入码必随迁移（台账新规） ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证） ｜ PR 只开不合 ｜ 不入册 14 屏零触碰（wizard×2 不动）。
