# 急修三件（PD-03）· evidence 卷宗（A 窗施工）

> 批次：急修三件（QA40-D13 联合支付 / QA40-D1 分摊上屏 / D-16 自助开户）
> 施工令：docs/ops/PD-03_急修三件施工令.md（CJ-0925-07/08 特批先行，今日双签死线）
> 分支：feat/fixpack-hot1（基线 main@5b8cccb）｜施工方：Kimi Code A 窗（角色卡⑧ V2.1）
> 日期：2026-09-26 ｜ 纪律：PR 只开不合（合并权=老板书面授权）

## 闸门实证（真跑输出原文入卷）

| 闸门 | 证据件 | 结果 |
|---|---|---|
| 三端 build（根单命令 `npm run build`） | `build-all`→`hot1-build.log` | ✅ exit 0 |
| server typecheck | `hot1-tc.log` | ✅ exit 0 |
| server e2e（含 D-16 新增断言 4 条：建档/链路/幂等/格式拦截） | `hot1-e2e.log` | ✅ 全链路验收全部通过 |
| smoke-routes | `hot1-smoke.log` | ✅ 48/50——唯二红=/execute×2=F1 已登记环境口径（D-2），非本批域 |
| check-nav-closure | `hot1-nav.log` | ✅ 66 路由 死胡同 0（本批零新路由） |
| 禁令/禁用色 grep | diff 域 0 命中 | ✅（PaySheet:333 离线横幅 #FDC830=既有行未触碰，换皮批 F2 域） |
| 零新依赖零新迁移 | git diff 实证 | ✅ |

## CDP 实证 13/13（真浏览器真数据，脚本=临时验证件不入仓）

PaySheet 四修法（平板横屏 1180×820，店主真登录，全价成犬粮 ¥129 单）：
1. ✓ 现金手输 64 → 微信末位自动兜底 65（Σ=应收）
2. ✓ 现金手输同步刷实收（cashReceived=现金承担）
3. ✓ Σ=应收时无差额提示行
4. ✓ 明细行标签=「现金承担」（「应收」字样不再出现在分段位）
5. ✓ Σ≠应收→差额提示行「还差 ¥128——补足后才可确认结账」
6. ✓ 确认钮锁死
7. ✓ 顶部应收真值不回写（改分段后仍 ¥129）
8. ✓ 日结页分摊参考行在位（参考口径·不计入今日已收）
9. ✓ dashboard 营业额卡口径注在位
10. ✓ 口令门内手机号输入卡出现
11. ✓ 新号注册→登录→落 /home
12. ✓ 新客进开通页（微光一键开档入口在）
13. ✓（微光开档链路 server e2e 断言互补）

## 能跑能验截图（shots/）

| 图 | 内容 |
|---|---|
| hot1-paysheet-rebalanced.png | 现金 64+微信 65=129 联合支付再平衡态 |
| hot1-paysheet-gap.png | 差额提示行「还差 ¥128」+确认锁死+应收真值不动 |
| hot1-dayclose-amortization.png | 日结页分摊参考行（本地库无售卡单=¥0 占位，数字口径由 QA 对 35 号档四条在生产对数） |
| hot1-dashboard-note.png | dashboard 营业额卡口径注 |
| hot1-phone-card.png | 口令门内手机号登录/注册输入卡 |
| hot1-phone-registered.png | 新号注册落 /home（新客 4444） |

## 报备与挂账

1. **Y7 口径修正生效**：分摊额从全连锁改本店——今日 dashboard/日结的分摊数字会变小，是口径修正不是 bug（PD-03 §四已预告）。
2. **微光线上开档分摊不计入任何店**（sold_store_id=NULL）——待连锁合批裁定，代码注释留痕。
3. **与 R11b（PR #41）同触 server/src/routers/membership.ts 不同段落**（本批=amortizationStats 一处过滤；R11b=新增 ledger 端点）——合并串行时可能轻碰头，双方段落互不重写。
4. D-16 e2e 首跑踩号段冲突（13900000999=种子「e2e 他店店主」）——换 13977776666 后全绿；顺带实证：手机号撞既有账号=登录该账号（ merchant_owner 号也能登），这是设计内行为（手机号即账号），未新增角色。
