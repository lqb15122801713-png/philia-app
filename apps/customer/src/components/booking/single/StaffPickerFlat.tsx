/**
 * B9a 任务 A · v4.1 减法版员工横滑选择（单屏族样式副本）：
 * 逻辑 1:1 复刻共享件 ../StaffPicker（首个固定「随缘」门店安排，其后在职员工；
 * appointment.create 无 staffId 入参，所选员工以备注前缀传达门店）。
 * 仅视觉按设计规格 v3 §1 重做——去卡片化（hairline 细线卡）、去阴影、
 * 无彩色图标底块（首字母/emoji 细线圈或直接呈现）、选中态=深棕墨细线圈。
 * 共享件 StaffPicker 被旧 4 屏向导 /wizard 共用，不动。
 */

import type { StaffPublic } from '../types';
import { SKILL_LABEL } from '../format';

export default function StaffPickerFlat({
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
    `flex w-24 shrink-0 flex-col items-center gap-1 rounded-card border px-2 py-3 text-center transition active:scale-95 ${
      active ? 'border-[1.5px] border-ink' : 'border-line'
    }`;

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {/* 随缘：不指定 */}
      <button type="button" onClick={() => onSelect(null)} className={cardCls(selectedId === null)}>
        <span className="flex h-11 w-11 items-center justify-center text-[24px]">
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
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-body font-semibold text-ink">
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
