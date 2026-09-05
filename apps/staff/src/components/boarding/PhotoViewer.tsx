/**
 * 全屏照片查看器（员工端寄养页自用）：
 * 暖深棕 90% 底（与客户端 PhotoWall 查看器同色系），左右切换 + 计数 + 关闭。
 */

import type { PhotoWallPhoto } from '@philia/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';

export interface PhotoViewerState {
  photos: PhotoWallPhoto[];
  index: number;
}

export interface PhotoViewerProps {
  state: PhotoViewerState;
  onClose(): void;
  onIndexChange(index: number): void;
}

export default function PhotoViewer({ state, onClose, onIndexChange }: PhotoViewerProps) {
  const { photos, index } = state;
  const current = photos[index];

  // Esc 关闭 / 方向键切换
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col bg-[rgba(61,50,41,0.9)]"
      role="dialog"
      aria-label="查看照片"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-3">
        <span className="font-number text-body text-white/90">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white"
          aria-label="关闭"
        >
          <X className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-6">
        <img
          src={current.url}
          alt={current.tag ?? `照片 ${index + 1}`}
          className="max-h-full max-w-full rounded-tag object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {photos.length > 1 ? (
        <>
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index - 1);
            }}
            className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
            aria-label="上一张"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            disabled={index === photos.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(index + 1);
            }}
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30"
            aria-label="下一张"
          >
            <ChevronRight className="h-7 w-7" strokeWidth={1.5} />
          </button>
        </>
      ) : null}
    </div>
  );
}
