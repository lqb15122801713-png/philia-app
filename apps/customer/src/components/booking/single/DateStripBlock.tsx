import { weekCN } from '../format';
import { isSameDay, type DayGrid } from './slotGrid';

const stripLabel = (d: Date) => {
  const now = new Date();
  if (isSameDay(d, now)) return '今天';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(d, tomorrow)) return '明天';
  return weekCN(d);
};

export default function DateStripBlock({
  days,
  selectedDay,
  onPickDay,
}: {
  days: DayGrid[];
  selectedDay: Date | null;
  onPickDay: (d: Date) => void;
}) {
  return (
    <div data-testid="gs-date-strip">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => {
          const active = selectedDay !== null && isSameDay(d.date, selectedDay);
          const greyed = d.closed || !d.hasAvailable;
          return (
            <button
              key={d.date.getTime()}
              type="button"
              onClick={() => onPickDay(d.date)}
              data-testid={`gs-day-${d.date.getFullYear()}-${d.date.getMonth() + 1}-${d.date.getDate()}`}
              data-active={active ? 'true' : 'false'}
              data-greyed={greyed ? 'true' : 'false'}
              aria-label={`${stripLabel(d.date)}${d.date.getDate()}日${d.closed ? '，休息' : !d.hasAvailable ? '，约满' : ''}`}
              className={`flex h-[68px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[16px] border text-center transition active:scale-95 ${
                active ? 'border-transparent bg-brand-cta text-brand-cta-on' : 'border-line-ring bg-card text-ink'
              } ${greyed && !active ? 'opacity-45' : ''}`}
            >
              <span className={`text-caption ${active ? 'text-[#E8E2D6]' : 'text-ink-secondary'}`}>{stripLabel(d.date)}</span>
              <span className="u1-num mt-0.5 text-body-lg font-semibold">{d.date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
