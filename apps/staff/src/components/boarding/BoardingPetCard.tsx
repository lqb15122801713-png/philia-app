/**
 * U2 任务 E · 寄养打卡页宠物卡（规格书 §5 + 试样 .bd-pet）
 *
 * 16:10 照片头（avatarUrl 缺省回落薄荷爪印占位，资产缺失不破版）+
 * 左上「在店寄养 · 房型」纸面签 + 名 16/800（宠物名 16 先例档）+ 品种·体重 +
 * 入住→退房日期 + 状态签（在店且未超期=薄荷「状态正常」；超期=红「已超期」）。
 */

import { PawPrint } from 'lucide-react';

const fmtDay = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

export default function BoardingPetCard({
  pet,
  roomLabel,
  scheduledStart,
  scheduledEnd,
  overdue,
}: {
  pet: { name?: string | null; breed?: string | null; weightKg?: number | null; avatarUrl?: string | null } | null | undefined;
  /** 房型=服务名（如「标准间寄养（犬）」） */
  roomLabel: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  overdue: boolean;
}) {
  return (
    <section className="u1-card mx-[22px] mt-1.5 overflow-hidden" data-testid="boarding-pet-card">
      <div className="relative aspect-[16/10] bg-sunken">
        {pet?.avatarUrl ? (
          <img src={pet.avatarUrl} alt={pet.name ?? '宠物'} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" aria-hidden>
            <PawPrint className="h-12 w-12 text-[rgba(74,59,46,.42)]" strokeWidth={1.5} />
          </span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1.5 text-caption-xs font-bold text-ink">
          在店寄养 · {roomLabel}
        </span>
      </div>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-body-lg font-bold">{pet?.name ?? '宠物'}</p>
          <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">
            {[pet?.breed, pet?.weightKg ? `${pet.weightKg}kg` : null].filter(Boolean).join(' · ') || '档案未完善'}
            {scheduledStart && scheduledEnd ? ` · ${fmtDay(scheduledStart)} 入住 → ${fmtDay(scheduledEnd)} 退房` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-chip px-2 py-1 text-caption-xs font-bold ${
            overdue ? 'bg-danger-light text-danger-deep' : 'bg-brand-secondary text-ink'
          }`}
        >
          {overdue ? '已超期' : '状态正常'}
        </span>
      </div>
    </section>
  );
}
