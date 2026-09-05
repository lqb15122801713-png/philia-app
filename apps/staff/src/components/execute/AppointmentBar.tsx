import { CloudOff, RefreshCw } from 'lucide-react'

export interface AppointmentBarProps {
  petName: string
  petMeta?: string | null // 品种 · 体重等
  temperamentTags?: string[] | null
  serviceName?: string | null
  timeText?: string | null // HH:mm 预约时间
  note?: string | null // 客户备注
  /** 待上传队列张数（>0 显示"上传中"芯片） */
  pendingCount: number
  /** 当前离线（照片本地暂存提示） */
  offline: boolean
}

/**
 * 顶部信息条（常显）：宠物 / 服务 / 客户备注 / 性格标签 + 队列与离线状态芯片。
 * 员工端正文 ≥16px。
 */
export default function AppointmentBar({
  petName,
  petMeta,
  temperamentTags,
  serviceName,
  timeText,
  note,
  pendingCount,
  offline,
}: AppointmentBarProps) {
  return (
    <div className="mx-3 mt-2 rounded-card bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-title-lg text-ink">{petName}</span>
            {petMeta && <span className="shrink-0 text-body text-ink-secondary">{petMeta}</span>}
          </div>
          <div className="mt-1 text-body-lg text-ink-secondary">
            {serviceName ?? '洗护服务'}
            {timeText ? ` · ${timeText}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-brand-primary-light px-2.5 py-1 text-caption text-brand-primary-pressed">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              {pendingCount} 张上传中
            </span>
          )}
          {offline && (
            <span className="flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-caption text-ink-secondary">
              <CloudOff className="h-3.5 w-3.5" strokeWidth={1.5} />
              离线 · 照片本地暂存
            </span>
          )}
        </div>
      </div>

      {temperamentTags && temperamentTags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {temperamentTags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-secondary-light px-2.5 py-1 text-caption text-ink"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {note && (
        <div className="mt-2.5 rounded-input bg-sunken px-3 py-2 text-body-lg text-ink">
          <span className="font-semibold">客户备注：</span>
          {note}
        </div>
      )}
    </div>
  )
}
