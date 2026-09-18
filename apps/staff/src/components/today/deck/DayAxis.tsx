/**
 * U2 任务 B/C · 日轴（时间轴台 B′ 核心件，groomer/frontdesk 同骨架）
 *
 * 规格书 §2：09:00–打烊、小时行高 52px、当前时间墨线+圆点；单块三态——
 * 已完成 45% 透明（试样 .45 工艺值）/ 服务中薄荷底（点击就地展开服务卡，点轴外收回）/
 * 待开工带来源签+疫苗安心签；同刻并行块对半分列。
 * frontdesk 态差异（§3）：块副行=核销状态+员工名（subtitle 覆盖），并行块同分列规则。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ServiceCard from './ServiceCard';
import { AXIS_HOUR_PX, assignColumns, axisHours, fmtMin, minutesOf } from './deckUtils';
import type { TodayItem } from '../utils';

/** 派单来源签（S4 统一口径：auto=自动派单 / merchant=商家改派；null 不显示） */
const SOURCE_LABEL: Record<string, string> = { auto: '自动派单', merchant: '商家改派' };

/** 待开工块疫苗安心签：appointment.get 现成接口取 pet.vaccineValidUntil（前端聚合，零新接口） */
function VaccineNote({ appointmentId }: { appointmentId: string }) {
  const { trpc } = usePhiliaClient();
  const q = useQuery({
    queryKey: ['appointment', 'get', appointmentId],
    queryFn: () => trpc.appointment.get.query({ appointmentId }),
    staleTime: 300_000,
  });
  const until = q.data?.pet?.vaccineValidUntil;
  if (!until) return null;
  if (new Date(until).getTime() < Date.now()) return null;
  return <span> · 疫苗已齐 ✓</span>;
}

export default function DayAxis({
  items,
  startMin,
  endMin,
  now,
  /** frontdesk：块副行覆盖（核销状态+员工名） */
  subtitle,
  /** frontdesk：并行块/员工名等扩展标题行 */
  titleSuffix,
}: {
  items: TodayItem[];
  startMin: number;
  endMin: number;
  now: Date;
  subtitle?: (item: TodayItem) => ReactNode;
  titleSuffix?: (item: TodayItem) => ReactNode;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 点轴外收回（冻结决策 #21 口径）
  useEffect(() => {
    if (!expandedId) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[data-svc-card],[data-axis-block]')) setExpandedId(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expandedId]);

  const blocks = useMemo(
    () =>
      items.map((item) => ({
        item,
        startMin: minutesOf(item.scheduledStart),
        endMin: Math.max(minutesOf(item.scheduledEnd), minutesOf(item.scheduledStart) + 30),
      })),
    [items],
  );
  const cols = useMemo(() => assignColumns(blocks), [blocks]);

  const nowMin = minutesOf(now);
  const showNow = nowMin >= startMin && nowMin <= endMin;
  const hours = axisHours(startMin, endMin);
  const axisHeight = (endMin - startMin) * (AXIS_HOUR_PX / 60);

  return (
    <div className="relative mt-3" data-testid="day-axis" style={{ paddingLeft: 46 }}>
      {/* 当前时间墨线+圆点（试样 .b-now：left 38 / right 22 / 高 2px 墨 + 8px 圆点） */}
      {showNow ? (
        <div
          aria-hidden
          className="absolute left-[38px] right-[22px] z-[2] h-0.5 bg-ink"
          style={{ top: ((nowMin - startMin) / 60) * AXIS_HOUR_PX }}
        >
          <i className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-ink" />
        </div>
      ) : null}

      {/* 小时行 */}
      <div className="relative" style={{ height: axisHeight }}>
        {hours.map((h) => (
          <div key={h} className="relative border-t border-[rgba(74,59,46,.06)]" style={{ height: AXIS_HOUR_PX }}>
            <span className="u1-num absolute -left-[44px] -top-[7px] text-caption-xs text-[rgba(74,59,46,.42)]">
              {fmtMin(h)}
            </span>
          </div>
        ))}

        {/* 单块 */}
        {blocks.map(({ item, startMin: sMin, endMin: eMin }, i) => {
          const top = ((sMin - startMin) / 60) * AXIS_HOUR_PX + 2;
          const height = Math.max(((eMin - sMin) / 60) * AXIS_HOUR_PX - 6, 44);
          const { col, cols: n } = cols.get(i) ?? { col: 0, cols: 1 };
          const live = item.status === 'in_service';
          const done = item.status === 'completed';
          const expanded = expandedId === item.id;
          const range = `${fmtMin(sMin)}–${fmtMin(eMin)}`;
          const durationMin = Math.round((item.scheduledEnd.getTime() - item.scheduledStart.getTime()) / 60_000);

          return (
            <div
              key={item.id}
              data-axis-block
              data-testid={`axis-block-${item.id}`}
              className={`absolute overflow-hidden rounded-xl ${
                expanded ? 'px-[13px] py-[11px]' : 'px-3 py-2' /* 试样 .b-ev.svc padding 11px 13px 13px */
              } ${
                live
                  ? 'z-[3] bg-brand-secondary shadow-[0_0_0_1px_rgba(74,59,46,.14)]'
                  : 'u1-ring bg-card'
              } ${done ? 'opacity-[.45]' : ''} ${live && !expanded ? 'cursor-pointer transition-transform duration-120 ease-philia-spring active:scale-[0.98]' : ''}`}
              style={{
                top,
                height: expanded ? 'auto' : height,
                left: `${(col / n) * 100}%`,
                width: `calc(${(1 / n) * 100}% - 2px)`,
              }}
              onClick={live ? () => setExpandedId(expanded ? null : item.id) : undefined}
              role={live ? 'button' : undefined}
              aria-expanded={live ? expanded : undefined}
            >
              {expanded ? (
                <ServiceCard item={item} />
              ) : (
                <>
                  <p className="truncate text-caption font-bold">
                    {item.petName ?? '宠物'} · {item.serviceName ?? '服务'}
                    {titleSuffix?.(item)}
                  </p>
                  <p className={`mt-0.5 text-caption-xs ${live ? 'text-[rgba(74,59,46,.66)]' : 'text-[rgba(74,59,46,.62)]'}`}>
                    {subtitle ? (
                      subtitle(item)
                    ) : (
                      <>
                        {range}
                        {done ? ' · 已完成' : null}
                        {live ? ` · 约 ${durationMin} 分钟 · ${item.checkedInAt ? '到店已核销' : '待核销'}` : null}
                        {!live && !done ? (
                          <>
                            {item.assignSource && SOURCE_LABEL[item.assignSource] ? ` · ${SOURCE_LABEL[item.assignSource]}` : ''}
                            <VaccineNote appointmentId={item.id} />
                          </>
                        ) : null}
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
