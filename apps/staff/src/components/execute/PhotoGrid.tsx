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
  /** v1 不支持删：点击提示"重拍请联系商家打标" */
  onPhotoTap?: () => void
}

/**
 * 已拍照片九宫格（3 列等宽、间距 4px、8px 圆角，DESIGN §6.3）。
 * 队列中的本地预览（blob URL）带"上传中"角标与呼吸透明度。
 */
export default function PhotoGrid({ photos, onPhotoTap }: PhotoGridProps) {
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
        </button>
      ))}
    </div>
  )
}
