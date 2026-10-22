# 验收 1/前端面 实证：DOM 无整串令牌 + 到期自动刷新（TTL=90s）

运行环境：本窗 dev server 7200（CORS_ORIGINS 放行 7118）+ 本窗 customer vite 7118（strictPort）。
路径：/dev-login 账号 ID 登录（示例客户）→ /me/card。

> 注：本机 7100/7101 被其他窗占用，7102 有陈旧 Service Worker 残影（别窗员工端），
> 故本窗实证口=7118（server 以 CORS_ORIGINS 环境变量放行，属 server 既有配置旋钮，未改代码）。

## 帧（shots/001-membercard-no-token-text.png）

QR 码 + 条码图形 + 「示例客户 · 注册用户」+「到店出示给店员扫描」；码下无任何令牌文本。

## DOM 文本快照（page.text.snapshot, source=dom）

帧 A（capturedAt 1792668651648）：

```
b1 关闭
b2 示例客户 · 注册用户
b3 到店出示给店员扫描
b4 亮度已调高 · 自动刷新00:53 后自动刷新
```

帧 B（capturedAt 1792668726901，帧 A 后 75.3 秒）：

```
b1 关闭
b2 示例客户 · 注册用户
b3 到店出示给店员扫描
b4 亮度已调高 · 自动刷新00:52 后自动刷新
```

## 判定

- 两帧 DOM 文本均无 `mc1.` 令牌串 / userId / plan 明文（旧版码下整串位已撤）。
- 墙钟 75.3s 间倒计时 00:53 → 00:52：若不刷新应早已 00:00 过期；实测在 T−15s 链式续签
  （首件余 53s → 第 38s 续签新 90s 件 → 第 75s 时新件余 52s），前端到期自动刷新在轨。
- 属性面无 `data-token`：见 04-dom-served-code.md（vite 实际伺服件 grep=0）。
