# PD-36 N9 独立只读评审

- 评审：agent-20（独立于施工上下文）
- 对象：`1340e831` 基线上的工作树 diff、未跟踪专项、前后量尺／截图与固定闸门日志
- 约束：只读；未改工作树、索引、HEAD、分支或证据；未派生其他评审；未运行写库／交易脚本；未执行合并

## Strengths

- 指定 diff 仅为 `StaffPicker.tsx` 两处类名替换；`onSelect`、`selectedId`、横轨 snap／overflow、`scrollLeft` 复位与 `leading-[1.6]` 均未改。
- `text-caption` 在 preset 中明确为 12px；最终四张员工卡全部为 12px、目标「洗护·美容」存在，且 `railScrollLeft=0`。before 8.5px／0/1，final 12px／1/1。
- 第二处随缘卡副文与员工角色副文原本同款式，且本批要求去掉组件内 `text-[8.5px]`，属于合理同族处理；card 皮与 Obs5a 已使用同一令牌。
- 商城返显 8.5px 未触碰；StaffPicker 硬编码零命中。
- 专项使用 computed style、角色卡非空、目标文案、最小字号与检查数约束，基线负对照有效。
- 十组固定专项合计 100/100；D-58 独立断言首卡非负 X 与 `scrollLeft=0`，可捕捉下游布局回退。

## Issues

### Critical

无。

### Important

无。

### Minor（非阻塞，本批不扩写）

`scripts/aesthetic-fix-n9-check.mjs:189-205` 排除了 `gs-groomer-any`，且 `ok` 未纳入 `railScrollLeft`；单独的 N9 1/1 不能证明随缘卡副文运行时字号，也不独立防横轨回退。当前第二处与员工副文共用 `text-caption`，final JSON 记录横轨为 0，D-58 又独立断言横轨，因此属于证据补强项而非功能缺口。后续可补随缘卡副文与 `Math.abs(railScrollLeft) < 1` 断言。

## Declined to judge

- 评审未复跑构建或测试，尤其未运行写库、造单或交易脚本；结论基于源码、日志、JSON 与截图。
- 未做真实移动设备字体栅格化验收，也不判断 PR 是否实际合并。

## Recommendations

- 可选择补齐上述专项断言，但无需扩大产品代码或既有回归范围。
- 保持当前两处产品差异，不顺手调整商城 8.5px 或其他已销项。

## Assessment

**Ready to merge? Yes。**

两处改动准确销项且目标实测达到 12px，无业务、选择态、横轨或其他 8.5px 的越界修改；专项覆盖补强为 Minor，不阻断技术 Ready 判断。PR 仍只开不合。
