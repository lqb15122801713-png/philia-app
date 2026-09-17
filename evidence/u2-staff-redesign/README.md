# 批次 U2 证据卷宗 · 员工端全屏 UI 重做（时间轴台 B′）

- 工作分支：`feat/u2-staff-redesign`（基线 main@636081bc，U1.1 已并入）
- 设计母本：《U2员工端全屏规格书-v1.md》+ 试样 u2-full.html（7 屏）+《Philia 动效与细节纲领 v1》（全文生效）
- 日期：2026-09-17 ｜ 施工：K3

## 验收总闸门逐项

| 闸门 | 结果 | 证据 |
|---|---|---|
| 1. 三端 build + server typecheck exit 0 | ✅ customer/merchant/staff build ✓ + server tsc ✓ | J/j-gate-*.log |
| 2. 逐屏母本对照+实现+真机渲染（390×844） | ✅ 逐任务目录 | A/–H/ |
| 3. smoke-routes 全绿 | ✅ 31/31 exit 0（staff /today 锚点行已按任务书授权适配） | J/smoke-u2.log + .json |
| 3b. diff 范围 | ✅ 仅 apps/staff + scripts/smoke-routes.mjs（锚点行） | PR diff |
| 3c. 珊瑚粉/text-white/渐变 grep | ✅ apps/staff/src（除 shadcn ui/ 库件，与客户端 U1 验收先例同口径）命中 0 | J 见 matrix |
| 3d. 一致性矩阵 | ✅ 19 格全 ✓（含基准裁定取舍备注） | J/matrix.md |
| 3e. 花架子侦测 | ✅ 逐按钮真实链路 + 零新接口核对 + 待裁定疑点 6 条 | J/button-audit.md |
| 3f. 非安全上下文 | ✅ LAN http（isSecureContext=false）6 页逐页不崩 | J/nonsecure/ |
| 4. docker | 本批 diff 不含 Dockerfile/entrypoint/compose | — |
| 5. 三端互通实证 | ✅ 员工端传照/确认 → 客户端全程页 SSE 458ms 自动更新（≤2s） | D/D-sse（staff-after-confirm + customer-live-after-sync 同刻对照） |

## 目录索引

- A/ 全域 StaffDock（groomer 任务台/历史/我的 + frontdesk 核销台变体，同组件 props 仅 active+role）
- B/ 任务台 groomer 态（顶栏/周横条/全天行寄养打卡卡/日轴三态/服务中浮层展开收回/安静统计行）
- C/ 任务台 frontdesk 态（柠檬核销大钮/待办列/全店轴口径注记）
- D/ 六步执行（竖向 stepper 摘要卡/奶油底操作区/吸底随态主钮）+ SSE 双端实证
- E/ 寄养打卡（宠物卡/喂食 segment/遛狗 stepper/照片≥1/幂等提交 e2e/家长端可见）
- F/ 历史（近 30 天/按月分组/好评+金额）
- G/ 我的（用户卡/三格数字/排班只读/帮助设置就地展开/退出登录）
- H/ 登录换肤（主视觉卡/衬线宣言/柠檬主钮/口令门/角色签）+ 链路回归
- J/ 收口：matrix.md + button-audit.md + smoke 31/31 + 三端 build + 非安全上下文

## 试样对照说明

- 版式/像素/工艺对照以单文件试样《U2员工端全屏试样-v1.html》为基准（390×844 同机位）。
- 页边距按冻结决策 #23 全域 16px（试样所印 22 作废）；字阶就近冻结档 11/12/14/17/20；
  完成态透明度取试样 .45（任务书所印 43% 让位试样工艺值）；差异项已在 J/matrix.md 备注。
- 种子数据注记：演示单由真实 API 链路生成（客户下单→前台核销→员工六步→confirm 完成），
  造数脚本不入库（走查一次性）；排班经 store.setSchedule 延长（真实商家接口）以覆盖晚窗。
