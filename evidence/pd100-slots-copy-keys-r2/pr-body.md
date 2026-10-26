# fix(merchant): PD-100 r2 humanize slots and copy labels

## 范围

打回补钉，针对复测-R `SLOTS_COPY_KEYNAME_EXPOSED`。基线 `015a4ca8e262c9a5aad662fa1ec3a23c77aab0ee`；DEPLOY 对照 `20261026214133`。

- `/settings/slots`：卡片标题、预览标题和下线确认改用版本内容既有人话 `alt`，不再直出 `slotKey`。
- `/settings/copy`：列表、变更留痕和保存确认改用既有 `position／screen` 标签，不再直出 `ruleKey`。
- 复用 `rowByKey` Map，避免大量文案行下重复 `rows.find()`。
- 仅两个商家端页面展示层；不改 API 形状、内部 key、上传／审批／版本流，不改 schema。
- 本窗无 mig／0146 故意空留；未扩审美、NOTE、监控、YKNXD2、灰链、驾舱、日结或客员端。

## 本地候选证据

- 候选：`index-_dA59x8G.js`，SHA-256 `83dcb273559a3820f51b018b3d918f9553aece1a78b316ae5e54b70ff1110c06`。
- 文件名同时异于 `index-BxXrf5jN.js` 与 `index-sf4Mp8sz.js`。
- `npm run build:merchant`：exit 0。
- 全量商家测试：19/19 PASS（`final-unit.txt`）。
- 最终双端口真 dist＋单店合成 GET：slots 显示“首页品牌横幅／员工端登录页主视觉／商城促销横幅”；copy 列表与留痕显示位置标签。
- 最终读数：`keynameHomeBanner=false`、`keynameLoginHero=false`、`keynameExposed=false`、`skeletonHeavy=false`；同构 `mall.hero` 与 copy 点号键也未外露。
- 关窗反证：临时返回内部 key 时重新 FAIL，随后还原并重跑最终验证。
- `blockedMutations=[]`、`unknown=[]`；未碰 `01M5EQVF`，未造第二店，未使用 USAGE。

## 明示 INC／未跑项

- 全量 lint：**INC**，基线既有 47 errors／5 warnings（`final-full-lint.txt`）。
- 目标 lint：**INC**，`CopyConfigPage` 既有 `react-hooks/set-state-in-effect` 1 error 与 unused-disable 1 warning；`git show HEAD:… | eslint --stdin` 对照相同，未新增，也未顺手扩修。
- 保存确认／紧急下线的后台点击未形成可靠状态迁移，不写交互 PASS。
- 合后现网复测-R 未跑；本 PR 不代表复测结论。

卷宗：`evidence/pd100-slots-copy-keys-r2/`（RED／反证／最终读数、双端口帧、构建与测试日志、只读 mock）。

## 后续闸

PR 只开不合；交付 HIT→异会话双审→Cursor；合前 update branch 到当时 tip；合部后再由敏慧按双端口键名＋监控／YKNXD2／灰链不回退复测-R。PD-100 禁正式销直至键名簇 PASS。
