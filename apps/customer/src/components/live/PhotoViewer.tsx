/**
 * 全屏照片查看器（PhotoWall 契约：查看原图由页面层实现）。
 * 底色按 DESIGN §6.3 用 90% 暖深棕（保持色温，不用纯黑）；
 * 支持左右切换、点击空白/关闭按钮退出。
 */

import type { PhotoWallPhoto } from '@philia/shared'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect } from 'react'

export interface PhotoViewerProps {
  photos: PhotoWallPhoto[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function PhotoViewer({ photos, index, onClose, onNavigate }: PhotoViewerProps) {
  const photo = photos[index]

  // 查看器打开时锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!photo) return null
  const hasPrev = index > 0
  const hasNext = index < photos.length - 1

  return (
    <div
      className="fixed inset-0 z-modal flex flex-col bg-[rgba(61,50,41,0.9)]"
      onClick={onClose}
      role="dialog"
      aria-label="查看照片"
    >
      <div className="flex items-center justify-between p-2">
        <span className="px-3 font-number text-caption text-white/80">
          {index + 1} / {photos.length}
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

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-8">
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
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(index - 1)
            }}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
          </button>
        ) : null}
        {hasNext ? (
          <button
            type="button"
            aria-label="下一张"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
            onClick={(e) => {
              e.stopPropagation()
              onNavigate(index + 1)
            }}
          >
            <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
