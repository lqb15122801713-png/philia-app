/**
 * B9a 任务 A · v4.1 减法版员工横滑选择（单屏族样式副本）：
 * 逻辑 1:1 复刻共享件 ../StaffPicker（首个固定「随缘」门店安排，其后在职员工；
 * appointment.create 无 staffId 入参，所选员工以备注前缀传达门店）。
 * 共享件 StaffPicker 被旧 4 屏向导 /wizard 共用，不动。
 *
 * U1-D 换肤（v9.1 美容师横卡）：置顶「随缘派单」默认卡（paw VI 线图标，替换 🐾
 * 彩色 emoji——全域禁彩色图标）+ 横滑员工卡；卡片=U1-B 细线 ring 控件档
 * （rounded-control 14 + ring-1 ring-line-ring），选中态=深棕墨 1.5px 细线圈（同语言）。
 */

import { PawPrint } from 'lucide-react';
import type { StaffPublic } from '../types';
import { SKILL_LABEL } from '../format';

export default function StaffPickerFlat({
  staff,
  selectedId,
  onSelect,
  loading,
}: {
  staff: StaffPublic[];
  /** null = 随缘派单 */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading?: boolean;
}) {
  const cardCls = (active: boolean) =>
    `flex w-24 shrink-0 flex-col items-center gap-1 rounded-control px-2 py-3 text-center ring-1 transition active:scale-95 ${
      active ? 'ring-2 ring-ink' : 'ring-line-ring'
    }`;

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1" data-testid="gs-groomer-rail">
      {/* 置顶默认卡：随缘派单（不指定，门店按 S4 可用性引擎自动派单） */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        data-testid="gs-groomer-any"
        className={cardCls(selectedId === null)}
      >
        <span className="flex h-11 w-11 items-center justify-center" aria-hidden="true">
          <PawPrint className="h-6 w-6 text-ink" strokeWidth={1.5} />
        </span>
        <span className="text-body-sm font-semibold">随缘派单</span>
        <span className="text-caption-xs text-ink-secondary">门店安排</span>
      </button>

      {loading
        ? [1, 2].map((i) => (
            <div key={i} className="h-[104px] w-24 shrink-0 animate-pulse rounded-control bg-sunken" />
          ))
        : staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              data-testid={`gs-groomer-${s.id}`}
              className={cardCls(selectedId === s.id)}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-line-ring text-body font-semibold text-ink">
                {s.name.slice(0, 1)}
              </span>
              <span className="text-body-sm font-semibold">{s.name}</span>
              <span className="text-caption-xs text-ink-secondary">
                {(s.skills ?? []).map((k) => SKILL_LABEL[k] ?? k).join('·') || '店员'}
              </span>
            </button>
          ))}
    </div>
  );
}
