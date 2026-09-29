/**
 * LiveStepper · 客户端服务全程页六步 stepper（批次 U1 任务 E；换皮批片 2 取齐 S-01）。
 *
 * 步骤名以 server getStepDef 真实定义为准（冻结 6+1 步名，不改数据）。
 * 定稿锚 = screens.html S-01 六步清单 stepx（screens.css 实证值，件级样式落
 * styles/live-v2.css，lv2-* 类）：
 * - 步号 22 圆：done=深棕填 #2E2318 米白✓ / now=淡黄填 #F2DFA6 + 4px 淡黄光晕
 *   （静态工艺，禁呼吸动画）/ future=卡其描边 #B9A482 + 行件 opacity .55；
 * - 步名 14/800 + 右侧 mono 9 状态（done=完成时刻✓ / now=进行中 / future=未开始，
 *   文案走 copy 键 live.*）；active 步操作说明落 wnote mono 9 工作注；
 * - 照片 3 列方格 gap 6 圆角 10；空位虚线框 slotx（仅 now/future 按
 *   requiredPhotos 补位，done 步不补——定稿 S-01 逐格；requiredPhotos 为
 *   serviceStep.list 既有字段，仅透传不新取数）；
 * - 左轨保留既有纵向轨道形态（功能零改动），连接线取齐发丝线 1px --line；
 *   before_after 步仍走共享 PhotoWall 前后并排（哇塞时刻既有特性保留）。
 */

import { Check } from 'lucide-react'
import { PhotoWall, getStepDef } from '@philia/shared'
import type { PhotoWallPhoto, ServiceStepStatus } from '@philia/shared'
import { mc } from '../member/copy'
import '../../styles/live-v2.css'

/** 时间轴单步数据（与共享 StepTimelineStep 同构）。 */
export interface LiveStepperStep {
  stepKey: string
  status: ServiceStepStatus
  /** done 步完成时刻（HH:MM） */
  time?: string
  /** active 步操作说明 */
  description?: string
  photos?: PhotoWallPhoto[]
  /** 该步规定照片数（serviceStep.list 既有字段；空位虚线框补位依据） */
  requiredPhotos?: number
}

export interface LiveStepperProps {
  steps: LiveStepperStep[]
  onPhotoClick?: (photo: PhotoWallPhoto, index: number, stepKey: string) => void
  resolveName?: (stepKey: string) => string
}

/** 22px 步号圆：done 深棕✓ / now 淡黄步序（静态光晕）/ future 卡其描边灰字。 */
function StepNode({ status, order }: { status: ServiceStepStatus; order: number }) {
  if (status === 'done') {
    return (
      <span className="lv2-stepno done">
        <Check className="h-3 w-3" strokeWidth={2.2} />
      </span>
    )
  }
  return <span className={`lv2-stepno ${status === 'active' ? 'now' : ''}`}>{order}</span>
}

export default function LiveStepper({ steps, onPhotoClick, resolveName }: LiveStepperProps) {
  return (
    <ol className="flex flex-col pt-1.5" data-testid="live-stepper">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const name = resolveName?.(step.stepKey) ?? getStepDef(step.stepKey)?.name ?? step.stepKey
        // 右侧 mono 9 状态签（S-01 .stepx .st）：done=完成时刻✓ / now=进行中 / future=未开始
        const statusText =
          step.status === 'done'
            ? step.time
              ? `${step.time} ✓`
              : null
            : step.status === 'active'
              ? mc('live.stepActive')
              : mc('live.stepPending')
        // 空位虚线框：仅 now/future 补位（done 步空位不画，定稿逐格）；before_after 走对比双图不补位
        const slotCount =
          step.status === 'done' || step.stepKey === 'before_after'
            ? 0
            : Math.max(0, (step.requiredPhotos ?? 0) - (step.photos?.length ?? 0))
        const hasGrid = (step.photos?.length ?? 0) > 0 || slotCount > 0

        return (
          <li
            key={step.stepKey}
            className={`relative flex gap-[13px] ${step.status === 'locked' ? 'opacity-[.55]' : ''}`}
            data-step-key={step.stepKey}
            data-step-status={step.status}
          >
            {/* 左轨：步号圆 + 连接发丝线（1px --line） */}
            <div className="flex w-[22px] flex-col items-center">
              <StepNode status={step.status} order={index + 1} />
              {!isLast ? <span className="min-h-4 w-px flex-1 bg-line" /> : null}
            </div>

            {/* 内容区 */}
            <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-5'}`}>
              <div className="flex h-[22px] items-center gap-2.5">
                <span className="lv2-stepname">{name}</span>
                {statusText ? (
                  <span className={`lv2-stepst ${step.status === 'active' ? 'now' : ''}`}>{statusText}</span>
                ) : null}
              </div>

              {step.status === 'active' && step.description ? (
                <p className="lv2-wnote">{step.description}</p>
              ) : null}

              {step.stepKey === 'before_after' ? (
                step.photos && step.photos.length > 0 ? (
                  <div className="mt-2">
                    <PhotoWall
                      photos={step.photos}
                      stepKey={step.stepKey}
                      onPhotoClick={(photo, i) => onPhotoClick?.(photo, i, step.stepKey)}
                    />
                  </div>
                ) : null
              ) : hasGrid ? (
                <div className="lv2-photos">
                  {(step.photos ?? []).map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPhotoClick?.(p, i, step.stepKey)}
                      className="lv2-ph"
                      aria-label={p.tag ?? `照片 ${i + 1}`}
                    >
                      <img src={p.thumbUrl ?? p.url} alt="" loading="lazy" />
                    </button>
                  ))}
                  {Array.from({ length: slotCount }, (_, i) => (
                    <span key={`slot-${i}`} className="lv2-slotx" aria-hidden="true" />
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
