/**
 * B4-1 单屏 · 吸底确认条：
 * 三态 —— 可点（「确认预约 · ¥X · 约 N 分钟」）/ 置灰点名缺项（如「请选择时间」）/
 * 提交中（「提交中…」）。B4-R1：单屏页为沉浸式下单流（App.tsx 按路由隐藏 TabBar），
 * fixed 落底 bottom: env(safe-area-inset-bottom)；页面底部需留 padding（单屏页 pb-36）。
 *
 * U1-D 换肤（v9.1）：CTA 下加「安心行」——文案只写真实功能点（服务全程页六步可见 +
 * 员工过程照片记录，live 页现成链路），禁虚构承诺；衬底去渐变（全域禁渐变装饰）
 * 改米白实底 + 顶部细线 hairline（深度策略）。
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
      className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
      data-testid="gs-confirm-bar"
    >
      <div className="mx-auto max-w-lg border-t border-[rgba(74,59,46,.09)] bg-canvas px-4 pb-3 pt-3">
        <button
          type="button"
          disabled={!ready}
          onClick={onConfirm}
          data-testid="gs-confirm"
          data-state={submitting ? 'submitting' : missingLabel !== null ? 'disabled' : 'ready'}
          className={`pointer-events-auto h-12 w-full rounded-control text-body font-semibold shadow-philia transition-transform duration-120 ease-philia-spring ${
            ready ? 'bg-brand-primary text-ink active:scale-92' : 'cursor-not-allowed bg-line text-ink-placeholder shadow-none'
          }`}
        >
          {label}
        </button>
        {/* 安心行：真实功能点（全程页六步可见 + 过程照片记录），不虚构承诺 */}
        <p data-testid="gs-confirm-assurance" className="mt-2 text-center text-caption-xs text-ink-secondary">
          全程可见 · 照片记录
        </p>
      </div>
    </div>
  );
}
