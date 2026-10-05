/**
 * B4-2 寄养单屏 · 入住/退房日期区块：
 * 两个大日期格（入住 / 退房），点按各自唤起底部月历 range picker 的对应阶段；
 * 两日齐后实时显示「共 N 晚 · 单晚 ¥X」（单晚价来自已选房型，未选房型只显示晚数）。
 *
 * 换皮批片 2（定稿 H-01 / §4.10 rangebar 工艺卡）：入住/离店双卡 16（白卡 --line 边，
 * k=mono 9 卡其组头 / v=mono 15/700 日期 / w=周次小注）+ 中箭头（mono 卡其）+
 * 右上「共 N 晚」淡黄角标（-9px 浮起，本屏点睛位）。交互零改动。
 */

import { fenToYuan, fmtMD, weekCN } from '../format';

export default function BoardingDatesBlock({
  checkin,
  checkout,
  nights,
  perNightFen,
  onOpen,
}: {
  checkin: Date | null;
  checkout: Date | null;
  nights: number;
  /** 已选房型单晚价（分），null = 未选房型 */
  perNightFen: number | null;
  /** 唤起底部月历（入住格 → checkin 阶段；退房格 → checkout 阶段） */
  onOpen: (phase: 'checkin' | 'checkout') => void;
}) {
  const bothPicked = checkin !== null && checkout !== null;

  const cell = (label: string, value: Date | null, phase: 'checkin' | 'checkout', testId: string) => (
    <button
      type="button"
      onClick={() => onOpen(phase)}
      data-testid={testId}
      className="flex-1 rounded-card border border-line bg-card px-3.5 py-3 text-left transition active:scale-[0.99]"
    >
      <span className="block font-number text-[9px] tracking-[.08em] text-brand-secondary">{label}</span>
      {value ? (
        <>
          <span className="mt-1 block font-number text-body font-bold">{fmtMD(value)}</span>
          <span className="mt-0.5 block text-[10px] text-ink-secondary">{weekCN(value)}</span>
        </>
      ) : (
        <span className="mt-1 block text-body text-ink-placeholder">请选择</span>
      )}
    </button>
  );

  return (
    <div>
      <div className="relative">
        <div className="flex items-stretch gap-2">
          {cell('入住 CHECK-IN', checkin, 'checkin', 'bs-checkin-cell')}
          {/* 中箭头（mono 卡其） */}
          <span className="self-center font-number text-caption text-brand-secondary" aria-hidden="true">
            →
          </span>
          {cell('离店 CHECK-OUT', checkout, 'checkout', 'bs-checkout-cell')}
        </div>
        {/* 「共 N 晚」淡黄角标（-9px 浮起，点睛位）；既有 testid 锚点移挂此件 */}
        {bothPicked ? (
          <span
            data-testid="bs-nights-line"
            className="absolute -top-[9px] right-0 rounded-full bg-brand-primary px-2.5 py-[3px] font-number text-v2-trace font-bold text-ink"
          >
            共 {nights} 晚
          </span>
        ) : null}
      </div>
      {bothPicked ? (
        perNightFen !== null ? (
          <p className="mt-2 font-number text-v2-trace text-ink-secondary">
            单晚 {fenToYuan(perNightFen)}
          </p>
        ) : null
      ) : (
        <p className="mt-2 text-caption text-ink-placeholder" data-testid="bs-nights-line">
          点按选择入住与退房日期（退房须晚于入住）
        </p>
      )}
    </div>
  );
}
