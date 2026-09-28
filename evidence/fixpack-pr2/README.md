# 修复包 PR-2（评价链七件）· evidence 卷宗（A 窗施工）

> 批次：复走修复包 PR-2（PD-10 施工令 · PD-02 冻结版第 2 层 + PD-05 件 3 · 免签直发）
> 分支：feat/fixpack-pr2（基线 main@81a6a56，PR-1 已合）｜施工：Kimi Code A 窗
> 日期：2026-09-28 ｜ PR 只开不合

## 七件落点

| 件 | 修法 | 实证 |
|---|---|---|
| A1+A2 双入口合一/星值一致 | 删详情页内联评价表单（默认 5 星/28px/未选可提交），复用 ReviewPanel（默认 0 星/44px/未选禁提交） | review-e2e.mjs 六断言全绿（默认 0 星/未选禁提交/44px/选星放开/提交转我的评价）+详情页截图 |
| A3 步名归一「交付检查」 | 6 处表+2 处硬编码+通知套异名（术前检查→预检/家长确认→完成确认）+步 1 简称（消毒→消毒工具确认）一把归一；照片数口径不动 | grep 代码侧步名残留=0；build 三端过 |
| A4 XP 标注粒度 | myEvents 出参补 ruleKey+boardingNights（points÷xp_rules 现值）；XpPage「寄养 N 晚」chip | XpPage 截图（「寄养 2 晚」chip 在屏） |
| A5 差评 −8+寄养负责人（PD-05 件 3） | 复用 staff_id 零新列：核销落定负责人（默认=当班寄养岗=首位 boarding 技能在职员工，兜底核销人）+leadStaffId 受理指派+assigned 留痕（by=checkin/checkinStay）；confirm 软指派；checkinStay 历史在住单补指派（员工端入住登记含负责人选择）；assign 改派放开 in_boarding；差评 −8 扣负责人 | e2e 4 断言全绿（负责人落定/留痕/改派/差评 −8 挂本评价 reviewId） |
| A6 好评单号链接 | myEvents 出参 appointmentId（review/penalty 联 reviews、boarding 联 boarding_stays）+XpPage 单号链接 | XpPage 截图（差评行带「单 …XXXXXX」链接） |
| A7 文案区分 | isSecureContext 共享 helper（打卡+扫码两套文案） | 代码级（HTTP 内测环境无法真机触发非安全源分支，QA 补验渠道=HTTPS 或 App 容器） |
| A9 差评 −8 可配行核查 | 零代码 | 配置端口 XP 页签输入框现值 `-8` 可配（CDP 实证截图+取值日志） |

## 闸门实证（真跑原文入卷）

| 闸门 | 证据件 | 结果 |
|---|---|---|
| 三端 build 根单命令 | pr2-build.log | ✅ exit 0 |
| server typecheck | （同 log 链） | ✅ 0 |
| server e2e | pr2-e2e.log | ✅ 全链路验收全部通过（A5 新增 4 断言全绿，0 红） |
| review-e2e（PD-02 闸门新增件） | review-e2e-detail.png+运行输出 | ✅ 六断言全绿（夹具自足：寄养建单→核销→退房） |
| smoke-routes | pr2-smoke.log | ✅ 49/51（唯二红=F1 已登记 D-2 环境口径，非本批域） |
| check-nav-closure | pr2-nav.log | ✅ 67 路由 0 死胡同（零新路由） |
| 禁令+禁用色 grep / 零新依赖零新迁移 | diff 域 | ✅ 0 命中 / 零改动 |

## 能跑能验截图（shots/）

- review-e2e-detail.png：详情页评价区（ReviewPanel 合规件在页）
- pr2-xppage-a4-a6.png：XpPage 差评 −8 带单号链接 + 「寄养 2 晚」chip
- pr2-a9-config-xp.png：配置端口 XP 页签（差评扣分行，输入框现值 -8）

## 过程诚实账（自检+子代理协同）

- A3/A7 两件派子代理并行施工（步名归一 8 文件/文案区分 3 文件），与主窗并行期发生一次
  git stash 协同插曲（子代理为 build 验证暂存主窗在飞文件，已恢复+重放，无丢失）；
- A5 设计落点按链路实况：客户线上创建寄养单无员工上下文，「创建即拦」落为
  「受理（核销/入住登记）强制落定负责人」；默认=当班寄养岗（PD-05 原文）非核销人，
  已按 PD-05 校准（首跑误用核销人默认值，自抓自修）；
- e2e 断言三轮校准：staff.id≠user.id 两处、差评 −8 找错旧行（按 reviewId 精确定位）、
  checkout 需负责人本人 cookie——全部自抓自修，最终全绿；
- A7 非安全源分支在 HTTP 内测环境天然可触发但真机验证归 QA（24 号档 P1-1 环境级）；
- 报备：MomentsPage.tsx:207 相册文案「前后对比照会自动收进这里」为相册语境名词
  （非六步步名），未动，请产品侧裁定是否随改（A3 子代理已报备产品侧）。
