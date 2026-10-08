# 卷宗 · 生产可用性急修 1008（单片直批 · 四件）

> 令=开工令-产品-1008-生产可用性急修.md（老板 20:11 批）｜ 授权=授权-老板-1004 延续 ｜ 纪律-PM-1008（CJ-1008-01）照走 ｜ 基线=main 尖 b6ff1a02（codeload 钉 sha 拉取）｜ 分支 `feat/prod-hotfix-1008` ｜ 卷宗 `evidence/prod-hotfix-1008` ｜ PR 只开不合 ｜ 档位=K3·Max（生产可用性面）｜ 施工=A 窗 2026-10-08 晚。

## 两问闸（答死照执）

1. 后期谁管：拓扑映射=端口配置（能调纲领）——落=copy 端口键 `canvas.previewPortMap`（非工程师可改）；施工=A 窗；验收=产品侧复核八步（含生产实证）；
2. 写死/留口：端口映射表=配置端口留口（改拓扑零代码，探针实证=覆写 7101→7100 即时生效）；**tRPC 同源口径=写死**（getApiBase 生产缺省='' 同源相对路径，永不再烤绝对地址）。

## 一、四件总账

1. **画布预览端口分端轨（HIGH）**：canvasPreviewUrl 四轨并存——①路径轨（/admin 前缀，片 4 保留）②**端口轨（新，生产真拓扑：7202 商家/7201 员工→7200 客户；cashierMarketing=同源 /cashier）**③dev/截图双轨（零改动）④Host 前缀轨（保留不拆）；端口映射表=copy 端口键 `canvas.previewPortMap`（0070 新增，JSON 串，解析失败回落缺省 7202/7201→7200）；推导矩阵扩至 16 例全过（端口轨 4 例+映射覆写 1 例+解析件 3 例）；实尺=端口轨模拟栈（vite preview 7101 商家/7100 客户）三页签 iframe 出图非死链+修复前对照（旧轨丢端口落 80=连接拒绝帧 00）；
2. **商家端 7202 数据面跨口（HIGH）**：定位在卷——绝对地址烤入机制=Dockerfile ARG VITE_API_BASE 构建期烧死（部署档「部署必填公共 URL」）→ 7202 页面跨口调 7200 → 生产 CORS 白名单/凭局面拦截（CORS/401/404 14 条形态）；**正解=全部归同源相对路径**（getApiBase 生产缺省=''，各端自口自 API，Caddy 透传 /api//trpc 同口同域）；forUser 404 归因=同一烤值面（非同源后路径同源即消；生产亲验候产品侧）；**轮询 URL 膨胀**：三形态复现探针（正常/CORS 全挂/兜底全开 75s 盯网，url-bloat-result.json）=URL 长度恒定无累积拼接（码内 grep 零累积件）；根因面=绝对地址失败面下请求计数膨胀（非 URL 拼接），同源归一后即消——生产亲验收口（令验收③）；码内确无「URL 累积拼接」件（grep 实证：三端+server 零 `+= '/'` 类）；
3. **暖阳卡面文案同源（MEDIUM）**：`card.claimNuanyang` 去只数=「多只毛孩子 · 都被叫得出名字」（0070 改值+种子生成器同源）——参数面（含 5 只 v6）与卡面永不再打架；
4. **smoke 夹具陈旧（MEDIUM）**：smoke-deploy R11a 萤火售卡夹具去硬编 25800——改读 membership.plans 端口值动态算（priceFen+max(0,4−includedPets)×extraPetFen 精确到分，分摊下限同源）；smoke-deploy 真绿（端口期望值 25800 现库实证过=老板 v6 值变更后亦自适应）。

## 二、申报件

1. 迁移 **0070**（copy 键 1 增 1 改；幂等守卫；INSERT/UPDATE 生成器直出）；journal idx 70；dev 库已落（hash=6dc4f5a30312…，键值抽核在列）——**部署时须随码落库**；
2. e2e 全量两绿采信 **955 断言**（零回退；56.1/76.3=3888/72 随键同步）；
3. **nav 双表零申报**（零新路由；124 路由 0 死 0 弱）；
4. 配置文件变更面：`.env.example` VITE_API_BASE 段注释改口径（生产留空=同源）；Dockerfile/compose 零改动（ARG 留口既有）；
5. **CJ-1008-01 六条自过**：命名说人话/纯函数单职责/注释写为什么（四轨来历+映射表留口写明）/零死代码/结构按业务域/维护者视角自过 diff=已做。

## 三、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build / server typecheck | 0 / 0 | gate-build.log / gate-typecheck.log |
| e2e 全量 | **两绿采信 955 断言**（零回退；跑 2 首发 Segfault 环境件照案复跑补绿） | gate-e2e-green1/green2.log |
| check-nav-closure | 124 路由 0 死 0 弱 | gate-nav-closure.log + nav-closure.json |
| smoke-routes | 108/108 | gate-smoke-routes.log |
| review-e2e | 全绿 ✅ | gate-review-e2e.log |
| smoke-deploy | **真绿**（萤火售卡断言=端口期望值 25800 过） | gate-smoke-deploy.log |
| 推导矩阵 | 四轨 16 例全过 | canvas-url-matrix.json |
| 实尺截图 4 帧 | 端口轨三页签出图（home/memberCenter/cashier）+丢端口落 80 死链对照——逐屏目检（PROBE_ALL_GREEN，含映射表覆写「改拓扑零代码」实证+用后复原） | 00-03-*.png + probe-result.json |

## 四、红线自查

零新依赖 / 禁令零命中 / 行尾 LF（改动件 CR=0）/ 迁移幂等（0070 守卫）/ 迁移申报=1 枚照令口径（预期零或一枚 copy 键✓）/ gh API 四步 / 收摊必净（7100-7102/7200 零监听+dist-probe/uploads/staging 清零）/ CJ-1008-01 六条自过。

## 五、登记候知会

1. **轮询 URL 膨胀诚实结论**：复现三形态 URL 恒定+码内零累积拼接件——令内「query key/URL 组装错」预判未坐实；失败面根因=绝对地址烤入（已修=同源写死）；**生产亲验候产品侧**（部署后看轮询 URL 不再膨胀——若仍见 528 段=补采证据另批，本件不遮不瞒）；
2. e2e 跑 2 首发 Segmentation fault（node 进程崩，族 86 中段）=静默死同类环境件，照案复跑补绿；
3. 探针拓扑注记：vite preview 口须 CORS 白名单内（7130/7132 不在 DEV_ORIGINS=首跑红教训，落 7100/7101 白名单口）；iframe 跨口=SOP 拦直读，实证=DOM src+node fetch 200+截图像素三件套；
4. 生产亲验三件事（令验收③，部署后产品侧）：画布三页签出图/收银台 forUser 通/驾驶舱轮询 URL 不膨胀。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 晚
