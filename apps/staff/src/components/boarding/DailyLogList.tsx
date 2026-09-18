/**
 * U2 任务 E · 历史打卡倒序行（规格书 §5 + 试样 .bd-hist）
 *
 * 每行：日/周（Montserrat）+ 第 N 晚（按入住日推算）+ 餐遛摘要 + 照片缩略 34×26×N
 * （点击看大图）。倒序（服务端升序返回，组件内反转）。
 */

import type { PhotoWallPhoto } from '@philia/shared';
import type { BoardingLogRow } from './types';

export interface DailyLogListProps {
  logs: BoardingLogRow[];
  today: string;
  /** 入住日（第 N 晚推算基准 = logDate − 入住日 + 1） */
  stayStart?: Date;
  onPhotoClick(photos: PhotoWallPhoto[], index: number): void;
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'] as const;
const dayStartOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function DailyLogList({ logs, today, stayStart, onPhotoClick }: DailyLogListProps) {
  const desc = [...logs].reverse();
  return (
    <div className="mx-[22px] mb-5 mt-3.5" data-testid="daily-log-list">
      <h2 className="mb-2.5 text-body-sm font-bold">历史打卡</h2>
      {desc.length === 0 ? (
        <p className="u1-card px-4 py-5 text-center text-caption text-ink-secondary">
          今天还没打卡——喂了饭、遛了弯，拍张照再提交
        </p>
      ) : (
        desc.map((log) => {
          const d = new Date(`${log.logDate}T00:00:00`);
          const night = stayStart
            ? Math.max(1, Math.round((dayStartOf(d).getTime() - dayStartOf(stayStart).getTime()) / 86_400_000) + 1)
            : null;
          const wallPhotos: PhotoWallPhoto[] = (log.photos ?? []).slice(0, 6).map((url, i) => ({ id: `${log.id}-${i}`, url }));
          return (
            <div key={log.id} className="u1-card mb-2.5 flex items-center gap-3 px-3.5 py-3" data-testid={`log-${log.logDate}`}>
              <div className="w-11 shrink-0 text-center">
                <div className="u1-num text-body-lg font-bold">{Number(log.logDate.slice(8, 10))}</div>
                <div className="text-caption-xs text-[rgba(74,59,46,.42)]">周{WEEK[d.getDay()]}</div>
              </div>
              <div className="min-w-0 flex-1 text-caption-xs leading-relaxed text-[rgba(74,59,46,.62)]">
                <b className="text-caption text-ink">
                  {night ? `第 ${night} 晚` : log.logDate}
                  {log.logDate === today ? ' · 今天' : ''}
                </b>
                <br />
                {log.meals?.length ? `${log.meals.length} 餐` : '未喂'} · 遛狗 {log.walks} 次 · {log.photos?.length ?? 0} 张照片
                {log.note ? <span className="block truncate">{log.note}</span> : null}
              </div>
              {wallPhotos.length > 0 ? (
                <div className="flex shrink-0 gap-1">
                  {wallPhotos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`查看照片 ${i + 1}`}
                      onClick={() => onPhotoClick(wallPhotos, i)}
                      className="h-[26px] w-[34px] overflow-hidden rounded-chip bg-sunken transition-transform duration-120 ease-philia-spring active:scale-92"
                    >
                      <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
