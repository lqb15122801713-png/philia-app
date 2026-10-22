# PD-82 · 客户端抽奖真转盘＋granted×2＋消息入口＋登录协议

- 基线：main@8ec880e（8ec880ee425f9ea3beaf79a391bd6d0001bec55b）／DEPLOY 20261022202611
- 分支：feat/pd82-client-lottery-msg-agreement ｜ 树：E:\KIMI code\pd82-client-lottery-msg-agreement
- 依据：D:\Philia-shared\下批分拣池-产品-1022-基线8ec880e.md ＋ 连续测分拣桶-产品-1022-fd99fb9.md 客户端条目（只读进池用非验收）＋ 已冻粘贴令（权威只认本包 PD-82）
- **迁移号声明：0123 预分；本窗零 schema 变更、不占迁移文件——「0123 故意空留」；未撞 0114–0120；0117／0119 空留未动**

## 令围（只做这些，开挂不扩）

1. 抽奖入口：硬链 /member → 真转盘页（可交互；奖品 mock）
2. granted×2：去重复展示
3. 消息主入口：missing=true→false（补可达入口）
4. 登录协议可点（R17 回归）：协议链接真页可打开
5. 待换＝只换素材——**不在本窗**（首页/商城占位图原样保留）

## 口径决策（施工注记）

- **转盘页 `/member/lottery`**：前端纯件（本批无服务端抽奖台账/发放链）。SVG 八格轮盘（奖品文案全走 `copy/lottery.ts` 键表，端口可改）＋顶针＋主钮三态（开始/抽奖中/再抽一次）＋CSS 旋转 5 圈落定（transitionend 为准＋兜底定时器＋spinId 闸挡连点竞态）＋结果区三态文案（中奖/再来一次/未中）＋奖池明面＋规则＋**mock 诚实注记**。PushBar 返回条＝导航闭环四要素；详情级无 dock。首页活动卡换链 `/member`→`/member/lottery`（HomePage 原硬链位，最小 1 行 diff）。
- **granted×2 去重**：`perk.myUnused` 服务端只回 `status='granted'` 行，原 UI 逐行裸显同一英文 status 徽标＝每行都印一个「granted」（多行即 granted×N 重复噪音）。修为**仅「已用完」差异态出徽标**（usedUp 分支保留），常数徽标摘除；资格留痕（发放时刻行）原样。server 零改动。
- **消息主入口**：补缺批片 5 原设计回补（copy/notify.ts 表头本载「HomePage 铃铛 aria / MePage 消息行」，U 系改版时两处入口被摘）：①首页 banner 右上铃铛（门店 chip 正下，避 preview 角标左上位）→/notifications，未读角标=`push.unreadCount` 30s 轮询（queryKey 与 /me 共享缓存，>99 显 99+）；②/me 列表首行「消息 ›」（me.entries 块首行，testId=me-notify-entry）。
- **登录协议可点（R17 回归）**：`/dev-login` 页脚「登录即同意《用户协议》与《隐私政策》」原为纯文本不可点。修为协议名真链 → 新增**公开别名路由 `/agreements`**（守卫外，登录前可读；页内仅 publicProcedure：canvas.blocks/store.listNearby，零鉴权面扩张）＋ AgreementsPage 支持 `?doc=user|privacy|member_service|boarding` 直开对应全文弹层。原 `/settings/agreements`（守卫内）不动。/agreements 抑制 PWA 安装条（公共页不抢热区）。
- 文案纪律：新增键全部入 copy 表（lottery 15 键／devlogin 拆 4 键替 footerA），CK 锚点照挂；`footerA` 键随拆分退役（端口若有同名 override 自然失效，无迁移）。

## diff 清单（最小 diff：10 改＋2 新）

| 文件 | 变更 |
|---|---|
| apps/customer/src/pages/LotteryPage.tsx（新） | 真转盘页（SVG 八格＋旋转落定＋结果区＋规则/mock 注记） |
| apps/customer/src/copy/lottery.ts（新） | lty.* 15 键（页题/八格奖/主钮三态/结果三态/规则/mock 注记） |
| apps/customer/src/App.tsx | 路由 +`/member/lottery`（守卫内）＋`/agreements`（守卫外公开）；/agreements 抑制安装条 |
| apps/customer/src/pages/HomePage.tsx | 活动卡换链 /member→/member/lottery；铃铛入口＋未读角标（push.unreadCount） |
| apps/customer/src/styles/home-v2.css | .hv2-notify-bell/.hv2-notify-badge 两件 |
| apps/customer/src/pages/MePage.tsx | me.entries 块首行加「消息 ›」→/notifications |
| apps/customer/src/pages/MemberCenterPage.tsx | granted 常数徽标摘除（仅 usedUp 出徽标） |
| apps/customer/src/pages/DevLoginPage.tsx | 页脚协议名改真链 ×2（Link→/agreements?doc=…） |
| apps/customer/src/copy/devlogin.ts | footerA 拆为 footerAgree/footerUser/footerAnd/footerPrivacy |
| apps/customer/src/pages/AgreementsPage.tsx | ?doc= 直开对应协议全文（lazy init） |
| scripts/check-nav-closure.mjs | 申报 +2 行（/member/lottery、/agreements） |
| scripts/smoke-routes.mjs | 申报 +2 行（同上，锚点=页题） |

server/**：零改动**（零 schema、零接口；0123 故意空留）。商家端/员工端 app：零改动。

## RED → GREEN

- RED（基线实证）：首页「回馈抽奖」卡 href=/member（会员中心无转盘）；会员中心未用权益每行重复「granted」英文徽标；首页/我的无任何 →/notifications 入口（copy 表头承诺的铃铛/消息行缺席）；登录页协议名纯文本不可点。
- GREEN（本窗实证，截图见 shots/）：
  - 01 首页铃铛＋未读角标 2 上屏；02 转盘页八格轮盘＋开始抽奖；03 奖池明面＋规则＋mock 注记；04 落定「谢谢参与」正顶指针＋结果卡＋再抽一次（转盘实转，对比 02 格位已旋转）；
  - 05 消息中心真列表（两条登录提醒＝角标 2 同源）；09 /me 列表首行「消息 ›」；点行 → /member/lottery 与 /notifications 均实跳（URL 实证）；
  - 06 新注册账号（19900000782，D-16 自助开户真链路）未用权益「新人礼包 发放 22:26」**无 granted 徽标**；
  - 07 页脚《隐私政策》点击 → /agreements?doc=privacy 真页＋全文弹层；08 页脚双链下划线实拍；?doc=user 直开《用户协议》全文（DOM 文本实证）。

## 闸门

- 构建：`npm run build`（三端全量，VITE_API_BASE 注入本窗隔离口）✓；customer `tsc -b` 0 错（随 build 同跑）。
- `check-nav-closure.mjs`（129 路由）：本窗两新路由 ✅（back=true）；汇总 死胡同 1＝`/me/card`（**基线既有**：该页本窗零改动，git diff=0；非会员态渲染「关闭」件，四要素口径未覆盖——留痕不扩面）。
- `smoke-routes.mjs`：115 ✅ / 6 ❌；本窗两新路由 ✅。6 红＝/booking×1、/booking/grooming×2、/booking/success×2、/me/card×1（**基线既有锚点面**：相关页本窗零改动；/booking/grooming 实测渲染正常、页题为「预约」非旧锚「预约洗护」——锚点漂移属前批遗留，不扩面修）。
- eslint（触碰文件自查）：LotteryPage/copy/lottery/MePage/MemberCenterPage/AgreementsPage 零问题；DevLoginPage 129 未用 disable＋HomePage 128 Date.now 纯度＝**基线逐字同存**（HEAD 原文 116/129 行同文，行位偏移系本窗加行所致）。
- server 测试：本窗 server 零改动，未跑 e2e（无烟）。

## 实机自验（本窗隔离端口 server:7320＋customer:7310＋merchant:7311＋staff:7312，独立 dev 库；与他窗 7100–7102/7200 零共享）

- 走测正例（示例客户）：登录→首页铃铛（角标 2）→回馈抽奖卡→/member/lottery 转盘实转落定出结果→/me 消息行→/notifications 列表；新号自助开户→/member 未用权益无 granted 徽标；登出方向页脚两协议链→公开协议页真文。涉钱：本窗无钱域触碰（奖品 mock）。
- 环境注记：桌面面板 responsive 仿真截图有平铺伪影，走测后段改桌面窗实拍（不影响功能断言）；会话曾被闸门 seed 登录顶号弹回登录页一次（单用户单会话口径），重登后续测无碍。
- 测完自清：本窗 server/preview 进程全停；本地 dev 库（server/data）删除；node_modules/dist 保留在树内（.gitignore 内）。

## 截图清单（shots/）

01-home-bell（首页铃铛＋角标）· 02-lottery-wheel（转盘初始）· 03-lottery-pool-rules（奖池＋规则＋mock 注记）· 04-lottery-result（落定结果＋再抽一次）· 05-notifications（消息中心）· 06-member-grants（granted 徽标已摘）· 07-agreements-privacy（隐私政策全文弹层）· 08-devlogin-footer（页脚双真链）· 09-me-notify-entry（/me 消息行）
闸门机读件：nav-closure.log/json、smoke-routes.log/json（同目录）。
