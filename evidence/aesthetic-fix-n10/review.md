# PD-37 N10 独立评审与范围修复留痕

- 初审：agent-21（独立于施工上下文），只读源码 diff、专项与证据；未改文件、未运行写库／交易脚本、未执行合并。
- 初审结论：**With fixes**。N10 本身达标，但共享 `.m2-cardface .cf-claim` 规则的范围超出本批。

## 初审 Important：共享规则范围外溢

初版把共享规则从 11px 改为 12px，除了开通 deck，也会改变 `MemberCenterPage` 持有卡与 `MemberUpgradePage` 升级当前卡。专项只检查 deck，无法证明只影响 `/member/open`。

处理：新增范围外持有卡保持 11px 的断言。`check-review-before.log` 为 **1/2**，实测范围外持有卡也变为 12px，证明问题存在。随后将共享规则恢复 11px，仅在 `.m2-deck .cf-claim` 覆盖 12px。最终 `check-review-after.log` 与 `check-final.log` 均为 **2/2**：开通 deck 12px、范围外持有卡 11px。未追加第二轮评审。

## 初审 Minor（非阻塞，本批不扩写）

专项可在“部分缺卡”或“横向裁切”时进一步加固：当前过滤无 claim 的卡并只比较纵向边界。最终 JSON 已明确记录四处且均在卡内，不影响本次结果采信。后续可断言四卡齐全，并用文本 Range 检查全方向裁切。

## 最终证据

- 最终 diff 仅 `.m2-deck .cf-claim { margin-top: 9px; font-size: 12px; }` 一行；共享 `.m2-cardface .cf-claim` 为 11px。
- N4 19/19 与其他十组固定回归均通过，十一组合计 101/101。
- 三端构建、119/119 路由、127 路由闭环与本地 Mock 均通过。
