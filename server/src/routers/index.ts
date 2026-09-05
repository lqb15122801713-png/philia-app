/**
 * appRouter 合并入口（CONTRACTS.md · T1.6 名下文件）
 *
 * 七个业务 router 按命名空间合并，前端 tRPC client 以 AppRouter 类型对齐：
 *   auth         登录用户 / 员工绑定 / 开店（T1.2）
 *   pet          宠物档案（T1.3）
 *   store        门店 / 服务目录 / 员工与排班（T1.3）
 *   appointment  预约全生命周期（T1.3a）
 *   serviceStep  洗护六步状态机（T1.3b）
 *   boarding     寄养打卡（T1.3c）
 *   push         推送订阅登记 / 站内通知（T1.4）
 */

import { router } from '../trpc';
import { appointmentRouter } from './appointment';
import { authRouter } from './auth';
import { boardingRouter } from './boarding';
import { mallRouter } from './mall';
import { petRouter } from './pet';
import { pushRouter } from './push';
import { serviceStepRouter } from './serviceStep';
import { storeRouter } from './store';

export const appRouter = router({
  auth: authRouter,
  pet: petRouter,
  store: storeRouter,
  appointment: appointmentRouter,
  serviceStep: serviceStepRouter,
  boarding: boardingRouter,
  push: pushRouter,
  mall: mallRouter, // P5 T5.1 商城（coder-mall-server 追加）
});

/** 前端 tRPC client 的类型锚点（仅类型导出，无运行时开销） */
export type AppRouter = typeof appRouter;
