# PD-59 · B-7201／B-7202 盲测意见（两项）

- 日期：2026-10-21
- Worktree：`E:\KIMI code\pd59-b720-opinion`
- 分支：`feat/pd59-b720-opinion`
- 基线：main@`43ce81c3d01b894efd8762766dc6999c60c309fb`
- 令包：`大测-产品-1021-下批令包字段-PD59-b720-opinion-43ce81c.md`
- 范围：仅首页单一主操作与商家待办「去处理」点按靶；未改密度、图表、素材、接口或 drizzle／`_journal.json`，未使用迁移号。

## 根因与最小修改

1. **B-7201**：`HomePage.tsx` 的进行中状态卡「到店领」与 hero CTA 同为实底主按钮。
   - `apps/customer/src/pages/HomePage.tsx:184`：同一个 `inServiceAppt` 同时控制状态卡渲染和 hero 次级类。
   - `apps/customer/src/styles/home-v2.css:41`：有进行中预约时 hero 改为透明描边；状态卡既有主按钮不变。无进行中预约时 hero 保持主操作，三个服务入口保持白卡次级样式。
2. **B-7202**：`.wsk-alert .go` 原为 `padding:0` 的下划线文字链，实测高 18px。
   - `apps/merchant/src/styles/console.css:59-63`：仅待办动作增加 `min-block-size:44px`、描边按钮样式并移除下划线；晨报等其他 `.wsk-go` 不变。

## RED → GREEN

实测脚本：`scripts/pd59-b720-opinion-check.mjs`，390×844 Edge CDP，真实登录、真实 API、专用 SQLite 夹具；直接读取 computed style 与 `getBoundingClientRect()`。

| 检查 | RED（修改前） | GREEN（最终） |
|---|---|---|
| B-7202 | 「去处理」18px／underline | **44px／none／独立描边按钮** |
| B-7201·无进行中预约 | `primary=home-banner-cta` | 同左，且三个服务入口 `serviceSecondary=true` |
| B-7201·有进行中预约 | `primary=home-banner-cta,home-service-pickup` | **仅 `home-service-pickup`**，hero 透明，三个服务入口次级 |

- 红灯：`red-results.json`、`red-home-idle.png`、`red-home-service.png`、`red-merchant-todo.png`。
- 最终：`final-results.json`、`final-home-idle.png`、`final-home-service.png`、`final-merchant-todo.png`。
- 接口读证：`api-check.json`（健康检查、`listMine` 的 `in_service` 夹具、商家统计字段）。
- 清理读证：`fixture-cleanup.json`，脚本结束后 `appointmentRows=0`、`stepRows=0`。

## 验证记录

| 命令／检查 | 最新结果 |
|---|---|
| `npm run build` | 三端构建 exit 0；仅有既有打包体积／注释警告 |
| `npm --prefix server run typecheck` | exit 0 |
| `npm exec -w @philia/customer -- eslint src/pages/HomePage.tsx` | exit 0 |
| B7 四组既有 Node 测试 | 27/27 |
| `apps/merchant/src/components/dashboard/utils.test.ts` | 1/1 |
| `node --check scripts/pd59-b720-opinion-check.mjs` + `git diff --check` | exit 0 |
| PD-59 RED | 1/3；两项预期失败均复现 |
| PD-59 最终实测 | **3/3** |
| `scripts/smoke-routes.mjs` | **113/119**；商家端与员工端通过，6 项客户端锚点失败见 `smoke-routes.json` |
| `scripts/check-nav-closure.mjs` | 127 路由；126 通过／豁免口径，`/me/card` 1 项死胡同，弱 0、豁免 6，见 `nav-closure.json` |
| `scripts/e2e-nav-check.mjs` | 8 项失败：预约成功页 6 项、宠物选择弹层 2 项；其余真实造单、取消单筛选返回及底栏标签检查通过 |

### 非本令失败与环境说明

- `smoke-routes` 的 6 项客户端失败为 `/booking`、`/booking/grooming`（含尾斜线）、`/booking/success?aid=…`（含尾斜线）、`/me/card`；与仓库 `evidence/pd56-kpi-align/README.md` 已记录的 6 项客户端既有锚点失败相同。本次未改这些页面，不扩修。
- 点击导航 8 项失败位于预约成功页与宠物选择流程，本次未改其代码或路由；如实保留，不写成全绿。
- 首次员工端检查受本地 API 旧子进程 CORS 影响；清理该 PD-59 遗留监听后，员工端路由与导航全部通过。最终 `113/119` 与导航 1 项失败均不含该环境问题。
- Desktop 内置浏览器打开本地页时页面进程异常；已关闭其后台页。上表浏览器数据与截图由仓库既有 Edge CDP 方式实测，未抢前台。

## 审查与状态

独立代码审查：Critical 0、Important 0；审查提出的服务入口次级断言与夹具自动清理已补入并最终复跑。

状态：待 PR 审阅；不声明整体验收结论。
