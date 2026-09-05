/**
 * 历史打卡列表：按日期倒序卡片（服务端按 log_date 升序返回，这里倒序渲染）。
 * 每张卡：日期 / 喂食摘要 / 遛弯 / 备注 / 照片墙（复用 packages/shared PhotoWall）。
 */

import { PhotoWall, type PhotoWallPhoto } from '@philia/shared';
import { Footprints, UtensilsCrossed } from 'lucide-react';
import { fmtLogDate, type BoardingLogRow } from './types';

export interface DailyLogListProps {
  /** 服务端升序数组；组件内倒序展示 */
  logs: BoardingLogRow[];
  /** 今日 ISO 日期，用于给今天的卡打标 */
  today: string;
  onPhotoClick(photos: PhotoWallPhoto[], index: number): void;
}

function LogCard({
  log,
  isToday,
  onPhotoClick,
}: {
  log: BoardingLogRow;
  isToday: boolean;
  onPhotoClick: DailyLogListProps['onPhotoClick'];
}) {
  const wallPhotos: PhotoWallPhoto[] = (log.photos ?? []).slice(0, 6).map((url, i) => ({
    id: `${log.id}-${i}`,
    url,
  }));
  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-title">
          {fmtLogDate(log.logDate)}
          {isToday ? (
            <span className="rounded-tag bg-brand-primary-light px-1.5 py-0.5 text-caption text-brand-primary">
              今天
            </span>
          ) : null}
        </h3>
        <p className="flex items-center gap-1 text-body text-ink-secondary">
          <Footprints className="h-4 w-4" strokeWidth={1.5} />
          遛弯 <span className="font-number">{log.walks}</span> 次
        </p>
      </div>

      {log.meals && log.meals.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {log.meals.map((m, i) => (
            <li key={i} className="flex items-center gap-2 text-body text-ink">
              <UtensilsCrossed className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.5} />
              <span className="font-number text-ink-secondary">{m.time}</span>
              <span className="min-w-0 flex-1 truncate">
                {m.food}
                {m.amount ? <span className="text-ink-secondary"> · {m.amount}</span> : null}
              </span>
              {m.finished ? (
                <span className="shrink-0 rounded-tag bg-success-light px-1.5 py-0.5 text-caption text-success-deep">
                  已吃完
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-body text-ink-secondary">未记录喂食</p>
      )}

      {log.note ? <p className="mt-2.5 text-body text-ink-secondary">{log.note}</p> : null}

      {wallPhotos.length > 0 ? (
        <div className="mt-3">
          <PhotoWall photos={wallPhotos} onPhotoClick={(_, i) => onPhotoClick(wallPhotos, i)} />
        </div>
      ) : null}
    </section>
  );
}

export default function DailyLogList({ logs, today, onPhotoClick }: DailyLogListProps) {
  const desc = [...logs].reverse();
  return (
    <div className="space-y-3">
      <h2 className="px-1 text-title">历史打卡</h2>
      {desc.length === 0 ? (
        <section className="rounded-card bg-card p-4 shadow-card">
          <p className="text-body text-ink-secondary">还没有打卡记录，提交今日打卡后会显示在这里。</p>
        </section>
      ) : (
        desc.map((log) => (
          <LogCard key={log.id} log={log} isToday={log.logDate === today} onPhotoClick={onPhotoClick} />
        ))
      )}
    </div>
  );
}
