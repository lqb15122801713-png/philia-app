/**
 * 在店宠物看板卡片（T4.3 · BoardingPage）
 *
 * 卡片字段（boarding.stayBoard 行）：宠物头像/名、房间号、入住日期、
 * 预计退房、最近打卡日期；超期（scheduled_end 已过且未退房）红色标记。
 */

import { fmtDate, fmtDateTime, fmtIsoDate } from './format';
import { SPECIES_LABEL, type StayBoardRow } from './types';
import { Badge } from './ui';

export function PetAvatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-secondary font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function BoardingStayCard({
  row,
  selected,
  onSelect,
}: {
  row: StayBoardRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const { stay, appointment, pet } = row;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-card border bg-card p-4 text-left shadow-card transition-shadow hover:shadow-elevated ${
        row.overdue ? 'border-danger' : 'border-transparent'
      } ${selected ? 'ring-2 ring-brand-primary' : ''}`}
    >
      <div className="flex items-center gap-3">
        <PetAvatar url={pet.avatarUrl} name={pet.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-title font-semibold text-ink">{pet.name}</span>
            <span className="text-caption text-ink-secondary">
              {SPECIES_LABEL[pet.species] ?? pet.species}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </span>
          </div>
          <div className="mt-0.5 text-caption text-ink-secondary">
            {row.customer.nickname ?? '客户'}
            {row.customer.phone ? ` · ${row.customer.phone}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone="brand">{stay.roomNo ? `房间 ${stay.roomNo}` : '未排房'}</Badge>
          {row.overdue ? <Badge tone="danger">已超期</Badge> : null}
        </div>
      </div>
      <div
        className="mt-3 grid grid-cols-3 gap-2 text-caption"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <div>
          <div className="text-ink-placeholder">入住</div>
          <div className="text-ink">{fmtDate(stay.createdAt)}</div>
        </div>
        <div>
          <div className="text-ink-placeholder">预计退房</div>
          <div className={row.overdue ? 'font-medium text-danger-deep' : 'text-ink'}>
            {fmtDateTime(appointment.scheduledEnd)}
          </div>
        </div>
        <div>
          <div className="text-ink-placeholder">最近打卡</div>
          <div className="text-ink">{fmtIsoDate(row.lastLogDate)}</div>
        </div>
      </div>
    </button>
  );
}
