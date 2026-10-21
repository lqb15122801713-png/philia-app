# PD-52 · 客壳 banner q=null「待换」fallback（并 F-待换）卷宗

> A窗 · feat/pd52-banner-fallback @ 基线 main@`4313b1c323841137972f2c0c4c7e4f5e45c53c78` · K3 MAX · 2026-10-21
> 令包：大测-产品-1021-下批令包字段-PD52-banner-fallback-4313b1c.md · 只修一缺陷（开挂不扩）

## 缺陷定位

- `apps/customer/src/pages/HomePage.tsx:159`：`const bannerImage: string | null = null`——图源写死 null（令包所称 q=null），`HomeImage` 恒走 `hv2-image-fallback`「待换」。
- 同函数 148–158 行 `bannerSlotRaw = slotContentOf('home.banner')` 已吃 slotPort liveMap（PD-50 合部后 live 行 url=`/brand/banner-home-1200.png` 在库），但只接了 alt/title/cta，**url 未接线**。

## 修法（最小 diff = 2 行）

```diff
-import { CK, getStepDef, slotContentOf, slotPreviewState, useMe, usePhiliaClient } from '@philia/shared'
+import { CK, getStepDef, resolveSlotUrl, slotContentOf, slotPreviewState, useMe, usePhiliaClient } from '@philia/shared'
 ...
-  const bannerImage: string | null = null
+  const bannerImage = resolveSlotUrl(bannerSlot?.url ?? null)
```

- 口径同仓内既有惯例（`MallPage.tsx:73`、`v2.tsx:160`）：`resolveSlotUrl` 归一化（/api/* 拼 base，/brand 等 public 路径原样）。
- 沿用 audience 过滤后的 `bannerSlot`（与 alt/title/cta 同一行口径，aria/alt 对齐 live）。
- `HomeImage` 兜底逻辑零改动：无 url／图 404（onError）→ 明确「待换」fallback 仍在。

## 成功标准对照

| 令包期望 | 证据 | 判定 |
|---|---|---|
| ①横幅 src 吃 liveMap/slotPort home.banner.url，禁写死 q=null | `02_DOM证据.json`：home-banner-img tag=IMG src=/brand/banner-home-1200.png（=liveMap 值） | PASS |
| ②live 有合法 url 时不见「待换」，aria/alt 对齐 live | alt=首页品牌横幅（=live alt）；banner 区无「待换」文本、无 fallback 类；截图 01 真图在屏 | PASS |
| ③无图／url 非法时才可明确 fallback | 对照：精选卡（无 live url）仍 DIV.hv2-image-fallback「待换」；onError 兜底未动 | PASS |
| ④不清 pending×3／不 publish／不扩 CLIP·KPI·STEPS | diff 仅 HomePage.tsx 2 行；无 drizzle／_journal.json 变更（0093 未启用） | PASS |
| 不误伤商／员端 | diff 只触 apps/customer；两端未构建面零改动 | PASS |

## 卷宗清单

| 件 | 内容 |
|---|---|
| `01_客壳home_banner吃live图.png` | CDP 真浏览器 390×844 截图：横幅=品牌真图非「待换」 |
| `02_DOM证据.json` | liveMap 真值 + banner-img DOM 探针（tag/src/alt/naturalOk）+ banner 区 outerHTML + 精选卡对照 |
| `03_runtime_链路实测.txt` | 环境／静态闸／运行时链路／边界守护全记录 |

## 复现路径

临时库 migrate+seed → server :7200 → customer dev :7152（/api 代理 7200；CORS_ORIGINS 加 7152）→ dev-login 客户 → /home。取证脚本为一次性 CDP 件（零依赖，学 scripts/capture-shell-shots.mjs），用毕即删不入库。
