# 卷宗 · CJ-1015-02 安心包／微光修订（A1→A2→A3 · 任务书冻结版 V1.0 · 头子 10-15 准）

> 分支 `feat/cj1015-02-weiguang-anxin-copy` ｜ 基线=生产 main@`1691683b`（全 `1691683b147b4222adbd84e5c20bca26916bd698`；PD-26 已合）｜ 档位 **K0／K1 小**（纯 copy／模型口径修订）｜ 2026-10-15
> 令书四件在区；三开口收死；不升 PD-27 在案（D-49 假阴性已更正）。

## 一、交付清单（片内序照令：A1 微光身份 → A2 安心包到店 → A3 宠物数不限）

| 刀 | 交付 | 实证 |
|---|---|---|
| **A1** 微光=免费注册用户身份 | 对外档名昵称=「微光」（`plans.tsx` planShortName，客户端会员/对照/开通全链路单源）；对内=注册用户（member_plans label「会员档·注册用户」不动，双标并置：开口①）；j1 四键（alreadyMemberFree/freeOpenedTitle/toastOpenedFree/q1.nonMemberGuide）改「微光（注册用户）」；**身份模型零端口凑**（plan_weiguang 免费档既有，非付费第四档；付费三档主轴零触） | F1 + e2e 107.3 |
| **A2** 安心包到店不绑 App | 新端点 `inventory.issueCarePack`（staffProcedure 本店员工）：库存扣减＋`stock_movements` manual 流水留痕（谁/何时/数量/「先发后补身份」注记）＋手机号可选挂 `member_perk_grants` care_package 权益行；**无号先发零拒发**（attachedUser=false=身份后补）；库存不足/非安心包 400 人话；配 `carePackageStockStaff` 读口；员工端盘点页新增「安心包发放」区（库存行+发放表单：数量/手机号/备注） | F2/F3 + e2e 107.2 |
| **A3** 宠物数正式不限 | 「含 100」作废：`membershipChargeFen` 免费档不套 max_pets 闸（isFreePlanRow 同源判定；付费档 10 只封顶照旧不翻案）；`member_plans` plan_weiguang value_json included_pets/max_pets 100→0（迁移 0085；seed 同步）；e2e 89.5 钉程随新裁定更新 | e2e 107.1 |

## 二、闸门（全绿）

| 闸 | 结果 |
|---|---|
| server typecheck / customer tsc -b / staff tsc -b / merchant tsc -b | 0 |
| e2e 全链路 | **全绿**（新增 107 族六断言；89.1/89.5 钉程随 CJ-1015-02 新裁定兼容修订〔双标四键白名单/includedPets=0〕；copy 计数链 4266→4279 四处+双注释同步）——`e2e-green.log` |
| build 双版（零参录证 + 栈版 VITE_API_BASE=7200） | 全绿 —— `build-zero.log` / `build-stack.log` |
| nav 闭环 / smoke-routes / smoke-deploy | 见 `nav-closure.log` / `smoke-routes.log` / `smoke-deploy.log` |
| 迁移 0085 | 幂等（INSERT NOT EXISTS×13 + UPDATE active=1×4 + member_plans json_set UPDATE×1）；闸门库核：copy active=**4279**/72 域 |

## 三、实尺帧（shots/）

| 帧 | 内容 |
|---|---|
| F1-member-weiguang-name.png | 客户端会员对照表：plan_weiguang 行档名=「微光」（对外昵称） |
| F2-issue-form.png | 员工端盘点页：安心包发放区（库存行）+发放表单（数量/手机号/备注） |
| F3a-issue-walkin-toast.png | 无号先发：库存扣减入流水+「已发放并入库存流水（身份可后补）」toast |
| F3b-issue-attached-toast.png | 挂手机号发放：权益台账挂接+「已发放并挂到客户权益包」toast |
| shot-results.json | 帧内断言全绿 |

## 四、候裁明面（产品侧定夺）

1. **89.1 白名单四键**：CJ-1015-02 开口①与微光正名批「旧名零残留」口径的交叠——四键（j1.alreadyMemberFree/j1.freeOpenedTitle/j1.toastOpenedFree/q1.nonMemberGuide）按新裁定含「微光（注册用户）」双标；白名单外全量端口文案值仍零旧名（钉程在码）。
2. **身份后补的补挂路径**：A2 无号先发只落库存流水（附手机号注记可选），客户事后建档不自动补挂权益行（补挂=另批或人工）；已裁「可先发」零硬拒已落地。
3. **plan_weiguang included/max=0 语义**=不设闸（免费档）；付费档 included=3/max=10 原样。
4. 安心包内容物清单/时长表大施工=仍候老板既有候件，本批未碰。

## 五、红线自报

不扩钱权／L2／真支付／提成／价目闸；不叫醒三角色；**未发设计换皮令**；未判美；未重做 IA；付费三档主轴/回馈金三本账/年费≠储值不翻案；勿端口凑身份；勿把微光当付费第四档卖；零新依赖；**A 窗禁合禁部，PR 只开不合**；收摊 PORTS_ALL_CLEAR。

— A 窗（施工方 · Kimi Code）2026-10-15
