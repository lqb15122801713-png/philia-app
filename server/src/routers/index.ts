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
 *   pass         次卡充次 / 扣次流水（v1.1-b2 B2-7）
 */

import { router } from '../trpc';
import { appointmentRouter } from './appointment';
import { attendanceRouter } from './attendance';
import { authRouter } from './auth';
import { boardingRouter } from './boarding';
import { cashierRouter } from './cashier';
import { commissionRouter } from './commission';
import { configRulesRouter } from './configRules';
import { inventoryRouter } from './inventory';
import { mallRouter } from './mall';
import { membershipRouter } from './membership';
import { passRouter } from './pass';
import { petRouter } from './pet';
import { pushRouter } from './push';
import { refundRouter } from './refund';
import { serviceStepRouter } from './serviceStep';
import { storeRouter } from './store';
import { storedValueRouter } from './storedValue';
import { xpRouter } from './xp';

export const appRouter = router({
  auth: authRouter,
  pet: petRouter,
  store: storeRouter,
  appointment: appointmentRouter,
  serviceStep: serviceStepRouter,
  boarding: boardingRouter,
  push: pushRouter,
  mall: mallRouter, // P5 T5.1 商城（coder-mall-server 追加）
  pass: passRouter, // v1.1-b2 B2-7 次卡（充次/扣次/回补闭环）
  cashier: cashierRouter, // 批次 M1 商家端收银台（登记型收银，决策 #27）
  storedValue: storedValueRouter, // M1-补2 R5b 存量储值台账 CSV 导入（仅店主，只交付不执行）
  attendance: attendanceRouter, // 批次 员工端2.0 R7 打卡考勤（含补卡双流）
  inventory: inventoryRouter, // 批次 员工端2.0 R8 库存流水+盘点
  commission: commissionRouter, // 批次 员工端2.0 R9 提成/绩效（仅本人硬过滤）
  xp: xpRouter, // 批次 员工端2.0 R10 XP/榜单/评价查询
  config: configRulesRouter, // 批次 员工端2.0 R9-F 规则配置管理端口（仅 owner）
  refund: refundRouter, // 批次 R12 退款专项（六联动内核：退款单/支付段/库存/储值次卡/财务口径/回馈金列位）
  membership: membershipRouter, // 批次 R11a 会员前置批（档位透出/微光开档/售卡/续费/退会/立省钩子/年费分摊双口径）
});

/** 前端 tRPC client 的类型锚点（仅类型导出，无运行时开销） */
export type AppRouter = typeof appRouter;
