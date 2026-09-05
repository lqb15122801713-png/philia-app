/**
 * 已入住信息卡：房间 / 入住称重 / 随身物品清单 chips 只读展示。
 * - 在住（checkoutAt 为空且未退房）：可点「修改登记信息」回到编辑表单；
 * - 已退房 / 已完成单：纯只读（不传 onEdit）。
 * 物品照片缩略图点击可抛给页面层查看器。
 */

import type { PhotoWallPhoto } from '@philia/shared';
import { BedDouble, Pencil, Scale } from 'lucide-react';
import type { BoardingStayRow } from './types';

export interface StayInfoCardProps {
  stay: BoardingStayRow;
  /** 在住时可再编辑；不传则纯只读 */
  onEdit?: () => void;
  onPhotoClick?: (photos: PhotoWallPhoto[], index: number) => void;
}

export default function StayInfoCard({ stay, onEdit, onPhotoClick }: StayInfoCardProps) {
  const belongings = (stay.belongings ?? []).filter((b) => b.name);
  const photoItems = belongings
    .map((b, i) => ({ b, i }))
    .filter((x): x is { b: (typeof belongings)[number] & { photoUrl: string }; i: number } =>
      Boolean(x.b.photoUrl),
    );
  const wallPhotos: PhotoWallPhoto[] = photoItems.map((x) => ({
    id: `belonging-${x.i}`,
    url: x.b.photoUrl,
    tag: x.b.name,
  }));

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-title">入住信息</h2>
        <span className="flex items-center gap-2">
          <span className="rounded-tag bg-success-light px-2 py-1 text-caption text-success-deep">已入住</span>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-12 items-center gap-1 rounded-full bg-sunken px-3 text-body text-ink"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
              修改
            </button>
          ) : null}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <p className="flex items-center gap-1.5 text-body-lg text-ink">
          <BedDouble className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
          房间 <span className="font-semibold">{stay.roomNo ?? '待分配'}</span>
        </p>
        {stay.checkinWeightKg != null ? (
          <p className="flex items-center gap-1.5 text-body-lg text-ink">
            <Scale className="h-5 w-5 text-ink-secondary" strokeWidth={1.5} />
            入住称重 <span className="font-number font-semibold">{stay.checkinWeightKg.toFixed(1)} kg</span>
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="text-caption text-ink-secondary">随身物品</p>
        {belongings.length === 0 ? (
          <p className="mt-1 text-body text-ink-secondary">无登记物品</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {belongings.map((b, i) => {
              const wallIdx = photoItems.findIndex((x) => x.i === i);
              return (
                <li key={`${b.name}-${i}`}>
                  <button
                    type="button"
                    disabled={wallIdx === -1}
                    onClick={() => {
                      if (wallIdx !== -1) onPhotoClick?.(wallPhotos, wallIdx);
                    }}
                    className="flex h-11 items-center gap-1.5 rounded-tag bg-sunken px-2.5 text-body text-ink disabled:cursor-default"
                  >
                    {b.photoUrl ? (
                      <img src={b.photoUrl} alt={b.name} className="h-8 w-8 rounded-tag object-cover" />
                    ) : null}
                    {b.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
