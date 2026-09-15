/**
 * B4-2 寄养单屏 · 入住/退房日期区块：
 * 两个大日期格（入住 / 退房），点按各自唤起底部月历 range picker 的对应阶段；
 * 两日齐后实时显示「共 N 晚 · 单晚 ¥X」（单晚价来自已选房型，未选房型只显示晚数）。
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
  const cell = (label: string, value: Date | null, phase: 'checkin' | 'checkout', testId: string) => (
    <button
      type="button"
      onClick={() => onOpen(phase)}
      data-testid={testId}
      className="flex-1 rounded-card border border-line px-4 py-3 text-left transition active:scale-[0.99]"
    >
      <span className="block text-caption text-ink-secondary">{label}</span>
      {value ? (
        <span className="mt-0.5 block">
          <span className="font-number text-title font-semibold">{fmtMD(value)}</span>
          <span className="ml-1.5 text-caption text-ink-secondary">{weekCN(value)}</span>
        </span>
      ) : (
        <span className="mt-0.5 block text-body text-ink-placeholder">请选择</span>
      )}
    </button>
  );

  return (
    <div>
      <div className="flex gap-2">
        {cell('入住', checkin, 'checkin', 'bs-checkin-cell')}
        {cell('退房', checkout, 'checkout', 'bs-checkout-cell')}
      </div>
      {checkin && checkout ? (
        <p className="mt-2 text-body" data-testid="bs-nights-line">
          共 <span className="font-number font-semibold text-ink">{nights}</span> 晚
          {perNightFen !== null ? (
            <span className="text-ink-secondary"> · 单晚 <span className="font-number">{fenToYuan(perNightFen)}</span></span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-caption text-ink-placeholder" data-testid="bs-nights-line">
          点按选择入住与退房日期（退房须晚于入住）
        </p>
      )}
    </div>
  );
}
