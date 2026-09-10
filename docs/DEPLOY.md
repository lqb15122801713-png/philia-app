# Philia 部署手册（批次 6 · 可部署内测版）

> 目标：**App 在老板 VPS 上单实例跑起来，可真机内测**——不是完美上线，是「实打实能跑」。
> 拍板与裁定：VPS 单实例 + libsql 嵌入式不迁移（拍板 1）；dev-login 保留 + 口令门（拍板 2）；
> 内测走 MockPay（拍板 3）；**方案一 Host 头分发**（裁定书 #1 ①）；
> **内测必须 `NODE_ENV=staging`**（裁定书 #1 ②，staging 合法放行 MockPay，
> `production + mock` 红线一行未动）。
>
> ⚠️ 本手册按「单服务 app + libsql volume + 可选 https profile」骨架撰写；
> Dockerfile/compose 已经过静态评审，**docker build / compose up 的实机日志待 VPS 首验补档**
> （本批施工机无 Docker，见证据卷宗 README）。

---

## 1. VPS 最低规格

| 项 | 最低 | 建议 |
|---|---|---|
| CPU / 内存 | 1C / 2G | 2C / 4G（镜像构建更快） |
| 磁盘 | 20G | 40G |
| 系统 | Ubuntu 22.04 LTS（或任意可跑 Docker 的发行版） | — |
| 软件 | Docker 24+（含 compose 插件，`docker compose version` 可查） | — |
| 域名 | **可无**（无域名期按 §4.2 降级访问） | 1 个主域 + 3 条子域 A 记录 |

## 2. 两条命令拉起

```bash
# ① 准备环境变量（真值只在 .env，永不入库；逐变量注释见 .env.example）
cp .env.example .env && $EDITOR .env     # 内测必须 NODE_ENV=staging（裁定②）

# ② 构建并拉起（仅此两条）
docker compose up -d --build
docker compose ps          # 确认 app Up (healthy)；docker compose logs -f app 看日志
```

- 首启自动建库：entrypoint 检测 DB 文件缺失时执行 `db:migrate`（drizzle journal 幂等）。
- 内测演示账号（种子用户，dev-login 用）首装手动灌一次：

```bash
docker compose exec app sh -lc 'cd server && npm run db:seed'
```

- 自检：`node scripts/smoke-deploy.mjs`（见 §6）。
- 架构：单容器跑 server（7200）并**按 Host 头子域分发三端静态产物**
  （`app.*`→客户端、`m.*`→商家端、`s.*`→员工端，无子域/裸 IP → 客户端兜底；
  `/api`、`/trpc` 永远走 server 不被静态接管）。

## 3. 环境变量（server 运行时）

全部变量与代码读取位置一一对应，**以仓库 `.env.example` 为准**。关键项：

| 变量 | 内测（staging）口径 |
|---|---|
| `NODE_ENV` | **必须 `staging`**（裁定②：放行 MockPay；production 内测期不要用） |
| `BETA_GATE_CODE` | **必设**：dev-login 口令门（无码 401 / 错码 403）；staging 未设仅告警——内测机等同后门 |
| `SESSION_SECRET` / `BOOKING_CODE_SECRET` / `IMG_SECRET` / `MOCK_PAY_SECRET` | 显式注入强随机值（未注入会沿用源码 dev 缺省，启动时有告警清单） |
| `CORS_ORIGINS` | 三子域完整 origin，逗号分隔（无域名期填 `http://<IP>:7200` 及 hosts 假域名对应 origin） |
| `PUBLIC_BASE_URL` | 公共 base URL（有域名填 `https://app.<域>`，无域名填 `http://<IP>:7200`） |
| `PHILIA_DB_URL` | 保持 `file:/app/data/philia.db`（volume 挂盘点，compose 已对齐） |
| `SERVE_STATIC` / `STATIC_ROOT` | 保持 `1` / `/app/apps`（compose 默认已开；本地直跑调试才改） |
| `PAYMENT_PROVIDER` | `mock`（内测）；`wechat` 需另配 `WECHAT_*` 四项，本批次不接 |
| `APP_DOMAIN` / `M_DOMAIN` / `S_DOMAIN` | 仅 https profile 用：三子域名（§4.1） |

## 4. 访问方式

### 4.1 有正式域名：A 记录 + Caddy 自动 HTTPS

1. DNS 三条 A 记录指向 VPS 公网 IP：`app.<域>`、`m.<域>`、`s.<域>`（`dig +short` 验证）。
2. `.env` 填 `APP_DOMAIN` / `M_DOMAIN` / `S_DOMAIN`、`CORS_ORIGINS`（三子域 https origin）、
   `PUBLIC_BASE_URL=https://app.<域>`。
3. 拉起带 Caddy 的 https profile（Host 头天然透传，与方案一零适配）：

   ```bash
   docker compose --profile https up -d --build
   ```

   Caddy 自动签发/续期 Let's Encrypt（安全组放行 80/443）。
4. 访问：`https://app.<域>`（客户）、`https://m.<域>`（商家）、`https://s.<域>`（员工）。
   PWA「添加到主屏幕」与微信内扫码均要求 https，正式内测推荐本方式。

### 4.2 无正式域名期：降级访问（裁定①附加口径，老板不看代码也能起）

**方式 A（最简，仅客户端体验）**：直接访问 `http://<VPS-IP>:7200` ——
裸 IP 无子域，Host 分发兜底到**客户端**。商家端/员工端体验用方式 B。

**方式 B（推荐，三端全通）：本地 hosts 三行**。在每台体验手机的同一 Wi-Fi 电脑/
或 Jailbreak 免 root 不便时——用电脑浏览器先行体验：

```
# Windows: C:\Windows\System32\drivers\etc\hosts；macOS/Linux: /etc/hosts
<VPS-IP>  app.beta.local
<VPS-IP>  m.beta.local
<VPS-IP>  s.beta.local
```

然后浏览器访问 `http://app.beta.local:7200` / `http://m.beta.local:7200` /
`http://s.beta.local:7200`（Host 头带子域 → 正确分发到三端）。
对应 `.env`：`CORS_ORIGINS=http://app.beta.local:7200,http://m.beta.local:7200,http://s.beta.local,http://<VPS-IP>:7200`，
改完 `docker compose restart app`。

**方式 C：Caddy 按端口临时映射**（不想改每台设备 hosts 时）：
把 `caddy/Caddyfile` 临时换成按端口分发（Host 头由 Caddy 改写注入）：

```caddyfile
:7201 {	reverse_proxy app:7200 { header_up Host app.beta.local } }   # 客户端
:7202 {	reverse_proxy app:7200 { header_up Host m.beta.local } }     # 商家端
:7203 {	reverse_proxy app:7200 { header_up Host s.beta.local } }     # 员工端
```

compose 的 caddy 服务 ports 加 `"7201:7201" "7202:7202" "7203:7203"`，
`docker compose --profile https up -d` 后访问 `http://<VPS-IP>:7201/7202/7203`。
（此为无域名过渡手段；正式域名就绪后回到 §4.1。）

## 5. 数据备份与恢复（libsql 文件拷贝）

libsql 嵌入式库 = volume `philia-data` 里的单个 SQLite 文件（`philia.db`）。

```bash
# 备份（低峰期；先停写更稳）
docker compose stop app
cp "$(docker volume inspect -f '{{.Mountpoint}}' philia-app_philia-data)/philia.db" \
   "backup/philia-$(date +%F-%H%M).db"
docker compose start app

# 恢复：停 app → 备份文件覆盖 volume 内 philia.db → 启动
```

建议 cron 每日备份（如 `17 3 * * * /root/philia/backup.sh`）。
上传图片在 volume `philia-uploads`，同法拷贝。

## 6. 部署后自检（smoke）

```bash
# 仓库根目录（本地能连到 VPS 即可），口令走环境变量
PUBLIC_BASE_URL=http://<VPS-IP>:7200 BETA_GATE_CODE=<内测口令> node scripts/smoke-deploy.mjs
# 三端分发到不同地址时分别指定：
#   CUSTOMER_URL=http://app.beta.local:7200 MERCHANT_URL=http://m.beta.local:7200 STAFF_URL=http://s.beta.local:7200
```

覆盖：`/api/health` 200、三端首页可达、口令门三态、演示单 下单→确认→取码→核销。
全部 ✅ 即内测就绪。演示单真实落库（占明天一个时段槽），重复跑自动顺延不失败。

## 7. 日志与常见故障排查

```bash
docker compose logs -f app        # 实时日志（含 [deploy] staging 配置提醒）
docker compose restart app        # 改 .env 后重启生效
```

| 症状 | 排查 |
|---|---|
| 启动日志 `[deploy] NODE_ENV=staging …未显式注入` | 提醒非错误：按清单把 `.env` 补齐（密钥/口令/CORS），重启后消失 |
| 启动报 `[secrets] …拒绝启动` | 误用了 `NODE_ENV=production` 且密钥未配齐；内测改回 `staging` 或补齐密钥 |
| 启动报 `[payments] 生产构建检测到 PAYMENT_PROVIDER=mock` | §4.7 红线：**内测必须 `NODE_ENV=staging`**（裁定②），不要把 NODE_ENV 设为 production |
| 打开 `http://IP:7200` 只有客户端 | 正常兜底（裸 IP 无子域 → customer）；三端体验按 §4.2 方式 B/C |
| 子域名打开却是错的端 | Host 分发按首个子域标签：`app.*`/`m.*`/`s.*`；检查访问用的域名/hosts 拼写 |
| 前端跨域报错 / cookie 不生效 | `CORS_ORIGINS` 没包含当前访问的完整 origin（协议+主机+端口）；改后重启 |
| 登录页要「内测口令」/ 401 / 403 | 口令门生效中：401=未带口令，403=口令错；口令 = `BETA_GATE_CODE`，注意无多余空格 |
| SSE 实时推送不更新 | Caddy 默认流式 OK；自换 nginx 需 `proxy_buffering off` |
| 端口冲突 | `ss -lntp \| grep -E '7200\|80\|443'`；改 compose 端口映射或停占用进程 |
| PWA 更新后手机端还是旧版 | sw.js/index.html 已 no-cache，强刷或清站点数据即可；指纹 assets 长缓存属正常 |
| 数据库被删/重置 | 恢复 §5 备份；容器重启会自动 migrate（仅 DB 文件缺失时） |

## 8. staging / production 口径说明（裁定②落地）

- **本批内测：`NODE_ENV=staging`**。MockPay 合法；secrets/deploy 生产闸门不触发，
  但所有变量**显式设置即生效**（口令门照常吃 401/403，密钥不用 dev 缺省值）；
  启动时 `warnStagingConfig` 会把未注入项打成告警清单（不阻断）。
- **未来正式：`NODE_ENV=production`**。全部闸门自动生效：三密钥缺失/dev 值 →
  拒启动；`CORS_ORIGINS` / `PUBLIC_BASE_URL` / `BETA_GATE_CODE` 缺失 → 拒启动；
  `PAYMENT_PROVIDER=mock` → 拒启动（§4.7 红线一行未动）。

## 9. 升级流程

```bash
git pull
docker compose up -d --build                                   # 重建并替换
docker compose exec app sh -lc 'cd server && npm run db:migrate'   # 有新迁移时（幂等）
node scripts/smoke-deploy.mjs                                  # 自检
```

## 10. 架构与接口约定（任务 A 交付摘要）

- **Dockerfile**（根级，多阶段）：`fe-builder`（npm ci workspaces + 三端 vite build）
  → `server-deps`（server npm ci，含 tsx）→ 最终镜像 `node:20-bookworm-slim`
  （server src+drizzle+node_modules + 三端 dist + entrypoint，tsx 直跑）；
  `EXPOSE 7200`；`HEALTHCHECK` 对 `GET /api/health`。
- **entrypoint**（`docker/entrypoint.sh`）：DB 文件缺失 → `db:migrate`（幂等）→ `exec tsx src/index.ts`。
- **docker-compose.yml**：单服务 `app`（build .，7200，`env_file: .env`，
  volumes `philia-data`→/app/data、`philia-uploads`→/app/server/uploads）；
  可选 `--profile https` 起 Caddy（三域名走 `APP_DOMAIN`/`M_DOMAIN`/`S_DOMAIN`，
  `caddy/Caddyfile` 已入库，Host 透传）。
- **静态托管**（`server/src/static/spa.ts`）：`SERVE_STATIC`（默认关，dev 不变）+
  `STATIC_ROOT`；Host 首个子域 `app/m/s` → customer/merchant/staff，其余兜底 customer；
  SPA fallback 到该端 index.html；`/api`、`/trpc` 永不接管；assets 指纹长缓存、
  index.html/sw.js/manifest no-cache；各端 PWA 文件（manifest/sw.js/icons）按端隔离原样服务。
- **VPS 首验补证链**（本批施工机无 Docker，首验时按序留档到证据卷宗）：
  `docker build` 日志 → `docker compose up` 日志 → `docker compose ps`（healthy）→
  `smoke-deploy.mjs` 输出 → 真机按 `docs/BETA-CHECKLIST.md` 逐项勾。
