/**
 * B4-1 单屏 · 服务 chips 区块：
 * 横排 chips，默认选中=上次/推荐（由页面预填）；超过 4 个时显示前 4 个 +
 * 「更多服务 ▸」渐进披露（展开为 wrap 全量，可再收起）。chip 含名称/时长/价格。
 */

import { useState } from 'react';
import type { ServiceItem } from '../types';
import { fenToYuan } from '../format';

const COLLAPSED_COUNT = 4;

export default function ServiceChipsBlock({
  services,
  selectedId,
  onSelect,
  loading,
}: {
  services: ServiceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex gap-2" data-testid="gs-service-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-28 animate-pulse rounded-card bg-sunken" />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p
        className="rounded-card bg-sunken px-4 py-6 text-center text-caption text-ink-secondary"
        data-testid="gs-service-empty"
      >
        该门店暂无可约洗护服务，换家门店看看
      </p>
    );
  }

  const overflow = services.length > COLLAPSED_COUNT && !expanded;
  const visible = overflow ? services.slice(0, COLLAPSED_COUNT) : services;

  return (
    <div data-testid="gs-service-chips">
      <div className="flex flex-wrap gap-2">
        {visible.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              data-testid={`gs-service-chip-${s.id}`}
              data-active={active ? 'true' : 'false'}
              className={`rounded-card px-3.5 py-2.5 text-left transition active:scale-95 ${
                active ? 'bg-brand-primary-light shadow-card ring-2 ring-brand-primary' : 'bg-card shadow-card'
              }`}
            >
              <span className="block text-body font-semibold">{s.name}</span>
              <span className="mt-0.5 block text-caption text-ink-secondary">
                约 {s.durationMin ?? 60} 分钟 · <span className="font-number text-brand-primary">{fenToYuan(s.priceFen)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {services.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-testid="gs-service-more"
          className="mt-2 text-caption font-medium text-brand-primary"
        >
          {expanded ? '收起服务 ▾' : `更多服务 ▸（共 ${services.length} 项）`}
        </button>
      ) : null}
    </div>
  );
}
