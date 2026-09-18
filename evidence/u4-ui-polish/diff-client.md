# U4 客户端逐格对照销项记录（diff-client）

每条格式：编号｜屏｜差异描述｜修法/口径｜状态（已销/豁免/疑点）

## D1 预约单屏（/booking/grooming，390×844）——任务书 D-补1 五条

- D1-1｜屏 04｜服务大卡选中态仅 1.5px 细线、缺柠檬圆勾，线上坍缩「全是线条」｜对照试样 `.svc-card.sel`/`.sc-check`：选中=深棕墨 2px 描边（ring-2 ring-ink）+ 右上角 22px 柠檬圆底墨勾；未选中=u1-ring 细线｜已销
- D1-2｜屏 04｜服务项 chips 选中态=墨 1.5px 边，三态不分明｜选中改柠檬底 bg-brand-primary（与任务书日期条「选中=柠檬底」同口径；试样/规格书本屏无 chips 可参照），未选=白底+细线 border-line；圆角控件档 14 不变｜已销
- D1-3｜屏 04｜chips 禁用态｜真实口径无禁用服务场景（getWithServices 只回在架项），不伪造禁用 chip；「墨 25% 字+细线」禁用工艺落在时段格与日期约满（见 D1-7/D1-8）｜豁免
- D1-4｜屏 04｜洗护师头像圈 44px 白底 sans 首字、选中无柠檬边｜试样 `.st-photo` 58px 圆；listStaffPublic 不透出头像（staff 表无 avatar 字段，schema 实证）→ 字圈=浅木底 bg-oak-light + u1-serif 衬线首字 20/600；选中柠檬边 ring-2 ring-brand-primary；卡 118px 宽（试样 .staff）、选中卡墨 2px 描边（试样 .staff.sel）｜已销
- D1-5｜屏 04｜「随缘派单」卡副文案为静态「门店安排」｜置顶卡=木纹底 bg-oak + 爪印 VI 线图标 +「最早可约 HH:MM」真值（页面由可约槽集合最早时刻算出；无可约槽回退「门店安排」，不造假）｜已销
- D1-6｜屏 04｜日期条无 chip 容器（裸字+下划细指示条）、非今明标签「9月20日 周日」在 56 宽内折行｜试样 `.date` 56 宽 chip：白底+细线 ring；选中=柠檬底（任务书口径，覆盖试样墨底）；日期数字 u1-num 17px（试样 15px 越字阶闸门，取 17）；余量「余 N」u1-num 11px；周几改短标签 今天/明天/周x 单行不折行；删除下划指示条｜已销
- D1-7｜屏 04｜约满日工艺｜43% 透明度（opacity-[.43]）+ 红「约满」（text-danger #D92D20），休息日同透明度灰「休息」；当前造数 7 天全部可约，无约满日可供视觉实证｜疑点（工艺已落码，待真实约满日复核）
- D1-8｜屏 04｜时段格禁用态=透明边+placeholder 死灰+删除线（一片死灰）；选中=墨 1.5px 边；圆角 16 越四档；数字 15px 越字阶｜三态分明：可约=白底+border-line 细线；选中=柠檬底 bg-brand-primary；禁用=墨 25% 字（text-ink/25）+细线 border-line-ring，bg 透明不落死灰，去删除线；圆角控件档 14；数字 u1-num 14px｜已销
- D1-9｜屏 04｜洗护师/日期条横滑在桌面浏览器露滚动条｜scrollbar-width:none + ::-webkit-scrollbar{display:none}（沿用 ProductDetailPage 既有 arbitrary 类写法，未新增全局 CSS）｜已销
- D1-10｜屏 04｜吸底条缺摘要行、衬底米白与试样白卡不符｜试样 `.confirm-bar` 骨架：摘要行（左=宠物·服务·洗护师，右=日期 时间加粗 u1-num；缺项如实写「未选宠物/未选时间」）+ 柠檬主钮 + 安心行；衬底改 bg-card 白底+顶部 hairline；按钮字阶 15→14｜已销
- D1-11｜屏 04｜试样服务大卡为 4:3 真实照片（svc-bath/svc-groom），实现为 VI 插画图标卡｜services 表无照片字段（schema 实证），不伪造图片——大卡图位维持 VI 插画工艺，img 插槽保留，待产品侧照片资产入库后替换｜豁免（取舍项，任务书明示口径）
- D1-12｜屏 04｜试样宠物卡默认选中旺财，实现为「请选择宠物」虚线空态｜双宠物真实口径不替选（任务书明示不改）｜豁免
- D1-13｜屏 04｜结构差异：试样=二选一照片大卡+时间摘要行；实现=品类大卡+服务项 chips+门店单行+洗护师+日期+时段栅格｜任务书 D-补1 点名 chips 保留修工艺，信息架构维持现行不重构｜豁免（结构差异说明）
- D1-14｜屏 04｜试样美容师卡有评分/单数（5.0★·1,280 单）与「熟手」职级签｜staff 公开字段仅 id/name/skills，无评分/单数/职级真实数据源，不伪造；meta 行用真实技能标签｜豁免
- D1-15｜屏 04｜吸底条安心行试样文案「不取消费·迟到保留 15 分钟·到店付」｜无取消/迟到政策真实字段，不照抄承诺；安心行=真实口径「全程可见 · 照片记录 · 到店付/次卡扣次」（随 paymentMode 真实切换）｜已销（口径置换）

验证记录：tsc -b exit 0；VITE_API_BASE=http://app.beta.local:7200 build:customer ✓；禁令 grep（FFAAA5/text-white/gradient）改动文件 0 命中；text-shadow 未使用（无需登记）。shoot.mjs customer 12/12 + combine.py 重合成；首屏以下区域用 u4-pipeline/scrollshot-booking.mjs（临时辅助，不入 repo）滚动实拍 4 张（洗护师区/日期+时段/点选 13:00 选中态/日期条横滑态）自查销项。

## D2 登录 / 服务中全程页 / philia 页（/dev-login、/appointments/:id/live、/philia，390×844）——任务书 D2 三屏逐格

- D2-1｜屏 01｜hero 为居中旧肤（64px 爪印圈+单行宣言「守护每一次洗护」+居中分隔线+「开发登录」题），与试样左对齐双行宣言骨架不符｜试样 01 工艺逐格：左对齐 hero=54px 纸面细线爪印圆标（实心爪 SVG，dock 中央钮同款 VI 路径）+ 衬线宣言「守护每一次/被照顾的时刻」双行（试样 30px/600 越字阶闸门 → 取 20/700 u1-serif，规格书 §10 同口径）+「PHILIA · 洗护 / 美容 / 寄养」11px 宽距小字（试样 11.5→11 caption-xs，tracking .14em）+ 柠檬短分隔线 44×1.5｜已销
- D2-2｜屏 01｜柠檬主钮「手机号一键登录」无真接口｜拍板 2 内测口径：主钮真实落点=锚滚至种子账号区（员工端 U3 DevLoginPage 同写法 scrollIntoView，data-testid=login-primary），「口令入内测 ›」=口令门卡显隐开关（真实交互，aria-expanded 外露，data-testid=login-gate 对齐 routes.json waitSelector）；不伪造手机号登录接口｜已销（dev-login 内测口径置换，结构差异登记）
- D2-3｜屏 01｜缺底部协议小字｜试样工艺两行「登录即同意《用户协议》与《隐私政策》/ 内测期间口令由门店发放」：10px 越阶→11 caption-xs，ink-40→ink-placeholder 令牌；flex 末位落底（口令门展开内容超高时随流滚屏，不死钉）｜已销
- D2-4｜屏 01｜功能区块工艺不符：种子卡 rounded-card(16)+shadow-card、正文 text-body(15) 越字阶、按钮/输入 rounded-md(8)、错误 raw red-50/red-600｜卡→u1-card（panel 20+细线 ring）；15→14 text-body-sm；按钮/输入→rounded-control 14；错误→danger 令牌（bg-danger-light/text-danger-deep）；骨架屏→rounded-panel；种子行角色小字→11｜已销
- D2-5｜屏 05｜摘要卡缺美容师行、头像无柠檬细环、旧胶囊「服务中·第 N 步」占右位｜试样 .bk-pet 逐格：头像 56 全圆+2px 纸缝+1.5px 柠檬环（ring-[1.5px] ring-brand-primary ring-offset-2）；「{宠物} · {服务}」17/700（试样 16/800→字阶 17，truncate）；美容师行「{员工}服务中 · 预计 HH:MM 完成」——员工名=store.listStaffPublic 按 appointment.staffId 解析（U4-B 同口径现成接口零新增），ETA=scheduledEnd 真字段 fmtTime，缺真值段隐去（寄养态=「寄养中 · 第 N 天」，scheduledEnd 为离店日不出 ETA 免歧义）；旧状态胶囊退役（步序在 stepper 可视）、门店名移出摘要卡｜已销
- D2-6｜屏 05｜摘要卡缺「实时同步」签｜SSE connected 真值点签（本页 useEventSource 返回值上行：薄荷点「实时同步」/灰点「重连中」，禁常亮；InServicePanel U4-B 同工艺，data-testid=live-sync 外露 connected）；completed 态右位=苔绿「已完成」chip；未开始/取消态=plain 不出签｜已销
- D2-7｜屏 05｜返回条仅 ← 圆钮无题｜补 PageHeader 题「洗护全程/寄养全程」（试样 nav 16/700 → 全域详情页锁定形态 text-title-lg 20/600，U1-A 统一返回条）；pending/confirmed/cancelled 分支同步换 nav｜已销（口径置换）
- D2-8｜屏 05｜stepper 装 u1-card 卡壳、节点 active=柠檬墨芯点/locked=锁图标+墨描边、连接线 done 薄荷实线/未到虚线、步骤名 15px、时间 12px 右挂｜试样 .steps 直上画布→去卡壳；节点：active=柠檬底+步序数字（u1-num 11/700）+静态柠檬环影（试样 .step.now .sd box-shadow 0 0 0 5px rgba(253,200,48,.25)；U1-E 去除的是呼吸光环动画，本环为试样静态工艺，恢复登记），locked=纸面细线环+灰数字（去锁图标，试样未到步显步序）；连接线统一 2px 暖墨细线（试样 ink-06→令牌 line-ring .09）；步骤名 14（done/active 600、locked 灰 500）；meta 行 11px 置题下（试样 .st2：done=完成时刻 u1-num、active=「进行中 · 说明」）｜已销
- D2-9｜屏 05｜步骤过程照=共享 PhotoWall 三列方图，与试样横排缩略不符｜常规步→试样横排 64×44（试样 CSS 尺寸；圆角 8 越四档→chip 6；inset 1px 描边 rgba(0,0,0,.08)；gap 6 / mt 8）；before_after 步保留共享 PhotoWall 前后并排（哇塞时刻既有特性）；点击全屏查看器链路不变｜已销
- D2-10｜屏 05｜试样步骤名（接宠确认/深层清洁/护毛滋养/吹干拉毛/细节修剪/完成检查·接宠回家）与实现不符｜以 server getStepDef 真实定义为准（消毒工具确认/预检/洗澡美容/细节对比照/前后对比照/完成确认），不改数据；试样未到步说明文案（「指甲 · 脚底毛 · 眼周」）server stepDef 无描述字段→不出；active 步「HH:MM 开始」时间戳不再出（试样进行中步 meta=「进行中 · 说明」）｜豁免（数据口径：试样步骤名/说明为设计稿文案）
- D2-11｜屏 05｜试样底部「联系门店」条（阿强 · 洗护间 ›）｜stores 无 phone 字段（schema 实证）→不渲染；ContactStore 防御式读取保持（schema 补字段后自动生效）｜豁免（U1 疑点口径）
- D2-12｜屏 06｜成长三格仅两项（陪伴天数/服务次数）、数值 15px 非大数字｜补真实可聚合第三项「累计消费」（listMine completed priceFen 合计 fenToYuan，HomePage stats 行同口径）；grid-cols-3；大数字 u1-num 20/700（规格书 §4 Montserrat 大数字；试样 800 字重→自托管 Montserrat 仅 400/600/700 三档，取 700 登记）；守护值无真实字段不出（裁定 #23 豁免口径维持）｜已销
- D2-13｜屏 06｜试样顶部右侧「守护值 320」与末行「守护市集」入口｜守护值无真值（schema 无积分表）、市集无路由（App.tsx 路由表无）→均不渲染，不造假｜豁免（U1-F 在案维持）
- D2-14｜屏 06｜三胶囊卡阵（rounded-full 胶囊卡+15px 名）与试样 q-row 细线列表行不符｜卡阵退役→细线列表行（U4-A 首页次级行同工艺：oak-light 圆角 14 图标芯片+墨 60% 线图标+名 14/600+述 11 ink-secondary+› 墨 30%，hairline 分隔）；真实链路（宠物档案/会员卡/服务相册）保留；成长护照预告行并入同组（置灰静态「9c 解锁」chip+「护照盖章预告」小字，非按钮不挂链）｜已销
- D2-15｜屏 06｜形象位/日记区工艺：宠物名 sans、物种行 12px、关闭钮 shadow-card、日记卡 rounded-card(16)+shadow-card 越圆角四档｜宠物名→u1-serif 衬线展示位（试样 .q-name）；物种·品种行→11 caption-xs（试样 10px 越阶）；关闭钮→u1-ring 细线工艺；日记卡→u1-card（panel 20+细线 ring）、小贴士卡→rounded-panel；空档案引导卡→u1-card；text-body(15) 余处→14｜已销
- D2-16｜屏 06｜结构差异：试样=serif wordmark 顶栏+白卡场景（LV.3/进度条/喂食玩耍打扮拍照四钮）+「定制我的崽」行｜实现=问候语+关闭钮全屏弹层结构维持现行（任务书未点名重构）；LV/进度条无真实字段不出；四钮无接口不做（U1-F 禁做假互动在案）；「定制我的崽」AI 接口预留隐藏｜豁免（结构差异说明）

D2 验证记录：tsc -b exit 0；VITE_API_BASE=http://app.beta.local:7200 build:customer ✓；D2 改动五文件禁令 grep（FFAAA5/text-white/gradient）0 命中；text-shadow 未使用（无需登记）。shoot.mjs customer 12/12 + combine.py 重合成；屏下区域用 u4-pipeline/scrollshot-d2.mjs（临时辅助，不入 repo）滚动实拍 3 张（06 列表行+护照预告 / 06 日记区 / 01 底部协议小字）自查销项。实机真值佐证：05 摘要卡「阿强服务中 · 预计 14:00 完成」（listStaffPublic 解析 staffId + scheduledEnd）、右位「实时同步」薄荷点（SSE connected 真值）；06 累计消费 ¥88（completed priceFen 合计）；01 口令门 401 真态展开。

## D3 商城列表 / 商品详情 / 订单列表 / 我的 / 宠物档案 / 空态（/mall、/mall/product/:id、/mall/orders、/me、/philia/pets、/mall/cart，390×844）——任务书 D3 六屏逐格 + D-补2/D-补3

- D3-1｜屏 07｜页边距 16px、题 20px、分类 chip 选中=柠檬底（U1-J 旧口径）、快加购=36px 白底细线钮、价柠檬字 17px、卡图 1:1、带店铺名行｜试样 07 逐格：页边距 22px（px-[22px]）；题 17（text-title）；chip=12/500 纸面细线、选中=深棕墨底米白字（.cat.on，覆盖 U1-J 柠檬口径——以左图为像素基准）；图 4:3（试样 120px/167px 卡宽）；名 12/600 两行；价 u1-num 14/700 墨色（试样非柠檬字）；快加购=26px 柠檬圆底墨「＋」（.pr-add），绝对定位与 Link 同级避免交互嵌套；店铺名行摘除（试样无，店名真值仍用于加车链路）｜已销
- D3-2｜屏 07｜右上 44px 白圆购物车钮+角标与试样细线 pill 不符｜CartLink 重写为试样 .pill-code 工艺：袋图标+「购物袋 · N」（N>0 带出，u1-num），细线 ring 全圆 11/600 墨 60%；数量增加弹跳保留｜已销
- D3-3｜屏 07｜分类横条桌面浏览器露滚动条｜D-补2 工艺（scrollbar-width:none + ::-webkit-scrollbar{display:none}）｜已销
- D3-4｜屏 07｜骨架卡 rounded-card(16)+shadow-card、错误/空态行动钮 15px 全圆｜骨架→u1-card+4:3 图位；行动钮统一柠檬控件档（rounded-control px-[30px] py-[13px] 14/600）｜已销
- D3-5｜屏 07｜搜索框为试样未画的真实功能（mall.listProducts keyword 服务端模糊）｜保留，输入字阶 15→14｜豁免（结构差异：真实功能）
- D3-6｜屏 07｜试样分类=全部/主粮/零食/玩具/洗护用品/会员专享；实现=全部/主粮/零食/玩具/清洁/其他｜实现对齐种子数据应用层枚举（真实口径），不照抄试样文案｜豁免
- D3-7｜屏 08｜主图 1:1、信息区无米白叠面、价柠檬 20px 居前、名 20px｜试样 .pdp-hero/.pdp-body：主图 300px 通栏横滑；信息面 -22px 叠上、顶圆角试样 24 越四档→panel 20；名 17/700 居前；价试样 24/800 越字阶闸门→取 20 text-price/700 墨色 u1-num｜已销
- D3-8｜屏 08｜试样「会员 9.5 折后 ¥X」薄荷小签｜会员价无字段不造假（任务书裁定口径）：薄荷签位保留但填诚实提示「会员价细则即将公布」，不显价格数字；细则上线后替换真值｜已销（口径置换登记）
- D3-9｜屏 08｜数量卡在正文区、底栏=车位+白加购钮+柠檬买钮｜试样 .pdp-bar：数量步进 pill（墨 6% 底全圆 30px 钮）入底栏左位；「加入购物袋」墨底米白字、「立即购买 · ¥X」柠檬底墨字（价=priceFen×qty 真值联动，实拍 qty+ → ¥129→¥258）；控件档 14；底栏购物袋入口试样无——移除（购物袋经商城页头 pill 可达）｜已销
- D3-10｜屏 08｜试样规格表（规格/适用/门店同款）与评价区（4.9/326 条）｜product schema 无规格字段、无评价系统（任务书点名无字段不显示）｜豁免
- D3-11｜屏 08｜售罄/仅剩 chip 全圆 12px｜小签档 6+11px（rounded-chip caption-xs）；stock 真值驱动不变｜已销
- D3-12｜屏 09｜状态签=柠檬底胶囊 chip 行｜试样 .tabs：文字签+底部 hairline，选中=墨 700+柠檬 2px 下划线（13px→14）；计数为真值保留（caption-xs u1-num）；补「全部」首签并设为默认（试样默认全部；全量并集按下单时间倒序）；横滑条隐藏｜已销
- D3-13｜屏 09｜状态胶囊全圆 12px 旧配色｜试样 .opill：小签档 6+11/600；待支付=柠檬底、待发货/待收货=薄荷洗（试样「进行中」同位）、已完成/已取消=墨 6% 沉底、售后中=功能红洗（真实态）｜已销
- D3-14｜屏 09｜订单卡工艺：padding 16、缩略图 48px/8 圆角、单价 15px、合计柠檬字、操作钮 15px 无分隔｜试样 .order：padding 14/16；缩略图 52×52 圆角试样 12 越四档→control 14；单号行 11px；价 u1-num 14/700 墨色（合计同）；操作区顶 hairline+右对齐胶囊钮 14/600，pri 柠檬/sec 纸面细线；「取消订单」→「取消」（试样文案）；「再来一单」白细线钮→柠檬主钮（试样已完成卡口径）；地址/物流块圆角 12→control 14｜已销
- D3-15｜屏 09｜签内空态=sunken 圆角盒（D-补3 空框边缘）｜改居中一句话（py-12 caption placeholder），不坍缩不裸框；全域空订单仍走 EmptyState｜已销
- D3-16｜屏 09｜试样「申请售后」钮｜无售后申请接口（refunding 态由门店侧发起）——不出，不造假｜豁免
- D3-17｜屏 09｜结构：试样=主级屏（wordmark 订单+dock）；实现=商城子页（PageHeader 返回条+无 dock）｜§0.4 详情级无 dock 口径维持；标题保留「商品订单」（与服务预约单区分）｜豁免（结构差异说明）
- D3-18｜屏 10｜题 20px sans；用户条套卡、头像 64 薄荷 PawPrint 占位｜试样 10：题=u1-serif 17/600 宽距 .14em；用户条直上画布；头像 54 全圆+细线 ring、无头像=字圈（浅木底+衬线首字，D-补3）；meta=手机号脱敏（users.phone 真字段，实拍 138****0000）· 加入 N 天｜已销
- D3-19｜屏 10｜Guardian Card：统计居中网格、值 14px 带单位、右上 ›｜试样 .gcardQ 素卡工艺核（任务书点名重点抽查）：纸面细线卡 padding 18/20；GUARDIAN CARD 10px 宽距（ink-40→placeholder 令牌）；统计行顶 hairline+左对齐 gap 30，值 u1-num 17/700 纯数字（试样 800 字重→自托管 Montserrat 700 上限，登记）、标签 11px；右下「会员码 ›」（真路由 /me/card）；档名/守护值/折扣副题/已省行无真实字段不出（裁定 #23 维持）｜已销
- D3-20｜屏 10｜入口列表=u1 卡+图标+15px sans 行｜试样 .svc-list：细线列表行直上画布（去卡去图标），行名衬线 14/600（试样 14.5→字阶 14），padding 16px 0+hairline，右位 ›；「我的订单」→「商城订单」、「宠物档案」→「我的宠物」（试样文案同路由）；试样「优惠券/联系客服」无字段无路由不出｜已销
- D3-21｜屏 10｜试样右上「设置」｜无设置页路由——不出｜豁免
- D3-22｜屏 10｜结构：实现多「我的宠物」卡区/宠友圈入口/退出登录卡（真实功能，试样 10 未画）｜IA 维持现行；宠物圈占位同步字圈（D-补3）；行内 15→14 清扫｜豁免（结构差异说明）
- D3-23｜屏 10｜退出确认弹窗纯白字类禁令残留｜→text-destructive-foreground 令牌；圆角 card 16→panel 20｜已销（禁令清净）
- D3-24｜屏 11｜宠物卡：头像 PawPrint 薄荷占位、名 15px、编辑=铅笔圆钮｜字圈（浅木底+衬线首字，双细线环保留）；名 17 text-title；编辑→试样「编辑 ›」安静文字链 11px 墨 60%｜已销
- D3-25｜屏 11｜洗护史：无区头计数、行 12px、再约 11/500｜区头=题 14/600+「共 N 次」真值（该宠已完成洗护单数，实拍 共 1 次）；行=日期 u1-num+项目+「同款再约 ›」11/700（试样 .tl .re）；试样缩略图位无真实照片字段（listMine 不透出过程照）——不出｜已销
- D3-26｜屏 11｜结构：试样=单宠详情页（大头照 210px 渐隐+指标格 2×2）；实现=多宠列表页｜IA 维持（/philia/pets 列表，/pets/:id 无路由）；指标格不重构——驱虫无字段、体重/年龄/疫苗行内真实展示（数字 u1-num 化）｜豁免（结构差异说明）
- D3-27｜屏 11｜表单卡 rounded-card+shadow-card、输入 12 圆角、新增钮 16 圆角｜表单卡→u1-card；输入/物种钮→控件档 14；新增宠物虚线卡→panel 20；正文 15→14 余处清扫｜已销
- D3-28｜屏 12｜空态=u1 卡+112px 日历插画+15px 题｜全域 EmptyState 重写对齐试样 12：直上画布居中；插画位=110px 浅木圆（oak #D4B896 VI 空间色）+爪印（AppDock PawMark 同源导出复用，墨 55%）；题 17/600（试样 15 越阶）、说明 12 双行 lh1.6；行动钮=柠檬控件档 px-[30px] py-[13px] 14/600；CartPage/订单空态文案对齐试样「购物袋还空着呢 / philia 帮你看着货架… / 去逛逛 ›」；空态余白区垂直居中（min-h-[56vh]）；9 处调用点行动钮统一清扫（Mall/MallOrders/Cart/Me/Pets/Appointments/Checkout/Moments/Philia 日记无钮）｜已销
- D3-29｜屏 12｜结构：试样=订单空态主级屏（tabs+dock）；实现侧实拍路由=/mall/cart（详情级无 dock，routes.json 既定口径）｜豁免（结构差异说明）
- D3-30｜屏 12｜CartPage 余项：结算主钮渐变禁令残留、结算栏 bottom-14 悬空（本页无 dock）、行卡 16+shadow、价柠檬字｜渐变→柠檬实底（禁令）；结算栏落底 safe-area；行卡→u1-card；价墨色 u1-num；题「购物车」→「购物袋」统一试样口径｜已销
- D3-31｜D-补2｜横滑条滚动条隐藏全域收口｜本六屏 3 处（07 分类行/09 状态签行/10 宠物圈行）+全域余 5 处（AppointmentsPage 签行、PhiliaPage 宠物横滑[原仅 inline scrollbarWidth，补 webkit 伪类统一 arbitrary 写法]、旧向导 StaffPicker/SlotPicker/BookingBoardingPage 门店行）；booking/single 两文件 D1 已落不重复；ui/table.tsx 为未使用 shadcn 件不动｜已销
- D3-32｜D-补3｜PawPrint 图标占位 vs 字圈工艺｜字圈（浅木底+衬线首字）落 6 处——10 用户头像/10 宠物圈/11 宠物卡头像/首页宠物圈（HomePage）/philia 形象位大圈（PhiliaPage，text-detail-lg 首字）/05 摘要卡（LiveHeader，柠檬细环保留）；保留 paw 两处=宠物表单上传钮（行动 affordance 非空头像）、随缘派单 VI 爪（D1 已定）；商品/服务卡无图=bg-sunken 暖底+居中爪（ProductImage 既有工艺，非细线空框裸奔，试样卡 2 bg #E8E2D2 同族）｜已销
- D3-33｜全域｜禁令连带清净（改动文件历史残留，非本批新增）｜PDP/Cart/Checkout/BookingBoarding 四处 bg-philia-gradient→柠檬实底；MePage 弹窗/MomentsPage 叠字三处纯白字类→destructive-foreground/canvas 令牌；diff 新增行 grep（FFAAA5/纯白字类/gradient）=0｜已销
- D3-34｜屏 09｜待支付/已完成卡操作钮（取消/去支付/再来一单）未实拍｜造数仅 1 笔待发货单；工艺与同屏已验证柠檬主钮/细线次钮同源（12 屏「去逛逛」、08 底栏实拍佐证）｜疑点（待真实单复核）
- D3-35｜屏 09｜routes.json clickText「待发货」现命中卡上状态胶囊（DOM 序更深）为空操作｜默认签改「全部」后成片恰与基线同构图（全部选中+混列+状态胶囊），未改 routes.json｜疑点（不影响成片，登记）

D3 验证记录：tsc -b exit 0（终态复跑 ✓）；VITE_API_BASE=http://app.beta.local:7200 build:customer ✓（终态复建 ✓）；禁令 diff grep 新增行 0 命中（余留命中均为删除旧违例行）；text-shadow 未新增使用（无需登记）。shoot.mjs customer 12/12 + combine.py 重合成，六屏并排图逐张自查；屏下区域与交互态用 u4-pipeline/scrollshot-d3.mjs（临时辅助，不入 repo）实拍 4 张（07 滚底「共 10 件商品 · 到底啦」/09 已完成签空态/09 售后签空态/08 qty+ 联动「立即购买 · ¥258」）。实机真值佐证：10 屏「138****0000 · 加入 1 天」（users.phone 脱敏）、Guardian Card「1 陪伴天数 / 1 服务次数 / ¥88 累计消费」三真数、11 屏「洗护史 共 1 次」。chrome.mjs stop + stack.mjs stop 已执行（7200/9223 均不可达）。
