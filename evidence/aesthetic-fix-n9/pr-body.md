PD-36／CJ-1018-02 · 拟人验证修调 N9

- 基线：main@`1340e831`（`1340e83115532addc88c95baaf350c9915a179c3`）
- 分支：`feat/aesthetic-fix-n9`
- 模型：已用 K3 MAX
- PR 只开不合；A 窗不部署

## 范围

只销 N9：StaffPicker「洗护·美容」角色副文由 8.5px 升至 ≥12px，并去掉该组件 `text-[8.5px]` 硬编码。Obs3d／N5／O7／O8／O10／五态／读本期／chip／truncate／Obs5f 不施工；已销 Obs5ace／N1～N8 不动。零新依赖、零迁移；未提交预约、未点立即购买／提交／会员开通／真加购结账。

## 修调

- 仅 `StaffPicker.tsx` 两处共享副文由 `text-[8.5px]` 改为 `text-caption`（12px）：员工角色与同组件随缘卡副文。
- `leading-[1.6]`、选择逻辑、员工顺序、横轨 snap／overflow 与 `scrollLeft` 复位未改；商城返显 8.5px 未触碰。
- 新增真实浏览器专项，使用既有种子客户／宠物／洗护服务测量角色副文，不创建宠物或预约。

## 证据

卷宗：`evidence/aesthetic-fix-n9`

- 基线 0/1：四张员工卡最小字号 8.5px，目标文案存在，横轨 scrollLeft=0。
- 最终 **1/1**：四张员工卡均 12px；「洗护·美容」矩形 left=54.391、top=455、宽 55.203、高 19.188px；横轨 scrollLeft=0。
- `StaffPicker.tsx` 的 `text-[8.5px]` 零命中。
- 三端 build、server typecheck、目标 ESLint、专项语法：exit 0。
- 十组固定专项合计 100/100：PD-30 4/4、PD-29 17/17、PD-31／32 19/19、PD-27 9/9（含 D-58）、PD-27.1 7/7、PD-28 主专项 10/10、状态矩阵 8/8、PD-33 14/14、PD-34 6/6、PD-35 6/6。
- `smoke-routes` 119/119；导航闭环 127 路由零死胡同；`e2e-nav-check` 与本地 Mock `smoke-deploy` 全部通过。
- 独立只读评审 Critical 0、Important 0，Ready=Yes；一项 Minor 为专项可补随缘卡与 railScrollLeft 断言，不阻断当前证据。

详细坐标、前后截图、评审与全部日志均在卷宗内。施工方自报全绿不替代产品侧后续复核。
