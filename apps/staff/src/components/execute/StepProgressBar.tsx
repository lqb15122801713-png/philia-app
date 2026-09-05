import { Check, Lock } from 'lucide-react'
import { SERVICE_STEPS } from '@philia/shared'

/** 六段进度条用的两字短名（全名在步屏大标题展示） */
const SHORT_LABEL: Record<string, string> = {
  disinfection: '消毒',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '对比',
  confirm: '完成',
}

export interface StepProgressBarProps {
  /** 各步状态（keyed by stepKey）；缺省按 locked 渲染 */
  statusByKey: Record<string, 'locked' | 'active' | 'done' | undefined>
  /** 商家打标重拍的步（红点提示） */
  flaggedKeys?: ReadonlySet<string>
  /** 当前正在浏览的步序（1-6，下划线提示） */
  viewingOrder?: number
  onSelect?: (stepOrder: number) => void
}

/**
 * 顶部 6 段步骤进度条：done 品牌色勾 / active 呼吸光环 / locked 灰锁。
 * 每段可点（热区 ≥48px），点击滚动到对应步屏。
 */
export default function StepProgressBar({
  statusByKey,
  flaggedKeys,
  viewingOrder,
  onSelect,
}: StepProgressBarProps) {
  return (
    <div className="flex w-full items-stretch gap-1 px-3 py-2">
      {SERVICE_STEPS.map((def) => {
        const status = statusByKey[def.stepKey] ?? 'locked'
        const flagged = flaggedKeys?.has(def.stepKey) ?? false
        const viewing = viewingOrder === def.stepOrder
        return (
          <button
            key={def.stepKey}
            type="button"
            onClick={() => onSelect?.(def.stepOrder)}
            className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-tag"
            aria-label={`第 ${def.stepOrder} 步 ${def.name}`}
          >
            <span className="relative flex items-center justify-center">
              {status === 'done' && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary">
                  <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                </span>
              )}
              {status === 'active' && (
                <span className="flex h-6 w-6 animate-halo items-center justify-center rounded-full bg-brand-primary">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              )}
              {status === 'locked' && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card">
                  <Lock className="h-3 w-3 text-ink-placeholder" strokeWidth={1.5} />
                </span>
              )}
              {flagged && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />
              )}
            </span>
            <span
              className={`text-caption leading-none ${
                status === 'active'
                  ? 'font-semibold text-brand-primary'
                  : status === 'done'
                    ? 'text-ink'
                    : 'text-ink-placeholder'
              } ${viewing ? 'underline decoration-brand-primary decoration-2 underline-offset-4' : ''}`}
            >
              {SHORT_LABEL[def.stepKey] ?? def.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
