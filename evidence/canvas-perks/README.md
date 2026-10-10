# 卷宗 · 产品-1010 画布全屏批 片 1（权益墙数据区块）

> 基线=main fe8a5f0b（codeload 钉 sha）｜ 分支=feat/canvas-perks（base=main，PR 只开不合）｜ 卷宗=evidence/canvas-perks ｜ 纪律=PM-1008+PM-1009 红区硬句+拟人化死规 ｜ 档位=K3·High ｜ 2026-10-10

## 一、令围五件回执

1. **格名/描述=文案件**：perk.* 键全接画布行内编辑（格级子区=mc.perksWall 块内七格各行，名称+副签双位）——**涉承诺话术高危口令复核闸=内建既有件**（perk. 前缀在 COPY_HIGH_RISK_PREFIX 名单，画布弹层+server confirmedHighRisk 双闸，e2e 94.2 实证：无确认 400/带确认 200+读口即新值）；
2. **格子换序=区块内格子序入布局数据**：page_layouts.blocksJson 块项扩 `perks?: [{key, icon}]`（仅 mc.perksWall 可携带，saveLayout 白名单校验：未知格/未知图标/非墙块=400 明文）；编辑面=格级子区 ↑↓ 移（零 dnd 库）；
3. **图标=注册表白名单选换**：PERK_ICON_SET 十枚（七格默认+爱心/礼盒/星标备选）码内写死（SVG 形状数据族，渲染件 PerkIcon 统一线性）——不自由上传；
4. **数值面=档端口透出+跳口**：格级子区注记「几折/几%/含几只=数值走会员档端口」+「去会员档改数 ›」跳口（/console?port=member_plans 预选口新增）；画布永不改数；
5. **双屏同帧实证**：格序/图标=会员中心 published 布局单源，开通页读本行（usePerkWallCells）——实尺对照帧 S5/S6 同序同文案（生日礼遇置顶+「生日当月送洗护 9 折券」双屏同生效）。

## 二、闸门（实跑全绿）

| 闸门 | 结果 | 件 |
|---|---|---|
| 三端 build | ✓ | — |
| server typecheck | 0 错 | — |
| e2e 全量两绿 | 94 族四断言全过+85/88/91/92/93 族零回退 | e2e-p1b/p1c 日志 |
| nav 闭环 | 125 路由 0 死 0 弱（零新路由） | nav-closure.log |
| smoke-routes | 109/109 | smoke-routes.log/json |
| smoke-deploy | 全过 | smoke-deploy.log |
| 实尺截图 | 七帧全绿（SHOTS_ALL_GREEN） | shots/S1-S7 + checks.json |

## 三、实证在案（闸门/实尺真抓）

1. **VITE_API_BASE 环境件**（实尺首跑抓）：preview 栈直起=生产构建缺省同源 /trpc 打回 index.html（守卫 401 弹登录页）；screenshot 栈须 VITE_API_BASE 构建（scripts/README §二.6 口径在案）——非缺陷，环境口径；
2. **7200 占用拒跑实证**（e2e 自检拦：闸门栈未收摊跑 e2e=拒跑，清场后两绿）；
3. e2e 直调工艺已知件照挂（通道侧关单 ALERT 跨进程噪音，支付批登记在案不遮）。

## 四、边界与候办（明面）

- 三屏不重建 ✓（本件=mc.perksWall 已登记块上扩格子可改）；零迁移 ✓（格清单=码内写死件双端同源+布局 JSON 扩形）；零新依赖 ✓；
- 格序编辑=↑↓ 移（零 dnd 库，注记报备：格子 7 枚量级小，↑↓ 比拖柄稳）；
- 权益墙格子序=会员中心归属行单源（开通页无画布注册，读本行=同帧单源，写死在案）；
- 候令：片 2（高频五屏入册+抽键小批，六件裁死①②照办）随发。

## 五、文件清单（feat/canvas-perks，9 件）

shared：perkWall.ts（新·写死件）/ canvasLayout.tsx（PerkIcon+usePerkWallCells+perks 位保留）/ index.ts（导出）；server：routers/canvas.ts（perks 白名单校验）/ db/schema.ts（blocksJson 形状注）/ __tests__/e2e.ts（94 族）；customer：components/member/v2.tsx（PerksWall 接格序）/ pages/MemberCenterPage.tsx+pages/MemberOpenPage.tsx（双屏同读）；merchant：pages/CanvasPortBody.tsx（格级子区）+pages/ConsolePage.tsx（?port= 预选口）。
