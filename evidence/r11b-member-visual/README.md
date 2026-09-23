# R11b 会员页视觉批 · evidence 卷宗（A 窗施工）

> 批次：R11b（38 号施工令 + 36 号施工示意图 + 34 号设计规范 v2.0）
> 分支：feat/r11b-member-visual（基线 main@78a1da7）｜施工方：Kimi Code A 窗（角色卡⑧ V2.1）
> 日期：2026-09-24 ｜ 纪律：PR 只开不合（合并权=老板书面授权）

## 闸门实证（真跑输出原文入卷）

| 闸门 | 证据件 | 结果 |
|---|---|---|
| 三端 build（根单命令 `npm run build`） | `build-all.log` | ✅ exit 0（customer/merchant/staff 三端各 built） |
| server typecheck（`tsc --noEmit`） | `tc.log` | ✅ exit 0 |
| server e2e（`npm run test:e2e`，临时库隔离） | `e2e.log` | ✅ 全链路验收全部通过（会员域既有断言零删改） |
| smoke-routes | `smoke-routes-full.log` | ✅ 49/51——唯二红=/execute 两条，即 F1 已登记环境口径（D-2：SMOKE_APPT_ID 指向规范环境种子 ULID，fresh seed 必现，修复包口径件处理）；会员区四路由全绿 |
| check-nav-closure | `nav-closure.log` | ✅ 67 路由 死胡同 0（新路由 /member/rebate 已申报双表） |
| 禁用色 grep（#FDC830/#D97B4A） | 施工自检 | ✅ 本批新增/改动文件 0 命中（既有 token 里的柠檬黄=换皮批 F2/D-3 域，不在本批范围） |
| 零新依赖零新迁移 | `git diff` 实证 | ✅ package.json/lock 零改动；drizzle 迁移零新增 |

## 能跑能验（390×844 实尺浏览器截图目检，dev server 真跑）

截图=Chrome headless CDP 实渲（Emulation 390×844 dsf2），示例客户真实登录（dev-login 种子），微光开档幂等二次实证（「你已是会员」）：

| 件 | 图 | 目检结论 |
|---|---|---|
| J-01 卡池默认态 | shots/j01-open-deck.png | 暖阳默认选中（金环+深影+scale），ledger ¥1.6/¥599/含3只档跟随，CTA 吸底「开通暖阳·每天¥1.6」 |
| J-01 对比四档弹层 | shots/j01-tiers-sheet.png | 三件套齐（手柄/遮罩/滚动锁），四档色条+冻结值 8/85/88 折 |
| J-01 微光选中 | shots/j01-weiguang-selected.png | 白卡墨描边选中态，CTA 变「免费注册·领个身份」 |
| J-01 开通完成 | shots/j01-done.png | 微光开档幂等提示「你已是会员」 |
| A-3 持有态（微光白卡） | shots/a3-member.png | apphead serif 屏题+PHILIA CLUB，卡面/三格账/权益墙8枚/规则明面八条全在 |
| A-3 续费弹层 | shots/a3-renew-sheet.png | 到店付口径弹层（内测期明示） |
| W-01 账本（空态） | shots/w01-rebate.png | 结算环 94% 本周期/¥0.00/周期 8.26–9.25·次月5日前到账；空态三句话；规则八条全量 |
| Q-01 码屏 | shots/q01-card.png | 卡面横卡+码区诚实占位（待裁定件，见下） |

## 待裁定挂账（开工回执已报备，交付继续挂）

1. **Q-01 码区**：server 无会员码签发端点（R11a 未落「扫会员码」）——防假功能红线不画假码，码区=诚实占位文案（明文提示+手机号降级口径）；裁定到后换装真码。
2. **卡面 NO. 号源**：memberships 无序号列（零新迁移红线）——本期 cf-no 位不落假号，待裁定口径。
3. **卡面蜡封/线稿真件 + famcard 实拍**=素材通道（A5 槽位）；本批素色谱+占位渐变上线（36 号档许可）。

## 偏离与设计判断记录（自检诚实账）

- A-3 页面框架=pushbar（返回→/me）+apphead 屏题，非定稿的 dock 形态——dock 归换皮批全域件（36 号档 §〇「dock 不动」），且现状 /member=详情级路由；导航闭环实测 back=true ✓。
- W-01 明细行溯源行附带「余额 ¥前→¥后」（四铁律③保留骨架版前后余额功能，定稿未画该字段——加而不丢）。
- 权益墙「服务折扣」折数显示=bp/100 去尾零（8000→8 折），对齐共创会冻结文案 88/85/8 折。
- J-01 deck 修复一桩自抓缺陷：初版 onScroll 在挂载时把默认选中冲回首卡——已修为 plans 到位后居中默认档一次（暖阳）。
- 生产验证遗留：PWA SW 缓存曾致 localhost:7100 旧包假象（目检时以 127.0.0.1 同站绕开核实，非代码问题）。
