/**
 * 状态筛选 chips（T4.2）：全部 + 七态；选中态品牌浅底+品牌色字。
 */

import { STATUS_LABEL, STATUS_ORDER, type ApptStatus } from './appt-utils';

export type StatusFilter = 'all' | ApptStatus;

export function StatusChips({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const items: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    ...STATUS_ORDER.map((s) => ({ key: s as StatusFilter, label: STATUS_LABEL[s] })),
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="状态筛选">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={`h-8 shrink-0 rounded-full px-3 text-caption transition-colors ${
              active
                ? 'bg-brand-primary-light font-semibold text-brand-primary'
                : 'bg-card text-ink-secondary shadow-card hover:bg-sunken'
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
