# PHILIA 品牌 Token 冻结表 v1.1（批次 5 · B5-0 已冻结）

> 本文件 =《PHILIA-VI到App-Token转译方案》v1.1 冻结版 + 完整 token 映射终值表（含 dark 子表）。
> 效力：批次 5 起**唯一改色通道凭据**。改色只改 `packages/shared/src/tokens.ts` 与
> `packages/config/tailwind-preset.js`（同名同值双同步），组件禁止硬编码色值。

## 一、VI 色板（锁定）

| 角色 | 名称 | 色值 |
|---|---|---|
| 主品牌色 | 柠檬黄 | `#FDC830` |
| 辅品牌色 | 薄荷绿 | `#7FD8BE` |
| 空间色（寄养/房间场景） | 浅木 | `#D4B896` |
| 文字色 | 深棕墨 | `#4A3B2E` |
| 底色 | 米白 | `#F6F1E3` |

- **珊瑚粉 `#FFAAA5` 已删**，全域 0 命中（专项检查每次清剿必跑）。
- VI 字体：中文 **Noto Sans SC**；拉丁 **Montserrat**（标题/数字）与 **Poppins**（正文）。
  全部自托管 woff2，禁外链 CDN；中文禁斜体；中文不落拉丁展示字体。

## 二、推导规则（冻结）

- 交互态同 H 同 S：hover 明度 **−6**、pressed **−13**（dark 域方向反转：hover **+6** / pressed **−6**）。
- 洗色 light：主色同 H、S−12、L=92；副色同 H、S−9、L=88；功能色同 H、S−7、L=92；浅木同主色规则。
- 加深 deep：副色同 H、S+2、L−8；功能色同 H 同 S、L−10。
- 中性族（secondary/border/muted）hue 一律对齐深棕墨 **27.9°**。

## 三、light 域终值表（shadcn HSL 行 + 品牌 token）

```
--background: 44 51% 93%;      /* 米白 #F6F1E3 */
--foreground: 28 23% 24%;      /* 深棕墨 #4A3B2E */
--card: 0 0% 100%;             /* 纯白（保留） */
--card-foreground: 28 23% 24%;
--popover: 0 0% 100%;
--popover-foreground: 28 23% 24%;
--primary: 44 98% 59%;         /* 柠檬黄 #FDC830 */
--primary-foreground: 28 23% 24%;  /* on-primary 深棕墨，对比度 6.89:1 */
--secondary: 162 44% 88%;      /* 薄荷绿洗底 #D3EEE6 */
--secondary-foreground: 28 23% 24%;
--muted: 46 55% 90%;
--muted-foreground: 28 13% 47%;    /* #8A796B */
--accent: 162 44% 88%;
--accent-foreground: 28 23% 24%;
--destructive: 4 74% 49%;      /* 功能红 #D92D20 */
--destructive-foreground: 0 0% 100%;   /* 白字 on 红 4.83:1 */
--border: 26 29% 89%;
--input: 26 29% 89%;
--ring: 28 23% 24%;
```

品牌 token（tailwind preset 同名同值）：

| token | 值 |
|---|---|
| brand.primary / hover / pressed / light | `#FDC830` / `#FDC012` / `#E8AD02` / `#FCF3D9` |
| brand.secondary / light / deep | `#7FD8BE` / `#D3EEE6` / `#5ED1AF` |
| bg.canvas / card / sunken | `#F6F1E3` / `#FFFFFF` / `#F3ECD6` |
| bg.oak / oakLight | `#D4B896` / `#F1EBE5` |
| text.primary / secondary / placeholder / inverse | `#4A3B2E` / `#8A796B` / `#BDB2A8` / `#FFFFFF` |
| border.default / strong / divider | `#EBE2DB` / `#DDD1C6` / `#F0EAE5` |
| success base / light / deep（原值保留） | `#7FA87C` / `#E8EFE8` / `#649160` |
| danger base / light / deep | `#D92D20` / `#F8DFDD` / `#AC2419` |
| gradient philia / hover | `135deg #FDC830→#7FD8BE` / `135deg #FDC012→#5ED1AF` |
| shadow card / elevated / philia | `0 2px 10px rgba(61,50,41,.05)` / `0 8px 24px rgba(61,50,41,.08)` / `0 6px 16px rgba(253,200,48,.35)` |
| halo from / to（1.8s） | `rgba(253,200,48,.45)` → `rgba(253,200,48,0)` |
| radius tag/input/card/sheet/full | 8/12/16/20/9999px |
| font sans / display / number | Poppins→Noto Sans SC→系统栈 / Montserrat→Noto Sans SC / Montserrat→Noto Sans SC→系统栈 |

## 四、dark 域子表（确认书第 3 条：本批次开启）

```
--background: 28 25% 12%;      /* #261E17 */
--foreground: 44 51% 93%;      /* 米白反相 #F6F1E3 */
--card: 30 23% 17%;            /* #352B21 */
--card-foreground: 44 51% 93%;
--popover: 30 23% 17%;
--popover-foreground: 44 51% 93%;
--primary: 44 98% 59%;         /* 柠檬黄原值（dark 10.53:1） */
--primary-foreground: 28 23% 24%;
--secondary: 162 44% 88%;
--secondary-foreground: 28 23% 24%;
--muted: 30 22% 9%;
--muted-foreground: 28 12% 68%;
--accent: 162 44% 88%;
--accent-foreground: 28 23% 24%;
--destructive: 4 74% 57%;      /* #E34A3F（+8 提亮） */
--destructive-foreground: 0 0% 100%;
--border: 27 20% 26%;
--input: 27 20% 26%;
--ring: 44 98% 59%;
```

| dark 品牌 token | 值 |
|---|---|
| brand.primary / hover / pressed / light | `#FDC830` / `#FDD04E` / `#FDC012` / `#5F4807` |
| brand.secondary / light / deep | `#7FD8BE` / `#225848` / `#5ED1AF` |
| bg.canvas / card / sunken / oak / oakLight | `#261E17` / `#352B21` / `#1C1712` / `#6D502C` / `#352B21` |
| text.primary / secondary / placeholder / inverse | `#F6F1E3` / `#B7ADA4` / `#8F7E70` / `#4A3B2E` |
| border.default / strong / divider | `#504135` / `#685545` / `#40352B` |
| success base / light / deep | `#97B895` / `#2D3A2C` / `#C1CEBF` |
| danger base / light / deep | `#E34A3F` / `#551511` / `#EEAEAA` |

sidebar-* 变量按同祖规则推导：background←card；foreground/primary/accent/border/ring 对齐同名主变量。

## 五、组件硬编码清剿口径

- 蒙层/遮罩一律 `bg-ink/<alpha>`（如 `bg-ink/45`），禁止 `rgba(61,50,41,x)` arbitrary。
- 品牌色面上的文字/图标一律 on-primary 深棕墨（`text-ink`），禁 `text-white` on brand-primary/gradient。
- 功能红面上保留白字（`text-white` on `bg-danger`，4.83:1）。
- 语义对不上的一律列「存疑清单」，不得私自配色。
