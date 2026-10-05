/**
 * 预约筛选 chips（U3 任务 D · 规格书 §3 · 母本 273–275 行）：u3-chipf，当前=墨底反白。
 * 今天 N / 待到店 N / 服务中 N / 已完成 N / 取消申请 N / 寄养 N / 日期 ›。
 * 计数真值由调用方以今日 listForStore 全量在前端按口径聚合传入；状态档=前端过滤
 * （查询参数不变），「日期 ›」就地展开原生 input[type=date]，选日才改 from/to
 * （当日 0 点区间）。选中非今天时「今天」chip 不再 on，日期 chip 显示所选日期并转 on。
 */

import { useState } from 'react';

/** 状态/类型聚合档（口径见 AppointmentsPage 的 CATEGORY_MATCH） */
export type CategoryKey = 'arriving' | 'serving' | 'done' | 'cancel' | 'boarding';

export interface ChipCounts {
  today: number;
  arriving: number;
  serving: number;
  done: number;
  cancel: number;
  boarding: number;
}

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'arriving', label: '待到店' },
  { key: 'serving', label: '服务中' },
  { key: 'done', label: '已完成' },
  { key: 'cancel', label: '取消申请' },
  { key: 'boarding', label: '寄养' },
];

export function StatusChips({
  counts,
  isToday,
  category,
  pickedDate,
  onToday,
  onCategory,
  onPickDate,
}: {
  counts: ChipCounts;
  /** 当前列表是否=今天（决定「今天」chip 与日期 chip 的 on 态） */
  isToday: boolean;
  category: CategoryKey | null;
  /** 当前日期档（yyyy-MM-dd 本地键；全部档传今天） */
  pickedDate: string;
  onToday: () => void;
  onCategory: (c: CategoryKey) => void;
  onPickDate: (dayKey: string) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const picked = new Date(`${pickedDate}T00:00:00`);
  const pickedLabel = `${picked.getMonth() + 1}月${picked.getDate()}日`;
  const todayOn = isToday && category === null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="预约筛选">
      <button
        type="button"
        role="tab"
        aria-selected={todayOn}
        onClick={onToday}
        className={`u3-chipf${todayOn ? ' on' : ''}`}
      >
        今天 <span className="u1-num">{counts.today}</span>
      </button>

      {CATEGORIES.map((c) => {
        const on = category === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onCategory(c.key)}
            className={`u3-chipf${on ? ' on' : ''}`}
          >
            {c.label} <span className="u1-num">{counts[c.key]}</span>
          </button>
        );
      })}

      <button
        type="button"
        aria-expanded={dateOpen}
        onClick={() => setDateOpen((v) => !v)}
        className={`u3-chipf${isToday ? '' : ' on'}`}
      >
        {isToday ? '日期' : pickedLabel} ›
      </button>
      {dateOpen ? (
        <input
          type="date"
          value={pickedDate}
          autoFocus
          aria-label="选择日期"
          onChange={(e) => {
            if (e.target.value) onPickDate(e.target.value);
          }}
          className="u1-ring u1-num h-[33px] rounded-control bg-card px-2.5 text-[12px] text-ink focus:outline-none"
        />
      ) : null}
    </div>
  );
}
