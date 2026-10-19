# PD-39.1 / CJ-1018-05-M · U1 触控热区 ≥44px

- 日期：2026-10-20（Asia/Shanghai）
- Worktree：`E:\KIMI code\pd39-1-touch`
- 分支：`feat/pd39-1-u1-touch-44`
- 基线：`origin/main@eb95da6`（`eb95da6fa78674eb8cd27251a3c1e5e091c64f15`，rebase 后复验）
- 范围：只修 M1／M2／M3／M4／L1／L2 六处触控热区；不改 U0 浮岛、团购、薄抽或 PD-41.1。

## 修改点

- `apps/customer/src/styles/home-v2.css`
  - M1 `.hv2-banner-cta`：38 → 44px
  - M2 `.hv2-member-code`：32 → 44px
  - M3 `.hv2-member-summary`：38 → 44px
  - M4 `.hv2-pickup`：32 → 44px，并补 inline-flex 垂直居中
  - L1 `.hv2-store-chip`：32 → 44px
  - L2 `.hv2-activity-lead`：34 → 44px
- `apps/customer/src/pages/HomePage.tsx`：M3 增加 `data-testid="home-member-summary"`。
- `scripts/pd39-home-ia-check.mjs`：真实 `getBoundingClientRect()` 采集宽×高；六处统一 testid；断言宽与高均 ≥44px；原 14 项闸门不删。

## 点验记录

RED（修改前）：`pd39-1-red-results.json` 实测 M1=38、M2=32、M3=38、M4=32、L1=32、L2=34，2 项新增断言 FAIL。

GREEN（修改后）：`pd39-1-final-results.json`，`16/16 PASS`：

- 空闲态：M1=115.2×44.0、M2=76.0×44.0、M3=276.0×44.0、L1=141.9×44.0、L2=334.0×44.0。
- 服务中：M4=60.0×44.0。
- Banner CTA 与进度卡无重叠；副文仍 ≥12px；U0 五栏实点与团购落点保持原结果。
- rebase 到 `origin/main@eb95da6` 后重跑仍为 16/16；专用夹具库重 seed 只改变门店 ID 与商城落地文案快照，不影响上述矩形。

截图：

- `pd39-1-red-idle.png`、`pd39-1-red-service.png`
- `pd39-1-final-idle.png`、`pd39-1-final-service.png`

## 命令

```bash
CUSTOMER_URL=http://127.0.0.1:7174 API_BASE=http://127.0.0.1:7215 \
  PHILIA_DB_URL=file:E:/KIMI\ code/pd39-1-touch/server/data/pd39-home-ia.db \
  EVIDENCE_PREFIX=pd39-1-red EVIDENCE_DIR=evidence/pd39-1-u1-touch-44 \
  node scripts/pd39-home-ia-check.mjs
# exit 1，新增六项实测低于 44px

CUSTOMER_URL=http://127.0.0.1:7174 API_BASE=http://127.0.0.1:7215 \
  PHILIA_DB_URL=file:E:/KIMI\ code/pd39-1-touch/server/data/pd39-home-ia.db \
  EVIDENCE_PREFIX=pd39-1-final EVIDENCE_DIR=evidence/pd39-1-u1-touch-44 \
  node scripts/pd39-home-ia-check.mjs
# exit 0，16/16 PASS

npm run build
# exit 0（三端）
```

状态：待产品 ROG；未合部、未部署。
