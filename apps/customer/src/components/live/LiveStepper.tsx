/**
 * LiveStepper · 客户端服务全程页六步 stepper（批次 U1 任务 E · v9.1 换肤）。
 *
 * 结构与数据口径 1:1 沿用共享 StepTimeline（packages/shared/StepTimeline.tsx，
 * 商家端 MonitorTimeline 以其视觉规范为准——共享件本批不动，故客户端落本地副本）：
 * 左轨 24px 节点圆 + 连接线（done 段实线、未到达段虚线），内容区标题/时间戳/
 * active 操作说明/节点下挂 PhotoWall（共享件只读复用，前后对比照区随之保留）。
 *
 * v9.1 三态色票（任务书：薄荷✓完成 / 柠檬进行中 / 墨灰未到；品牌面文字一律深棕墨）：
 * - done   ：24px 薄荷绿圆（brand.secondary）+ 深棕墨 ✓；连接线薄荷实线；
 * - active ：24px 柠檬黄圆 + 深棕墨芯点；标题深棕墨 600 +「进行中」小签
 *            （柠檬浅底 + 深棕墨字，不写反白）；深度策略去呼吸光环（halo 为投影动画）；
 * - locked ：墨灰描边圆 + 小锁（ink-placeholder），标题占位灰，连接线虚线。
 */

import { Check, Lock } from 'lucide-react'
import { PhotoWall, getStepDef } from '@philia/shared'
import type { PhotoWallPhoto, ServiceStepStatus } from '@philia/shared'

/** 时间轴单步数据（与共享 StepTimelineStep 同构）。 */
export interface LiveStepperStep {
  stepKey: string
  status: ServiceStepStatus
  time?: string
  description?: string
  photos?: PhotoWallPhoto[]
}

export interface LiveStepperProps {
  steps: LiveStepperStep[]
  onPhotoClick?: (photo: PhotoWallPhoto, index: number, stepKey: string) => void
  resolveName?: (stepKey: string) => string
}

/** 24px 节点圆：薄荷✓完成 / 柠檬进行中 / 墨灰未到。 */
function StepNode({ status }: { status: ServiceStepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-secondary">
        <Check className="h-3.5 w-3.5 text-ink" strokeWidth={1.5} />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
        <span className="h-2 w-2 rounded-full bg-ink" />
      </span>
    )
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card">
      <Lock className="h-3 w-3 text-ink-placeholder" strokeWidth={1.5} />
    </span>
  )
}

export default function LiveStepper({ steps, onPhotoClick, resolveName }: LiveStepperProps) {
  return (
    <ol className="flex flex-col" data-testid="live-stepper">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const lineDone = step.status === 'done'
        const name = resolveName?.(step.stepKey) ?? getStepDef(step.stepKey)?.name ?? step.stepKey

        return (
          <li key={step.stepKey} className="relative flex gap-3" data-step-key={step.stepKey} data-step-status={step.status}>
            {/* 左轨：节点圆 + 连接线，轴线左偏 24px */}
            <div className="flex w-6 flex-col items-center">
              <StepNode status={step.status} />
              {!isLast ? (
                lineDone ? (
                  <span className="min-h-4 w-0.5 flex-1 bg-brand-secondary" />
                ) : (
                  <span className="min-h-4 w-0 flex-1 border-l-2 border-dashed border-line-strong" />
                )
              ) : null}
            </div>

            {/* 内容区 */}
            <div className={`flex-1 ${isLast ? '' : 'pb-6'}`}>
              <div className="flex h-6 items-center gap-2">
                <span
                  className={
                    step.status === 'active'
                      ? 'text-body font-semibold text-ink'
                      : step.status === 'done'
                        ? 'text-body text-ink'
                        : 'text-body text-ink-placeholder'
                  }
                >
                  {name}
                </span>
                {step.status === 'active' ? (
                  <span className="rounded-chip bg-brand-primary-light px-1.5 py-0.5 text-caption-xs text-ink">
                    进行中
                  </span>
                ) : null}
                {step.time ? (
                  <span className="u1-num ml-auto text-caption text-ink-secondary">{step.time}</span>
                ) : null}
              </div>

              {step.description ? (
                <p className="mt-1 text-body-sm text-ink-secondary">{step.description}</p>
              ) : null}

              {step.photos && step.photos.length > 0 ? (
                <div className="mt-2">
                  <PhotoWall
                    photos={step.photos}
                    stepKey={step.stepKey}
                    onPhotoClick={(photo, i) => onPhotoClick?.(photo, i, step.stepKey)}
                  />
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
