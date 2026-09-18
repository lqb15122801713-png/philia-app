/**
 * LiveStepper · 客户端服务全程页六步 stepper（批次 U1 任务 E；U4-D2 试样 05 逐格收口）。
 *
 * 步骤名以 server getStepDef 真实定义为准（试样步骤名为设计文案，不改数据）。
 * U4-D2 试样取齐（.steps/.step CSS 逐格）：
 * - 节点圆 24px：done=薄荷底墨 ✓；active=柠檬底 + 步序数字（u1-num 11/700）+
 *   静态柠檬环影（试样 box-shadow 0 0 0 5px rgba(253,200,48,.25)；U1-E 去除的是
 *   呼吸光环动画，本环为试样静态工艺，恢复并登记 diff-client）；locked=纸面
 *   细线环 + 灰数字（去锁图标，试样未到步显步序）；
 * - 连接线统一 2px 暖墨细线（试样 ink-06 → 令牌 line-ring rgba(74,59,46,.09)），
 *   不再按 done 段薄荷实线/未到段虚线分色；
 * - 步骤名 14px（done/active 600、locked 灰 500），meta 行 11px 置于题下
 *   （试样 .st2 结构：done=完成时刻 u1-num；active=「进行中 · 说明」；
 *   locked 无说明——server stepDef 无描述字段，不照抄试样设计文案）；
 * - 过程照横排 64×44（试样 CSS 尺寸；圆角 8 越四档 → 取 chip 6）+ inset 1px
 *   描边 rgba(0,0,0,.08)；before_after 步仍走共享 PhotoWall 前后并排（哇塞时刻
 *   既有特性保留）。
 */

import { Check } from 'lucide-react'
import { PhotoWall, getStepDef } from '@philia/shared'
import type { PhotoWallPhoto, ServiceStepStatus } from '@philia/shared'

/** 时间轴单步数据（与共享 StepTimelineStep 同构）。 */
export interface LiveStepperStep {
  stepKey: string
  status: ServiceStepStatus
  /** done 步完成时刻（HH:MM） */
  time?: string
  /** active 步操作说明 */
  description?: string
  photos?: PhotoWallPhoto[]
}

export interface LiveStepperProps {
  steps: LiveStepperStep[]
  onPhotoClick?: (photo: PhotoWallPhoto, index: number, stepKey: string) => void
  resolveName?: (stepKey: string) => string
}

/** 24px 节点圆：薄荷✓完成 / 柠檬步序数字进行中（静态柠檬环影）/ 纸面细线环灰数字未到。 */
function StepNode({ status, order }: { status: ServiceStepStatus; order: number }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-secondary">
        <Check className="h-3.5 w-3.5 text-ink" strokeWidth={1.5} />
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary shadow-[0_0_0_5px_rgba(253,200,48,.25)]">
        <span className="u1-num text-caption-xs font-bold leading-none text-ink">{order}</span>
      </span>
    )
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-line-ring">
      <span className="u1-num text-caption-xs font-bold leading-none text-ink-placeholder">{order}</span>
    </span>
  )
}

export default function LiveStepper({ steps, onPhotoClick, resolveName }: LiveStepperProps) {
  return (
    <ol className="flex flex-col pt-1.5" data-testid="live-stepper">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const name = resolveName?.(step.stepKey) ?? getStepDef(step.stepKey)?.name ?? step.stepKey
        // meta 行（试样 .st2）：done=完成时刻；active=进行中 · 说明；locked 无
        const meta =
          step.status === 'done' && step.time
            ? step.time
            : step.status === 'active'
              ? `进行中${step.description ? ` · ${step.description}` : ''}`
              : null

        return (
          <li
            key={step.stepKey}
            className="relative flex gap-[13px]"
            data-step-key={step.stepKey}
            data-step-status={step.status}
          >
            {/* 左轨：节点圆 + 连接线（统一 2px 暖墨细线） */}
            <div className="flex w-6 flex-col items-center">
              <StepNode status={step.status} order={index + 1} />
              {!isLast ? <span className="min-h-4 w-0.5 flex-1 bg-line-ring" /> : null}
            </div>

            {/* 内容区 */}
            <div className={`flex-1 ${isLast ? '' : 'pb-5'}`}>
              <div className="flex h-6 items-center">
                <span
                  className={
                    step.status === 'locked'
                      ? 'text-body-sm font-medium text-ink-placeholder'
                      : 'text-body-sm font-semibold text-ink'
                  }
                >
                  {name}
                </span>
              </div>

              {meta ? (
                <p className="mt-0.5 text-caption-xs text-ink-secondary">
                  {step.status === 'done' ? <span className="u1-num">{meta}</span> : meta}
                </p>
              ) : null}

              {step.photos && step.photos.length > 0 ? (
                step.stepKey === 'before_after' ? (
                  <div className="mt-2">
                    <PhotoWall
                      photos={step.photos}
                      stepKey={step.stepKey}
                      onPhotoClick={(photo, i) => onPhotoClick?.(photo, i, step.stepKey)}
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex gap-1.5">
                    {step.photos.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onPhotoClick?.(p, i, step.stepKey)}
                        className="block h-11 w-16 shrink-0 overflow-hidden rounded-chip bg-sunken shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)]"
                        aria-label={p.tag ?? `照片 ${i + 1}`}
                      >
                        <img
                          src={p.thumbUrl ?? p.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
