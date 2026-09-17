# 批次 U1.1 证据卷宗 · 客户端 VI 图标插槽启用

- 工作分支：`feat/u1-assets-slots`（commit `b6b82a6` `feat(u1): assets-slots`）
- 基线：main @ `91ea3fa9`
- 日期：2026-09-17 ｜ 施工：K3

## 验收总闸门逐项

| 闸门 | 结果 |
|---|---|
| 1. build exit 0 | ✅ `build-u11.log`（customer build ✓ 14s + PWA 产物） |
| 2. 两屏并排对照截图 | ✅ 本目录 `task1-home/`、`task2-booking/`（390×844，实现侧；试样 v9.1 为产品侧母本，截图与其口径并排复核） |
| 3. smoke-routes 31/31 | ✅ `smoke/smoke-routes-u11.log` + `smoke-u11-final.json`（exit 0） |
| 4. diff 仅两文件 | ✅ `diff-stat.log`：仅 HomePage.tsx + ServiceChipsBlock.tsx |
| 5. 珊瑚粉/text-white/渐变 grep=0 | ✅ `grep-checks.log`（diff 新增行命中 0） |

## 任务核对

- 任务 1（首页三入口）：EntryIcon 换 `/photos/icons/ic-bath|ic-groom|ic-board.png`，容器 48px 圆/底色不变，img onError 回退原 lucide（Bath/Scissors/BedDouble）。截图 `task1-home-icons.png`：三入口 VI 插画图标已显示。
- 任务 2（预约单屏服务大卡）：CatCard 照片插槽换 ic-bath/ic-groom，容器尺寸不变，onError 回退 lucide。截图 `task2-booking-catcards.png`：洗澡/造型美容两大卡插画图标已显示，选中态墨圈不回归。
- 明确不做遵守：ic-shop 商城入口未启用；其余文件/样式/逻辑零改动；零新依赖（package-lock.json 已还原）。

## 冒烟环境注记

- 本地全新种子库无走查单：`staff /execute/<走查ID>` 锚点依赖在卷单号（smoke 脚本默认值对应 VPS 走查数据）。以 `server/scripts/demo-live.ts` 造真实服务中单、`demo-finish.ts` 走完全程后，带 `SMOKE_APPT_ID=01M2PY9D6PJZ1508393BBV4C7A` 复跑，31/31 全绿。
- 中途一轮 29/31 的两处「失败」均为数据态锚点偏移，非回归：① 全新种子无走查单（staff execute）；② 服务中态首页标题变「洗护进行中 · 第 N 步」（customer /home 锚点「守护每一次洗护」让位）——两态下页面均 200 非空白、console 零红线。
