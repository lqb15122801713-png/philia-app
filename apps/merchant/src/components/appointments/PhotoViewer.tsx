/**
 * 全屏照片查看器（T4.2 监视页）：90% 暖深棕底（保持色温，DESIGN §6.3），
 * 显示拍摄时间 + 序号，左右切换，点遮罩/关闭按钮退出。
 */

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fmtDateTime } from './appt-utils';

export interface ViewPhoto {
  id: string;
  url: string;
  thumbUrl?: string;
  takenAt?: Date | null;
  tag?: string;
}

export function PhotoViewer({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: ViewPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const photo = photos[index];
  if (!photo) return null;
  const prev = () => onNavigate((index - 1 + photos.length) % photos.length);
  const next = () => onNavigate((index + 1) % photos.length);

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-[rgba(61,50,41,0.9)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="查看照片"
    >
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-number text-caption">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
          aria-label="关闭"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* 图片区 */}
      <div
        className="relative flex flex-1 items-center justify-center px-12"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.tag ?? `照片 ${index + 1}`}
          className="max-h-full max-w-full rounded-tag object-contain"
        />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="上一张"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="下一张"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        ) : null}
      </div>

      {/* 底部：拍摄时间 */}
      <div className="px-4 pb-6 pt-2 text-center">
        <p className="text-caption text-white/80">
          {photo.takenAt ? `${fmtDateTime(photo.takenAt)} 拍摄` : '拍摄时间未知'}
          {photo.tag ? ` · ${photo.tag}` : ''}
        </p>
      </div>
    </div>
  );
}
