/**
 * StepTimeline · 六步服务时间轴（展示组件）
 *
 * 「预约 → 服务 → 完成」全程可视，是品牌「可信赖」的核心载体。
 * 客户端 / 商家端 live 页复用；员工端操作态在其页面层另行封装。
 *
 * 节点三态（规格见 docs/DESIGN.md §6.2）：
 * - done   ：24px 实心品牌色圆 + 白色 1.5px 勾；标题暖深棕，右侧可挂时间戳
 * - active ：24px 品牌色圆外罩 animate-halo 呼吸光环（与 philia 按钮同一母题），
 *            标题 600 品牌色 +「进行中」标签，可附一行当前操作说明
 * - locked ：24px 圆仅 1.5px 强描边 + 12px 线性小锁，标题占位灰
 *
 * 连接线：done 段品牌色实线，未到达段强描边色虚线（dash 4/4）。
 * 节点 photos 可选传入，传入则节点下方挂 PhotoWall。
 */

import { Check, Lock } from 'lucide-react';
import PhotoWall from './PhotoWall';
import { getStepDef } from '../constants/steps';
import type { ServiceStepStatus } from '../constants/steps';
import type { PhotoWallPhoto } from './PhotoWall';

/** 时间轴单步数据。 */
export interface StepTimelineStep {
  /** 对应 SERVICE_STEPS 的 stepKey；未知 key 时回退展示原始字符串。 */
  stepKey: string;
  status: ServiceStepStatus;
  /** 完成时间戳等（12px 次级文字，挂在标题右侧）。 */
  time?: string;
  /** active 态的当前操作说明（15px 次级文字）。 */
  description?: string;
  /** 该步骤照片，传入则节点下挂 PhotoWall。 */
  photos?: PhotoWallPhoto[];
}

export interface StepTimelineProps {
  steps: StepTimelineStep[];
  /** 透传给 PhotoWall 的点击回调（查看原图由页面层处理）。 */
  onPhotoClick?: (photo: PhotoWallPhoto, index: number, stepKey: string) => void;
  /** 自定义步骤名兜底（未传时用 SERVICE_STEPS 的 name）。 */
  resolveName?: (stepKey: string) => string;
}

/** 24px 节点圆：三态样式。 */
function StepNode({ status }: { status: ServiceStepStatus }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === 'active') {
    // 呼吸光环与 philia 按钮同一母题；同屏光环不超过 2 处（DESIGN §5）
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary animate-halo">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-card">
      <Lock className="h-3 w-3 text-ink-placeholder" strokeWidth={1.5} />
    </span>
  );
}

export default function StepTimeline({ steps, onPhotoClick, resolveName }: StepTimelineProps) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        // 当前步 done → 到下一步的连接线为品牌色实线，否则虚线灰
        const lineDone = step.status === 'done';
        const name = resolveName?.(step.stepKey) ?? getStepDef(step.stepKey)?.name ?? step.stepKey;

        return (
          <li key={step.stepKey} className="relative flex gap-3">
            {/* 左轨：节点圆 + 连接线，轴线左偏 24px */}
            <div className="flex w-6 flex-col items-center">
              <StepNode status={step.status} />
              {!isLast ? (
                lineDone ? (
                  <span className="w-0.5 min-h-4 flex-1 bg-brand-primary" />
                ) : (
                  <span className="w-0 min-h-4 flex-1 border-l-2 border-dashed border-line-strong" />
                )
              ) : null}
            </div>

            {/* 内容区 */}
            <div className={`flex-1 ${isLast ? '' : 'pb-6'}`}>
              <div className="flex h-6 items-center gap-2">
                <span
                  className={
                    step.status === 'active'
                      ? 'text-body font-semibold text-brand-primary'
                      : step.status === 'done'
                        ? 'text-body text-ink'
                        : 'text-body text-ink-placeholder'
                  }
                >
                  {name}
                </span>
                {step.status === 'active' ? (
                  <span className="rounded-tag bg-brand-primary-light px-1.5 py-0.5 text-caption text-brand-primary">
                    进行中
                  </span>
                ) : null}
                {step.time ? (
                  <span className="ml-auto font-number text-caption text-ink-secondary">{step.time}</span>
                ) : null}
              </div>

              {step.description ? (
                <p className="mt-1 text-body text-ink-secondary">{step.description}</p>
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
        );
      })}
    </ol>
  );
}
