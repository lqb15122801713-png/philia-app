/**
 * U2 任务 E · 寄养打卡页宠物卡（规格书 §5 + 试样 .bd-pet）
 *
 * 有 avatarUrl 时展示 16:10 照片头；无照片时展示紧凑档案条，不留空照片框。
 * 左上「在店寄养 · 房型」纸面签 + 名 16/800（宠物名 16 先例档）+ 品种·体重 +
 * 入住→退房日期 + 状态签（在店且未超期=livetag 同族深棕底淡金「状态正常」；超期=赭红「已超期」）。
 * PD-44 U5：卡面进 sk 语言（sk-panel 白卡 18），可读文字全量 ≥12px，色走 token/.sk 变量。
 */

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
    <section className="sk-panel" style={{ padding: 0, overflow: 'hidden' }} data-testid="boarding-pet-card">
      {pet?.avatarUrl ? (
        <div className="relative aspect-[16/10] bg-sunken">
          <img src={pet.avatarUrl} alt={pet.name ?? '宠物'} className="h-full w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1.5 text-caption font-bold text-ink">
            在店寄养 · {roomLabel}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-sunken px-4 py-3" data-testid="boarding-pet-compact">
          <span className="u1-serif flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-[22px] font-bold leading-none text-ink" aria-hidden>
            {(pet?.name ?? '宠').slice(0, 1)}
          </span>
          <span className="min-w-0 rounded-full bg-card px-3 py-1.5 text-caption font-bold text-ink">
            在店寄养 · {roomLabel}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-body-lg font-bold">{pet?.name ?? '宠物'}</p>
          <p className="mt-1 text-caption text-ink-secondary">
            {pet?.breed || pet?.weightKg ? (
              <>
                {pet?.breed}
                {pet?.breed && pet?.weightKg ? ' · ' : ''}
                {pet?.weightKg ? <span className="u1-num">{pet.weightKg}kg</span> : null}
              </>
            ) : (
              '档案未完善'
            )}
            {scheduledStart && scheduledEnd ? (
              <>
                {' · '}
                <span className="u1-num">{fmtDay(scheduledStart)}</span> 入住 → <span className="u1-num">{fmtDay(scheduledEnd)}</span> 退房
              </>
            ) : (
              ''
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-chip px-2 py-1 text-caption font-bold ${
            overdue ? 'bg-danger-light text-danger-deep' : ''
          }`}
          style={overdue ? undefined : { background: 'var(--ink)', color: 'var(--gold-pale)' }}
        >
          {overdue ? '已超期' : '状态正常'}
        </span>
      </div>
    </section>
  );
}
