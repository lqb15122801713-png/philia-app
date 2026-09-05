/**
 * 监视时间轴（T4.2 监视页）= 共享 StepTimeline 只读展示 + 商家操作叠加。
 *
 * 复用说明：节点三态（done 品牌色实心圆+白勾 / active 品牌色圆点+animate-halo
 * 呼吸光环 / locked 1.5px 强描边+小锁）、连接线（done 实线 / 未到达虚线 dash）、
 * 节点行高与轴线左偏 24px 全部沿用 packages/shared StepTimeline 的结构与类名；
 * 共享 StepTimeline 无节点操作槽，本组件在其视觉规范上叠加「打标重拍」按钮。
 * 照片：before_after 步直接复用共享 PhotoWall（并排双图模式）；其余步骤照片用
 * 同 §6.3 网格规格（3 列 / 4px / 1:1 / 8px 圆角）的悬停网格 —— 每张照片 hover
 * 显示拍摄时间（共享 PhotoWall 无此槽位，规格要求，见汇报说明）。
 *
 * 打标重拍规则（服务端 flagForRedo 规则 5 镜像）：
 *  (a) 当前 active 步可打标；(b) step_order 最大的 done 步且其后全部 locked、
 *      当前无 active 步可打标；其余一律禁用（悬停 title 提示规则）。
 */

import { getStepDef, PhotoWall } from '@philia/shared';
import { Check, Lock, RotateCcw } from 'lucide-react';
import { fmtTime } from './appt-utils';
import type { StepListItem } from './appt-utils';
import type { ViewPhoto } from './PhotoViewer';

const FLAG_DISABLED_HINT = '仅「当前进行中步骤」或「最新一个已完成且其后步骤均未开始的步骤」可打标重拍';

type StepPhoto = StepListItem['photos'][number];

/** 步骤照片 → 查看器照片（保留拍摄时间） */
const toViewPhoto = (p: StepPhoto): ViewPhoto => ({
  id: p.id,
  url: p.url,
  thumbUrl: p.thumbUrl ?? undefined,
  takenAt: p.takenAt,
});

/** 悬停显示拍摄时间的照片网格（规格同 PhotoWall 九宫格；点击看大图） */
function HoverPhotoGrid({
  photos,
  onPhotoClick,
}: {
  photos: StepPhoto[];
  onPhotoClick: (photos: ViewPhoto[], index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {photos.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPhotoClick(photos.map(toViewPhoto), i)}
          className="group relative block aspect-square w-full overflow-hidden rounded-tag bg-sunken"
          aria-label={`照片 ${i + 1}`}
        >
          <img
            src={p.thumbUrl ?? p.url}
            alt={`照片 ${i + 1}`}
            loading="lazy"
            className="h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
          />
          {/* hover 显示拍摄时间 */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(61,50,41,0.75)] to-transparent px-1 pb-0.5 pt-4 text-left text-caption text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {p.takenAt ? `${fmtTime(p.takenAt)} 拍摄` : '时间未知'}
          </span>
        </button>
      ))}
    </div>
  );
}

/** 24px 节点圆：三态样式（与共享 StepTimeline 一致） */
function StepNode({ status }: { status: string }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
      </span>
    );
  }
  if (status === 'active') {
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

export function MonitorTimeline({
  steps,
  flaggingKey,
  onFlag,
  onPhotoClick,
}: {
  steps: StepListItem[];
  /** 打标 mutation 进行中的 stepKey（按钮 loading） */
  flaggingKey: string | null;
  onFlag: (step: StepListItem) => void;
  onPhotoClick: (photos: ViewPhoto[], index: number) => void;
}) {
  // 规则 5 镜像：active 步；或最新 done 步且其后全 locked、无 active 步
  const actives = steps.filter((s) => s.status === 'active');
  const doneSteps = steps.filter((s) => s.status === 'done');
  const latestDone = doneSteps[doneSteps.length - 1] ?? null;

  const canFlag = (s: StepListItem): boolean => {
    if (s.status === 'active') return true;
    if (s.status !== 'done') return false;
    if (latestDone?.id !== s.id) return false;
    if (actives.length !== 0) return false;
    return steps.filter((x) => x.stepOrder > s.stepOrder).every((x) => x.status === 'locked');
  };

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const lineDone = step.status === 'done';
        const name = getStepDef(step.stepKey)?.name ?? step.stepKey;
        const flaggable = canFlag(step);
        const busy = flaggingKey === step.stepKey;

        // before_after 步：before 左 / after 右（共享 PhotoWall 并排双图模式）
        const wallPhotos =
          step.stepKey === 'before_after'
            ? (() => {
                const before =
                  step.photos.find((p) => p.tag === 'before') ?? step.photos[0];
                const after = step.photos.find((p) => p.tag === 'after');
                return [before, after].filter((p): p is StepPhoto => !!p);
              })()
            : step.photos;

        return (
          <li key={step.id} className="relative flex gap-3">
            {/* 左轨：节点圆 + 连接线 */}
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
                {step.flagged ? (
                  <span className="rounded-tag bg-danger-light px-1.5 py-0.5 text-caption text-danger-deep">
                    已打标，等待重拍
                  </span>
                ) : null}
                {/* 右侧：时间 + 打标重拍（操作叠加）。
                    不可打标的步按钮禁用态 + 悬停 title 提示规则——用 aria-disabled
                    而非 disabled 属性（disabled 按钮不触发 hover，提示无法显示）。 */}
                <span className="ml-auto flex items-center gap-2">
                  {step.status === 'done' && step.doneAt ? (
                    <span className="font-number text-caption text-ink-secondary">
                      {fmtTime(step.doneAt)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-disabled={!flaggable || busy}
                    title={flaggable ? '打标该步骤，要求员工重拍' : FLAG_DISABLED_HINT}
                    onClick={() => {
                      if (flaggable && !busy) onFlag(step);
                    }}
                    className={`flex h-7 items-center gap-1 rounded-full border px-2 text-caption transition-colors ${
                      flaggable
                        ? 'border-danger text-danger-deep hover:bg-danger-light'
                        : 'cursor-not-allowed border-line text-ink-placeholder opacity-60'
                    }`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {busy ? '打标中…' : '打标重拍'}
                  </button>
                </span>
              </div>

              {/* 照片：before_after 复用共享 PhotoWall；其余悬停时间网格 */}
              {wallPhotos.length > 0 ? (
                <div className="mt-2">
                  {step.stepKey === 'before_after' ? (
                    <PhotoWall
                      photos={wallPhotos.map((p) => ({
                        id: p.id,
                        url: p.url,
                        thumbUrl: p.thumbUrl ?? undefined,
                      }))}
                      stepKey="before_after"
                      onPhotoClick={(_photo, i) =>
                        onPhotoClick(wallPhotos.map(toViewPhoto), i)
                      }
                    />
                  ) : (
                    <HoverPhotoGrid photos={step.photos} onPhotoClick={onPhotoClick} />
                  )}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
