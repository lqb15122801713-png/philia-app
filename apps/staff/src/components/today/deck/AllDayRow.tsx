/**
 * U2 任务 B · 全天行（groomer 态 = 寄养打卡卡列）
 *
 * 规格书 §2：左「全天」小标，右侧寄养打卡卡列——每只一卡：宠物名 + 房型·第 N 晚 +
 * 今日打卡状态；未完成=红描边卡+红「去打卡 ›」（warn 态），已完成=「查看 ›」。
 * 数据：listTodayForStaff 的 boarding 单（现成）+ boarding.stayForStaff 今日 dailyLog
 * 存在性（现成，前端聚合，零新接口）。无寄养单整行不渲染。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { BedDouble } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TodayItem } from '../utils';

const dayStartOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function BoardingCard({ item, today }: { item: TodayItem; today: Date }) {
  const { trpc } = usePhiliaClient();
  const stayQ = useQuery({
    queryKey: ['boarding', 'stayForStaff', item.id],
    queryFn: () => trpc.boarding.stayForStaff.query({ appointmentId: item.id }),
    staleTime: 60_000,
  });
  // 第 N 晚 = 今日 − 入住日 + 1（入住日=scheduledStart 日界）
  const night = Math.max(1, Math.floor((dayStartOf(today).getTime() - dayStartOf(item.scheduledStart).getTime()) / 86_400_000) + 1);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayLogged = (stayQ.data?.logs ?? []).some((l) => l.logDate === todayStr);
  // 打卡进行中（查询中）按未完成口径展示，按钮照常可点（真链路）
  const warn = !todayLogged;

  return (
    <Link
      to={`/boarding/${item.id}/checkin`}
      data-testid={`allday-boarding-${item.id}`}
      className={`mb-1.5 flex items-center gap-2.5 rounded-control bg-card px-3 py-2.5 transition-transform duration-120 ease-philia-spring active:scale-[0.98] ${
        warn ? 'shadow-[0_0_0_1px_rgba(217,45,32,.35)]' : 'u1-ring'
      }`}
    >
      <BedDouble className="h-[17px] w-[17px] shrink-0 text-[rgba(74,59,46,.62)]" strokeWidth={1.6} aria-hidden />
      <span className="min-w-0 flex-1 text-caption leading-snug text-[rgba(74,59,46,.62)]">
        <b className="text-caption font-bold text-ink">{item.petName ?? '宠物'}</b> · {item.serviceName ?? '寄养'}第 {night} 晚
        <span className="block text-caption-xs">{warn ? '今日喂食/遛狗打卡未完成' : '今日打卡已完成 ✓'}</span>
      </span>
      <span className={`shrink-0 text-caption-xs font-bold ${warn ? 'text-danger' : 'text-ink'}`}>
        {warn ? '去打卡 ›' : '查看 ›'}
      </span>
    </Link>
  );
}

export default function AllDayRow({ items, today }: { items: TodayItem[]; today: Date }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex items-start gap-2.5" data-testid="allday-row">
      <span className="u1-num w-9 shrink-0 pt-2 text-right text-caption-xs text-[rgba(74,59,46,.42)]">全天</span>
      <div className="min-w-0 flex-1">
        {items.map((item) => (
          <BoardingCard key={item.id} item={item} today={today} />
        ))}
      </div>
    </div>
  );
}
