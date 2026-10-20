# PD46／CJ-1018-12 · 全端升档 U7 商家手机（phone-v57）

> 基线 main@`dd0417a0`（含 PD-42）｜模型 K3 MAX｜窗「全端升档-U7-商家手机」
> 权威：figma bro 定稿＋Ready／Figma `ot5SBoqhKAw2UIZRVFzhel`；VI `193:2`
> **PR 只开不合；A 禁合禁部；不写验收通过；不判美。** 合／部＝产品 ROG。

## 范围（只销 U7）

- **五槽壳**（`198:374／203:5219／198:445／203:5365／203:5480`）：总览／门店／收银／报表／我的——dock 五槽按 B10b 映射归槽；**新建 `/me` W-我的 店主真页**（身份卡＋经营/账本/系统入口，`203:5480`），dock 第五槽自 `/settings` 过渡口径改落 `/me`。
- **B10 高频六屏 ·phone-v57**（`212:2／73／144／220／291／362`）：驾驶舱／预约台账／监控 Hub／收银台／日结／退款。
- **B10b 低频八屏 ·phone-v57**（`213:2／84／166／248／330／412／494／576`）：商城订单／商品／会员·次卡／员工／报表／权限矩阵／门店设置／运营后台——低频豁免取消，逐屏齐。
- **语言包 `212:755`**＝可退／仅参考，未冒充逐屏。

## 施工要点

- `styles/console.css` 新增 phone-v57 媒体块（max-width:1279.5px，与 dock/rail 互斥同线）：可读文字全量 ≥12px（caption-xs／wsk／u3 件族小字全抬；dock 签 12）；`.wsk-cports` 整宽；wlist 行 ≥44；**≥xl 桌面零改动**。
- MainScaffold：<lg 页头纵排＋actions 折行；SearchInput 手机满宽。
- WMatrix：<lg 渲染分区卡列（`213:412`，非桌面缩略糊图），≥lg 桌面表原样。
- 收银台：红线明面带钉在收款面板下（手机态，`212:220`）。
- 五张裸表（预约台账／次卡／员工／报表台账＋骨架）进 `u3-noscrollx overflow-x-auto` 横滑容器＋合理 min-w；行内钮手机态 ≥36。
- ConsoleDock：B10b 激活归属（W-09/10→总览、W-11/15→门店、W-12/14/16→我的、W-13→报表）。
- 零新依赖、零服务端迁移、零 copy_overrides 改动（新键仅 `copy/console.ts` 码内 `wme.*` 族 fallback）。

## 验证（CDP 实测 390×844 · 全绿）

- `scripts/design-upgrade-u7-merchant-phone-check.mjs`：**104/104 通过**（15 屏结构＋2 二态；每屏 ≥12px／爪印=0／cream ≤2／零横溢；dock 激活逐屏对；全程无真付真退提交请求）。证据：`evidence/design-upgrade-u7-merchant-phone/`（README＋17 截图＋u7-results.json＋gates/）。
- 三端 `npm run build` exit 0；server `npm run typecheck` exit 0。
- merchant 全量 lint 既有 12 错 1 警；本片文件定向 lint vs 基线同文件集 **13=13 零新增**。

## 禁区遵守

未做：真付／真退／提交预约／开会员／真加购；B7／PD-40／`209:*`／选品／PD-39；C4–C6 桌面入口（归 U6）；U1～U6 深脸；桌面翻案；A 合部；验收通过；判美；`212:755` 冒充逐屏。

## 开口项

1. 生产 `copy_overrides` active 行 `wnav.dockMe` 若为历史「设置」（0049 旧口径），翻牌「我的」须产品侧走文案端口／另批迁移（本片零新迁移；server e2e 77.2 旧断言随翻牌另批更新）。
2. W-16 嵌入内核（owner-only 高级层 10 种）本体未逐个手机化；hub＋目录＋危险区已实测。
3. MonitorHub 僵尸桶钮／CashMovePanel 表单控件触控 <36px 属既有件，未圈本片，报备另批。
4. 真图／线性 icon 终库维持既有占位（Ready §5 挂账）。

详见 `evidence/design-upgrade-u7-merchant-phone/README.md`。
