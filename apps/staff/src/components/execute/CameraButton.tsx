import { useRef } from 'react'
import { Camera } from 'lucide-react'

export interface CameraButtonProps {
  disabled?: boolean
  /** 禁用时的说明（如"已达上限 9 张"） */
  hint?: string | null
  /** 已拍 / 上限（按钮副文案） */
  countText?: string
  onFiles: (files: FileList) => void
}

/**
 * 大拍照按钮（≥64px，戴湿手套也能点）：
 * `<input type="file" accept="image/*" capture="environment">` 调起相机，
 * 支持连续多次添加累加（每次选完重置 input.value，同一角度可重拍）。
 */
export default function CameraButton({ disabled, hint, countText, onFiles }: CameraButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`flex h-16 w-full items-center justify-center gap-2 rounded-full text-body-lg font-semibold transition active:scale-92 duration-120 ${
          disabled
            ? 'bg-sunken text-ink-placeholder'
            : 'bg-card text-brand-primary shadow-card border-2 border-brand-primary'
        }`}
      >
        <Camera className="h-6 w-6" strokeWidth={1.8} />
        {disabled ? (hint ?? '暂不能拍照') : `拍照${countText ? `（${countText}）` : ''}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files)
          e.target.value = '' // 重置，允许连续拍同一场景
        }}
      />
    </div>
  )
}
