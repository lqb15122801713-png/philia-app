/**
 * B9a 任务 A · v4.1 减法版员工横滑选择（单屏族样式副本）：
 * 逻辑 1:1 复刻共享件 ../StaffPicker（首个固定「随缘」门店安排，其后在职员工；
 * appointment.create 无 staffId 入参，所选员工以备注前缀传达门店）。
 * 共享件 StaffPicker 被旧 4 屏向导 /wizard 共用，不动。
 *
 * U4-D1 逐格对照试样（.staff/.st-photo 工艺）：
 * - 卡：118px 宽横滑卡（试样 .staff），rounded-control 14 + 细线 ring；
 *   选中卡=深棕墨 2px 描边（试样 .staff.sel）。
 * - 头像圈 58px 圆（试样 .st-photo）：listStaffPublic 不透出头像字段（staff 表无
 *   avatar，实证 schema/listStaffPublic 仅 id/name/skills）——无照片=浅木底
 *   （bg-oak-light）+衬线首字（u1-serif）字圈，选中态柠檬边（任务书 D-补1 口径）。
 * - 置顶「随缘派单」默认卡：木纹底（bg-oak）爪印 VI 线图标 +「最早可约 HH:MM」
 *   真值（页面由可约槽集合算出，无可约槽回退「门店安排」，不造假）。
 * - 横滑条滚动条隐藏（D-补2 口径：scrollbar-width:none + ::-webkit-scrollbar 隐藏）。
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
  const cardCls = (active: boolean) =>
    `flex w-[118px] shrink-0 flex-col items-center gap-1 rounded-control px-3 py-3.5 text-center ring-1 transition active:scale-95 ${
      active ? 'ring-2 ring-ink' : 'ring-line-ring'
    }`;

  return (
    <div
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-testid="gs-groomer-rail"
    >
      {/* 置顶默认卡：随缘派单（不指定，门店按 S4 可用性引擎自动派单） */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        data-testid="gs-groomer-any"
        className={cardCls(selectedId === null)}
      >
        <span
          className={`flex h-[58px] w-[58px] items-center justify-center rounded-full bg-oak ${
            selectedId === null ? 'ring-2 ring-brand-primary' : ''
          }`}
          aria-hidden="true"
        >
          <PawPrint className="h-6 w-6 text-ink" strokeWidth={1.5} />
        </span>
        <span className="mt-1 text-body-sm font-semibold">随缘派单</span>
        <span className="u1-num text-caption-xs text-ink-secondary">
          {earliestLabel ? `最早可约 ${earliestLabel}` : '门店安排'}
        </span>
      </button>

      {loading
        ? [1, 2].map((i) => (
            <div key={i} className="h-[132px] w-[118px] shrink-0 animate-pulse rounded-control bg-sunken" />
          ))
        : staff.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              data-testid={`gs-groomer-${s.id}`}
              className={cardCls(selectedId === s.id)}
            >
              {/* 字圈：无真实头像字段——浅木底 + 衬线首字；选中柠檬边（任务书 D-补1） */}
              <span
                className={`flex h-[58px] w-[58px] items-center justify-center rounded-full bg-oak-light u1-serif text-title-lg font-semibold text-ink ${
                  selectedId === s.id ? 'ring-2 ring-brand-primary' : ''
                }`}
                aria-hidden="true"
              >
                {s.name.slice(0, 1)}
              </span>
              <span className="mt-1 text-body-sm font-semibold">{s.name}</span>
              <span className="text-caption-xs text-ink-secondary">
                {(s.skills ?? []).map((k) => SKILL_LABEL[k] ?? k).join('·') || '店员'}
              </span>
            </button>
          ))}
    </div>
  );
}
