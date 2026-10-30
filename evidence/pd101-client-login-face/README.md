# PD-101 客登录脸卷宗

缺陷码：`LOGIN-FACE-DEV-SHELL`。基线为 `86b614fd6ccacda5c1a83b639bde7dab422bcb2b`／DEPLOY `20261030143547`／客包 `index-DmV9kubu.js`；迁移 **0142 故意空留**，零 schema、未占文件。

## 根因与最小产品改动

- 未登录现网客根与 `/login` 均最终到 `/dev-login`，主脸含访问口令、演示账号与账号 ID 卡。
- `RequireAuth.tsx` 原先把所有未登录请求固定送到 `/dev-login`，且 `App.tsx` 没有 `/login` 产品路由。
- 新增 `LoginPage.tsx`：沿用现有品牌登录视觉与手机号登录／注册能力，主流程只有手机号输入，不渲染口令、演示账号或账号 ID 卡。
- `App.tsx` 接入 `/login`，登录页不显示 dock／安装条；`RequireAuth.tsx` 与设置页登出统一收口到 `/login`。`/dev-login` 内测页原样保留。

## 证据索引

| 项 | 结果 |
|---|---|
| 基线单测 | 26/26，fail=0 |
| 初始 RED | 真实 `App` 在 `/login` 输出空 main，缺少 `product-login-form` |
| 最终单测 | **27/27，fail=0** |
| 触及文件 lint | **0 error／0 warning** |
| 全量客户 lint | 既有 **65 errors／4 warnings**，与 PD-109 基线同数；`INC-PREEXISTING-LINT`，未宣称全量 lint 绿 |
| 三端根构建 | `npm run build` exit 0 |
| 候选客包 | `index-DYordG4O.js`；1429569 bytes；SHA-256 `2b29b3051f22b4d226da400245d9446877bdf460c32e288c41542631d45d58c3` |
| 客根 | 最终 URL `/login`；最终 DOM 快照 `text-41229027-40ee-4e07-b284-4d2f7202cf85` |
| `/login` | 最终 URL `/login`；最终 DOM 快照 `text-ae59fec3-f91f-4423-bb0b-1bf2c669223c` |
| 主脸 | 手机号登录／注册＋手机号输入＋协议链接；口令／演示账号／账号 ID 卡计数 0 |
| 表单 mock | 合成手机号 `19900000000`；POST 被本地 mock 以 405 阻断；错误可见；零上游流量 |
| 关闭前破红 | 临时把 `/login` 指回 `/dev-login`，测试按预期失败；随即还原并复跑 27/27 与三端构建 |

候选关键帧：`shots/root.png` 与 `shots/login.png` 为分别采集的两帧；客根重定向后与直访 `/login` 的最终 UI 相同，故 SHA-256 同为 `70a3ca351247fa17fa46d98edf19127e746b8650c1a251de6860639291111afa`，不是复制帧。

`validation.json` 保存命令、退出码、dist、浏览器与清理机械值。`test-setup.mjs` 只为 Node 路由测试忽略 CSS；`preview.mjs` 只服务候选 dist、mock 未登录并阻断 API／上游流量。

## 边界

候选为本地构建，**非 tip 包、未部署**；localhost 只作候选辅助证据，不冒充现网或交付 HIT PASS。未做审美换皮，未并 UNREAD，未扩员整端、商 `/dev-login`、相册、底栏、商城、售卡、关单、驾舱、监控、YKNXD2、发货；未抢 PD-106，未动 PD-108／110，未重冻 105／109／111／112。零真支付、零业务写、未碰 `01M5EQVF`、未造第二店。

依赖环境：Windows 根 `npm ci` 的嵌套 `postinstall` 三次均在子进程找不到 `node`；按仓内 PD-109／PD-112 已记录等价流程，以根 `npm ci --ignore-scripts`＋`npm --prefix server ci --ignore-scripts` 安装同一 lockfile（688＋110 packages），未改脚本或 lockfile。

预览服务已停止、浏览器页已关闭、临时浏览器配置已删除；现网测试只执行产品登出，未保存新会话。

## 补刀 R2｜码质 BLOCK×2

- BLOCK①：新增 `copy/login.ts`，正式脸所有主文案走独立 `login.*`；`LoginPage.tsx` 已无 `devlogin.*`、无中文硬编码主文案。
- BLOCK②：新增单份 `components/login/LoginBrandShell.tsx`，`LoginPage` 与 `DevLoginPage` 均通过 children 组合共用品牌头与协议脚；两页重复 header／footer 已移除。
- 新增 `loginQuality.test.ts` 分别取得两条初始 RED，抽壳／抽 copy 后 2/2 转绿；补刀受控误挂 `devlogin` 时 BLOCK① 再次按预期变红，已还原。
- 最终客户端单测 **29/29，fail=0**；定向 lint **0 error／1 条既有 warning**；全量 lint 仍既有 **65 errors／4 warnings**；三端根构建 exit 0。
- NEW 候选客包 **`index-Co6KPtYM.js`**，双≠`index-DYordG4O.js`／`index-DmV9kubu.js`；bytes=1428390，SHA-256=`dd756309c37978020b10e20c0808b75a8db0b0d15fa3451ab8258243cdf6a836`。
- 客根与 `/login` 仍到产品脸；DOM 快照分别为 `text-9a0acd76-53af-4da1-88ce-63c93cf031ed`／`text-e8a4933a-dc3d-41e8-9531-dd5224724063`。`/dev-login` 共壳后仍保留内测内容，快照 `text-a08bca5f-415f-4449-84fd-4ad0050b6df3`。
- `shots/r2-root.png`／`r2-login.png` 与首轮正式脸帧逐字节一致，`pixelBytesEqual=true`，未做视觉偏移；`r2-dev-login.png` 另证内测页内容保留。
- 机械明细见 `r2-validation.json`；首轮 `validation.json` 与功能证据原样保留，未以 REUSE 冒充 NEW dist。

— 不写验收通过
