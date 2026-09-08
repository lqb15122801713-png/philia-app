/**
 * B4-1 单屏 · 吸底确认条：
 * 三态 —— 可点（「确认预约 · ¥X · 约 N 分钟」）/ 置灰点名缺项（如「请选择时间」）/
 * 提交中（「提交中…」）。fixed 吸底于 TabBar（56px）上方，带渐变衬底；
 * 页面底部需留 padding 避免内容被遮（单屏页 pb-36）。
 */

import { fenToYuan } from '../format';

export default function ConfirmBar({
  priceFen,
  durationMin,
  missingLabel,
  submitting,
  onConfirm,
}: {
  /** 已选服务价格（分），null = 未选服务 */
  priceFen: number | null;
  /** 已选服务时长（分钟） */
  durationMin: number | null;
  /** 缺项点名（如「请选择时间」）；null = 必选已齐可提交 */
  missingLabel: string | null;
  submitting: boolean;
  onConfirm: () => void;
}) {
  const ready = missingLabel === null && !submitting;
  const label = submitting
    ? '提交中…'
    : missingLabel !== null
      ? missingLabel
      : `确认预约 · ${fenToYuan(priceFen ?? 0)} · 约 ${durationMin ?? 60} 分钟`;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-sticky"
      data-testid="gs-confirm-bar"
    >
      <div className="mx-auto max-w-lg bg-gradient-to-t from-canvas via-canvas to-transparent px-4 pb-3 pt-6">
        <button
          type="button"
          disabled={!ready}
          onClick={onConfirm}
          data-testid="gs-confirm"
          data-state={submitting ? 'submitting' : missingLabel !== null ? 'disabled' : 'ready'}
          className={`pointer-events-auto h-12 w-full rounded-full text-body font-semibold shadow-philia transition-transform duration-120 ease-philia-spring ${
            ready ? 'bg-philia-gradient text-white active:scale-92' : 'cursor-not-allowed bg-line text-ink-placeholder'
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
