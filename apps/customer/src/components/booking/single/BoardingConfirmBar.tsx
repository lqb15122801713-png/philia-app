/**
 * B4-2 寄养单屏 · 吸底确认条：
 * 三态（同洗护口径）——可点（「确认预约 · 共 N 晚 ¥X」）/ 置灰点名缺项 / 提交中。
 * 疫苗硬校验不满足时：按钮置灰（保留晚数总价文案）+ 按钮上方红条
 * 「{宠物}的疫苗将于 X 到期，请先补录 ▸」（点击跳 /philia/pets 补录）；
 * 无疫苗记录时红条文案为「还没有疫苗有效期记录」。
 * fixed 落底 bottom: env(safe-area-inset-bottom)（B4-R1：单屏页隐藏 TabBar）；
 * 页面底部需留 padding（单屏页 pb-36）。
 */

import { Link } from 'react-router-dom';
import { fenToYuan } from '../format';

export interface VaccineBlock {
  petName: string;
  /** 疫苗有效期（ISO），null = 档案无记录 */
  until: string | null;
}

export default function BoardingConfirmBar({
  nights,
  totalFen,
  missingLabel,
  vaccineBlock,
  submitting,
  onConfirm,
}: {
  nights: number;
  /** 总价（分）= 单晚价 × 晚数 */
  totalFen: number;
  /** 缺项点名（如「请选择入住日期」）；null = 必选已齐 */
  missingLabel: string | null;
  /** 疫苗阻断（非 null 即置灰 + 红条） */
  vaccineBlock: VaccineBlock | null;
  submitting: boolean;
  onConfirm: () => void;
}) {
  const ready = missingLabel === null && vaccineBlock === null && !submitting;
  const priceLabel = `确认预约 · 共 ${nights} 晚 ${fenToYuan(totalFen)}`;
  const label = submitting ? '提交中…' : (missingLabel ?? priceLabel);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-sticky"
      data-testid="bs-confirm-bar"
    >
      <div className="mx-auto max-w-lg border-t border-[rgba(74,59,46,.09)] bg-canvas px-4 pb-3 pt-3">
        {vaccineBlock ? (
          <Link
            to="/philia/pets"
            data-testid="bs-vaccine-bar"
            className="pointer-events-auto mb-2 flex items-center justify-between rounded-control bg-danger-light px-4 py-2.5 text-body text-danger-deep"
          >
            <span>
              {vaccineBlock.until
                ? `${vaccineBlock.petName}的疫苗将于 ${vaccineBlock.until} 到期，请先补录`
                : `${vaccineBlock.petName}还没有疫苗有效期记录，请先补录`}
            </span>
            <span className="ml-2 shrink-0 font-medium">▸</span>
          </Link>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={onConfirm}
          data-testid="bs-confirm"
          data-state={submitting ? 'submitting' : ready ? 'ready' : 'disabled'}
          data-block-reason={vaccineBlock ? 'vaccine' : missingLabel !== null ? 'missing' : ''}
          className={`pointer-events-auto h-12 w-full rounded-control text-body font-semibold shadow-philia transition-transform duration-120 ease-philia-spring ${
            ready ? 'bg-brand-primary text-ink active:scale-92' : 'cursor-not-allowed bg-line text-ink-placeholder shadow-none'
          }`}
        >
          {label}
        </button>
        {/* U1-D 安心行：真实功能点（寄养每日照看日志 + 照片记录，BoardingLive 现成链路） */}
        <p data-testid="bs-confirm-assurance" className="mt-2 text-center text-caption-xs text-ink-secondary">
          每日照看日志 · 照片记录
        </p>
      </div>
    </div>
  );
}
