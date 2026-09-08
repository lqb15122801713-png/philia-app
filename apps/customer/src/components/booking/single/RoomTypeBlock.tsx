/**
 * B4-2 寄养单屏 · 房型区块（数据驱动两种形态，B4-4 裁定）：
 * - 单房型：只读信息卡（名称 + 单晚价 + 余 N 间），无选择动作（页面预填已自动选中）；
 * - 多房型：选择器卡列表（现状向导屏2 同款，「余 N 间」透出保留）。
 * 余量口径沿用 B3-2：已选区间 = 区间内逐晚最小剩余；未选日期 = 今晚剩余。
 */

import { fenToYuan } from '../format';
import type { ServiceItem } from '../types';

export default function RoomTypeBlock({
  services,
  selectedId,
  onSelect,
  remainingOf,
  tonight,
  loading,
  error,
  onRetry,
}: {
  services: ServiceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 某房型剩余间数（null = 余量未加载） */
  remainingOf: (serviceId: string) => number | null;
  /** true = 未选日期，余量按「今晚」展示 */
  tonight: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return <div className="h-20 animate-pulse rounded-card bg-sunken" data-testid="bs-room-loading" />;
  }
  if (error) {
    return (
      <div className="rounded-card bg-sunken px-4 py-8 text-center" data-testid="bs-room-error">
        <p className="text-caption text-ink-secondary">房型加载失败，请检查网络</p>
        <button type="button" onClick={onRetry} className="mt-2 text-caption font-semibold text-brand-primary">
          重新加载
        </button>
      </div>
    );
  }
  if (services.length === 0) {
    return (
      <p className="rounded-card bg-sunken px-4 py-8 text-center text-caption text-ink-secondary" data-testid="bs-room-empty">
        该门店暂无寄养房型，换一家看看
      </p>
    );
  }

  const remainLine = (sid: string) => {
    const remaining = remainingOf(sid);
    if (remaining === null) return null;
    return (
      <span className={`mt-0.5 block text-caption ${remaining === 0 ? 'text-danger-deep' : 'text-success-deep'}`}>
        {tonight ? `今晚剩余 ${remaining} 间` : `剩余 ${remaining} 间`}
      </span>
    );
  };

  /* B4-4：单房型 → 只读信息卡（无选择动作） */
  if (services.length === 1) {
    const s = services[0]!;
    return (
      <div
        className="flex w-full items-center justify-between rounded-card bg-card p-4 shadow-card"
        data-testid="bs-room-readonly"
        data-service-id={s.id}
      >
        <span>
          <span className="block text-body font-semibold">{s.boardingRoomType ?? s.name}</span>
          {s.boardingRoomType ? <span className="mt-0.5 block text-caption text-ink-secondary">{s.name}</span> : null}
          {remainLine(s.id)}
        </span>
        <span className="text-right">
          <span className="block font-number text-price text-brand-primary">{fenToYuan(s.priceFen)}</span>
          <span className="text-caption text-ink-placeholder">/ 晚</span>
        </span>
      </div>
    );
  }

  /* 多房型 → 选择器（「余 N 间」透出保留） */
  return (
    <div className="space-y-2" data-testid="bs-room-selector">
      {services.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            data-testid={`bs-room-option-${s.id}`}
            data-active={active ? 'true' : 'false'}
            className={`flex w-full items-center justify-between rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
          >
            <span>
              <span className="block text-body font-semibold">{s.boardingRoomType ?? s.name}</span>
              {s.boardingRoomType ? <span className="mt-0.5 block text-caption text-ink-secondary">{s.name}</span> : null}
              {remainLine(s.id)}
            </span>
            <span className="text-right">
              <span className="block font-number text-price text-brand-primary">{fenToYuan(s.priceFen)}</span>
              <span className="text-caption text-ink-placeholder">/ 晚</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
