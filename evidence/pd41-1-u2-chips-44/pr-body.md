# PD-41.1 / CJ-1018-07-M1 · U2 chips 触控高 44

> PR 只开不合；合／部走产品 ROG。本片不写验收结论、不判美。

## 范围

- 仅修 `u2-chip-store/pet/service/staff` 顶栏 chips 的触控高
- Default／已选态共用 `chipClass`，由 `min-h-10`（40px）改为 `min-h-11`（44px）
- 不改时段格、不扩扫、不动选品树、不真付真退、不提交预约、不抢 PD-39

## 验证

- 先红：M1 实测四枚 chips 均 40px，闸门 13/14
- 后绿：四枚均 44px，闸门 14/14；全程无 `appointment.create`／支付请求
- 交付前复核：14/14
- `npx eslint src/pages/GroomingSinglePage.tsx`（cwd=`apps/customer`）：通过
- `npm run build`：三端通过（仅既有 bundle 体积／zod 注释警告）

卷宗：`evidence/pd41-1-u2-chips-44/README.md`
