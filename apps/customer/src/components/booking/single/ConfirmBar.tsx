import { dayLabel, fenToYuan, fmtHM } from '../format';

export default function ConfirmBar({
  priceFen,
  durationMin,
  missingLabel,
  submitting,
  onConfirm,
  slot,
  nextSlotLabel,
}: {
  priceFen: number | null;
  durationMin: number | null;
  missingLabel: string | null;
  submitting: boolean;
  onConfirm: () => void;
  slot: Date | null;
  nextSlotLabel: string | null;
}) {
  const ready = missingLabel === null && !submitting;
  const label = submitting ? '提交中…' : missingLabel ?? '确认预约';
  const summary = slot
    ? `已选 ${dayLabel(slot)} ${fmtHM(slot)} · 约 ${durationMin ?? 60} 分钟 · ${fenToYuan(priceFen ?? 0)}`
    : nextSlotLabel
      ? `下一可约 ${nextSlotLabel} 已提示 · 点选时段后确认`
      : '请选择可约日期与时段';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
      data-testid="gs-confirm-bar"
    >
      <div className="mx-auto max-w-lg bg-canvas px-4 pb-4 pt-3">
        <p data-testid="u2-bottom-summary" className="mb-3 truncate text-caption text-ink-secondary">
          {summary}
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={onConfirm}
          data-testid="gs-confirm"
          data-state={submitting ? 'submitting' : missingLabel !== null ? 'disabled' : 'ready'}
          className={`pointer-events-auto h-[52px] w-full rounded-full text-body-lg font-semibold transition-transform duration-120 ease-philia-spring ${
            ready ? 'bg-brand-cta text-brand-cta-on shadow-philia active:scale-92' : 'cursor-not-allowed bg-sunken text-ink-placeholder shadow-none'
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
