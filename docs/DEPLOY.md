# Philia 部署手册（批次 6 · 可部署内测版）

> 目标：**App 在老板 VPS 上单实例跑起来，可真机内测**——不是完美上线，是「实打实能跑」。
> 部署形态（拍板 1）：自有 VPS 单实例，libsql 嵌入式库不迁移；内测登录 = 种子账号 + 口令门（拍板 2）；支付走 MockPayProvider（拍板 3）。

---

## 1. VPS 最低规格

| 项 | 最低 | 建议 |
|---|---|---|
| CPU / 内存 | 1C / 2G | 2C / 4G（构建更快） |
| 磁盘 | 20G | 40G |
| 系统 | Ubuntu 22.04 LTS（或任意可跑 Docker 的发行版） | — |
| 软件 | Docker 24+（含 compose 插件，`docker compose version` 可查） | — |
| 域名 | 1 个（内测可裸 IP + 自签跳过 HTTPS，但不建议） | 已备案/可解析域名 |

## 2. 两条命令拉起

仓库根级 `Dockerfile` / `docker-compose.yml` 由任务 A 提供，既定骨架为：
**单服务 `app`（server 7200 + 托管三端静态产物）+ libsql 数据文件挂 volume
（数据不随容器丢）+ 可选 `--profile https`（Caddy 反代 + 自动 HTTPS，域名走环境变量）**。

```bash
# ① 准备环境变量（真值只在 .env，永不入库；逐变量注释见 .env.example）
cp .env.example .env && $EDITOR .env

# ② 构建并拉起（仅此两条）
docker compose up -d --build
docker compose ps          # 确认 app 运行中；docker compose logs -f app 看日志
```

首次拉起后初始化数据库（迁移 + 种子，只需一次；容器内路径以任务 A 镜像为准）：

```bash
docker compose exec app sh -lc 'cd server && npm run db:migrate && npm run db:seed'
```

自检（见 §6）：`node scripts/smoke-deploy.mjs`。

## 3. 环境变量（server 运行时）

全部变量与代码读取位置一一对应，**以仓库 `.env.example` 为准**（逐行注释）。
关键项：

| 变量 | 必填口径 |
|---|---|
| `SESSION_SECRET` / `BOOKING_CODE_SECRET` / `IMG_SECRET` | `NODE_ENV=production` 时必须注入强随机值，缺省或仍为 dev 值 → **启动即报错**（`config/secrets.ts`） |
| `CORS_ORIGINS` | 跨域白名单，逗号分隔完整 origin（如 `https://philia.example.com`）。production 必须显式配置，缺失 → 启动即报错；非 production 缺省三端 dev 端口（`config/deploy.ts`） |
| `PUBLIC_BASE_URL` | 公共 base URL（如 `https://philia.example.com`），production 必填 |
| `BETA_GATE_CODE` | **内测口令**。设置后 dev-login / dev-seed-users 凭口令放行（无码 401 / 错码 403）；production 未设置 → 启动即报错（不留后门）；本地开发未设置 → 开放 |
| `PHILIA_DB_URL` | libsql 连接串，指向 volume 挂盘点，如 `file:/data/philia.db` |
| `PAYMENT_PROVIDER` | 内测 = `mock`（见 §8 已知冲突）；`wechat` 需另配 `WECHAT_*` 四项，本批次不接 |
| `PORT` | 容器内监听端口，缺省 7200，一般不动 |
| `VITE_API_BASE` | 三端构建期变量；同源部署留空即可（缺省同源相对路径不可用时会回落 `http://localhost:7200`，按任务 A 分发方案定） |

## 4. 域名 + HTTPS（Caddy，可选 profile）

1. DNS：域名 A 记录指向 VPS 公网 IP，等待解析生效（`dig +short example.com`）。
2. `.env` 填 `PUBLIC_BASE_URL=https://<域名>`、`CORS_ORIGINS=https://<域名>`。
3. 拉起带 Caddy 的 https profile：

   ```bash
   docker compose --profile https up -d --build
   ```

   Caddy 首次访问自动签发/续期 Let's Encrypt 证书（80/443 需在安全组放行）。
4. 验证：`curl -I https://<域名>/api/health` 返回 200。

> 裸 IP 内测（无域名）：跳过本节的 https profile，`PUBLIC_BASE_URL=http://<IP>:7200`、
> `CORS_ORIGINS=http://<IP>:7200`，直接访问 `http://<IP>:7200`。扫码核销与
> 添加到主屏幕在 http 下部分浏览器能力受限（PWA 安装提示通常要求 https）。

## 5. 数据备份与恢复（libsql 文件拷贝）

libsql 嵌入式库 = volume 里的单个 SQLite 文件（默认 `philia.db`）。

```bash
# 备份（推荐先停写：暂停 app 或选低峰；直接拷文件即可）
docker compose stop app
cp "$(docker volume inspect -f '{{.Mountpoint}}' <volume名>)/philia.db" \
   "backup/philia-$(date +%F-%H%M).db"
docker compose start app

# 恢复：停 app → 用备份文件覆盖 volume 内 philia.db → 启动
```

建议 cron 每日备份（示例）：`17 3 * * * /root/philia/backup.sh`（脚本内容同上三段）。
上传图片（`server/uploads/`，如挂 volume）同法拷贝。

## 6. 部署后自检（smoke）

```bash
# 在仓库根目录（本地能连到 VPS 即可），口令走环境变量
PUBLIC_BASE_URL=https://<域名> BETA_GATE_CODE=<内测口令> node scripts/smoke-deploy.mjs
```

覆盖：`/api/health` 200、三端首页可达、口令门（无码 401 / 错码 403 / 对码 200）、
演示单 下单 → 商家确认 → 取码 → 员工核销 全链路。全部 ✅ 即内测就绪。
三端如按不同域名/路径分发，用 `CUSTOMER_URL` / `MERCHANT_URL` / `STAFF_URL` 分别指定。

> 注意：演示单会真实落库（占明天一个时段槽 + 一条 in_service 预约），
> 内测演示数据可保留；重复跑会自动顺延时段，不会失败。

## 7. 日志与常见故障排查

```bash
docker compose logs -f app        # 实时日志
docker compose logs --tail 200 app
docker compose restart app        # 改 .env 后重启生效
```

| 症状 | 排查 |
|---|---|
| 启动报 `[secrets] …拒绝启动` | 三个 HMAC 密钥未注入或仍为 dev 值 → 按 `.env.example` 填强随机值 |
| 启动报 `[deploy] …CORS_ORIGINS / PUBLIC_BASE_URL / BETA_GATE_CODE` | production 缺部署配置 → 补齐后重启（口令门是拍板 2，不可绕过） |
| 启动报 `[payments] 生产构建检测到 PAYMENT_PROVIDER=mock` | §4.7 红线：production 禁 mock。内测期口径见 §8 |
| 前端跨域报错 / cookie 不生效 | `CORS_ORIGINS` 未包含访问用的完整 origin（协议+域名+端口）；改了要重启 |
| 登录页要求「内测口令」 | 正常（口令门生效）；口令 = `BETA_GATE_CODE`，分发给内测人员 |
| dev-login 401 / 403 | 401=未带口令，403=口令错；确认口令无多余空格 |
| SSE 实时推送不更新 | 反代需关缓冲：Caddy 默认 OK；若自换 nginx 需 `proxy_buffering off` |
| 端口冲突 | `ss -lntp | grep -E '7200|80|443'`；compose 端口映射与宿主机占用冲突时改映射 |
| PWA 更新后手机端还是旧版 | Service Worker 缓存：杀掉 App/清站点数据重开；构建哈希变化后会自动换新 |
| 数据库被删/重置 | 恢复 §5 备份；然后 `db:migrate`（种子只用于首装） |

## 8. 已知冲突（内测期口径，待产品侧裁定）

拍板 3「内测走 MockPayProvider」与代码现行 §4.7 红线
（`assertPaymentConfig`：production + mock → 启动报错）冲突，本批次**不改支付红线、
不接微信真配置**（任务书「明确不做」），已上报产品侧。裁定前内测机按以下口径运行：

- `NODE_ENV` **不设为 production**（如 `staging`），使 §4.7 生产闸门不触发；
- 同时**显式注入全部密钥与口令**（`SESSION_SECRET` / `BOOKING_CODE_SECRET` /
  `IMG_SECRET` / `MOCK_PAY_SECRET` / `BETA_GATE_CODE` / `CORS_ORIGINS` /
  `PUBLIC_BASE_URL`）——这些变量一旦显式设置即生效，与 NODE_ENV 无关，
  内测环境不因此降安全（口令门照常吃 401/403，密钥不用 dev 缺省值）。

产品侧裁定落地（放宽 mock 或接微信）后，改回 `NODE_ENV=production` 即可，
届时全部生产闸门（secrets / deploy / payments）自动生效。

## 9. 升级流程

```bash
git pull                      # 或上传新包
docker compose up -d --build  # 重建并滚动替换
docker compose exec app sh -lc 'cd server && npm run db:migrate'   # 有新迁移时
node scripts/smoke-deploy.mjs # 自检
```

## 10. 给任务 A 的接口约定（静态托管 / 端口 / 健康检查）

- server 容器内监听 `PORT`（缺省 7200）；健康检查 `GET /api/health` → `{ ok: true }`。
- 三端静态产物：`apps/customer/dist`、`apps/merchant/dist`、`apps/staff/dist`
  （`npm run build` 于仓库根一次产出三端）。
- 反代/同源分发口径：`/api/*`、`/trpc/*` → server；其余按任务 A 裁定方案分发三端
  （Host 头或路径前缀，分发设计说明见 PR 描述）；`/api/events` 为 SSE 长连接，勿加缓冲。
- 数据持久化：libsql 文件目录挂 volume（`PHILIA_DB_URL` 指向挂盘点）；
  上传图片目录 `server/uploads/` 建议同挂。
