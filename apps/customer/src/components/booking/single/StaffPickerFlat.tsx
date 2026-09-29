/**
 * B9a 任务 A · v4.1 减法版员工横滑选择（单屏族样式副本）：
 * 逻辑 1:1 复刻共享件 ../StaffPicker（首个固定「随缘」门店安排，其后在职员工；
 * appointment.create 无 staffId 入参，所选员工以备注前缀传达门店）。
 * 共享件 StaffPicker 被旧 4 屏向导 /wizard 共用，不动。
 *
 * 换皮批片 2（定稿 B-01 / §4.4 gr-rail 工艺卡）：
 * - 卡 132 宽圆角 18 居中：字像 56 圆（#F4EDDC 底 + 姓字 17/800）+ 名 13.5/800
 *   + mono 8.5 专长行；选中=1.5px 深棕边 + 字像变金（淡黄底，本屏点睛位之二）。
 * - 横滑出血吃满屏宽 + scroll-snap（定稿 .gr-rail）；滚动条隐藏沿用。
 * - 「随缘派单」默认卡移至末卡（定稿口径：末卡=「不指定 · 门店安排」），
 *   选择逻辑/备注前缀传达口径不变。
 * listStaffPublic 不透出头像字段（staff 表无 avatar，实证仅 id/name/skills）——
 * 无照片=圆章底字像，不造假图。
 */

import { PawPrint } from 'lucide-react';
import type { StaffPublic } from '../types';
import { SKILL_LABEL } from '../format';

export default function StaffPickerFlat({
  staff,
  selectedId,
  onSelect,
  loading,
  earliestLabel,
}: {
  staff: StaffPublic[];
  /** null = 随缘派单 */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  loading?: boolean;
  /** 随缘卡「最早可约 HH:MM」真值（可约槽集合最早时刻）；null = 暂无可约槽，回退「门店安排」 */
  earliestLabel?: string | null;
}) {
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
            <div key={i} className="h-[148px] w-[132px] shrink-0 animate-pulse rounded-[18px] bg-sunken" />
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
        <span className="mt-[9px] text-[13.5px] font-extrabold leading-5">随缘派单</span>
        <span className="mt-1 font-number text-[8.5px] leading-[1.6] text-ink-secondary">
          {earliestLabel ? `最早可约 ${earliestLabel}` : '门店安排'}
        </span>
      </button>
    </div>
  );
}
