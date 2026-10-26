# PD-96 · 独立 B 监理审查记录

审查方式：独立 subagent 会话，严格只读；未修改工作树、索引、HEAD、分支或证据，未再派 reviewer，未合并、未部署。

## 初审结论

- 产品逻辑：Critical 无；Important 无。
- 根因与最小 diff 对齐：`MerchantRail` 的 `role.isOwner` → `role.canManage`，`canManage` 仅为 owner／manager；clerk 仍由 rail 提前分流与 `ClerkRouteGuard` 限制。
- `HqConsolePage`、`App.tsx`、server 与 `merchantOwnerProcedure` 零 diff；关店最终确认仍有 `isOwner`、知晓勾及 server 硬闸。
- 探针从 `/matrix` 真实鼠标点击侧栏到 `/hq`，不是地址栏直达；CTA、独立层、cancel 均复用既有页面。
- baseline manager 为有效 RED；after manager／owner 各 14 项全绿，三类写调用为空，同一 mock 店保持 active。
- 候选构建、`dist/index.html`、两角色结果及 Desktop 记录均指向 `index-Bh5WsuOY.js`。
- Desktop harness 早期误点、导航与快照异常被明示，没有归成产品结论；最终关闭 device emulation 后从 `/matrix` 完整复走。

### 初审 Minor 与处置

| Minor | 处置 | 复核 |
|---|---|---|
| `lint-target.log` 为 0 字节，缺命令与退出码，无法独立审计 | 重新执行定向 ESLint；`lint-target.txt` 记录 cwd、实际命令、`exit=0`、空诊断及仅覆盖两个变更文件 | closed |
| 六份引用日志被 `.gitignore` 的 `*.log` 排除，PR 可能缺件 | 五份原始日志改为 `.txt`；lint 实录也改为 `.txt`；旧空 `.log` 删除 | closed |

复核展开 `git status --short --ignored=matching --untracked-files=all` 后，PD-96 证据全部为未跟踪可提交文件，无 `!!`；目录内无残留 `.log`。复核后 Critical／Important／Minor 阻断均无。

## 监理判断

**Ready to open PR：Yes。** 初审为证据两项 With fixes，复核全部 closed；此判断不代表 ready to merge，不代替现网 HIT。

## 交付 HIT 监理附签

| 项 | 候选审查结论 | 仍需挂账 |
|---|---|---|
| 侧栏入口 | baseline 有效见红；after 两角色均见原生可见链接，帧面一致；clerk 代码分流未扩 | 合部后现网分别核 manager／owner 真面可见可点 |
| 经侧栏达 HQ | 从 `/matrix` 经真实鼠标点击到 `/hq`；Desktop 最终亦从 `/matrix` 复走 | 现网仍须从非 `/hq` 页面复走 |
| CTA＋开闸撤 | 两角色各 14 项：CTA→单确认层→cancel→弹层归零；manager 最终确认禁用 | 现网至少一路成对开闸／cancel，不以直达路径替代 |
| 未真关 | close/reopen/clone 调用均空；同一 mock 店 active、无第二店、无数据库写入 | 现网只核 cancel 网络零写；不执行真实关店 |
| 新 js／现网 tip | 候选 `index-Bh5WsuOY.js`；现网只读仍 `index-ZxpJoGaZ.js` | 合部同源 tip／新 dist HIT 待合部部署后执行 |
| 0137 | 零 schema、零 `server/drizzle` diff，0137 故意空留；0138 及其他禁占号未占 | PR 与回执继续明示 |

明确搁置于本窗之外：PD-94 真实关店成功、软关数据库全量、再开与克隆；真实 server／账号的生产鉴权与店域装配；合部后的现网复核；Desktop harness 自身的缩放根因。以上均不借本窗扩做或冒领结论。
