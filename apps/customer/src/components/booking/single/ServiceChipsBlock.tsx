/**
 * B4-1 单屏 · 服务 chips 区块：
 * 横排 chips，默认选中=上次/推荐（由页面预填）；超过 4 个时显示前 4 个 +
 * 「更多服务 ▸」渐进披露（展开为 wrap 全量，可再收起）。chip 含名称/时长/价格。
 *
 * U1-D 换肤（v9.1）：chips 之上加「服务二选一照片大卡」——洗澡 / 造型美容两档
 * （grooming 目录真实分组：服务名含「造型」为美容档，其余为洗澡档；某档目录为空
 * 则该卡不渲染，不造假入口）。点大卡=选中该档首个服务（复用 onSelect 真实选择逻辑，
 * 零新交互）；选中态=深棕墨 1.5px 细线圈（与 chips 选中态同语言）。
 * 照片资产取舍：产品侧 photos/ 照片包未入库——以 VI 线图标（lucide 墨色）+ 文字版
 * 大卡占位，结构留 img 插槽（见 CatCard 内注释），资产到位后替换。
 * chips 圆角换 U1-B 控件档 rounded-control(14)，逻辑零改动。
 */

import { useState } from 'react';
import { Bath, Scissors } from 'lucide-react';
import type { ServiceItem } from '../types';
import { fenToYuan } from '../format';

const COLLAPSED_COUNT = 4;

/** 档定义：洗澡（非造型）/ 造型美容（名含「造型」）；photo=VI 插画图标（已入库） */
const CATEGORIES = [
  { key: 'wash', name: '洗澡', icon: Bath, photo: '/photos/icons/ic-bath.png', testId: 'gs-cat-wash', match: (s: ServiceItem) => !s.name.includes('造型') },
  { key: 'style', name: '造型美容', icon: Scissors, photo: '/photos/icons/ic-groom.png', testId: 'gs-cat-style', match: (s: ServiceItem) => s.name.includes('造型') },
] as const;

/** 大卡照片插槽：VI 插画 <img> 直出，onError 回退 lucide 线图标（资产缺失不破版） */
function CatPhoto({ photo, icon: Icon }: { photo: string; icon: typeof Bath }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <span className="flex h-14 w-full items-center justify-center rounded-control bg-sunken" aria-hidden="true">
      {imgOk ? (
        <img src={photo} alt="" className="h-12 w-12 object-contain" onError={() => setImgOk(false)} />
      ) : (
        <Icon className="h-7 w-7 text-ink" strokeWidth={1.5} />
      )}
    </span>
  );
}

export default function ServiceChipsBlock({
  services,
  selectedId,
  onSelect,
  loading,
  durationById,
}: {
  services: ServiceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** B9a 任务 C：时长引擎逐服务输出（分钟，null=寄养无时长）；缺省回退服务默认 durationMin */
  durationById?: Record<string, number | null> | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex gap-2" data-testid="gs-service-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 w-28 animate-pulse rounded-control bg-sunken" />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <p
        className="rounded-control bg-sunken px-4 py-6 text-center text-caption text-ink-secondary"
        data-testid="gs-service-empty"
      >
        该门店暂无可约洗护服务，换家门店看看
      </p>
    );
  }

  // 二选一照片大卡：按档聚合真实目录（档内服务数 + 最低价）
  const catCards = CATEGORIES.map((c) => {
    const items = services.filter(c.match);
    return { ...c, items };
  }).filter((c) => c.items.length > 0);

  const overflow = services.length > COLLAPSED_COUNT && !expanded;
  const visible = overflow ? services.slice(0, COLLAPSED_COUNT) : services;

  return (
    <div data-testid="gs-service-chips">
      {/* U1-D：服务二选一照片大卡（洗澡/造型美容两档；空档不渲染） */}
      {catCards.length > 0 ? (
        <div className="mb-3 grid grid-cols-2 gap-3">
          {catCards.map((c) => {
            const active = c.items.some((s) => s.id === selectedId);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect(c.items[0]!.id)}
                data-testid={c.testId}
                data-active={active ? 'true' : 'false'}
                className={`u1-ring flex flex-col items-start gap-2 rounded-panel bg-card p-3.5 text-left transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${
                  active ? 'ring-2 ring-ink' : ''
                }`}
              >
                {/* 照片插槽：VI 插画图标（U1.1 启用），onError 回退 lucide（容器尺寸不变） */}
                <CatPhoto photo={c.photo} icon={c.icon} />
                <span className="text-body-sm font-semibold leading-5">{c.name}</span>
                <span className="u1-num text-caption-xs leading-4 text-ink-secondary">
                  {c.items.length} 项可选 · {fenToYuan(Math.min(...c.items.map((s) => s.priceFen)))} 起
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

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
              className={`rounded-control border px-3.5 py-2.5 text-left transition active:scale-95 ${
                active ? 'border-[1.5px] border-ink' : 'border-line'
              }`}
            >
              <span className="block text-body-sm font-semibold">{s.name}</span>
              <span className="mt-0.5 block text-caption text-ink-secondary">
                约 {durationById?.[s.id] ?? s.durationMin ?? 60} 分钟 · <span className="font-number font-semibold text-ink">{fenToYuan(s.priceFen)}</span>
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
          className="mt-2 text-caption font-medium text-ink"
        >
          {expanded ? '收起服务 ▾' : `更多服务 ▸（共 ${services.length} 项）`}
        </button>
      ) : null}
    </div>
  );
}
