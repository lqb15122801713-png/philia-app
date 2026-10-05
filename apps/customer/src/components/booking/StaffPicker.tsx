/**
 * 员工横滑选择（T2.2 · 洗护第 3 屏；换皮批片 2 定稿 B-01 单屏族减法皮）：
 * 固定「随缘」卡（不指定员工，门店安排）+ listStaffPublic 在职员工。
 * 说明：appointment.create 暂无 staffId 入参，所选员工以备注前缀传达门店（见提交处）。
 *
 * 换皮批片 5：双胞归并——原 single/StaffPickerFlat 与本件逻辑 1:1 同构，合并为
 * 单组件 + variant；single/StaffPickerFlat.tsx 改转发 variant='flat'。
 * 两皮定稿口径差逐字保留：
 * - card（旧 4 屏向导）：随缘为首卡，96 宽白卡投影皮；
 * - flat（单屏族，定稿 B-01 / §4.4 gr-rail）：132 宽圆角 18 + scroll-snap 出血横滑，
 *   选中=1.5px 深棕边 + 字像变金；「随缘派单」为末卡（定稿口径：末卡=不指定 ·
 *   门店安排），带最早可约时刻；gs-groomer-* testid 仅 flat 皮保留（e2e 契约）。
 * listStaffPublic 不透出头像字段（staff 表无 avatar，实证仅 id/name/skills）——
 * 无照片=圆章底字像，不造假图。
 */

import { PawPrint } from 'lucide-react';
import { Skeleton } from '@philia/shared';
import { bkc } from '@/copy/booking';
import type { StaffPublic } from './types';
import { SKILL_LABEL } from './format';

export interface StaffPickerProps {
  /** 皮：'card'（旧 4 屏向导，随缘首卡）| 'flat'（单屏族定稿，随缘末卡） */
  variant?: 'card' | 'flat';
  staff: StaffPublic[];
  /** null = 随缘（派单） */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading?: boolean;
  /** flat 皮：随缘卡「最早可约 HH:MM」真值（可约槽集合最早时刻）；
      null = 暂无可约槽，回退「门店安排」；card 皮忽略 */
  earliestLabel?: string | null;
}

export default function StaffPicker({
  variant = 'card',
  staff,
  selectedId,
  onSelect,
  loading,
  earliestLabel,
}: StaffPickerProps) {
  if (variant === 'flat') {
    /* grcard（定稿）：132 宽圆角 18；选中=1.5px 深棕边（替代旧 ring 体系） */
    const cardCls = (active: boolean) =>
      `flex w-[132px] shrink-0 snap-center flex-col items-center rounded-[18px] border px-3 py-3.5 text-center transition active:scale-95 ${
        active ? 'border-[1.5px] border-ink bg-card' : 'border-line bg-card'
      }`;

    return (
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="gs-groomer-rail"
      >
        {loading
          ? [1, 2].map((i) => (
              <Skeleton key={i} className="h-[148px] w-[132px] shrink-0 rounded-[18px]" />
            ))
          : staff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                data-testid={`gs-groomer-${s.id}`}
                className={cardCls(selectedId === s.id)}
              >
                {/* 字像 56 圆：#F4EDDC 底 + 姓字 17/800；选中字像变金（定稿点睛口径） */}
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-[17px] font-extrabold text-ink ${
                    selectedId === s.id ? 'bg-brand-primary' : 'bg-sunken'
                  }`}
                  aria-hidden="true"
                >
                  {s.name.slice(0, 1)}
                </span>
                <span className="mt-[9px] text-[13.5px] font-extrabold leading-5">{s.name}</span>
                <span className="mt-1 font-number text-[8.5px] leading-[1.6] text-ink-secondary">
                  {(s.skills ?? []).map((k) => SKILL_LABEL[k] ?? k).join('·') || '店员'}
                </span>
              </button>
            ))}

        {/* 末卡：随缘派单（不指定，门店按 S4 可用性引擎自动派单；定稿口径末卡=不指定） */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          data-testid="gs-groomer-any"
          className={cardCls(selectedId === null)}
        >
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              selectedId === null ? 'bg-brand-primary' : 'bg-sunken'
            }`}
            aria-hidden="true"
          >
            <PawPrint className="h-6 w-6 text-ink" strokeWidth={1.5} />
          </span>
          <span className="mt-[9px] text-[13.5px] font-extrabold leading-5">{bkc('booking.staffAny')}</span>
          <span className="mt-1 font-number text-[8.5px] leading-[1.6] text-ink-secondary">
            {earliestLabel ? bkc('booking.staffEarliest', { time: earliestLabel }) : bkc('booking.staffAnySub')}
          </span>
        </button>
      </div>
    );
  }

  const cardCls = (active: boolean) =>
    `flex w-24 shrink-0 flex-col items-center gap-1 rounded-card px-2 py-3 text-center transition active:scale-95 ${
      active ? 'bg-brand-primary-light shadow-card ring-2 ring-brand-primary' : 'bg-card shadow-card'
    }`;

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* 随缘：不指定 */}
      <button type="button" onClick={() => onSelect(null)} className={cardCls(selectedId === null)}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-secondary-light text-[20px]">
          🐾
        </span>
        <span className="text-body font-medium">{bkc('booking.staffAnyCard')}</span>
        <span className="text-caption text-ink-secondary">{bkc('booking.staffAnySub')}</span>
      </button>

      {loading
        ? [1, 2].map((i) => (
            <Skeleton key={i} className="h-[104px] w-24 shrink-0 rounded-card" />
          ))
        : staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cardCls(selectedId === s.id)}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-primary text-body font-semibold text-ink">
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
