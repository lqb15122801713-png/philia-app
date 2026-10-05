/**
 * B4-2 寄养单屏 · 底部半屏单列月历 range picker（手写，零新依赖）：
 * - 交互（设计方案第三节）：点入住日 → 点退房日 → 自动应用并关闭，不设「确认」按钮；
 *   改入住日不清空退房日（新入住日仍早于已选退房日时保留，否则退房置空待重选）；
 *   退房阶段点「不晚于入住日」的日期 = 前移入住锚点（行业公认 range picker 行为）。
 * - 单列多月竖排（当月 + 次月，覆盖可约窗口），区间内日期高亮、端点实心。
 * - 硬规则与旧向导同口径（BoardingDateRangePicker 同一套判断，组件本体不动）：
 *   入住时刻（开店时刻对齐 30min）须 ≥ 当前+1h；门店休息日禁选；退房 > 入住；
 *   可约窗口沿用旧向导默认值（入住 14 天 / 退房自入住起 14 天）。
 * - 顶部「入住/退房」阶段 chip 可点按切换，便于只改其中一天。
 */

import { useMemo, useState } from 'react';
import { checkinAt } from '../BoardingDateRangePicker';
import { fmtMD, toISODate, weekCN } from '../format';
import type { StoreWithHours } from '../types';
import BottomSheet from './BottomSheet';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const WEEK_HEADER = ['日', '一', '二', '三', '四', '五', '六'] as const;
/** B3-5（W-2 统一口径）：入住时刻落在「当前时间 +1h 缓冲」内的日期禁选 */
const LEAD_BUFFER_MS = 60 * 60 * 1000;
/** 可约窗口（与旧向导 BoardingDateRangePicker 默认 days=14 一致） */
const CHECKIN_WINDOW_DAYS = 14;
const CHECKOUT_WINDOW_DAYS = 14;

type Phase = 'checkin' | 'checkout';

/** 门店某日是否休息 */
const isClosed = (store: Pick<StoreWithHours, 'openHours'> | null, d: Date) =>
  !store?.openHours?.[DAY_KEYS[d.getDay()]!];

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function BoardingRangeSheet({
  store,
  checkin,
  checkout,
  initialPhase,
  onApply,
  onClose,
}: {
  store: Pick<StoreWithHours, 'openHours'> | null;
  checkin: Date | null;
  checkout: Date | null;
  /** 从哪个日期格唤起（入住格 → 先改入住；退房格 → 先改退房） */
  initialPhase?: Phase;
  /** 两日都选定即回调（自动应用），父组件负责关闭本 sheet */
  onApply: (checkin: Date, checkout: Date) => void;
  onClose: () => void;
}) {
  const [cIn, setCIn] = useState<Date | null>(checkin);
  const [cOut, setCOut] = useState<Date | null>(checkout);
  const [phase, setPhase] = useState<Phase>(initialPhase ?? (checkin ? 'checkout' : 'checkin'));

  const today = useMemo(() => dayStart(new Date()), []);
  const minCheckin = today;
  const maxCheckin = addDays(today, CHECKIN_WINDOW_DAYS - 1);
  /** 可约最远日 = 入住窗口末日 + 退房窗口（渲染月历覆盖到该日所在月） */
  const maxBookable = addDays(maxCheckin, CHECKOUT_WINDOW_DAYS);

  /** 入住日过近禁选：该日入住时刻（开店时刻对齐 30min）须 ≥ 当前时间 +1h */
  const checkinTooSoon = (d: Date): boolean =>
    store != null && checkinAt(store, d).getTime() < Date.now() + LEAD_BUFFER_MS;

  const disabled = (d: Date): boolean => {
    if (isClosed(store, d)) return true;
    if (checkinTooSoon(d)) return true; // 任何可能被设为入住日的日期都适用
    if (d.getTime() < minCheckin.getTime()) return true;
    if (phase === 'checkout' && cIn) {
      // 退房阶段：入住日及之前可点（前移入住锚点），超过退房窗口禁选
      return d.getTime() > addDays(cIn, CHECKOUT_WINDOW_DAYS).getTime();
    }
    return d.getTime() > maxCheckin.getTime();
  };

  const applyIfComplete = (ni: Date | null, no: Date | null) => {
    if (ni && no && no.getTime() > ni.getTime()) onApply(ni, no);
  };

  const tap = (d: Date) => {
    if (disabled(d)) return;
    if (phase === 'checkin' || !cIn) {
      // 点入住日：不清空仍有效的退房日（任务书硬性交互）
      const no = cOut && cOut.getTime() > d.getTime() ? cOut : null;
      setCIn(d);
      setCOut(no);
      if (no) applyIfComplete(d, no);
      else setPhase('checkout');
      return;
    }
    // 退房阶段：晚于入住日 → 定退房并自动应用；否则前移入住锚点
    if (d.getTime() > cIn.getTime()) {
      setCOut(d);
      applyIfComplete(cIn, d);
    } else {
      const no = cOut && cOut.getTime() > d.getTime() ? cOut : null;
      setCIn(d);
      setCOut(no);
      if (no) applyIfComplete(d, no);
    }
  };

  /* 单列多月：当月 1 号起，到可约最远日所在月 */
  const months = useMemo(() => {
    const list: Date[] = [];
    let cur = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cur.getTime() <= maxBookable.getTime()) {
      list.push(cur);
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRange = (d: Date) =>
    cIn && cOut && d.getTime() > cIn.getTime() && d.getTime() < cOut.getTime();
  const isEndpoint = (d: Date) =>
    (cIn && d.getTime() === cIn.getTime()) || (cOut && d.getTime() === cOut.getTime());

  const phaseChip = (p: Phase, label: string, value: Date | null) => (
    <button
      type="button"
      onClick={() => setPhase(p)}
      data-testid={`bs-phase-${p}`}
      data-active={phase === p ? 'true' : 'false'}
      className={`flex-1 rounded-control border px-3 py-2 text-left transition ${
        phase === p ? 'border-[1.5px] border-ink' : 'border-line'
      }`}
    >
      <span className="block text-caption text-ink-secondary">{label}</span>
      <span className={`block font-number text-body font-semibold ${value ? 'text-ink' : 'text-ink-placeholder'}`}>
        {value ? `${fmtMD(value)} ${weekCN(value)}` : '点下方日期'}
      </span>
    </button>
  );

  return (
    <BottomSheet title="选择入住 / 退房日期" onClose={onClose} testId="bs-range-sheet">
      <div className="flex gap-2">
        {phaseChip('checkin', '入住', cIn)}
        {phaseChip('checkout', '退房', cOut)}
      </div>
      <p className="mt-2 text-caption text-ink-placeholder" data-testid="bs-range-hint">
        {phase === 'checkin' ? '点选入住日期' : '点选退房日期（须晚于入住日）'} · 选定两日自动应用
      </p>

      {months.map((m) => {
        const y = m.getFullYear();
        const mon = m.getMonth();
        const daysInMonth = new Date(y, mon + 1, 0).getDate();
        const leadBlanks = m.getDay();
        return (
          <section key={`${y}-${mon}`} className="mt-4" data-testid={`bs-month-${y}-${String(mon + 1).padStart(2, '0')}`}>
            <p className="text-body font-semibold">
              {y} 年 {mon + 1} 月
            </p>
            <div className="mt-1 grid grid-cols-7 text-center text-caption text-ink-placeholder">
              {WEEK_HEADER.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: leadBlanks }, (_, i) => (
                <span key={`b${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = new Date(y, mon, i + 1);
                const dis = disabled(d);
                const endpoint = isEndpoint(d);
                const between = inRange(d);
                const isToday = d.getTime() === today.getTime();
                // 区间连色（v4.1：中性洗色 + 端点细线圈）：端点格半侧补底 + 圆角收边，中间格整格浅色
                const cinT = cIn?.getTime() ?? null;
                const coutT = cOut?.getTime() ?? null;
                const t = d.getTime();
                const wrapCls =
                  cinT === null || coutT === null
                    ? ''
                    : endpoint && t === cinT
                      ? 'rounded-l-full bg-sunken'
                      : endpoint && t === coutT
                        ? 'rounded-r-full bg-sunken'
                        : between
                          ? 'bg-sunken'
                          : '';
                return (
                  <div key={d.getTime()} className={wrapCls}>
                    <button
                      type="button"
                      disabled={dis}
                      onClick={() => tap(d)}
                      data-testid={`bs-day-${toISODate(d)}`}
                      data-disabled={dis ? 'true' : 'false'}
                      data-phase={phase}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-body transition ${
                        endpoint
                          ? 'border-[1.5px] border-ink font-semibold text-ink'
                          : dis
                            ? 'cursor-not-allowed text-ink-placeholder opacity-40'
                            : `text-ink active:scale-95 ${isToday ? 'font-semibold underline underline-offset-4' : ''}`
                      }`}
                    >
                      {i + 1}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </BottomSheet>
  );
}
