# B2-4 复现记录：客户看不到服务照片（走查 W-9）

## 复现步骤与现象

用 B2-2 留下的已完成洗护单 `01M1WZ4AGPAHCGNGH86BSJ07PB`（示例客户名下，六步走完、库内 10 张未失效照片：disinfection 1 / precheck 2 / grooming 3 / detail 2 / before_after 2(before+after) / confirm 0）：

1. 接口侧：`serviceStep.list`（publicProcedure + assertAppointmentAccess）能取到 10 张照片 —— **数据在库且客户可读链路存在**；`appointment.get` 返回的 `steps` 仅步骤行、**不含 photos**（repro.json: `getHasPhotos=false`）。
2. 页面侧：客户打开 `/appointments/01M1WZ4AGPAHCGNGH86BSJ07PB`，正文仅「预约信息 / 再次预约 / 门店 / 服务评价」四个区块，**无任何相册/服务照片区块**（before-detail.png；DOM 断言 `hasAlbum=false`，img 仅 1 张头像类图）。

## 根因（文件 + 行号）

- `apps/customer/src/pages/AppointmentDetailPage.tsx`：整页（L70-435）渲染区块为 预约码(L194) / 预约信息(L210) / 再次预约(L284) / 门店(L300) / 取消(L336) / 服务中提示(L379) / 评价(L396)，**没有任何读取步骤照片的逻辑**——既不调 `serviceStep.list` 也无相册组件，completed/in_service 单的照片在详情页完全不可达（仅 /live 实时页可见，完成单入口已消失）。
- `server/src/routers/appointment.ts`：客户可读接口仅 `get`(L518) / `listMine`(L491) / `getCode`(L535) 等，`get` 的 `progressOf`(L303-324) 只 select appointment_steps 行、不联 step_photos；**无 `serviceAlbum` 类接口**（路由止于 listForStaff L1115-1149）。仅有的含照片接口 `serviceStep.list`（serviceStep.ts L194-226）是 publicProcedure（customer/staff/merchant 三类归属均可），不满足本项「customerProcedure + 校验预约属本人」的专项要求。

## 修复方针

- 服务端：`appointment.serviceAlbum`（customerProcedure；显式校验 `appt.customerId === ctx.user.id`，他人 → FORBIDDEN，不存在 → NOT_FOUND），按六步返回 stepKey/stepName/status/photos[{url,tag}]（仅未失效照片，口径同 serviceStep.list）。
- 客户端：详情页新增「服务相册」区块（completed / in_service 的洗护单展示），按步骤分组网格，before/after 打标；进行中订单只显示已确认（done）步骤的照片。
