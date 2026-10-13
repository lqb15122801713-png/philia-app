# A5 运营三刀（D-40→D-41→D-42 · PD-20）卷宗 · evidence/a5-ops-p0

- 开工令：产品-1013-A5运营三刀（任务书=冻结版 V1.0，老板 10-13「签同片」；开口①②③已裁：同片/WcPub 接真 revert/未命中仅品牌默认图）
- 档位：K2（无新钱域；运营配置）；同片一支；分支 feat/a5-ops-p0（PR 只开不合，base=main）
- 基线：生产 main@`f70d1245`（全 f70d124580fe8dc574b733aae2b42f331175e663；PD-19/D-39 已合部亲验尖）

## 一、三刀明细

### D-40 单槽紧急下线
- server `slotPort.unpublish`（owner 硬闸）：当前 live→archived 单事务+留痕（actedBy/actedAt），槽可无 live；无 live 时 400 明文（不硬翻转）；版本行只增不改不物理删；下线后可再 upload→pending→publish 恢复（既有端点零改动）。
- `list` 透出 archived 行（版本/操作人/时刻=留痕可查）；槽位卡「紧急下线」钮（有 live 才出）+双确认；历史留痕区新出。
- 客户端回落=既有链天然生效（liveMap 无行→码内默认品牌图 `/brand/banner-home-1200.png`，非空白）。
- **页顶「一键关停」=支付通道语义零耦合零复用**：双向隔离实证（下线前后 killStatus 不变；kill 开=首页图不变+族尾复原）。

### D-41 真预览+修假回滚
- server `slotPort.previewVersion`（owner 硬闸）：按版本 id 读任意状态全量 contentJson（pending 可吃）；路人/非 owner=403。
- 客户端预览旁路（packages/shared slotContents）：URL 探针参 `slotPreview=<versionId>` → SlotContentLoader 拉 previewVersion 覆写 Map（403=denied 保持 live 不透零泄漏）；「预览中」角标挂 home.banner（新键 home.slotPreviewBadge=预览中，零营销弹窗特许件）。
- 商家端槽位卡 pending 行「预览此版」→ 预览面板 iframe（canvasPreviewUrl 工艺复用：`canvasPreview=1&canvasStore=<店锚>&slotPreview=<版本>`；**店锚前置**：auth.me.store 未解析=补锚注记不硬开，SC-011 照走）。
- **WcPub 修假回滚**：ConsolePage 槽位发布条回滚钮 `onRollback={() => undefined}+disabled` 假件 → 接真 `slotPort.revert`（目标=最近一次上线且可回退的槽[live.actedAt 最新；可回退口径同 SlotCard canRevert]；三段式胶囊观感零改动不拆；无可回退槽=置灰；失败 toast 明文）。

### D-42 contentJson 三行+audience+priority
- schema $type 扩（JSON 列零 DDL）：`title_main(≤12)/title_sub(≤20)/cta_text(2–4字)/audience(all|anon|free|anon_free)/priority(0–999)` 全可选，缺席=纯图版合法。
- 三行制闸+红线词闸=upload 入事务前硬拒 400 明文（复用 copy 端口禁令词 copyBannedHit + 槽位追加 `\d+折` 折扣词表；e2e 102 族六路拒单全绿）。
- SlotCard「文案与人群」编辑区（选填，随下次上传一并写入 pending 版）。
- 客户端 home.banner 接线：live 扩字段透出（liveMap）→ 三行覆盖层+CTA；**人群展示规则**：all=全量；anon=未登录∪无会员册（/home 有登录闸，未登录实落=未开卡）；free=在册免费档（plan.free）；anon_free=并集；**付费不见**=audience 未命中→仅品牌默认图（开口③裁死：不附 S10 文案种子）；展示规则层判定，券账/余额/回馈金零读写。
- 同坑多物料轮换/排期/recurrence/店 scope=P1 未进（priority 只存不求值）。

## 二、PD-19↔PD-20 交互处置（候裁明面①重点）

D-39 闸（f70d1245 已入主干）会拦 owner 会话看客户端 /home → D-41 owner 预览 iframe 直接撞闸。处置=**预览通道豁免**：`slotPreview` 参在场时，仅当 previewVersion 经 server owner 硬闸读回（200）才放行渲染；403/路人=闸照落（D-39 守卫帧零回退）。豁免=预览参数+服务端授权双件齐备，错端会话无有效预览件依然进不了 /home，软绕面零新增。**若产品侧要连预览通道也闸=D-41 须改独立预览页，另裁。**

## 三、迁移申报（键入码必随迁移）

- `server/drizzle/0080_a5_ops_p0.sql`（journal idx 80）：copy 键 **23 增**（slotport 22：紧急下线/双确认/预览面板/历史留痕/文案与人群编辑区；home 1：slotPreviewBadge 预览角标）；幂等 NOT EXISTS 守卫；键值=生成件 copySeedRows.ts 单源逐字；staging 件用后已删未入卷。
- copy active=**4245**/72 域（生成件 4244+seed 手补 1；e2e 56.1×2/76.3/98.2 计数断言+双链注释同步）。
- 更名零残留纪律：人群键值从现行档位注册名「注册用户」（89.1 守卫零旧名在案）。

## 四、闸门表（栈=7130 客户 / 7131 商家 / 7132 员工 preview + 7200 API，CORS 显式三端；库=a5-gate.db 新库 migrate+seed，0080 实证落库 4245 键）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck / 全仓 build 零参版 / 栈版（VITE_API_BASE=7200） | 绿（终码双版复跑在案） | typecheck.log / build-gate.log / build-stack.log |
| e2e 连跑 | **三绿**（1010 断言/跑；102 族六断言全绿=下线/边界/三闸/预览口/可再上+透出；回归 89.1 更名零残留一度撞新键「微光」字样→键值改现行注册名「注册用户」后三绿） | e2e-green-1/2/3.log + e2e-regression-89-1-note.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0 · 豁免 6（零新路由） | nav.log / nav.json |
| smoke-routes | 109/109 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 12 帧 SHOTS_ALL_GREEN（16 项断言） | shots/ + shots.log + shots/checks.json |

## 五、实尺截图清单（shots/）

1. M1-slotcard-copyfields-pending.png —— 槽位卡「文案与人群」编辑区+v3 待审行（三行+audience+priority 落库）
2. M2-preview-panel-iframe.png —— 「预览此版」面板 iframe（slotPreview 参+店锚 canvasStore 在链）
3. M3-preview-pending-with-badge.png —— owner 预览：pending 新稿上屏+「预览中」角标（豁免闸后实证）
4. C1-pending-isolated-live-v2.png —— pending 隔离：真用户仍见 v2 live（零透出零文案层）
5. C2-preview-link-denied.png —— 路人链（客户会话）打不开 pending：403→保持 live 零泄漏
6. C3-live-copy-guest-sees.png —— publish 后在册免费档命中 anon_free：开卡稿上屏
7. C4a-guest-nomember-sees-copy.png —— 未开卡（无会员册）命中见开卡稿
8. C4b-paid-sees-default-img.png —— 付费身份不见开卡稿→仅品牌默认图（mock 开通萤火演示链）
9. M4-redline-rejected-toast.png —— 红线词「充值返现」保存失败明文（pending 零新增）
10. M5-wcpub-real-rollback.png —— WcPub 回滚钮接真 revert（live 回上一版真图）
11. M6-unpublished-history.png —— 紧急下线后槽无 live+历史留痕区（版本/操作人/时刻）
12. C5-after-unpublish-default-brand.png —— 客户端回落码内品牌默认图（非空白非旧 live）

## 六、候裁明面（五件照实报）

1. **PD-19↔PD-20 交互**：预览通道豁免（见 §二）——错端闸对「slotPreview 参+owner 授权读回」双件豁免；连预览也闸=另裁。
2. WcPub 聚合条回滚目标语义=**最近一次上线且可回退的槽**（ actedAt 最新）；若要「选定槽回滚」交互=产品侧裁（改 UI 不改码径）。
3. 「未登录」人群语义落=未开卡/无会员册（/home 有登录闸，真匿名看不到首页=既有口径）；若要多 Anonymous 真匿名浏览首页=另案。
4. priority 本批只存不求值（多物料轮换=P1）；audience 客户端即时求值（plan 解析中瞬时不闪稿=「只管新渲染」工艺同族）。
5. 槽位预览口映射走 canvasPreviewUrl 缺省拓扑（canvas.previewPortMap 自定义拓扑时槽位预览不跟随自定义=登记；画布预览主链不受影响）。

## 七、纪律自查

零新依赖 ｜ 迁移幂等+申报（0080 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ 不新开 A1/A2 ｜ 页顶 kill 支付语义不动 ｜ 真支付/真退款/券账/余额/回馈金零触（付费消隐=展示规则层） ｜ D-31 关未碰 ｜ D-34 坐标未动 ｜ 零营销弹窗（预览角标=特许件） ｜ 不判美不换皮 ｜ 闸门栈 CORS 显式 ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
