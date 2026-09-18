/**
 * B4-1 单屏 · 吸底确认条：
 * 三态 —— 可点（「确认预约 · ¥X · 约 N 分钟」）/ 置灰点名缺项（如「请选择时间」）/
 * 提交中（「提交中…」）。B4-R1：单屏页为沉浸式下单流（App.tsx 按路由隐藏 TabBar），
 * fixed 落底 bottom: env(safe-area-inset-bottom)；页面底部需留 padding（单屏页 pb-36）。
 *
 * U4-D1 逐格对照试样（.confirm-bar 骨架）：摘要行（左=宠物·服务·洗护师，右=日期
 * 时间，均为真实选择态，缺项如实写「未选」）→ 柠檬主钮 → 安心行。衬底=白底卡 +
 * 顶部 hairline（试样 var(--paper) + 0 -1px 0 ink-06）；禁渐变。
 * 安心行只写真实口径：全程页六步可见 + 过程照片记录（live 页现成链路）+ 收款方式
 * （到店付/次卡扣次，随 paymentMode 真实切换），禁虚构承诺（不抄试样「不取消费」）。
 */

import { dayLabel, fenToYuan, fmtHM } from '../format';

export default function ConfirmBar({
  priceFen,
  durationMin,
  missingLabel,
  submitting,
  onConfirm,
  petName,
  serviceName,
  staffName,
  slot,
  paymentMode,
}: {
  /** 已选服务价格（分），null = 未选服务 */
  priceFen: number | null;
  /** 已选服务时长（分钟） */
  durationMin: number | null;
  /** 缺项点名（如「请选择时间」）；null = 必选已齐可提交 */
  missingLabel: string | null;
  submitting: boolean;
  onConfirm: () => void;
  /** U4-D1 摘要行真实选择态（null = 未选，如实展示） */
  petName: string | null;
  serviceName: string | null;
  /** null = 随缘派单（默认卡口径） */
  staffName: string | null;
  /** 已选时段；null = 未选时间 */
  slot: Date | null;
  /** 收款方式（安心行真实口径：到店付 / 次卡扣次） */
  paymentMode: 'pay_at_store' | 'pass_deduct';
}) {
  const ready = missingLabel === null && !submitting;
  const label = submitting
    ? '提交中…'
    : missingLabel !== null
      ? missingLabel
      : `确认预约 · ${fenToYuan(priceFen ?? 0)} · 约 ${durationMin ?? 60} 分钟`;

  const summaryLeft = [petName ?? '未选宠物', serviceName ?? '未选服务', staffName ?? '随缘派单'].join(' · ');

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
      data-testid="gs-confirm-bar"
    >
      <div className="mx-auto max-w-lg border-t border-[rgba(74,59,46,.09)] bg-card px-4 pb-4 pt-3">
        {/* 摘要行（试样 .cb-meta：左 宠物·服务·人，右 日期 时间加粗） */}
        <div className="mb-2 flex items-center justify-between gap-3 text-caption-xs text-ink-secondary">
          <span className="min-w-0 truncate" data-testid="gs-confirm-summary">
            {summaryLeft}
          </span>
          <span className="shrink-0">
            {slot ? (
              <b className="u1-num font-semibold text-ink">
                {dayLabel(slot)} {fmtHM(slot)}
              </b>
            ) : (
              '未选时间'
            )}
          </span>
        </div>
        <button
          type="button"
          disabled={!ready}
          onClick={onConfirm}
          data-testid="gs-confirm"
          data-state={submitting ? 'submitting' : missingLabel !== null ? 'disabled' : 'ready'}
          className={`pointer-events-auto h-12 w-full rounded-control text-body-sm font-semibold shadow-philia transition-transform duration-120 ease-philia-spring ${
            ready ? 'bg-brand-primary text-ink active:scale-92' : 'cursor-not-allowed bg-line text-ink-placeholder shadow-none'
          }`}
        >
          {label}
        </button>
        {/* 安心行：真实功能点（全程页六步可见 + 过程照片记录 + 收款方式），不虚构承诺 */}
        <p data-testid="gs-confirm-assurance" className="mt-2 text-center text-caption-xs text-ink-secondary">
          全程可见 · 照片记录 · {paymentMode === 'pass_deduct' ? '次卡扣次' : '到店付'}
        </p>
      </div>
    </div>
  );
}
