# PR #16 验收证据卷宗（产品侧独立验收）

> 锚点：head_sha = `93430c96e56ed83ac63e772d6649565c58d941df`（feat/b5-brand）
> base = `816d6bc1cc248e80f65da89be3b5e66de581a08e`（main）
> 验收人：产品侧（本会话）· 验收性质：越权施工事件的独立验收（施工者不得自验）
> 日期：2026-09-09 · 全部结论均为 GitHub 远端实证，非自报

## A. 元数据（pull_request_read get + get_commits）
- PR #16 open · 54 文件 · +1872/−381 · 25 commits（18:29:59Z~22:23:18Z，2026-09-08）
- 标题：feat(b5): B阶段品牌换色（VI v1.1 token 转译 + dark 域开启 + 品牌资产接入）
- ⚠️ PR 正文过期：写于施工事故时刻，自称「清剿未推送」；最终 diff 证明 b5-3 清剿已推送。
  裁定：内容以远端 diff 为准，正文作废。

## B. 分支卫生（list_branches perPage=100）
- 已收口分支均已删：feat/b4-booking-redesign、fix/v1.1-batch1/2/3 ✓
- evidence 分支保留：evidence/b4-booking@0f2c620、evidence/v1.1-batch2、evidence/v1.1-batch3 ✓
- 新增：feat/b5-brand@93430c9（本批次施工分支）；patch-1（老板自有，无害）
- **evidence/b5-brand 不存在 → 证据卷宗缺失（闸门缺口）**

## C. 变更范围（get_files 54 文件全文 patch 逐行过完）
- 分布：apps/customer（40+ 组件/页面/index.html/index.css/vite.config/logo.svg）、
  apps/merchant + apps/staff（各 index.html/index.css/logo.svg）、
  packages/（tokens.ts、tailwind-preset.js、shared 组件×3）、docs/BRAND-TOKENS-v1.1.md
- 冻结项零触碰：server 零改动、零迁移、零 package.json/lock 变更、零 ULID 硬编码、
  会员/退款链路零触碰、商家端页面逻辑零改动
- 零新依赖；token 双文件变更属任务书授权范围 ✓

## D. 重点文件直读比对（get_file_contents 双 ref）
1. **TabBar.tsx**（误推占位事故文件）：分支版 vs main 版仅 3 行色值差
   （bg-[rgba(61,50,41,0.4)]→bg-ink/40、text-white→text-ink×2），其余逐字节一致。
   结论：事故在最终态完全愈合。
2. **tokens.ts**（命门）：分支版 = v1.1 终值全表 + darkColors + onPrimary + oak 族，
   导出完好（tokens 聚合含 darkColors、cssVars 含新增项）；
   与 docs/BRAND-TOKENS-v1.1.md、B5-0 冻结确认书逐项吻合：
   柠檬黄 #FDC830/深棕墨 #4A3B2E/薄荷绿 #7FD8BE/浅木 #D4B896/米白 #F6F1E3/
   苔绿保留/danger #D92D20 族/渐变 135° 黄→绿/hover #FDC012/pressed #E8AD02… 全对 ✓
3. 批次 4 文件群（GroomingSinglePage、BoardingSinglePage、single/ 组件群、向导双页）：
   仅色值级小 diff（text-white→text-ink、stroke 硬编码→currentColor、rgba 蒙层→bg-ink/α），
   无逻辑改动 ✓

## E. G3 珊瑚粉禁令（search_code 远端）
- `FFAAA5 repo:lqb15122801713-png/philia-app` → 0 命中 ✓
- `coral repo:lqb15122801713-png/philia-app` → 0 命中 ✓
- 备注：code search 不索引 01-vector 资产包 SVG（VI 历史原件，规则内豁免）；PR diff 全文亦无引入。

## F. 缺失项（证据层闸门缺口）
1. 无构建日志（三端 tsc/vite build + server typecheck 未实证——施工方自认未编译验证）
2. 无前后对照截图（G5 视觉回归证据）
3. 无 evidence/b5-brand 卷宗分支
4. merchant/staff 页面级硬编码残量未全仓 grep 定量
5. 字体 woff2（24 文件，三端 public/fonts/）与 PWA PNG icons 未入库
   （MCP 通道二进制损坏实证——探针 commit 18:29/18:30 佐证；须老板 web 上传）

## G. 施工方过程记录（老板提供的新会话操作日志佐证）

（详见原记录，不再复述）

## H. 构建实证（2026-09-09，本会话沙箱，全新 tarball=93430c9 亲证）

> 仓库临时 Public 窗口期拉取 api.github.com tarball，目录名后缀 `…-93430c9` 证明内容=PR 头。
> 环境：node v20.20.2 / npm 11.19.0。全新 install：root 685 包 + server 独立 install。

| 验证项 | 命令 | 结果 |
|---|---|---|
| customer 构建 | `tsc -b && vite build` | ✅ EXIT 0（2320 模块，PWA SW 生成，12.16s） |
| merchant 构建 | 同上 | ✅ EXIT 0（10.07s） |
| staff 构建 | 同上 | ✅ EXIT 0（10.45s） |
| server 类型检查 | `tsc --noEmit` | ✅ EXIT 0 |

日志原件：/mnt/agents/output/pr16-assets/build-{customer,merchant,staff}.log + typecheck-server.log

## I. G2 残量定量（全仓 grep，本地树，148 行命中精解）

**真·代码残余（4 文件 ≈15 行，登记批次 5.1）：**
- `apps/staff/src/components/scan/QrScanner.tsx`：BRAND 常量 + 扫码按钮旧杏橘
- `apps/staff/src/components/scan/ManualCodeInput.tsx`：focus/提交按钮旧杏橘
- `apps/merchant/src/components/finance/EmptyState.tsx`：内联 SVG 插画旧色 ×7 行
- `apps/merchant|staff/vite.config.ts`：PWA theme/background 仍是旧米白（PR 只改了 customer 端）

**豁免归档类（批次 5.1 视觉资产，不算代码违规）：**
占位商品图 36 张（products/*.svg）、生成器脚本×2、demo 种子脚本×2、
docs/DESIGN.md 历史文档 20 行、docs/ACCEPTANCE.md 历史记录 1 行。
注：tokens.ts 与 BRAND-TOKENS 各 1 行命中 =「#FFAAA5 已删」禁令声明文本自指，合法。

原始输出：/mnt/agents/output/pr16-assets/grep-after.txt

## J. G5 视觉实证（换色后实拍，本会话浏览器直采）

- shot-01 dev-login：米白底/深棕墨/柠檬黄标签+按钮 ✓
- shot-02 首页：柠檬黄价格与图标、TabBar 中央 philia 钮黄→绿渐变 ✓
  （头图 banner 仍是旧杏橘位图 → 5.1 资产项）
- shot-03 洗护单屏：选中态柠檬黄描边、「今天」胶囊实心黄+深棕字 ✓
- shot-04 宠物选择弹层：米白卡片+深棕墨 ✓
- shot-05 **确认条就绪态：「确认预约 · ¥88 · 约 60 分钟」柠檬黄→薄荷绿渐变+深棕墨字**
  （最高频流程，on-primary 语义落地实证）✓

实拍原件：/mnt/agents/output/pr16-assets/shot-0{1..5}*.png
