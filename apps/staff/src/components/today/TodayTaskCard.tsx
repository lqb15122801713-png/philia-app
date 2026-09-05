/**
 * 今日任务卡片（T3.1 · 员工端时间轴节点卡）
 *
 * 卡片 = 时间大号 + 宠物名/服务名/客户备注/状态胶囊 + 状态动作：
 * - in_service  → 「继续执行」主按钮 → /execute/:id
 * - in_boarding → 「去打卡」主按钮   → /boarding/:id/checkin
 * - completed   → 灰态 + 评分（无评分显示「待评价」）
 * - confirmed   → 提示到店后扫顶部「扫码核销」
 * 员工端硬性规格：按钮高 ≥56px、正文 ≥16px（text-body-lg）、热区 ≥56px。
 */

import { PawPrint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusCapsule from './StatusCapsule';
import { hhmm, type TodayItem } from './utils';

/** 评分星（1-5；无评分显示「待评价」） */
export function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-body text-ink-placeholder">待评价</span>;
  return (
    <span className="text-body-lg tracking-wide" aria-label={`评分 ${rating} 星`}>
      <span className="text-brand-primary">{'★'.repeat(rating)}</span>
      <span className="text-line-strong">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/** 时间轴节点圆点（按状态配色；待核销带呼吸脉冲，与胶囊一致） */
function AxisDot({ status }: { status: string }) {
  if (status === 'confirmed') {
    return <span className="absolute left-0 top-6 h-4 w-4 rounded-full bg-brand-primary animate-halo" />;
  }
  if (status === 'in_service' || status === 'in_boarding') {
    return <span className="absolute left-0 top-6 h-4 w-4 rounded-full bg-brand-primary" />;
  }
  if (status === 'completed' || status === 'cancelled') {
    return <span className="absolute left-0 top-6 h-4 w-4 rounded-full bg-line-strong" />;
  }
  // pending / cancel_requested：未到节点的空心点
  return (
    <span className="absolute left-0 top-6 h-4 w-4 rounded-full border-2 border-line-strong bg-card" />
  );
}

export default function TodayTaskCard({ item }: { item: TodayItem }) {
  const navigate = useNavigate();
  const isDone = item.status === 'completed' || item.status === 'cancelled';

  return (
    <li className="relative pl-8">
      <AxisDot status={item.status} />
      <div
        className={`rounded-card bg-card p-4 shadow-card ${isDone ? 'opacity-70' : ''}`}
        data-status={item.status}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-number text-title-lg tabular-nums">{hhmm(item.scheduledStart)}</p>
          <StatusCapsule status={item.status} />
        </div>

        <p className="mt-1 flex items-center gap-1.5 text-body-lg font-semibold">
          <PawPrint className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
          {item.petName ?? '宠物'}
          <span className="font-normal text-ink-secondary">· {item.serviceName ?? '服务'}</span>
        </p>

        {item.note ? (
          <p className="mt-1 rounded-tag bg-sunken px-2 py-1 text-body text-ink-secondary">
            客户备注：{item.note}
          </p>
        ) : null}

        {item.status === 'in_service' ? (
          <button
            type="button"
            onClick={() => navigate(`/execute/${item.id}`)}
            className="mt-3 h-14 w-full rounded-full bg-brand-primary text-body-lg font-semibold text-white transition active:scale-[0.98]"
          >
            继续执行
          </button>
        ) : null}

        {item.status === 'in_boarding' ? (
          <button
            type="button"
            onClick={() => navigate(`/boarding/${item.id}/checkin`)}
            className="mt-3 h-14 w-full rounded-full bg-brand-primary text-body-lg font-semibold text-white transition active:scale-[0.98]"
          >
            去打卡
          </button>
        ) : null}

        {item.status === 'confirmed' ? (
          <p className="mt-2 text-body text-ink-secondary">客户到店后，点顶部「扫码核销」开始服务</p>
        ) : null}

        {item.status === 'pending' ? (
          <p className="mt-2 text-body text-ink-secondary">待商家确认 / 派单，可先留意时间冲突</p>
        ) : null}

        {item.status === 'completed' ? (
          <div className="mt-2 flex items-center justify-between border-t border-line-divider pt-2">
            <Stars rating={item.rating} />
            <span className="font-number text-body text-ink-secondary tabular-nums">
              {item.completedAt ? `完成于 ${hhmm(item.completedAt)}` : ''}
            </span>
          </div>
        ) : null}

        {item.status === 'cancel_requested' ? (
          <p className="mt-2 text-body text-danger-deep">客户申请取消，待商家审核</p>
        ) : null}
      </div>
    </li>
  );
}
