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
import { authSecurityRouter } from './authSecurity';
import { boardingRouter } from './boarding';
import { cashierRouter } from './cashier';
import { commissionRouter } from './commission';
import { configRulesRouter } from './configRules';
import { inventoryRouter } from './inventory';
import { mallRouter } from './mall';
import { membershipRouter } from './membership';
import { passRouter } from './pass';
import { payRouter } from './pay';
import { payrollRouter } from './payroll';
import { petRouter } from './pet';
import { pushRouter } from './push';
import { reportRouter } from './report';
import { refundRouter } from './refund';
import { refundRequestRouter } from './refundRequest';
import { scheduleRouter } from './schedule';
import { serviceLoopRouter } from './serviceLoop';
import { slotPortRouter } from './slotPort';
import { staffExitRouter } from './staffExit';
import { staffTaskRouter } from './staffTask';
import { serviceStepRouter } from './serviceStep';
import { storeRouter } from './store';
import { storedValueRouter } from './storedValue';
import { announceRouter } from './announce';
import { pdcaRouter, selfCheckRouter, taskExecRouter } from './taskCollab';
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
  refundRequest: refundRequestRouter, // 批次 C5 客户退款申请（客户端申请实体+审批缝；批准复用 R12 executeRefundCore 内核）
  membership: membershipRouter, // 批次 R11a 会员前置批（档位透出/微光开档/售卡/续费/退会/立省钩子/年费分摊双口径）
  serviceLoop: serviceLoopRouter, // 补缺大批片 4（服务闭环：相册聚合/安心证书/美容报告/客服工单/发票申请/客服时间公示）
  authSecurity: authSecurityRouter, // 批次 R13a 账号安全（注销/换绑双码/换绑申诉/设备登记）
  pay: payRouter, // 批次 6 补缺大批 server 侧收单骨架（quote/createOrder/status/listMine/reconcile + 超时关单）
  slotPort: slotPortRouter, // 端口批片 C（CJ-1002-01）：展示槽位端口（控制台第八域；liveMap 公开读/管理仅 owner）
  staffTask: staffTaskRouter, // 员工端骨架批片 1：任务总线骨架（staff_tasks 只读投影——聚合既有域在途件，不建第二口径不写业务表）
  schedule: scheduleRouter, // 员工端骨架批片 2：排班域（模板/生成/发布/换班/请假/调休/技能/CSV 导入，冻结版 V1.0 §二.B2）
  taskExec: taskExecRouter, // 员工端骨架批片 3：循环任务（模板自管+触读即补生成+提醒一发闸）
  pdca: pdcaRouter, // 片 3：PDCA 问题-整改-复检闭环（类目集入端口，timeline 只增留痕）
  selfCheck: selfCheckRouter, // 片 3：门店每日自检+上级审核（服务端算分，一店一日一表幂等锚）
  announce: announceRouter, // 片 3：公告+已读回执（定向发布+逐人通知+对账名单）
  staffExit: staffExitRouter, // 片 3：离职交接（未完结单改挂+前后值留痕；锁定本体=staffProcedure 既有闸）
  payroll: payrollRouter, // 片 4：薪资域（协作拆分/工资条两态/发放标记留痕/异议申诉返还，涉钱批）
  report: reportRouter, // 客户端体验大批片 5：尾牙读口 5+报表 17 张点亮（W-13）+N6 申诉铁规两件+CSV 导出仅店主
});

/** 前端 tRPC client 的类型锚点（仅类型导出，无运行时开销） */
export type AppRouter = typeof appRouter;
