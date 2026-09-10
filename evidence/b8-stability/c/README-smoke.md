# smoke-routes.mjs 使用说明（批次 8 · 任务 C 固定闸门）

## 跑法（本地三端 preview）
```bash
# 1. 起后端（dev-login 取种子用户用）与三端 preview
npm.cmd --prefix server run dev                                   # :7200
npm.cmd --prefix apps/customer run preview -- --port 7100         # :7100
npm.cmd --prefix apps/merchant run preview -- --port 7101         # :7101
npm.cmd --prefix apps/staff    run preview -- --port 7102         # :7102
# 2. 跑冒烟（仓库根目录）
node scripts/smoke-routes.mjs
```

## 参数（全环境变量）
| 变量 | 默认 | 说明 |
|---|---|---|
| CUSTOMER_URL / MERCHANT_URL / STAFF_URL | http://localhost:7100 / 7101 / 7102 | 三端产物 base（单容器同源部署时三者同指一个 base） |
| API_BASE | http://localhost:7200 | 后端 base（dev-seed-users + dev-login） |
| SMOKE_LOGIN | 1 | 0 = 跳过登录，全量走守卫跳转身口径 |
| CDP_PORT | 9223 | Edge headless 调试端口 |
| SMOKE_TIMEOUT_MS | 9000 | 每路由渲染等待上限（白屏路由给足整段窗口） |
| SMOKE_JSON | （空） | 设置时结果 JSON 写该路径 |
| SMOKE_APPT_ID | 01M256D240E19GWNG2QMFV3Q8V | serverDep 路由用预约单 |

## 判定口径
- 文档 HTTP 200 + #root 非空 + 关键锚点文本存在（路由表 anchors 任一命中）；
- console 红线（Edge CDP Log/Runtime）：同源 js/css/文档 `Failed to load resource` /
  `MIME type` / `Unexpected token '<'` 任一即失败；API（/trpc·/api）错误不计入静态产物红线；
- serverDep 路由允许以「非白屏 + 守卫跳 /dev-login」兜底；
- 退出码：0 全绿 / 1 有失败 / 2 环境不可用。

## 批次 8 基线（base './' 未修前）：14/28 绿，exit 1
- 绿：三端首页、登录页、全部顶层路由（含 B2 修复的 /monitor、/live —— 产物级已复通）；
- 红：全部嵌套（两段及以上）路由——base './' 使 ./assets 解析到路由前缀下 404/MIME
  错配（任务 A 待修）；B1/B3/B4 页面产物级直开同红，交互逻辑已在 dev server 层自验，
  A 修复后由主 agent 复跑本脚本至全绿。
