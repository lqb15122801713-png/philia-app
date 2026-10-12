# 走查修复批（D-29~D-34）卷宗 · evidence/walkfix-d29

- 开工令：产品-1012-走查修复批（任务书=冻结版 V1.0，老板 10-12 签：**日结冻结后新开单=进次日班次**）
- 档位：K3·Max（D-29 涉钱面）；单片六件；分支 feat/walkfix-d29（PR 只开不合，base=main 尖 885320e8）
- 基线：main 现尖 885320e816993cbe6c15f81f7fad296623888a35（codeload 钉 sha；候裁清零批已并入主干）

## 一、六件明细

| 件 | 面 | 改动 | 实证 |
|---|---|---|---|
| D-29 日结冻结后新开单=进次日班次（钱域） | server/routers/cashier.ts + CashierClosePage | computeDayTender 三处窗口（settledAt/paidAt/createdAt）加冻结链窗：chainStart=最近 frozen 日结 createdAt，>dayStart 才取；日结页加「已结明示卡」（copy 键 cashier.dayFrozenBannerTitle/Body） | e2e 100.1 双断言（增量=新单精确到分+冻结行重读逐字段不变+新班懒建 openedAt>=冻结时刻；一日一结 CONFLICT 照存）；实尺 S1/S2 |
| D-30 员工端 /today 批量 URL 膨胀收口 | packages/shared/src/api/client.ts | httpBatchLink maxURLLength=2048（BATCH_URL_MAX_LEN 常量），三端同享 | e2e 三绿全量回归零红 |
| D-31 打卡定位不可用=允许+留痕标注 | server/routers/attendance.ts + AttendancePage | mark lat/lng 成对可缺；端口键 attendance_allow_insecure_http（service_rules）把关；放行落行 source='no_geo'+distance_m=-2；页放行+注记卡+明细「未取到定位」签 | e2e 100.2 双断言（默认放行+留痕 / enabled=false 拦 400+族尾复原）；实尺 S3 |
| D-32 文档 7201 错映射残留 | apps 注释三处 | canvasPreviewUrl.ts×2 + copy/canvas.ts×1 注释 7201=客户端备用口修正；授权面（docs/caddy/docker）实证本就全对零改动 | 扫面 diff 清单在册 |
| D-33 种子登录按角色落端+客户端明示出口 | DevLoginPage + copy/devlogin.ts 6 键 | 员工种子→员工端 7102/7203、商家→7101/7202；未知端口拓扑=明示卡不盲跳（兜底 7203/7202 链接） | 实尺 S4a/S4b（7130 未知拓扑出卡+链接） |
| D-34 导航坐标读门店档案同源+演示店同改 | server/db/seed.ts | 演示店=文三路 100 号同址 lat 30.275/lng 120.1315；导航=store.lat/lng 同源坐实（AppointmentDetailPage navLinks 读档案行）；ProfilePortBody 坐标编辑口既有 | e2e 100.3（seed 落库值快照断言）；实尺 S5（档案表单=库行同值） |

## 二、迁移申报（键入码必随迁移）

- `server/drizzle/0078_walkfix_d29.sql`：copy 键 10 增（attendance.geo.noGeoNote / attendance.source.nogeo / cashier.dayFrozenBannerTitle / cashier.dayFrozenBannerBody / devlogin.endStaffTitle / endStaffBody / endMerchantTitle / endMerchantBody / endLinkStaff / endLinkMerchant）+ service_rules 键 1 增（attendance_allow_insecure_http，默认 {enabled:true}=内测期放宽）；journal idx 78 登记；幂等（INSERT OR IGNORE）；seed.ts 同步补种（CLEAR_ORDER 重置后仍有键）。
- copy active 计数=4221/72 域（e2e 56.1×2/76.3/98.2 四处计数断言同步，三绿在案）。

## 三、闸门表（栈=7130 客户 / 7131 商家 / 7132 员工 preview + 7200 API，CORS 显式三端；库=wf-gate.db 新库 migrate+seed）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck | 绿 | typecheck.log |
| 全仓 build 零参版 | 绿 | build-gate.log |
| 栈版 build（VITE_API_BASE=7200） | 绿 | build-stack.log |
| e2e 连跑 | 三绿（1009 断言/跑；100 族三断言全绿；另 1 红=ECONNRESET 环境件早夭在 100 族前，净场复跑即绿） | e2e-green-1/2/3.log + e2e-env-econnreset-note.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0 · 豁免 6 | nav.log / nav.json |
| smoke-routes | 109/109 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过（含日结真实冻结今日=截图夹具复用源） | smoke-deploy.log |
| 实尺截图 | 六帧 SHOTS_ALL_GREEN（9 项断言全绿） | shots/ + shots.log + shots/checks.json |

## 四、实尺截图清单（shots/）

1. S1-dayclose-frozen-banner.png —— 日结页「今日已日结冻结」明示卡（账面 ¥1253.80 冻结快照停涨；新开单自动计入次日班次）；夹具=smoke 真流量冻结单
2. S2-after-settle-still-frozen.png —— 冻结后新开 ¥88.00 单（delta=8800 精确到分）后页帧：快照停涨+新班懒建（openedAt=冻结时刻后 1s）
3. S3-attendance-nogeo-note.png —— 无坐标打卡：注记「当前环境无法获取定位…留痕提交」+今日明细两行「未取到定位」签（库行 source=no_geo / distance_m=-2）
4. S4a-devlogin-staff-redirect-card.png —— 员工种子（小美）在客户端登录=员工端明示卡+「前往员工端 ›」链接（:7203）
5. S4b-devlogin-merchant-redirect-card.png —— 店主种子=商家端明示卡（:7202）
6. S5-profile-geo-same-source.png —— 门店档案表单=库行同值（文三路 100 号 / 30.275 / 120.1315）

## 五、候裁明面（五件照实报）

1. D-32 错映射残留在 apps/ 注释=本批已修三处（canvasPreviewUrl.ts:7/:29 + copy/canvas.ts:63）；canvas.previewPortMap 键值不动（值本身对）。
2. D-31 定位放宽=**内测期限定**（端口键默认 enabled=true）；真机收紧=改参不改码（config.save enabled=false 即拦 400，e2e 100.2 在案）。
3. INSECURE_CONTEXT_GEO_MESSAGE（secureContext.ts）成孤儿常量（D-31 后无引用），未删=报备在册。
4. 链窗口径=冻结后新开单入下一张日结；跨日未结=窗口顺延（chainStart 只认 frozen 行 createdAt，跨日不截断）。
5. D-34 生产库存量坐标**不自动更新**（seed 清表重建才生效）——存量店坐标纠偏=运营裁（档案编辑口既有可手改）。

## 六、纪律自查

零新依赖 ｜ 迁移幂等+申报（0078 一件） ｜ 键入码必随迁移 ｜ LF 行尾 ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合 ｜ 涉钱面（D-29）：冻结快照停涨+新单精确到分入次日+一日一结守卫照存+冻结行重读逐字段不变，四道全实证。
