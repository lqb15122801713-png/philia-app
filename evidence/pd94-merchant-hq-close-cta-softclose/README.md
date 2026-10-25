# PD-94 · 商家端总部台关店 CTA 真面＋软关最小触点

- 基线：`main@7a37c6c333aeeb7e8b4f160eed54f95d946e553d`
- 分支：`feat/pd94-merchant-hq-close-cta-softclose`
- 对照部署：`DEPLOY 20261025155014`；现网商家包 `index-Cy3GZDEr.js`
- 迁移：零 schema；**0135 故意空留**。未占 `0117／0119／0122–0134`，其中 `0133／0134` 已用禁撞。
- 边界：本卷宗是代码与本地候选证据，不是现网 HIT 或验收结论；PR 只开不合、不部署。

## 根因与最小产品改动

冻结页面对非 owner 直接返回 `RoleGuidePage`，同时 `store.listMine` 仅对 owner 启用。`merchant_manager` 走测时，真实总部台列表与关店 CTA 一并消失，形成 `HQ_CLOSE_CTA_NOT_SEEN`。现网静态包实读仍含 `/hq`、关店 CTA 和软关文案标记，因此不是简单漏构建或需重写 PD-70。

产品 diff 仅 3 个商家端文件，48 insertions／42 deletions：

- `apps/merchant/src/pages/HqConsolePage.tsx`：owner/manager 均可读真实门店；manager 可见并点击「关闭门店」、查看独立软关确认层并取消。manager 的知晓勾和最终确认禁用，clone/reopen 入口不露出；`doClose` 增加 owner 体验层守卫，服务端 owner 硬闸不动。owner 原开闸、勾选、确认和 cancel 路径保留。
- 同页保留并取证软关触点：默认排除 closed、勾选「含已关闭」回看同一保留店、历史记录不做物理删除。空态改按 `includeClosed` 选择文案，closed-only 时引导勾选，不再误写「名下暂无门店」。HQ 行仍无关闭钮。
- `apps/merchant/src/App.tsx`、`apps/merchant/src/lib/roles.ts`：只同步权限注释，无行为改动。

未改服务端 API、schema、员工端或客户端；未重做 PD-70 全量；未重开 PD-89／91／93；未扩驾舱、传感器、端口或外露簇。

## 更深不更大

- **谁在压力下点**：店主／总部怕误关店；店长需要看清软关后果但不应获得关店权。
- **拦**：真实门店行＋独立确认层＋owner 知晓勾；manager 最终确认禁用，服务端 `merchantOwnerProcedure` 不变。
- **撤**：manager 与 owner 各自真实鼠标开闸后 cancel，均 acted＋closed、dialog=0、零写调用。
- **不可逆边界**：不直改库、不点任何真实门店关店。另设的 owner 成功腿只改浏览器同源 mock 进程内存，进程结束即消失，不是真实关店。
- **软关最小面**：同一 closed 店默认列表不见；勾选后仍在并带「已关闭」徽标；确认层明示历史记录保留、非物理删。

## RED → GREEN 与运行证据

| 腿 | 结果 | 关键证据 |
|---|---|---|
| 冻结基线 manager | RED | `HQ_CLOSE_CTA_NOT_SEEN actual=false expected=true`；`baseline-manager-result.json`；`shots/baseline/manager/01-hq-surface.png` |
| 审查补钉 closed 空态 | RED→GREEN | 旧实际「名下暂无门店」，目标为引导查看已关闭店；`review-red-manager-closed-result.json`；最终同腿 11/11 |
| 最终 active manager | 17/17 | CTA 真面、独立层、owner-only 边界、cancel acted+closed；三类写调用均空；`after-manager-result.json` |
| 最终 active owner | 17/17 | 知晓勾启用但不提交，cancel acted+closed；三类写调用均空；`after-owner-result.json` |
| 最终 closed manager | 11/11 | 同一 closed 店默认不见，空态文案正确，勾选可回看；零写；`after-manager-closed-result.json` |
| 最终 owner mock-success | 19/19 | 仅内存 mock：closeStore 恰好一次、知晓参数 true、弹层关闭、默认列表刷新、单店保留；`after-owner-close-success-result.json` |
| Desktop 内置浏览器 | 候选观察 | active manager 开闸撤；closed manager 默认隐藏＋勾选回看；双腿仅同一 `pd94-mock-store`；`desktop-browser.json` |

所有最终 CDP 腿均直接读取商家 `dist`，由同源 HTTP 服务提供静态包和 mock tRPC；禁用 Service Worker 与缓存，使用真实鼠标事件。`mockOnly=true`、`hit=false`，不以 localhost 领取现网结论。

## 静态闸与独立审查

- `npm run build`：客户、商家、员工三端 exit 0；见 `build-all.log`。
- 商家既有测试：10/10，fail=0；见 `merchant-unit.log`。
- `App.tsx`／`roles.ts`／`HqConsolePage.tsx` 定向 ESLint：exit 0。
- 全量商家 lint：仍有基线同集的 47 errors／5 warnings，见 `merchant-lint.log`；本窗未借机整端清理，目标页面定向检查无 error。
- `git diff --check`：通过；零 schema／journal diff。
- 独立审查第一轮指出第二 mock 店与 owner 成功证据缺口；均已改为同一店状态腿并补纯内存成功腿。第二轮无 Critical／Important；Minor 空态与计数亦已收尾。

## Bundle 对照

| 包 | 文件名 | SHA-256 | 是否现网 tip 包 |
|---|---|---|---|
| 现网只读对照 | `index-Cy3GZDEr.js` | `ec6cb53a6797cb2f3cbe7efd1444e489b186e0e74d74260ab40a794d5605f715` | 是，`DEPLOY 20261025155014`；未绕口令、未写 |
| 本地冻结基线构建 | `index-wv31ao1w.js` | `59fb983bfae76a1a1decad0f6c740e62f2eb0d9a71cf8599fcd6db6b2bffa151` | 否，仅 RED 对照 |
| 本地最终候选 | `index-Bzkt2irq.js` | `3384bb31cc3c43c8c90d8e449fa0d0345ea77d7c32e46d6b06ccd176b8cd41a3` | 否；异于现网与基线，合部前候选 |

## HIT 状态表（不是现网验收）

| 原缺陷／门槛 | 当前证据 | 状态 |
|---|---|---|
| 总部台 CTA 真面未见 | 基线 RED vs 最终 manager/owner 真面帧与 DOM | 本地候选覆盖；现网待合部后核 |
| 开闸＋cancel 成对 | manager 与 owner 均 acted+closed、dialog=0、closeCalls=[] | 本地候选覆盖；现网待核 |
| 未真关到不可逆 | 两 cancel 腿零写；成功腿仅内存 mock；无数据库 | 本地边界成立；现网零写 |
| 软关最小触点 | 同一 closed 店默认隐藏＋勾选保留回看＋非物理删文案 | 本地候选覆盖；现网待核 |
| 新商家 js 异于 `Cy3GZDEr` | 候选 `index-Bzkt2irq.js`，名称与内容均不同 | 候选成立；合后现网新名待核 |
| 合部同源 tip 现网包／HIT | 本 PR 不合、不部署；未收到另行贴出的 HIT 例程 | **未启动，不以 localhost 冒充** |

## 文件索引与自清

- `hq-close-cta.mjs`：可重复候选探针；支持 active／closed／纯内存 close-success 三态。
- `baseline-manager-result.json`、`review-red-manager-closed-result.json`：两类 RED 证据。
- `after-*.json`、`desktop-browser.json`：最终候选结果。
- `shots/baseline/`、`shots/review-red/`、`shots/after/`：对应像素帧。
- `build-all.log`、`merchant-unit.log`、`merchant-lint.log`：静态闸实录。

未触夹具 `01M5EQVF`，无第二店、无跨店造种、无真实业务写。临时服务与浏览器已关闭，`.runtime` 已删除；未启动 smoke-deploy 或 HIT 例程。
