# PD-92 · 员工端 AE-04＋日 pill 卷宗

状态：本窗施工与实证记录，非验收销项。PR 只开不合；未部署；未贴庆贲贴前未开工 HIT 例程。

- 基线：`main@73b5e82f005ee52fde5af54e48eb9aa2790a692e`／DEPLOY `20261024153113`
- 分支：`feat/pd92-staff-ae04-daypill`
- 范围：AE-04／AE-STAFF-R55-03；`DAY-PILL-NO-CONTRAST`／`DAY_PILL_CROP_MISS`／AE-STAFF-R55-02
- 产品 diff：6 个员工端文件，42 insertions／13 deletions；另有本回归测试、证据脚本与本卷宗
- schema：零；**0133 故意空留**；未占 `0117／0119／0122–0132／0134`

## 根因与现网事实

### AE-04

`useUnreadTotal` 在查询未返回或失败时以 `q.data?.total ?? 0` 把未知折叠成真 0；通知页未向员工提供手动重取出口。SPA 场景中，TanStack Query 还会在后台重取失败时保留旧 data，因此仅用 `data !== undefined` 也会继续把过期数字当当前值。

本窗改为同一 `['push','unreadCount']` 查询下以 `isSuccess` 判定可用值：普通后台刷新保留旧值，失败则显示「未读暂不可用」并开放「重新对齐」；失败时不开放「全部已读」或沿用过期封顶说明。未返回显示同步态，真 0 仍显示真 0。

现网基线本次只读走查的稳定帧为 **17＝17**，不是旧报告的 15≠0；不宣称复现了旧的瞬时画面。基线帧：`shots-live-baseline/me-17.png`、`shots-live-baseline/notifications-17.png`。

### 日 pill

基线 `/schedule` 已有深填，未宣称复现「无深填」。现有选中态只依赖颜色／类名，缺少非颜色选中标记；旧专裁还存在漏切本体的证据链问题。本窗仅对 `/schedule` 三个日按钮加入 `aria-hidden` 选中勾和 2px 选中描边，其他 chips 默认不变，周 pill／PD-90 未重开。

现网基线专裁使用原图像素坐标，帧内包含 pill 本体：`shots-live-baseline/day-today-pills.png`、`shots-live-baseline/day-tomorrow-pills.png`。

## 验证记录

| 项目 | 结果 |
|---|---|
| `npm run build` | exit 0；客户／商家／员工三端构建均完成 |
| 员工 SSR 测试 `pd92StaffAe04DayPill.tsx` | 先出现预期 RED，再转绿；覆盖未返回、冷错误、缓存 0／15／192 重取失败、真 0／15、读屏状态、勾标及其他 chips 不变 |
| 既有 `pd76Badge.tsx`、`pd72Notifications.tsx` | 均 exit 0；SSR 框架继续输出既有 useLayoutEffect 警告 |
| CDP 真页面／真鼠标／像素闸 | **31 项 ok，failures=0**；今天→明天→今天；Me→通知真实 SPA；零业务 mutation |
| 变更文件 ESLint＋脚本 `node --check` | 0 error；仅 `SchedulePage.tsx:237` 既有 warning |
| 全量员工 lint | 与基线相同：25 errors／1 warning；非本窗新增 |
| `npm --prefix server run typecheck` | 与基线相同：`server/src/db/pd66EvidenceFixture.ts` 12 个 TS1375；非本窗新增 |
| 独立代码复审 | 首轮 Important＝缓存重取失败；补齐后复审无 Critical／Important／Minor 遗留 |
| `smoke-routes` | 静态 preview 无同源 API，`dev-seed-users` 500 导致守卫性失败；已停止并清理，**无有效产品结论** |
| `smoke-deploy`／真实后端导航例程／HIT 例程 | 本窗未启动，避免业务写及越过 HIT 禁令 |

## 日 pill 专裁双证

最新新鲜 run：`fixed-1792840448520`，对应报告 `browser-report-fixed-1792840448520.json`。

- 整带含三颗 pill 本体：
  - `shots/fixed-1792840448520/01-today-pills.png`
  - `shots/fixed-1792840448520/02-tomorrow-pills.png`
  - `shots/fixed-1792840448520/03-return-today-pills.png`
- 同一 today 目标内样本：
  - 选中：`shots/fixed-1792840448520/01-today-sample-today.png`
  - 未选中：`shots/fixed-1792840448520/02-tomorrow-sample-today.png`
  - meanAbs `136.3914310515873`，changedPixels `7615`
- 同一 tomorrow 目标内样本：
  - 选中：`shots/fixed-1792840448520/02-tomorrow-sample-tomorrow.png`
  - 未选中：`shots/fixed-1792840448520/01-today-sample-tomorrow.png`
  - meanAbs `134.7158668154762`，changedPixels `7618`
- 两组均显式断言选中 `2px`／未选 `1px`，并有填色差；不是日期正文差或标题 REUSE。点回今天的日期和选中态均恢复。

## AE-04 对齐自救证据

同一报告内 `ae04.markAllClicked=false`，各阶段 `mockMutations=[]`。

- 「我的」与 dock 同源 15：`shots/fixed-1792840448520/04-ae04-me-before.png`
- 缓存正数在真实 SPA 中重取失败：不沿用旧 15，显示「未读暂不可用」＋「重新对齐」：`shots/fixed-1792840448520/05-ae04-unavailable.png`
- 只重取 `push.unreadCount`，请求计数 3→4，恢复「未读 15 条」：`shots/fixed-1792840448520/06-ae04-realaligned.png`
- 自救后「我的」行／dock／通知头三处对齐 15：`shots/fixed-1792840448520/07-ae04-me-after.png`

全程未点「全部已读」，未用列表正文差充当计数修复证据。

## bundle 与 HIT 边界

`bundle-compare.json` 是实读现网对照包与本地新包后的 SHA-256 比较：

| 项 | 文件名 | SHA-256 |
|---|---|---|
| 现网基线员工包 | `index-CWgjxsIP.js` | `fc28298402560c4afab649c8a9af2b7df8da880f4fd7b7badc28aaa149ae996b` |
| 本窗构建候选包 | `index-sVI36xOB.js` | `1733f2727938103377047d835181f6aa93abee3f83299caeffd9f8eeb940d76e` |

文件名与内容均不同。现网 `main` 仍只读核对为完整基线 `73b5e82f005ee52fde5af54e48eb9aa2790a692e`；**本窗候选包不是现网包**。

| 原缺陷／HIT 项 | 证据 | 状态 |
|---|---|---|
| 现网员工 js | `bundle-compare.json`；现网仍 `index-CWgjxsIP.js` | 基线已核；合后现网包待验 |
| 合后 js 必须异于 CWgjxsIP | 候选 `index-sVI36xOB.js`，名称与 SHA-256 均不同 | 候选已证；合后现网待验 |
| AE-04 对齐自救 | 上述 04–07 帧＋31 项报告；无业务写 | 本窗实证；合后现网待验 |
| 日 pill 像素双证＋专裁含本体 | 上述三态整带＋同 pill 目标样本 | 本窗实证；合后现网待验 |
| 禁正文差／标题 REUSE／加载壳 | 新鲜 runId；真实 dist；同 pill 目标内差分；页面加载完成断言 | 已守；不拿 mock 当现网 HIT |
| 禁「全部已读」当修证 | `markAllClicked=false`＋`mockMutations=[]` | 已守 |
| 合部同源 tip 现网 HIT | 本令只开不合、未部署、未贴庆贲贴 | **未开工，待后续授权** |

## 更深不更大

小美在压力下对照「我的」与通知怕漏读，切今天／明天怕看错天漏班；拦＝N/A（导航／读态对齐）；撤＝可再点回今天。未读可解释并可重新对齐，不靠「全部已读」；日 pill 以填色、描边、勾标和含本体专裁共同辨认，不靠正文差。

未直改库、未碰夹具 `01M5EQVF`、未跨店造种、未查 USAGE、未扩商家端、未重开周 pill／寄养／退出／协议已盖面。
