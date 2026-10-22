# 验收7 服务端日志实证（rg）

## [member-card-verify] 日志行（只记 jti=nonce 前缀＋结果码，不落明文令牌／userId 对）

会话一（探针 02-runtime-probe.txt 同次；该段日志文件后被会话二 `>` 重定向覆盖，行当次已摘录于此）：

```
[member-card-verify] jti=btKWpSAz result=ok
[member-card-verify] jti=btKWpSAz result=replay
[member-card-verify] jti=E7_gPFem result=bad_signature
[member-card-verify] jti=- result=bad_format
[member-card-verify] jti=AAAAAAAA result=unknown_nonce
```

会话二（server-runtime.log 现存全量，含过期拒直证件）：

```
[member-card-verify] jti=-uYra7_r result=expired
```

另：e2e 全量回归（07-e2e-full.txt 尾部 server 日志摘录）同口径六行：
ok / replay / bad_signature / expired / bad_format / store_scope / ok。

## rg 计数（对现存 server-runtime.log；全 0 = 不落明文令牌／userId 对）

- 完整 nonce 串 `btKWpSAzDzPcH7avjD9Q2w`: 0
- 完整签名段 `b079682c21daf349…`: 0
- 令牌前缀整串 `mc1.`: 0
- 会员 userId `01M5HN49SB7A95KTZ674N091JR`: 0
- 店主 userId `01M5HN49SA8W3Q06DPRZX85CRW`: 0
