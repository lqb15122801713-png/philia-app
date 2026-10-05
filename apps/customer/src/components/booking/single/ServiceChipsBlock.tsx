/**
 * B4-1 单屏 · 服务 chips 区块：
 * 横排 chips，默认选中=上次/推荐（由页面预填）；超过 4 个时显示前 4 个 +
 * 「更多服务 ▸」渐进披露（展开为 wrap 全量，可再收起）。chip 含名称/时长/价格。
 *
 * U1-D 换肤（v9.1）：chips 之上加「服务二选一照片大卡」——洗澡 / 造型美容两档
 * （grooming 目录真实分组：服务名含「造型」为美容档，其余为洗澡档；某档目录为空
 * 则该卡不渲染，不造假入口）。点大卡=选中该档首个服务（复用 onSelect 真实选择逻辑，
 * 零新交互）。
 *
 * 换皮批片 2（定稿 B-01 / §4.4 工艺卡）：
 * - 二选一大卡 → selcard：一卡两列竖线分隔（圆角 20），列=icon 26 + 题 16/800 +
 *   mono 副题（项数 · 价格起）；选中列=深棕底 #2E2318 反白 #F6EFDD（副题 #C9BBA0）。
 *   VI 位图插槽退役：选中列深棕底上位图无法反白，定稿锚 selcard 即线图标 26。
 * - 服务项 chips → 胶囊 99：边 --line，选中=深棕底 #F6EFDD 字（旧柠檬底退役，
 *   淡黄点睛位让给时段栅格选中态）。
 * - 「更多服务 ▸」= 卡其下划线链（tfield 更改链同工艺）。
 */

import { useState } from 'react';
import { Bath, Scissors } from 'lucide-react';
import { Skeleton } from '@philia/shared';
import { bkc } from '@/copy/booking';
import type { ServiceItem } from '../types';
import { fenToYuan } from '../format';

const COLLAPSED_COUNT = 4;

/** 档定义：洗澡（非造型）/ 造型美容（名含「造型」） */
const CATEGORIES = [
  { key: 'wash', name: '洗澡', icon: Bath, testId: 'gs-cat-wash', match: (s: ServiceItem) => !s.name.includes('造型') },
  { key: 'style', name: '造型美容', icon: Scissors, testId: 'gs-cat-style', match: (s: ServiceItem) => s.name.includes('造型') },
] as const;

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
          <Skeleton key={i} className="h-14 w-28 rounded-control" />
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
        {bkc('booking.noGroomingSingle')}
      </p>
    );
  }

  // 二选一 selcard：按档聚合真实目录（档内服务数 + 最低价）
  const catCards = CATEGORIES.map((c) => {
    const items = services.filter(c.match);
    return { ...c, items };
  }).filter((c) => c.items.length > 0);

  const overflow = services.length > COLLAPSED_COUNT && !expanded;
  const visible = overflow ? services.slice(0, COLLAPSED_COUNT) : services;

  return (
    <div data-testid="gs-service-chips">
      {/* selcard（定稿 §4.4）：一卡两列竖线分隔圆角 20；选中列=深棕底反白；空档不渲染 */}
      {catCards.length > 0 ? (
        <div className="mb-3 flex overflow-hidden rounded-panel border border-line bg-card">
          {catCards.map((c) => {
            const active = c.items.some((s) => s.id === selectedId);
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect(c.items[0]!.id)}
                data-testid={c.testId}
                data-active={active ? 'true' : 'false'}
                className={`flex-1 px-2 pb-4 pt-[18px] text-center transition active:scale-[0.98] ${
                  active ? 'bg-[#2E2318] text-[#F6EFDD]' : 'text-ink'
                } [&+&]:border-l [&+&]:border-line-divider`}
              >
                <Icon
                  className="mx-auto mb-[9px] block h-[26px] w-[26px]"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <span className="block text-v2-section">{c.name}</span>
                <span
                  className={`mt-1 block font-number text-v2-trace ${
                    active ? 'text-[#C9BBA0]' : 'text-ink-secondary'
                  }`}
                >
                  {c.items.length} 项可选 · {fenToYuan(Math.min(...c.items.map((s) => s.priceFen)))} 起
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* chips（定稿 §4.4）：胶囊 99，边 --line，选中=深棕底 #F6EFDD 字 */}
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
              className={`rounded-full border px-[15px] py-[9px] text-left transition active:scale-95 ${
                active ? 'border-transparent bg-[#2E2318] text-[#F6EFDD]' : 'border-line bg-card text-ink'
              }`}
            >
              <span className="block text-[12.5px] font-semibold leading-4">{s.name}</span>
              <span
                className={`mt-0.5 block font-number text-v2-trace ${
                  active ? 'text-[#C9BBA0]' : 'text-ink-secondary'
                }`}
              >
                约 {durationById?.[s.id] ?? s.durationMin ?? 60} 分钟 · {fenToYuan(s.priceFen)}
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
          className="mt-2 border-b border-brand-secondary pb-px text-caption font-medium text-ink"
        >
          {expanded ? '收起服务 ▾' : `更多服务 ▸（共 ${services.length} 项）`}
        </button>
      ) : null}
    </div>
  );
}
