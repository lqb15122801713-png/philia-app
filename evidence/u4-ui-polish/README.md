# 批次 U4 证据卷宗 · 三端 UI 细节收口（像素级对样批）

- 工作分支：`feat/u4-ui-polish`（基线 main@`081495c1`，线上内测同基线）
- 真相源：三端规格书 v1 三册 + 试样基准包（index-client.html / u2-full.html / u3-full.html + photos/）+《动效与细节纲领 v1》
- 日期：2026-09-18 ｜ 施工：K3 集群 work
- 视口：客户端/员工端 390×844（mobile 仿真）；商家端 1440×900；监控 Hub 补 1920×1080
- 像素级条款口径：**左试样右实现同尺寸并排对照图 32 张全量在卷**（sidebyside/），diff 清单三册逐项销项（diff-client/staff/merchant.md，合计 166 条）

## 验收闸门逐项

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 build exit 0 | ✅（VITE_API_BASE=http://app.beta.local:7200 生产构建 ×3；另默认 base 构建 ×3 供 smoke-routes） | gates/build-all.log |
| server typecheck exit 0 | ✅ `tsc --noEmit` | gates/server-typecheck.log |
| smoke-routes 33/33 | ✅ 33/33 通过（锚点适配 3 处：首页双态/购物袋口径/execute 守卫态，见 PR diff scripts/） | gates/smoke-routes.log + .json |
| smoke-deploy（任务 G 实证） | ✅ 全部通过；演示单落 2026-09-19 10:00 门店墙钟（修复前按容器 UTC 会落 18:00 撞打烊） | gates/smoke-deploy.log |
| diff 范围 | ✅ 仅 apps/customer（30）+ apps/staff（27）+ apps/merchant（31）+ scripts（2），共 88 文件；零新依赖（无 package.json/lock 改动）、零新接口（server/ 零改动） | PR diff |
| 禁令 grep | ✅ 珊瑚粉 #FFAAA5=0 命中；diff 新增行 text-white=0、渐变=0；**text-shadow 新增 2 处登记**（HomePage banner 图注/wordmark，试样 .hero 同值 rgba(46,38,32,.35/.45)，U1 先例在卷） | gates/grep-gate.log |
| 非安全上下文不崩 | ✅ 三端页面在 http://*.beta.local:7200（isSecureContext=false）真实渲染 root 非空；且全部 32 张右图本就摄于该非安全上下文 | gates/nonsecure-check.log |
| 像素级条款 | ✅ 并排对照图 32/32（客户 12 + 员工 7 + 商家 13）；屏下区域滚动实拍 20 张补证（scroll/） | sidebyside/ + scroll/ |

## 并排对照图索引（左试样右实现，同尺寸）

- `sidebyside/customer/` 01-login 02-home 03-home-serving 04-booking 05-live 06-philia 07-mall 08-product 09-orders 10-me 11-pets 12-empty（390×844 双侧）
- `sidebyside/staff/` 01-login 02-today-groomer 03-today-frontdesk 04-execute 05-boarding-checkin 06-history 07-me（390×844 双侧）
- `sidebyside/merchant/` 01-login 02-dashboard 03-appointments 04-appointment-detail 05-monitor 06-boarding 07-orders 08-products 09-pass 10-staff 11-finance 12-settings 13-monitor-single（1440×900 双侧）

## 口径与取舍（逐条登记）

1. **商家端左图缩放**：试样 u3-full.html 为浏览器框 mock，内容盒 1240×744（源文件无 1440×900 元素）；左图等比 LANCZOS 放大至 1440×900 与右图对齐——缩放糊度属试样载体差异，非实现偏差。
2. **02 首页·常态拍摄口径**：造数后客户端恒有在店单（服务中态），常态右图在干净种子库下单拍后回填（同账号同数据，仅无在店单）；03 服务中态右图=造数态实拍。
3. **任务书 > 试样的覆盖点**：①日期条选中=柠檬底（任务书 D-补1 覆盖试样墨底）；②过程照缩略 56×42（任务书 B 覆盖试样 46×32）；③首页次级行=两条列表行（任务书 A 覆盖试样四格横排 sub4）。
4. **banner 图注（任务 C）**：图文件不换（老板拍板）；文案取真实最小文案（常态=品牌句+昵称·加入第 N 天；服务中=宠物·第 N 步·步骤名·预计 scheduledEnd）——试样营销文案（秋日焕新洗护季/守护值双倍）无真实字段支撑未采用；禁令零渐变→试样的压暗渐变罩未加，以 text-shadow 保可读（见禁令闸门登记）。
5. **「查看全程 ›」**：任务书所写 /booking/journey 非现行路由；按「现行路由口径不变」维持 /appointments/:id/live。
6. **会员卡次级行跳转**：/philia/member → /me/card（任务书 A e2e 口径；MemberCardPage 现行路由）。
7. **豁免清单（任务书明示不动）**：守护值/星芽档位/已省（裁定 #23）、会员提醒条（无次卡隐去）、守护市集/联系门店行、banner 图文件、中央钮 60px 平圆。
8. **不造假口径**：服务大卡照片（services 无照片字段）、美容师评分/职级（无字段）、财务商城在线支付行（口径未定）等一律不伪造，逐项见 diff 清单「豁免/疑点」。

## 疑点上交（未擅自取舍，待产品侧裁定）

| 编号 | 内容 |
|---|---|
| D1-7 | 约满日 43%+红「约满」工艺已落码，造数 7 天全可约、无真实约满日供视觉实证 |
| D3-34 | 订单卡待支付/已完成操作钮未实拍（造数仅 1 笔待发货单），工艺与同屏柠檬主钮同源 |
| E-14 | frontdesk 任务台「今天全店无预约」：规格书 §3 的 listTodayForStore 服务端不存在，现以 listTodayForStaff 承接——与规格书矛盾（U2-1 已在案），未改过滤逻辑 |
| E-16 | 待办「去确认 ›」规格书指向员工 confirm 链，但 appointment.confirm=merchantProcedure 员工不可调——现为 toast 真实说明 |
| E-28 | 翻步反馈缺 crossfade（纲领 §四.4 未钉数值），登记待补 |
| F-31 | 商品分类 chips 试样枚举（主粮/零食/用品/洗护）与服务端过滤枚举（主粮/零食/玩具/清洁/其他）口径不一，改标签即假筛选 |
| F-39 | 财务流水是否计入商城在线支付行（试样含一行），口径未定 |
| F-21 | 共享包 steps.ts 全称与 U3 冻结步名并存，备案是否归一 |
| F-52 | 弹层/表单族 text-body 15px 为 T4/T5 存量（试样未画弹层），建议后续批次统一 |

## 造数与工具口径

- 演示数据全部真实 API 链路生成（下单→确认→核销→六步推进→照片上传；寄养入住+打卡；商城 MockPay 一单；历史完成单一单），造数脚本 `u4-pipeline/dataprep.mjs` 一次性走查工具不入库。
- 管线（并排渲染/截图/合成）位于施工机 `u4-pipeline/`（纯 node CDP + PIL，零新依赖，不入库）；本轮修复管线自身两缺陷：左图折行外空白（captureBeyondViewport）、headless Chrome SSE socket 占满致部分右屏假「加载中」（每屏全新标签页根治）。
- 非安全上下文实证：三端右图全部摄于 http://*.beta.local:7200（isSecureContext=false），另补 nonsecure-check.log 三端 root 非空断言。
