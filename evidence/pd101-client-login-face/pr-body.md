# PD-101 客端根与 /login 正式产品登录脸

缺陷码：`LOGIN-FACE-DEV-SHELL`。

## 根因与改动

未登录客根与 `/login` 原均落 `/dev-login`，主脸展示访问口令、演示账号和账号 ID 卡。根因是 `RequireAuth` 固定跳转内测路由，且客户端没有 `/login` 产品路由。

- 新增独立 `LoginPage`，沿用现有品牌视觉和手机号登录／注册能力；主脸只有手机号表单与协议链接。
- `App` 新增 `/login` 产品路由；`/dev-login` 内测路由原样保留，两类登录页均不显示 dock／安装条。
- 未登录守卫与设置页登出统一跳转 `/login`。
- 迁移 **0142 故意空留**：零 schema、未占文件。

## 新鲜验证

- 客户端既有＋新增单测：**27/27，fail=0**。
- 触及文件 ESLint：**0 error／0 warning**。
- `npm run build`：customer／merchant／staff 均 exit 0。
- `git diff --check`：exit 0。
- 全量客户 lint：既有 **65 errors／4 warnings**（与 PD-109 基线同数），`INC-PREEXISTING-LINT`；未扩修非范围文件，未宣称全量 lint 绿。
- 关闭前受控破红：临时把 `/login` 指回 `/dev-login`，新增路由测试按预期失败；已还原并复跑最终验证。

## 候选可见证据（非现网）

候选客包：`index-DYordG4O.js`（≠`index-DmV9kubu.js`），SHA-256 `2b29b3051f22b4d226da400245d9446877bdf460c32e288c41542631d45d58c3`。

- 客根未登录最终到 `/login`，不是 `/dev-login`。
- `/login` 直访保持产品手机号脸。
- 主脸无「需要访问口令」「选择演示账号登录」「账号 ID 登录」。
- 合成手机号提交只到本地 mock，405 阻断且错误可见；零上游请求、零业务写、零真支付。
- 证据：`evidence/pd101-client-login-face/`（`validation.json`、README、两帧截图、测试与预览辅助脚本）。

候选**非 tip 包、未部署**；localhost 未冒充现网或交付 HIT PASS。本 PR 只开不合，候交付 HIT＋头子派 PR Verifier＋码质审／loop-code-review 异窗。合部另须 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全及同轮 DEPLOY／HEALTH×4。

未做审美换皮，未并 UNREAD，未扩员整端、商 `/dev-login`、相册、底栏、商城、售卡、关单等；未抢 PD-106，未动 PD-108／110，未碰 `01M5EQVF`。

## 补刀 R2｜码质 BLOCK×2

- 新增 `copy/login.ts`：正式脸主文案全部走 `login.*`，不再误挂 `devlogin.*`，无硬编码主文案。
- 新增单份 `LoginBrandShell`：`LoginPage`／`DevLoginPage` 通过 children 组合共用品牌头与协议脚，重复 JSX 已移除；dev 专属文案仍走 `devlogin.*`。
- 新增两条源码回归测试，初始 RED→抽离后 GREEN；补刀受控误挂再次变红并已还原。
- 最终单测 **29/29，fail=0**；定向 lint **0 error／1 条既有 warning**；全量 lint 仍既有 65／4；三端构建 exit 0。
- NEW 候选客包 **`index-Co6KPtYM.js`**（双≠`DYordG4O`／`DmV9kubu`），SHA-256 `dd756309c37978020b10e20c0808b75a8db0b0d15fa3451ab8258243cdf6a836`。
- 客根与 `/login` 仍不落 `/dev-login`，主脸仍非口令／演示卡；`/dev-login` 共壳后原有内测内容保留。
- R1／R2 正式脸关键帧逐字节一致，未发生视觉偏移。证据追加于 `r2-validation.json` 与 `shots/r2-*.png`，旧功能证据保留。

候选仍非 tip 包、未部署；PR 只开不合，候码质复审与 PR Verifier 异窗续审。

— 不写验收通过
