# U4 员工端逐格对照销项记录（diff-staff）

每条格式：编号｜屏｜差异描述｜修法/口径｜状态（已销/豁免/疑点）
屏：01 登录 / 02 任务台 groomer / 03 任务台 frontdesk / 04 六步执行 / 05 寄养打卡 / 06 历史 / 07 我的（390×844）

## 屏 01 登录

- E-1｜屏 01｜hero 主视觉卡页边距 16px，与试样 `.lg-hero` margin 10px 22px 0 不符｜mx-[22px]（规格书 §0 页边距 22）｜已销
- E-2｜屏 01｜衬线宣言 text-[22px] 越字阶闸门（11/12/14/17/20）｜取 20/700 u1-serif leading-[1.5]（试样 lh1.5；客户端 D2-1 宣言 30→20 同口径映射；规格书 §1 所印 22/serif 越闸门，登记映射）｜已销
- E-3｜屏 01｜wordmark 800 字重（自托管 Montserrat 上限 700）、brand/按钮区/角色签边距与试样不符｜试样 `.lg-brand`/`.lg-act`/`.lg-role` 逐格：px-[30px] pt-[26px] / px-[30px] pt-[22px] gap-2.5 / mt-[18px]；font-extrabold→font-bold｜已销
- E-4｜屏 01｜hero 试样为 72% 宽照片插图（u2-full.html 引 `../photos/c6.jpg` 竖幅照片，基线渲染为破图空卡），实现为既有品牌 VI banner（1200×500）通栏 object-cover｜真实品牌资产 banner-home-1200.png 在库在用，不伪造试样照片；img 插槽保留，产品侧 hero 资产入库后可换｜豁免（资产口径）
- E-5｜屏 01｜屏下 dev-login 功能区（内测口令门/种子账号列/手动 userId 兜底）试样未画｜内测真链路保留不造假（口令门 u1-card、错误 danger 令牌、骨架 chip 档、按钮控件档均已在闸门内；实拍 scroll-01b 佐证）｜豁免（结构差异：真实功能）
- E-6｜屏 01｜同浏览器串话 cookie 会令 01 出现「当前已登录」卡（管线分组拍摄口径）｜实现行为正确（已登录态真实展示）；shoot.mjs 组序 anon 先拍时 canonical 成片干净（本轮 01 无此卡，口令门因服务端 BETA_GATE_CODE 强制展开=真实态）｜豁免（拍摄口径说明）

## 屏 02/03 任务台（groomer / frontdesk 同骨架双变体）

- E-7｜屏 02/03｜页边距 16px；deckUtils 旧注释称「规格书所印 22 作废（冻结决策 #23）」——核查无此冻结凭据（#23=守护值豁免口径，见 diff-client D2-12）｜全域 px-[22px]（规格书 §0/§13 硬闸门 + 试样全屏 22 + 客户端 D3-1 同批先例），deckUtils 注释更正销误｜已销
- E-8｜屏 02/03｜顶栏头像无头像时 PawPrint 图标占位（E-补1 点名）｜字圈工艺：浅木底 bg-oak-light + u1-serif 衬线首字（员工名首字，客户端 D-补3 同口径）；薄荷环保留且 3.5px→3px 校正（试样 `.a-date .av`=2px 纸缝+3px 薄荷）｜已销
- E-9｜屏 02/03｜当前时间墨线右端 right-0 顶到轴右缘｜试样 `.b-now` right:22px → right-[22px]｜已销
- E-10｜屏 02｜服务中块展开为服务卡后仍沿用普通块 padding 8/12｜试样 `.b-ev.svc` padding 11px 13px 13px → 展开态 px-[13px] py-[11px]｜已销
- E-11｜屏 02｜服务卡六步进度段色偏：done=secondary-deep（过深）、未到=墨 18%（过重）、gap 6px｜试样 `.a-prog`：done=薄荷 #7FD8BE、now=柠檬 #FDC830、未到=墨 6%、gap 5px、高 4px｜已销（scroll-02-svc 实拍佐证：薄荷 done 2 格+柠檬 now+墨 6% 未到）
- E-12｜屏 03｜扫码核销大钮 text-[15px] 越字阶闸门｜14/700（试样 15/700 映射；高 50px 不变）｜已销
- E-13｜屏 02/03｜全天行（groomer 寄养打卡卡列）/待办列（frontdesk 改期回退+寄养入住）无实拍数据：造数 B 寄养单为 in_boarding 且未指派本人，落在 listTodayForStaff 范围外｜数据口径非工艺缺陷；两列工艺已按试样落码（warn 红描边卡 rgba(217,45,32,.35)+红「去打卡 ›」/墨「查看 ›」「入住 ›」、纸面卡控件档 14、左小标 36px 右对齐）｜疑点（工艺未实拍，待真实在店寄养单复核）
- E-14｜屏 03｜【管线初拍疑点定性】frontdesk /today 显示「今天全店无预约」而当日实际有 3 单｜读码实证：规格书 §3 所印 listTodayForStore 服务端不存在，实现以 listTodayForStaff（本人单+本店未指派 pending/confirmed，server/routers/appointment.ts:1932 注释在案）承接——当日 3 单均指派阿强，前台视图为空属实；与规格书「轴=全店今日单（listTodayForStore 现成）」矛盾（代码内疑点 U2-1 已报产品侧）｜疑点（上交产品侧裁定，不改过滤逻辑、零新接口）
- E-15｜屏 03｜试样 frontdesk 顶栏副行「全店 12 单 · 2 美容师在班」｜全店单数/在班美容师数无员工可读数据源（U2-1 / U2-2 staffList=merchantProcedure 在案）；规格书 §3「差异仅三处」不含顶栏 → 保持「门店·周几·本人排班段」｜豁免（无真实字段不造假）
- E-16｜屏 03｜待办「去确认 ›」试样/规格书指向预约详情 confirm 幂等链｜appointment.confirm=merchantProcedure 员工不可调（server 实证），实现以 toast 说明现状（「确认在商家端审批——已为你标出」）不伪造跳转；与规格书 §3.2 口径矛盾｜疑点（上交，不改逻辑）
- E-17｜屏 02/03｜dock 三栏与中央态（重点抽查）｜试样 `.sdock` 逐格核验达标：高 78px+安全区、纸面底+顶部 hairline、3 栏无中央悬浮钮、frontdesk 首栏「核销台」+ScanLine 图标（同一 StaffDock，props 仅 active+role）、当前栏墨 600/非当前墨 42%、图标 22px 1.6 线、标签 11px（试样 10 越阶→11）、按下 scale-92+120ms+spring｜已销（核验无差异）
- E-18｜屏 02/03｜空态/骨架/错三态核验｜空态原文逐字=规格书 §2/§3（「今天没有派给你的单——休息，或去前台看看有没有要帮忙的」/「今天全店无预约——等自动接单，或把预约页分享给老客」）；emoji 禁令→lucide 墨色线图标（MoonStar/ScanLine 沉底暖圆）；骨架=内容轮廓 animate-pulse 无转圈；错态一句话+「重新加载」真链路。连带回炉：TodayPage 分流骨架旧工艺（rounded-card 16+shadow-card→u1-card、rounded-tag 8→chip 6）、无 staff 空态 🐾 emoji→PawPrint 墨色+15px→14｜已销
- E-19｜屏 02/03｜周横条核验｜试样 `.b-week` 一致：6 日 chip 控件档 14、纸面细线 ring、当前日墨底反白（bg-ink/text-canvas）、日号 u1-num 14/700、周几 11px（试样 9.5 越阶→11）｜已销（核验无差异）

## 屏 04 六步执行

- E-20｜屏 04｜摘要卡：边距 16、宠物名 15px 越阶+800 字重、meta 行=品种·体重（规格书 §4=服务·时间·员工）、N/6 800 字重、头像 PawPrint 占位｜mx-[22px]（试样 `.ex-sum` 6px 22px 0）；宠物名 16/700（宠物名先例档，自托管上限 700）；meta=服务·时间·员工（员工=当前登录本人——守卫已保证非本人单进不来，FORBIDDEN 引导页在案）；N/6 17/700；头像=E-补1 字圈（浅木底+衬线首字「旺」，柠檬环 3.5px 保留，客户端 D3-32 LiveHeader 同口径）｜已销
- E-21｜屏 04｜locked 前后对比步仅文字行，试样构图含 before/after 双槽（随步 45% 透明）｜locked BA 步补纯展示双槽（span 不挂交互不造假，随父级 opacity-[.45]）｜已销（scroll-04b 实拍佐证）
- E-22｜屏 04｜过程照缩略/前后槽/虚线槽圆角 8 越四档；「＋拍照/相册」槽 ring+dashed 双边叠影｜圆角统一 chip 6（试样 8 映射，客户端 D2-9 同口径）；虚线槽去叠影留单层 dashed 1px 墨 25%（规格书 §4 虚线槽口径）｜已销
- E-23｜屏 04｜stepper 区/吸底条边距 16｜px-[22px]（试样 `.ex-steps` padding 16px 22px 20px、底栏 padding 12px 22px 14px）｜已销
- E-24｜屏 04｜删除照片二次确认「确认删除」奶油字 arbitrary 值｜text-destructive-foreground 令牌（客户端 D3-23 同口径）｜已销
- E-25｜屏 04｜打标重拍横幅（FlaggedBanner）旧工艺：rounded-card 16、15/16px 字、边距 12｜rounded-control 14 + 字阶 14/12 + mx-[22px]｜已销
- E-26｜屏 04｜庆祝页（重点抽查）：副文 16px/提示 15px 越阶｜14/12 闸门档；勾勾回弹 0.55s cubic-bezier(0.34,1.56,0.64,1)=ease-philia-spring——纲领 §二 品牌弹簧合法场景（服务完成庆祝），低频不违「超 500ms 判不合格」常规动作条款；未实拍（触发需把共享造数单跑完六步，会污染三端造数态）｜已销（代码审查销项；实拍豁免登记）
- E-27｜屏 04｜弱网队列提示（动效纲领抽验）｜现状达标：IndexedDB 队列+flusher（upload→addPhotos 真链路）、摘要卡「N 张照片上传中…」、吸底主钮「照片上传中…」禁用态、上传中缩略 pulse 标记｜已销（核验无缺口）
- E-28｜屏 04｜翻步反馈（动效纲领抽验）｜在案：未满点主钮 toast 真实提醒（「还差 N 张过程照…」）、确认中按钮态、确认后 stepper 即时翻步+SSE 对齐；缺口：纲领 §四.4「同容器内容替换 crossfade」未落地（步骤状态切换为跳变），翻步动画数值纲领未钉｜疑点（缺口登记上交，不擅自加动画）

## 屏 05 寄养打卡

- E-29｜屏 05｜页边距 16（宠物卡/表单卡/历史区/吸底条/超期与完成横幅/退房入口/各引导卡）｜mx-[22px]/px-[22px] 全格（试样 `.bd-pet`/`.bd-form`/`.bd-hist`/底栏均 22）｜已销
- E-30｜屏 05｜喂食 segment 圆角 rounded-[10px] 越四档｜rounded-control 14（试样 10 映射控件档；选中墨底米白字/未选米白细线不变）｜已销
- E-31｜屏 05｜备注 textarea rounded-input 12 越四档｜rounded-control 14（米白底+inset 细线 ring 不变）｜已销
- E-32｜屏 05｜表单标题/遛狗步进数值/历史日号 800 字重（自托管上限 700）｜font-bold 700；日号 16px 保留（时间先例档，试样 Montserrat 16/800→16/700）｜已销
- E-33｜屏 05｜入住信息卡（StayInfoCard）/入住登记表单（CheckinForm）旧工艺：rounded-card 16+shadow-card、15/16px 字、rounded-input 12、「添加物品」柠檬浅底柠檬字低对比｜u1-card 化（panel 20+细线 ring）+字阶 14/12+控件档 14；「添加物品」改墨字（柠檬浅底保留）；h-staff-btn 56 锁定高度不动｜已销（两块为试样未画的真实功能块——结构差异登记豁免，工艺已入闸）
- E-34｜屏 05｜宠物卡 16:10 照片区无照片=PawPrint 居中占位｜非头像位（照片区），维持 bg-sunken 暖底+居中爪（客户端 D3-32 ProductImage 同族工艺，非细线空框）；E-补1 字圈不落此处｜豁免（口径）
- E-35｜屏 05｜历史打卡空态卡（E-补1 空卡口径）｜u1-card 细线暖底不死灰达标；空态原文「今天还没打卡——喂了饭、遛了弯，拍张照再提交」=规格书 §5 原文｜已销（核验）
- E-36｜屏 05｜打卡按下态（动效纲领抽验）｜segment/stepper/照片槽/吸底主钮全面 active:scale-92~0.98+duration-120+ease-philia-spring（纲领 §三 及格线）；历史行缩略 34×26 chip 6 对格｜已销（核验+scroll-05b 实拍佐证：幂等副行「同日重复提交=更新当日记录（幂等）」、已打卡主钮真态「更新今日打卡」）

## 屏 06 历史

- E-37｜屏 06｜页边距 16、日号 text-body 15px 越阶、金额带 .00 尾零（试样 ¥88 整数口径）、月分组 800 字重、骨架条 rounded-tag 8｜px-[22px]；日号 u1-num 17/700（试样 15 越阶→17，客户端 D1-6 同口径）；fenToYuan 整数元去 .00（非整数保留两位，仅 HistoryPage 使用）；月分组 12/700 宽距 .08em；骨架 chip 档｜已销
- E-38｜屏 06｜好评签/取消单/空态核验｜★N.N 仅真实评分单显示（rating 真字段）；取消单金额=—+取消来源小签（cancelSource schema 真字段）；空态原文=规格书 §6「还没有历史单——第一单完成后会出现在这里」+ClipboardList 沉底暖圆｜已销（核验无差异）

## 屏 07 我的

- E-39｜屏 07｜页边距 16、头像 PawPrint 占位（E-补1 点名）、名 800 字重、三格数字 text-[22px] 越闸门、用户卡多一行门店名（规格书 §7 结构无此行）｜px-[22px]；字圈工艺（浅木底+衬线首字「阿」，56px 薄荷环 3.5px 保留）；名 17/700；三格 u1-num 20/700（试样/规格书所印 22 越闸门→20，客户端 D2-12 同口径映射；无绩效数据=「—」墨色不落死灰）；门店名行摘除（任务台顶栏已有门店名，不丢信息）｜已销
- E-40｜屏 07｜试样列表行均带 ›，实现展开器行（我的排班/帮助与规范/设置）用 ChevronDown｜三行=就地展开真实内容（无对应页面不做假跳转，铁律），ChevronDown 如实表达展开交互；「我的评价/寄养负责中」真路由行保持 ›｜豁免（口径）
- E-41｜屏 07｜绩效口径核验｜staffList=merchantProcedure 员工不可调（疑点 U2-2 在案），绩效=listForStaff 本月+stayForStaff.logs 前端聚合（零新接口）；好评率无评分=「—」、寄养打卡无记录=「—」｜已销（口径核验；实拍「1 / — / 0」真值）

## 全域 / 动效纲领 / E-补1

- E-42｜全域｜toast 3.2s 自消（纲领 §四.1=2.5s）｜today/Toast useToast、ExecutePage、BoardingCheckinPage 三处计时器→2500ms｜已销
- E-43｜全域｜prefers-reduced-motion 无降级（纲领 §四.7 可访问性红线；App.css 仅有 vite 模板残留且未被引入）｜index.css 新增全域 reduce 降级（动画/过渡 0.01ms、单次迭代、scroll-behavior auto）｜已销
- E-44｜全域｜E-补1 横滑条滚动条隐藏｜全端 grep 实证：页面层无 overflow-x 横滑容器（周横条=flex 均分不滑、历史照片行 slice(0,6) 不溢出、执行页照片 flex-wrap；仅未使用 shadcn 件 ui/table.tsx 等带 overflow-x——客户端 D3-31 先例未使用件不动）；既有 `.no-scrollbar` 工具类（scrollbar-width:none+::-webkit-scrollbar{display:none} 双写，桌面同样干净）待命，未来新增横滑挂类即可｜已销（无命中，核验登记）
- E-45｜全域｜骨架屏抽验（纲领 §四.2 禁转圈）｜各屏加载>300ms 骨架=内容轮廓：TodayPage 分流骨架、两台轴骨架（hairline 小时行）、ExecutePage 摘要卡+stepper 骨架、BoardingCheckinPage 16:10 卡骨架、HistoryPage 行骨架，无页面级转圈；CheckinForm 上传中 Loader2=按钮内联态（非页面加载）｜已销（核验；行内 spinner 登记）
- E-46｜全域｜RequireStaff 引导页旧工艺残留（🐾 emoji、柠檬钮奶油字、15/16px 字）｜PawPrint 墨色线图标（emoji 禁令口径）+柠檬钮墨字（on-primary 对比度口径）+字阶 14｜已销
- E-47｜04/05｜返回条标题 text-title 17/700 vs 试样 `.nav h3` 16/700｜16 越字阶闸门→取 17（闸门内最近档贴左图；客户端 U1-A 详情页统一 20/600 为另一口径，跟随会拉大与左图差距，不随）｜已销（口径登记）
- E-48｜全域｜禁令核验｜改动文件 diff 新增行 grep（FFAAA5 / text-white / gradient / text-shadow）=0 命中；存量 text-white 仅在未使用 shadcn 件 ui/button.tsx、ui/badge.tsx（未使用件不动先例）；text-shadow 未使用（无需登记）｜已销

---

验证记录：`npx tsc -b` exit 0（全部改动落码后终态）；`VITE_API_BASE=http://app.beta.local:7200 npm run build:staff` ✓（2.37s）；禁令 diff grep 新增行 0 命中（E-48）。`node shoot.mjs staff` 7/7 ✓ + `python combine.py staff` 重合成，7 屏并排图逐张自查销项；屏下区域与交互态用 u4-pipeline/scrollshot-staff.mjs（临时辅助，不入 repo）实拍 5 张：scroll-02-svc（点服务中块就地展开服务卡——标题/服务中签/时间·时长·已核销行/六步进度段薄荷+柠檬+墨 6%/当前步行/柠檬「继续服务 · 第 3 步洗护」全格对位）、scroll-04b（locked 前后对比双槽+完成确认步+吸底条）、scroll-05b/05c（表单屏下：照片缩略+虚线槽+备注+吸底幂等副行；历史打卡行「第 1 晚·今天」+办理退房入口；两张同构图——页总高仅约 1.3 屏）、scroll-01b（屏下口令门/账号区/手动兜底工艺）。实机真值佐证：02 统计行「今天 2 单 · 已完成 1 · 当前空档 14:28–15:30」、05 「更新今日打卡」（今日已有打卡记录真态）、06「近 30 天 · 2 单」¥88 整数、07 三格「1 / — / 0」。chrome.mjs stop + stack.mjs stop 已执行。
