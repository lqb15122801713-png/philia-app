/**
 * PhotoViewer · 全屏看图件（换皮批片 5「同型归并」）
 *
 * 归并出处：
 * - apps/customer/src/components/live/PhotoViewer.tsx（基准：bg-ink/90 暖深棕底、点遮罩关闭、
 *   滚动锁、首末隐藏钮）
 * - apps/staff/src/components/boarding/PhotoViewer.tsx（Esc/←/→ 键盘导航，默认开）
 * - apps/merchant/src/components/appointments/PhotoViewer.tsx（拍摄时间展示；fmtDateTime
 *   为 merchant 本地 util，此处内联等价的 M月D日 HH:mm 格式化）
 * 增量：loop=true 循环导航（% length）、showTakenAt=true 底部显拍摄时间。
 */

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import type { PhotoWallPhoto } from './PhotoWall';

/** 查看器照片：PhotoWallPhoto 交集扩展可选拍摄时间。 */
export interface PhotoViewerPhoto extends PhotoWallPhoto {
  /** 拍摄时间（showTakenAt=true 时底部展示，格式 M月D日 HH:mm）。 */
  takenAt?: string | number | Date | null;
}

export interface PhotoViewerProps {
  photos: PhotoViewerPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** true 时首末循环导航（% length）；默认 false（首末隐藏钮）。 */
  loop?: boolean;
  /** true 时底部展示拍摄时间行。 */
  showTakenAt?: boolean;
  /** Esc 关闭 / ← → 切换；默认开。 */
  keyboard?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** M月D日 HH:mm（与 merchant appt-utils 的 fmtDateTime 同口径；非法输入返回空串）。 */
function fmtTakenAt(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function PhotoViewer({
  photos,
  index,
  onClose,
  onNavigate,
  loop = false,
  showTakenAt = false,
  keyboard = true,
}: PhotoViewerProps) {
  const count = photos.length;
  const photo = photos[index];
  const hasPrev = loop ? count > 1 : index > 0;
  const hasNext = loop ? count > 1 : index < count - 1;
  const goPrev = () => onNavigate(loop ? (index - 1 + count) % count : index - 1);
  const goNext = () => onNavigate(loop ? (index + 1) % count : index + 1);

  // 查看器打开时锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc 关闭 / 方向键切换（staff 版行为，默认开）
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) goPrev();
      if (e.key === 'ArrowRight' && hasNext) goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard, hasPrev, hasNext, index, count, loop, onClose, onNavigate]);

  if (!photo) return null;

  const takenAtText = photo.takenAt != null ? fmtTakenAt(photo.takenAt) : '';

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col bg-ink/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="查看照片"
    >
      <div className="flex items-center justify-between p-2">
        <span className="px-3 font-number text-caption text-white/80">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          aria-label="关闭"
          className="flex h-11 w-11 items-center justify-center text-white"
          onClick={onClose}
        >
          <X className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </div>

      <div
        className={`relative flex flex-1 items-center justify-center overflow-hidden px-4 ${
          showTakenAt ? 'pb-2' : 'pb-8'
        }`}
      >
        <img
          src={photo.url}
          alt={photo.tag ?? `照片 ${index + 1}`}
          className="max-h-full max-w-full rounded-tag object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {hasPrev ? (
          <button
            type="button"
            aria-label="上一张"
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/15 text-white"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
          </button>
        ) : null}
        {hasNext ? (
          <button
            type="button"
            aria-label="下一张"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/15 text-white"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          >
            <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>

      {showTakenAt ? (
        <div className="px-4 pb-6 pt-2 text-center">
          <p className="font-number text-caption text-white/80">
            {takenAtText ? `${takenAtText} 拍摄` : '拍摄时间未知'}
            {photo.tag ? ` · ${photo.tag}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
