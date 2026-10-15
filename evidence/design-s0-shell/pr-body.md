# 产品-1015 换皮 · 片0-三端壳（任务书冻结版 V1.0 · 头子 10-15 准）

> 纪律：PR 只开不合；合部＝产品经理走 ROG。卷宗：`evidence/design-s0-shell`（走查 md＋实证 json＋闸门 json＋实尺 14×2 对照截图）。
> 基线：生产 main@`a84397cc`（`a84397cc2503eb9c0ea67ff7cddf902372e9c9b9`）｜ 模型：K3 MAX ｜ 零新依赖 · 零新迁移 · server 零改动。

## 令围落点（A1→A2→A3→A4）

- **A1 客户端五 Tab 壳**：底栏顺序原已冻结（首页·预约·PHILIA·商城·我的）零改动；中央槽文字标「philia」→「PHILIA」；壳层全令牌化——pill=brand.pressed 94%+blur、激活块=brand #5C5040（Ready §2.1「dock 激活块」）、中央钮=cream（壳层 cream 唯一落点，页面主钮留第 2 处额度）、未激活=muted。
- **A2 员工 Dock 壳**：四槽 工位·预约·打卡·我的、cream 顶短划、无爪印——基线已符，随令牌层（`.sk` 变量）对齐；页面级爪印属片2 未动。
- **A3 商家壳**：桌面 rail 十九口→**十五口**（经营6+商城3+管理6+脚开发者；管理组下轨 排班/薪资/XP审核——路由全保留可直达；保留「运营 · 审批中心」=唯一待办角标口）；rail 激活左条=cream；手机五槽回「总览·门店·收银·报表·我的」（第五槽码内默认回「我的」，指向暂驻 /settings，W-我的真页属片3）。
- **A4 VI 令牌**：`tokens.ts`+`tailwind-preset.js` 双源同名同值对齐 Ready §2.1（brand/cream/canvas/surface/body/secondary/muted/divider/alert 同值/violet 新增）；三端 `:root`+`skeleton.css`+`console.css` 变量层随动；**success 族保留不动**（Ready「现网语义保留·勿换 brand」）；**dark 域不随动**（Ready 仅 light 终值，注记在案）。

## 闸门（全绿，明细入卷）

- 三端 `npm run build`（各含 tsc -b）✅ ｜ server `tsc --noEmit` ✅
- `smoke-routes` **110/110** ✅ ｜ `check-nav-closure` **126 路由 · 死胡同 0 · 弱 0** ✅
- 禁令 grep（diff 新增行）：珊瑚粉 / text-white / 柠檬黄渐变 / 旧雾感四值 = **0** ✅

## 报备产品侧（判断件五件，细则=卷宗 §四）

1. rail 管理组第六口裁留「运营 · 审批中心」（唯一待办角标口）；排班/薪资/XP审核下轨、路由保留。
2. `wnav.dockMe` 运行值=copy_overrides active 行「设置」（端口值优先）；码内默认已回「我的」，翻牌须产品侧经文案端口/另批迁移（本片零新迁移）。
3. 客户端 dock 长按快捷弹层保留（用户触发≠自发弹窗；壳层零新增弹窗）。
4. 员工端页面级爪印（RequireStaff 等）属片2 脸面批未动。
5. success 族三值未动；dark 域未随动（Ready 无 dark 终值）。

## 非目标守界

脸面内容批（片1–4）/icon 库全量/真图终摄/过程时间轴补帧/账本口径/钱权/L2/判美＝零触；A 禁合禁部。

— A 窗（施工方 · Kimi Code · 角色卡⑧）· 已用 K3 MAX
