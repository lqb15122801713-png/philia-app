/**
 * 预约步骤条（T2.2）：≤4 屏流程的进度指示。
 * 已完成节点：品牌色实心圆 + 白 ✓；当前节点：品牌色圆 + 文案 600；未到：描边圆。
 */

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
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-caption ${
                  done
                    ? 'bg-brand-primary text-white'
                    : active
                      ? 'bg-brand-primary text-white'
                      : 'border-[1.5px] border-line-strong text-ink-placeholder'
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <span className="font-number">{idx}</span>
                )}
              </span>
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
