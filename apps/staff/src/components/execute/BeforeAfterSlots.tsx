import { useRef, type RefObject } from 'react'
import { Camera, Check } from 'lucide-react'

export interface SlotPhoto {
  url: string
  uploading?: boolean
}

export interface BeforeAfterSlotsProps {
  before?: SlotPhoto | null
  after?: SlotPhoto | null
  /** 当前步非 active 时整体只读 */
  readOnly?: boolean
  onFiles: (tag: 'before' | 'after', files: FileList) => void
  /** 点击已填卡槽（v1 不支持删 → 提示重拍找商家打标） */
  onFilledTap?: () => void
}

/**
 * before_after 步专用双卡槽：「服务前」「服务后」分别各传 1 张（tag=before/after）。
 * 空槽为大热区拍照按钮；已填显示缩略图 + 标签（上传中带角标）。
 */
export default function BeforeAfterSlots({
  before,
  after,
  readOnly,
  onFiles,
  onFilledTap,
}: BeforeAfterSlotsProps) {
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)

  const renderSlot = (
    tag: 'before' | 'after',
    label: string,
    photo: SlotPhoto | null | undefined,
    inputRef: RefObject<HTMLInputElement>,
  ) => {
    if (photo) {
      return (
        <button
          type="button"
          onClick={onFilledTap}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-line bg-sunken"
        >
          <img
            src={photo.url}
            alt={label}
            className={`h-full w-full object-cover ${photo.uploading ? 'animate-pulse opacity-80' : ''}`}
          />
          <span
            className={`absolute left-2 top-2 rounded-tag px-2 py-1 text-caption font-semibold ${
              tag === 'before' ? 'bg-brand-secondary-light text-ink' : 'bg-brand-primary text-white'
            }`}
          >
            {label}
          </span>
          {photo.uploading && (
            <span className="absolute right-2 top-2 rounded-tag bg-ink/70 px-1.5 py-0.5 text-caption text-white">
              上传中
            </span>
          )}
          {!photo.uploading && (
            <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-success">
              <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
          )}
        </button>
      )
    }
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => inputRef.current?.click()}
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed ${
          readOnly
            ? 'border-line bg-sunken text-ink-placeholder'
            : 'border-brand-primary bg-card text-brand-primary active:scale-92 duration-120'
        }`}
      >
        <Camera className="h-8 w-8" strokeWidth={1.5} />
        <span className="text-body-lg font-semibold">{label}</span>
        <span className="text-caption text-ink-secondary">点这里拍 1 张</span>
      </button>
    )
  }

  const renderInput = (tag: 'before' | 'after', ref: RefObject<HTMLInputElement>) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) onFiles(tag, e.target.files)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="grid grid-cols-2 gap-2">
      {renderSlot('before', '服务前', before, beforeInputRef)}
      {renderSlot('after', '服务后', after, afterInputRef)}
      {renderInput('before', beforeInputRef)}
      {renderInput('after', afterInputRef)}
    </div>
  )
}
