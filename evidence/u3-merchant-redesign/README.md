# 批次 U3 证据卷宗 · 商家端全屏 UI 重做（墨轨案 A）

- 工作分支：`feat/u3-merchant-redesign`（基线 main@b6d7b45，U2 已并入）
- 设计母本：《U3商家端全屏规格书-v1.md》+ 试样 u3-full.html（13 屏）+《Philia 动效与细节纲领 v1》
- 日期：2026-09-17 ｜ 施工：K3
- 视口：1440×900（监控页补 1920×1080）；真机渲染卷宗=脱离工具导出的 CDP 截图

## 验收总闸门逐项

| 闸门 | 结果 | 证据 |
|---|---|---|
| 1. 全新 clone 可跑（npm i → 三端 build + server typecheck exit 0） | ✅ 全 0 | O/o-gate-*.log |
| 2. 逐屏三段证据 | ✅ 逐屏截图在卷（母本=产品侧单文件试样，并排对照口径） | A/B1/B2/O/ 各目录 |
| 3. smoke-routes 全绿 | ✅ 33/33 exit 0（新增 /login、/pass 锚点行；监控锚点适配墨轨文案） | O/smoke-u3.log + .json |
| 3b. diff 范围 | ✅ 仅 apps/merchant + scripts/smoke-routes.mjs | PR diff |
| 3c. 禁令 grep | ✅ 珊瑚粉=0、渐变=0、text-white=0（red 功能胶囊+墨轨例外由 u3-st.red/rail 类承担；shadcn ui/ 库件沿 U1 先例不动） | O 见 matrix |
| 3d. 一致性矩阵 13 屏 | ✅ 全格 ✓ | O/matrix.md |
| 3e. 花架子侦测逐按钮 | ✅ + 零新接口核对 + 疑点 6 条 | O/button-audit.md |
| 3f. 非安全上下文 | ✅ LAN http isSecureContext=false 11 页逐页不崩 | O/O-nonsecure/ |
| 4. docker | 本批 diff 不含 Dockerfile/entrypoint/compose | — |
| 5. 三端互通 | ✅ 商家改派→员工端 SSE 频道投递实测（curl 直连在卷）；排班→客户端可约栅格 17→0→17 联动实证 | O/sse-stream 摘录见 PR |

## 目录索引

- A/ 墨轨骨架（10 项直达 e2e + dashboard-rail.png）
- B1/ 登录 + 总览 + 寄养 + 订单 + 商品 + 次卡（1440×900）
- B2/ 预约 + 监控 Hub + 员工 + 财务 + 设置（1440×900）
- O/ 预约详情（完成态+去收款）+ 单约监控（寄养单实时签）+ 监控 Hub 1920×1080 + 收口全套

## 种子与走查注记

- 演示数据全部真实 API 链路生成（客户下单→前台核销→员工六步→完成；寄养核销→入住登记→打卡幂等）。
- 排班经 store.setSchedule 真实接口调整过（周四延班走查用），已恢复种子档（周四延班保留属演示残留，无功能影响）。
- 造数/探测脚本为一次性走查工具，不入库。
