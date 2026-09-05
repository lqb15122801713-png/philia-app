/**
 * 顶部常显宠物信息条（开发方案 §2.3 员工端 + 任务规格）：
 * 宠物名 / 品种 / 性格标签 / 疫苗有效期 / 客户备注，附寄养区间。
 * sticky 置顶，员工在两段表单间滚动时宠物关键信息始终可见。
 */

import { PawPrint, StickyNote, Syringe } from 'lucide-react';

export interface PetHeaderPet {
  name: string;
  species?: string | null;
  breed?: string | null;
  temperamentTags?: string[] | null;
  vaccineValidUntil?: string | null;
  avatarUrl?: string | null;
}

export interface PetHeaderProps {
  pet: PetHeaderPet | null | undefined;
  /** 客户备注（appointments.note） */
  note?: string | null;
  /** 寄养区间（预约起止） */
  scheduledStart?: Date;
  scheduledEnd?: Date;
}

type VaccineTone = 'ok' | 'warn' | 'expired' | 'none';

/** 疫苗有效期状态：过期 → 红；≤30 天到期 → 暖杏提醒；其余 → 绿 */
function vaccineState(until?: string | null): { label: string; tone: VaccineTone } {
  if (!until) return { label: '疫苗有效期未登记', tone: 'none' };
  const exp = new Date(`${until}T00:00:00`);
  if (Number.isNaN(exp.getTime())) return { label: `疫苗至 ${until}`, tone: 'ok' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (exp.getTime() < today.getTime()) return { label: `疫苗已过期（${until}）`, tone: 'expired' };
  const days = Math.round((exp.getTime() - today.getTime()) / 86_400_000);
  if (days <= 30) return { label: `疫苗 ${days} 天后到期（${until}）`, tone: 'warn' };
  return { label: `疫苗至 ${until}`, tone: 'ok' };
}

const VACCINE_TONE_CLASS: Record<VaccineTone, string> = {
  ok: 'bg-success-light text-success-deep',
  warn: 'bg-brand-secondary-light text-ink',
  expired: 'bg-danger-light text-danger-deep',
  none: 'bg-sunken text-ink-secondary',
};

const fmtDay = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

export default function PetHeader({ pet, note, scheduledStart, scheduledEnd }: PetHeaderProps) {
  if (!pet) {
    return (
      <header className="sticky top-0 z-sticky bg-canvas/95 px-4 py-3 backdrop-blur">
        <p className="text-body text-ink-secondary">宠物信息加载中…</p>
      </header>
    );
  }

  const vaccine = vaccineState(pet.vaccineValidUntil);
  const tags = (pet.temperamentTags ?? []).filter(Boolean);

  return (
    <header className="sticky top-0 z-sticky bg-canvas/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="rounded-card bg-card p-3 shadow-card">
        <div className="flex items-center gap-3">
          {pet.avatarUrl ? (
            <img
              src={pet.avatarUrl}
              alt={pet.name}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary-light">
              <PawPrint className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <h1 className="text-title-lg">{pet.name}</h1>
              <p className="text-body text-ink-secondary">
                {[pet.species, pet.breed].filter(Boolean).join(' · ') || '品种未登记'}
              </p>
            </div>
            {scheduledStart && scheduledEnd ? (
              <p className="mt-0.5 font-number text-caption text-ink-secondary">
                寄养 {fmtDay(scheduledStart)} → {fmtDay(scheduledEnd)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-tag px-2 py-1 text-caption ${VACCINE_TONE_CLASS[vaccine.tone]}`}
          >
            <Syringe className="h-3.5 w-3.5" strokeWidth={1.5} />
            {vaccine.label}
          </span>
          {tags.map((t) => (
            <span key={t} className="rounded-tag bg-sunken px-2 py-1 text-caption text-ink">
              {t}
            </span>
          ))}
        </div>

        {note ? (
          <p className="mt-2 flex items-start gap-1.5 text-body text-ink-secondary">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="min-w-0">客户备注：{note}</span>
          </p>
        ) : null}
      </div>
    </header>
  );
}
