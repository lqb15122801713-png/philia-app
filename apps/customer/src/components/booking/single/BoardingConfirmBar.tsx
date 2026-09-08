/**
 * B4-2 寄养单屏 · 吸底确认条：
 * 三态（同洗护口径）——可点（「确认预约 · 共 N 晚 ¥X」）/ 置灰点名缺项 / 提交中。
 * 疫苗硬校验不满足时：按钮置灰（保留晚数总价文案）+ 按钮上方红条
 * 「{宠物}的疫苗将于 X 到期，请先补录 ▸」（点击跳 /philia/pets 补录）；
 * 无疫苗记录时红条文案为「还没有疫苗有效期记录」。
 * fixed 吸底于 TabBar（56px）上方；页面底部需留 padding（单屏页 pb-36）。
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
      className="pointer-events-none fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-sticky"
      data-testid="bs-confirm-bar"
    >
      <div className="mx-auto max-w-lg bg-gradient-to-t from-canvas via-canvas to-transparent px-4 pb-3 pt-6">
        {vaccineBlock ? (
          <Link
            to="/philia/pets"
            data-testid="bs-vaccine-bar"
            className="pointer-events-auto mb-2 flex items-center justify-between rounded-card bg-danger-light px-4 py-2.5 text-body text-danger-deep"
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
