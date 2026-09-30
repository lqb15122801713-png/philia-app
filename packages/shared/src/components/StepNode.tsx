/**
 * StepNode / StepConnector · 步进节点三态原子件（换皮批片 5「同型归并」）
 *
 * 归并出处（各自手画节点归一）：
 * - apps/customer/src/components/live/LiveStepper.tsx（done 深棕填米白✓ / active 淡金填 /
 *   future 卡其描边灰字）
 * - apps/staff/src/components/execute/ExecuteStepper.tsx（done 墨色✓ 不设绿 / active 淡金序号）
 * - apps/customer/src/components/booking/StepIndicator.tsx（横向步进条节点）
 * - packages/shared/src/components/StepTimeline.tsx（既有节点画法参考）
 * 呼吸光环不做进原子件，壳层自包 animate-halo；连接线 done=实线 / 未到=虚线。
 */

import { Check } from 'lucide-react';

export type StepNodeState = 'done' | 'active' | 'future';

export interface StepNodeProps {
  state: StepNodeState;
  /** 节点内序号/短签；done 态忽略（固定 ✓）；active 未给时回落为墨点小圆。 */
  label?: string | number;
  /** 节点直径 px，默认 24。 */
  size?: number;
}

export default function StepNode({ state, label, size = 24 }: StepNodeProps) {
  const base = 'flex shrink-0 items-center justify-center rounded-full font-number text-caption';
  const dim = { width: size, height: size };

  if (state === 'done') {
    // 深棕填 + 米白✓（成功不设绿）
    return (
      <span className={`${base} bg-ink text-canvas`} style={dim}>
        <Check style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.2} />
      </span>
    );
  }
  if (state === 'active') {
    // 淡金填 + 墨字（无 label 时回落为墨点小圆，同 StepTimeline active 母题）
    return (
      <span className={`${base} bg-brand-primary text-ink`} style={dim}>
        {label ?? (
          <span
            className="rounded-full bg-ink"
            style={{ width: size / 3, height: size / 3 }}
          />
        )}
      </span>
    );
  }
  // future：卡其描边灰字
  return (
    <span
      className={`${base} border-[1.5px] border-brand-secondary bg-card text-ink-placeholder`}
      style={dim}
    >
      {label ?? null}
    </span>
  );
}

export interface StepConnectorProps {
  /** true=已完成段（淡金实线）；false=未到段（强描边色虚线 dash）。 */
  done?: boolean;
}

export function StepConnector({ done = false }: StepConnectorProps) {
  return done ? (
    <span aria-hidden className="min-h-4 w-0.5 flex-1 bg-brand-primary" />
  ) : (
    <span aria-hidden className="min-h-4 w-0 flex-1 border-l-2 border-dashed border-line-strong" />
  );
}
