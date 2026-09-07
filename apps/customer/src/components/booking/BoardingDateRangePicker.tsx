/**
 * 寄养两阶段日期选择（v1.1-b2 B2-5 交互，v1.1-b3 B3-4 抽为共用组件）：
 * - 先选入住日：选定后入住网格收起为摘要 chip（「入住 M月D日 周x · 点击修改」），
 *   页面只留退房网格，杜绝选退房时误触改入住；
 * - 点 chip 返回重选入住（退房选择随之清空）；
 * - 选定退房日即显示「共 N 晚」（不等提交）；门店休息日禁选。
 * 使用方：寄养预约向导（BookingBoardingPage）、寄养改期面板（AppointmentDetailPage B3-4）。
 */

import { useMemo, useState } from 'react';
import { dayLabel, fmtMD, nightsBetween, weekCN } from './format';
import type { StoreWithHours } from './types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** 门店某日是否休息 */
const isClosed = (store: Pick<StoreWithHours, 'openHours'> | null, d: Date) =>
  !store?.openHours?.[DAY_KEYS[d.getDay()]!];

/** 入住时刻：当日开店时间，向上对齐 30min 粒度（服务端强校验） */
export function checkinAt(store: Pick<StoreWithHours, 'openHours'>, d: Date): Date {
  const hours = store.openHours?.[DAY_KEYS[d.getDay()]!];
  const [oh = 10, om = 0] = (hours?.open ?? '10:00').split(':').map(Number);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), oh, om, 0, 0);
  const rem = t.getMinutes() % 30;
  if (rem !== 0) t.setMinutes(t.getMinutes() + (30 - rem));
  return t;
}

export default function BoardingDateRangePicker({
  store,
  checkin,
  checkout,
  onCheckinChange,
  onCheckoutChange,
  days = 14,
}: {
  store: Pick<StoreWithHours, 'openHours'> | null;
  checkin: Date | null;
  checkout: Date | null;
  onCheckinChange: (d: Date) => void;
  onCheckoutChange: (d: Date | null) => void;
  /** 入住/退房可选天数（各自自其起点起算，默认 14 天） */
  days?: number;
}) {
  // 两阶段：选定入住后入住网格收起为摘要 chip，点 chip 返回重选
  const [reselectingCheckin, setReselectingCheckin] = useState(false);

  const today = new Date();
  const checkinDays = useMemo(
    () => Array.from({ length: days }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days],
  );
  const checkoutDays = useMemo(() => {
    if (!checkin) return [];
    return Array.from(
      { length: days },
      (_, i) => new Date(checkin.getFullYear(), checkin.getMonth(), checkin.getDate() + i + 1),
    );
  }, [checkin, days]);

  const pickCheckin = (d: Date) => {
    setReselectingCheckin(false);
    onCheckinChange(d);
    if (checkout && checkout <= d) onCheckoutChange(null);
  };

  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;

  const dayBtn = (d: Date, active: boolean, disabled: boolean, onClick: () => void) => (
    <button
      key={d.getTime()}
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-input px-1 py-2 text-center transition ${
        active
          ? 'bg-brand-primary font-semibold text-white shadow-card'
          : disabled
            ? 'cursor-not-allowed bg-sunken text-ink-placeholder'
            : 'bg-card text-ink shadow-card active:scale-95'
      }`}
    >
      <span className="block text-caption">{d.getTime() === checkinDays[0]?.getTime() ? '今天' : weekCN(d)}</span>
      <span className="block font-number text-body">{fmtMD(d)}</span>
    </button>
  );

  return (
    <div>
      <h2 className="text-title">入住日期</h2>
      {checkin === null || reselectingCheckin ? (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {checkinDays.map((d) =>
            dayBtn(d, checkin?.getTime() === d.getTime(), isClosed(store, d), () => pickCheckin(d)),
          )}
        </div>
      ) : (
        // 两阶段：入住已定 → 收起为摘要 chip，页面只留退房网格，杜绝误触改入住
        <button
          type="button"
          onClick={() => {
            setReselectingCheckin(true);
            onCheckoutChange(null); // 返回重选入住：退房选择随之清空
          }}
          className="mt-2 flex w-full items-center justify-between rounded-card bg-card px-4 py-3 text-body shadow-card transition active:scale-[0.99]"
        >
          <span>
            入住 <span className="font-number font-semibold">{fmtMD(checkin)}</span> {weekCN(checkin)}
          </span>
          <span className="text-caption font-medium text-brand-primary">点击修改</span>
        </button>
      )}

      {checkin && !reselectingCheckin ? (
        <>
          <h2 className="mt-5 text-title">退房日期</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {checkoutDays.map((d) =>
              dayBtn(d, checkout?.getTime() === d.getTime(), isClosed(store, d), () => onCheckoutChange(d)),
            )}
          </div>
        </>
      ) : null}

      {checkin && checkout ? (
        <p className="mt-3 rounded-card bg-brand-primary-light px-4 py-2.5 text-body text-brand-primary-pressed">
          {dayLabel(checkin)}入住 · {fmtMD(checkout)} {weekCN(checkout)}退房 · 共{' '}
          <span className="font-number font-semibold">{nights}</span> 晚
        </p>
      ) : (
        <p className="mt-3 text-caption text-ink-placeholder">先选入住日，再选退房日（须晚于入住日）</p>
      )}
    </div>
  );
}
