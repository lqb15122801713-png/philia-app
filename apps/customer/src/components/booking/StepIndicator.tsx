/**
 * 预约步骤条（T2.2）：≤4 屏流程的进度指示。
 * 已完成节点：品牌色实心圆 + ✓；当前节点：品牌色圆 + 文案 600；未到：描边圆。
 *
 * 换皮批片 5：节点圆归并 @philia/shared StepNode（done 深棕墨✓ / active 淡金
 * 序号 / future 卡其描边，成功不设绿色纪律）；横向布局与连接线保留原样。
 */

import { StepNode } from '@philia/shared';

export default function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-start">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={label} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <StepNode state={done ? 'done' : active ? 'active' : 'future'} label={idx} size={24} />
              <span
                className={`whitespace-nowrap text-caption ${
                  active ? 'font-semibold text-brand-primary' : done ? 'text-ink' : 'text-ink-placeholder'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={`mx-1 mt-3 h-0.5 flex-1 rounded ${done ? 'bg-brand-primary' : 'bg-line'}`}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
