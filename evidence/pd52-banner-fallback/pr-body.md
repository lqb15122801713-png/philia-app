# fix(customer): PD-52 客壳 banner 图源接 liveMap home.banner.url（q=null 恒「待换」修，并 F-待换）

## 缺陷

客壳首页横幅 `HomePage.tsx` 图源写死 `bannerImage = null`（q=null 硬编码），`HomeImage` 恒走 `hv2-image-fallback`「待换」；PD-50 合部后 liveMap 已有 `home.banner.url=/brand/banner-home-1200.png`，alt/title/cta 早已接线，唯独 url 漏接。

## 修法（最小 diff：2 行）

- import 增补 `resolveSlotUrl`；
- `const bannerImage: string | null = null` → `const bannerImage = resolveSlotUrl(bannerSlot?.url ?? null)`。

口径同仓内 `MallPage.tsx` / `member/v2.tsx` 既有惯例；沿用 audience 过滤后的 `bannerSlot`（与 alt/title/cta 同源，aria/alt 对齐 live）；`HomeImage` 兜底（无 url／onError → 明确「待换」）零改动。

## 验证（卷宗 evidence/pd52-banner-fallback）

- build:customer（tsc+vite）PASS；eslint HomePage.tsx PASS；
- 运行时链路（临时库真 migrate+seed → server:7200 → customer dev，CDP 真浏览器）：liveMap home.banner live 透出 → 客壳 `home-banner-img` = `<img src="/brand/banner-home-1200.png" alt="首页品牌横幅">` 真图加载成功（naturalOk），banner 区无「待换」、无 fallback 类；
- 对照：无 live url 的精选卡仍明确「待换」fallback（无图才 fallback）；
- 截图证非「待换」：`01_客壳home_banner吃live图.png`。

## 边界（开挂不扩）

不改 slot_key；不 publish；不清 pending×3（归 PD-53）；不碰 NAV_CHROME_CLIP（归 PD-54）／KPI／STEPS；不动 drizzle/_journal.json（迁移号 0093 未启用，不碰 0094/0095）；商/员端零改动。

依据：线上运营_修后点验_PD50_O-SLOTKEY_2026-10-21.md；修后点验_PD50+PD51_合部后生产_窄回归汇总_2026-10-21.md；销项-产品-1021-PD48至PD51.md；盲测 F-待换。
