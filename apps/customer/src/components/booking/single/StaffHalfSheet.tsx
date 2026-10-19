import { useState } from 'react';
import { Skeleton } from '@philia/shared';
import type { StaffPublic } from '../types';
import { SKILL_LABEL } from '../format';
import BottomSheet from './BottomSheet';

export default function StaffHalfSheet({
  staff,
  selectedId,
  storeName,
  loading,
  onSelect,
  onClose,
}: {
  staff: StaffPublic[];
  selectedId: string | null;
  storeName: string | null;
  loading?: boolean;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [draftOverride, setDraftOverride] = useState<{ id: string | null } | null>(null);
  const draftId = draftOverride ? draftOverride.id : (selectedId ?? staff[0]?.id ?? null);
  const draft = staff.find((member) => member.id === draftId) ?? null;
  const draftName = draft?.name ?? '系统分配';
  const skills = draft ? (draft.skills ?? []).map((key) => SKILL_LABEL[key] ?? key).filter(Boolean) : [];

  return (
    <BottomSheet
      title="选择美容师"
      onClose={onClose}
      testId="u2-staff-sheet"
      footer={
        <button
          type="button"
          data-testid="u2-staff-confirm"
          onClick={() => {
            onSelect(draftId);
            onClose();
          }}
          className="h-12 w-full rounded-full bg-brand-cta text-body-lg font-semibold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {draft ? `选择${draft.name}` : '使用系统分配'}
        </button>
      }
    >
      <p className="text-center text-caption text-ink-secondary">选定后直接回画布可点时段 · 无 Peek</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          data-testid="u2-staff-option-any"
          onClick={() => setDraftOverride({ id: null })}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-caption ${draftId === null ? 'border-transparent bg-brand-cta text-brand-cta-on' : 'border-line bg-card text-ink'}`}
        >
          系统分配
        </button>
        {loading
          ? [1, 2].map((item) => <Skeleton key={item} className="h-11 w-20 shrink-0 rounded-full" />)
          : staff.map((member) => (
              <button
                key={member.id}
                type="button"
                data-testid={`u2-staff-option-${member.id}`}
                onClick={() => setDraftOverride({ id: member.id })}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-caption ${draftId === member.id ? 'border-transparent bg-brand-cta text-brand-cta-on' : 'border-line bg-card text-ink'}`}
              >
                {member.name}
              </button>
            ))}
      </div>

      <div data-testid="u2-staff-hero" className="relative mt-4 flex h-44 items-end overflow-hidden rounded-[20px] bg-sunken p-4">
        <span className="absolute right-3 top-3 rounded-full bg-card/80 px-3 py-1 text-caption text-ink-secondary">待换</span>
        <span className="text-[28px] font-semibold text-ink">{draftName}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-body-lg font-semibold">{draftName}</p>
        <span className="text-caption text-ink-secondary">{draft ? '评分与单量待换' : '由门店按时档安排'}</span>
        {draft ? <span className="rounded-full bg-sunken px-2.5 py-1 text-caption text-ink-secondary">门店美容师</span> : null}
      </div>
      <p className="mt-1 text-caption text-ink-secondary">
        {draft ? `擅长${skills.length > 0 ? skills.join(' / ') : '洗护服务'}${storeName ? ` · ${storeName}` : ''}` : '不指定美容师，由门店按服务与时段分配'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[draft ? '从业信息待换' : '系统分配', '档期以时段为准', draft ? '好评信息待换' : '门店安排'].map((item) => (
          <span key={item} className="rounded-full bg-sunken px-3 py-1.5 text-caption text-ink-secondary">{item}</span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-body-lg font-semibold">作品 · 近30天</h3>
        <span className="text-caption text-ink-secondary">待换</span>
      </div>
      <div data-testid="u2-staff-works" className="mt-3 grid grid-cols-2 grid-rows-2 gap-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`flex items-center justify-center rounded-[16px] bg-sunken text-caption text-ink-secondary ${item === 0 ? 'row-span-2 h-44' : 'h-[84px]'}`}
          >
            待换
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
