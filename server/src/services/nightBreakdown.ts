/**
 * 寄养按晚分明细公共件（商家端大批片 3 · S13 复走同源口径）：
 * 算式与 refund.ts 寄养剩余晚退（V4）逐字同源——
 * - totalNights=max(1, ceil((end−start)/24h))；
 * - occurredNights=入住日~执行日（+8 门店墙钟日界；已退住则截至退住日），clamp [0,total]；
 * - perNightFen=floor(行有效价×qty ÷ 总晚)（残余分归已发生晚，口径写死）。
 * 用法：退款侧（refund.ts 寄养剩余晚退）与收银透出侧（cashier.billSnapshot 寄养行
 * nightBreakdown 透出）共用，禁止两处各写算式漂移。
 */
import { storeDayStartMs, storeWallclock } from '../routers/appointment';

export interface NightBreakdown {
  totalNights: number;
  occurredNights: number;
  remainingNights: number;
  perNightFen: number;
}

export function computeNightBreakdown(opts: {
  scheduledStart: Date;
  scheduledEnd: Date;
  checkoutAt?: Date | null;
  /** 行有效价×qty 总额（分） */
  effAmountFen: number;
  now?: Date;
}): NightBreakdown {
  const now = opts.now ?? new Date();
  const totalNights = Math.max(
    1,
    Math.ceil((opts.scheduledEnd.getTime() - opts.scheduledStart.getTime()) / (24 * 3600 * 1000)),
  );
  const startW = storeWallclock(opts.scheduledStart);
  const startDayMs = storeDayStartMs(startW.y, startW.m, startW.day);
  const endRef = opts.checkoutAt && opts.checkoutAt.getTime() < now.getTime() ? opts.checkoutAt : now;
  const endW = storeWallclock(endRef);
  const endDayMs = storeDayStartMs(endW.y, endW.m, endW.day);
  const occurredNights = Math.max(
    0,
    Math.min(totalNights, Math.round((endDayMs - startDayMs) / (24 * 3600 * 1000))),
  );
  return {
    totalNights,
    occurredNights,
    remainingNights: totalNights - occurredNights,
    perNightFen: Math.floor(opts.effAmountFen / totalNights),
  };
}
