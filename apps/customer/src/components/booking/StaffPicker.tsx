/**
 * 员工横滑选择（T2.2 · 洗护第 3 屏）：
 * 首个固定为「随缘」（不指定员工，门店安排），其后为 listStaffPublic 的在职员工。
 * 说明：appointment.create 暂无 staffId 入参，所选员工以备注前缀传达门店（见提交处）。
 */

import type { StaffPublic } from './types';
import { SKILL_LABEL } from './format';

export default function StaffPicker({
  staff,
  selectedId,
  onSelect,
  loading,
}: {
  staff: StaffPublic[];
  /** null = 随缘 */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading?: boolean;
}) {
  const cardCls = (active: boolean) =>
    `flex w-24 shrink-0 flex-col items-center gap-1 rounded-card px-2 py-3 text-center transition active:scale-95 ${
      active ? 'bg-brand-primary-light shadow-card ring-2 ring-brand-primary' : 'bg-card shadow-card'
    }`;

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {/* 随缘：不指定 */}
      <button type="button" onClick={() => onSelect(null)} className={cardCls(selectedId === null)}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-secondary-light text-[20px]">
          🐾
        </span>
        <span className="text-body font-medium">随缘</span>
        <span className="text-caption text-ink-secondary">门店安排</span>
      </button>

      {loading
        ? [1, 2].map((i) => (
            <div key={i} className="h-[104px] w-24 shrink-0 animate-pulse rounded-card bg-sunken" />
          ))
        : staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cardCls(selectedId === s.id)}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-body font-semibold text-white">
                {s.name.slice(0, 1)}
              </span>
              <span className="text-body font-medium">{s.name}</span>
              <span className="text-caption text-ink-secondary">
                {(s.skills ?? []).map((k) => SKILL_LABEL[k] ?? k).join('·') || '店员'}
              </span>
            </button>
          ))}
    </div>
  );
}
