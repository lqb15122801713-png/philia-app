# PD-36／CJ-1018-02 · 拟人验证修调 N9 卷宗

- 分支：`feat/aesthetic-fix-n9`
- 基线：`1340e83115532addc88c95baaf350c9915a179c3`
- 范围：只销 N9；Obs3d／N5／O7／O8／O10／五态／读本期／chip／truncate／Obs5f 不施工；已销 Obs5ace／N1～N8 不动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未提交预约、未点立即购买／提交／会员开通／真加购结账；未合并未部署；不判美

## 一、基线复现

`gates/check-before.log` 与 `before-results.json` 为 **0/1**：StaffPicker 四张员工卡均含角色副文，目标「洗护·美容」存在，最小计算字号 **8.5px**，横轨 `scrollLeft=0`。基线截图为 `before-n9-staff-picker.png`。

## 二、修调

仅 `apps/customer/src/components/booking/StaffPicker.tsx` 两处共享副文由 `text-[8.5px]` 改为 `text-caption`（12px）：员工角色副文与同组件随缘卡副文。`leading-[1.6]`、选择逻辑、员工顺序、横轨 snap／overflow 与 `scrollLeft` 复位均未改。商城返显 8.5px 未触碰。

`gates/source-scan.log` 记录该组件 `text-[8.5px]` 零命中。

## 三、最终实证

`gates/check-final.log` 与 `final-results.json` 为 **1/1**：

| 角色副文 | 计算字号 | 矩形 |
|---|---:|---|
| 洗护·美容 | 12px | left=54.391、top=455、宽 55.203、高 19.188px |
| 洗护·寄养 | 12px | left=198.391、top=455、宽 55.203、高 19.188px |
| 美容·寄养 | 12px | left=342.391、top=455、宽 55.203、高 19.188px |
| 洗护 | 12px | left=502、top=455、宽 24、高 19.188px |

最终截图为 `final-n9-staff-picker.png`；横轨 `scrollLeft=0`。未点击员工卡或预约提交。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| `StaffPicker.tsx` ESLint | exit 0 | `gates/lint-targeted.log` |
| 专项脚本语法 | exit 0 | `gates/check-script-syntax.log` |
| PD-30 Obs4／Obs6 | 4/4 | `gates/regression-obs46.log` |
| PD-29 N1／N2 | 17/17 | `gates/regression-n1n2.log` |
| PD-31／32 N3／N4 | 19/19 | `gates/regression-n3n4-r2.log` |
| PD-27 B1～B5／O6（含 D-58） | 9/9 | `gates/regression-b1b5.log` |
| PD-27.1 D-60 | 7/7 | `gates/regression-d60.log` |
| PD-28 主专项 | 10/10 | `gates/regression-o-pd28.log` |
| PD-28 状态矩阵 | 8/8 | `gates/regression-o-pd28-state.log` |
| PD-33 N6／N7 | 14/14，独立 7203／7135 | `gates/regression-n6n7.log` |
| PD-34 N8 | 6/6，独立 7202／7134 | `gates/regression-n8.log` |
| PD-35 Obs5ace | 6/6 | `gates/regression-obs5ace.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |

十组固定专项合计 **100/100**。

## 五、独立只读评审

`review.md` 记录 agent-20 评审：Critical 0、Important 0，技术判断 Ready=Yes。唯一非阻塞 Minor：专项可把随缘卡副文与 `railScrollLeft` 也纳入 `ok`；当前随缘卡与员工副文共用 `text-caption`，D-58 已独立断言横轨非负 X 与 `scrollLeft=0`，故不扩写本批。

## 六、复跑

```bash
EVIDENCE_PREFIX=before node scripts/aesthetic-fix-n9-check.mjs
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-n9-check.mjs
```

默认客户端 `127.0.0.1:7130`、API `127.0.0.1:7200`。专项使用既有种子客户／宠物／洗护服务，不创建宠物或预约，不触发交易。

本卷宗是施工方自报证据，不替代产品侧后续八步与窄回归。
