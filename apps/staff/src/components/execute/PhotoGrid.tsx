import { X } from 'lucide-react'

export interface GridPhoto {
  key: string
  url: string
  /** 本地队列中的照片显示"上传中"角标 */
  uploading?: boolean
  /** before_after 步的照片标签 */
  tagLabel?: string
}

export interface PhotoGridProps {
  photos: GridPhoto[]
  /** 点击照片本体（非删除角标） */
  onPhotoTap?: () => void
  /** v1.1-b1：active 步服务端照片可删——提供则在非上传中照片上渲染 × 角标 */
  onDeletePhoto?: (key: string) => void
}

/**
 * 已拍照片九宫格（3 列等宽、间距 4px、8px 圆角，DESIGN §6.3）。
 * 队列中的本地预览（blob URL）带"上传中"角标与呼吸透明度。
 */
export default function PhotoGrid({ photos, onPhotoTap, onDeletePhoto }: PhotoGridProps) {
  if (photos.length === 0) return null
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={onPhotoTap}
          className="relative aspect-square overflow-hidden rounded-tag bg-sunken"
        >
          <img
            src={p.url}
            alt="服务照片"
            className={`h-full w-full object-cover ${p.uploading ? 'animate-pulse opacity-80' : ''}`}
            loading="lazy"
          />
          {p.uploading && (
            <span className="absolute right-1 top-1 rounded-tag bg-ink/70 px-1.5 py-0.5 text-caption text-white">
              上传中
            </span>
          )}
          {p.tagLabel && (
            <span className="absolute left-1 top-1 rounded-tag bg-ink/70 px-1.5 py-0.5 text-caption text-white">
              {p.tagLabel}
            </span>
          )}
          {onDeletePhoto && !p.uploading && (
            <span
              role="button"
              aria-label="删除这张照片"
              onClick={(e) => {
                e.stopPropagation()
                onDeletePhoto(p.key)
              }}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white active:scale-90"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
