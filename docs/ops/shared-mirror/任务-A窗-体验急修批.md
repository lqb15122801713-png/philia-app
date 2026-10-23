# 任务卡 · A 窗 · 体验急修批（导航回退链 6 件+返显钩子+theme-color）

> 产品侧 2026-09-29 晚 · 老板 20:10 批「紧急修复吧」（P0 体验，插队列首位，片 3 顺延）。
> 依据=产品-0929-体验走测缺陷清单.md（共享区，逐条实证在案）。基线=**main@8c77bdc8**，分支 `feat/navfix-urgent`，卷宗 `evidence/navfix-urgent` 分支。

## 一、施工范围（8 件，估 10 文件内，只动这些）

### A. 回退链 6 件（统一修法：返回=时间序回退 navigate(-1)；直访无栈兜底父页——BackButton/PageHeader 组件既有能力，去掉写死的固定 to=）

| # | 文件 | 现状→修法 |
|---|---|---|
| A1 | `pages/AppointmentLivePage.tsx` | backLink=固定 Link 到 `/appointments/:id`（压栈致全程↔详情死循环）→ 改 navigate(-1)，直访兜底 `/appointments/:id` |
| A2 | `pages/PetsPage.tsx` | PageHeader to="/philia" → 改 -1，兜底 /philia |
| A3 | `pages/MomentsPage.tsx` | PageHeader to="/philia" → 改 -1，兜底 /philia |
| A4 | `pages/MemberRebatePage.tsx` | PushBar to="/member" → 改 -1，兜底 /member |
| A5 | `pages/MemberCardPage.tsx` | PushBar to="/member" → 改 -1，兜底 /member |
| A6 | `pages/MemberCenterPage.tsx` | PushBar to="/me" → 改 -1，兜底 /me |

**口径入规**：返回键一律时间序回退；固定 to= 仅允许交易成功页双出口类明示场景（预约成功/支付成功既有件不动）。

### B. 商城返显钩子 1 件（三屏：MallPage 商品卡/ProductDetailPage 返显卡/CartPage CTA sub）

微光/非会员（rebateBp=0）：不显示「返 ¥x」（假数红线不动）**改显示规则钩子**——「付费档返 2/5/10% · 仅抵商品 ›」，点击→/member/open（J-01）；文案入 copy 键（新键清单随开工回执先报）；付费档（rebateBp>0）显示「返 ¥x 回馈金」现状不动。

### C. theme-color 1 行

`apps/customer/index.html` meta theme-color：#F6F1E3 → #FAF8F2（片 1 纸白化跟漏）。

## 二、施工红线

只修上列 8 件，不顺手扩；零新依赖零新迁移；e2e 断言零删改（可加回退链断言）；PR 只开不合；疑点报备不擅自改需求。

## 三、闸门

三端 build 根单命令 0 / server typecheck 0 / server e2e 全量（断言零删改）/ nav-closure 0 死胡同 / smoke-deploy / review-e2e 13 项 / smoke-routes（唯 F1×2 成文口径）/ 禁令 grep=0。

## 四、能跑能验（回退链实证=本片验收核心）

CDP 真点走测六条链全过（390×844）：
① /home→LIVE 卡→全程页→返回=**/home**（再点返回不得回全程页，死循环归零）；② /philia→LIVE→返回=/philia；③ /home→管理 ›→宠物档案→返回=**/home**；④ /home→案例流→服务相册→返回=/home（无照种子则改测 /philia→相册→返回=/philia）；⑤ /me→回馈金账本→返回=**/me**；⑥ /home→会员码屏→返回=**/home**、/home→会员中心→返回=/home。
直访兜底实证：新 tab 直开 /appointments/:id/live→返回=/appointments/:id；直开 /philia/pets→返回=/philia。
返显钩子截图两态（微光见钩子/付费档见返 ¥x——付费档态可注入或 mock 说明）；每链截图入卷。

## 五、流程

开工回执（基线+范围+新键清单首报）→ 修 → 闸门全绿+走测实证入卷 → PR 只开不合 → 交付回执入区 → 产品侧七步复核（重点=回退链走测复跑）→ 老板书面授权合并 → 部署 → 转片 3（任务- A 窗-换皮批片3.md 在区候命）。
