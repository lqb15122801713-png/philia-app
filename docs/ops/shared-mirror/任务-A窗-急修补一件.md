# 任务卡 · A 窗 · 急修补一件（J-01 弹球陷阱 · P0）

> 产品侧 2026-09-29 晚 · 老板亲测撞上（购物车→钩子→办理页→出不去）。
> 基线=**main@e747014a**（急修批已合），分支 `feat/navfix-j01`，卷宗 `evidence/navfix-j01` 分支。

## 缺陷（P0）

**J-01 办理会员页弹球陷阱**：`MemberOpenPage` 的 PushBar 写死 `to="/member"`——非会员按返回 → /member（会员中心）→ 36 号档分流口径（无档→replace 弹回 /member/open）→ 再按返回 → 又去 /member → 弹回……**非会员被关在 J-01**（详情级页无 dock，唯一出口失效）。老板原话：「出不去了」。

## 修法（一处）

`MemberOpenPage.tsx` PushBar：`to="/member"` → 去掉 to=，改 `fallback="/home"`——返回=时间序回退 navigate(-1)（购物车/我的页/首页身份带/钩子等任何来处都回得来）；直访兜底=**/home**。

**红线**：兜底**不许 /member**（非会员直访 J-01 按返回→/member→分流弹回 J-01，再造弹球）；/member 分流口径本身不动（36 号档 §〇 既定）。

**顺带核查（不改只验）**：开通完成页 DonePanel onBack=navigate('/member')——开通成功后用户已有档，/member 正常渲染 A-3 非陷阱，保留不动，走测验证一次即可。

## 闸门与实证

- 三端 build 0 / typecheck 0 / e2e 全量（断言零删改）/ nav-closure 0 / smoke-deploy / review-e2e / smoke-routes（F1×2 除外）/ 禁令 grep=0 / 零新依赖零新迁移；
- **CDP 回退链实证（验收核心）**：⑦ /mall/cart→钩子「仅抵商品 ›」→/member/open→返回=**/mall/cart**；非会员态 /member→自动分流 /member/open→返回=**来处不弹球**；直访新 tab /member/open→返回=/home；开通微光成功→完成页「回会员中心」→/member 正常 A-3 态。全链截图入卷。

## 流程

同急修批：读卡即修 → 闸门+实证入卷 → PR 只开不合 → 回执入区 → 产品侧复核 → 老板授权 → 部署。体量=1 文件，快修快走。
