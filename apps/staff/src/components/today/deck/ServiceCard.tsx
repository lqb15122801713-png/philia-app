/**
 * U2 任务 B · 服务中块就地浮层服务卡（冻结决策 #21：点服务中块就地展开，点轴外收回）
 *
 * 结构（试样 .b-ev.live.svc，整块卡其洗底）：标题 +「服务中」签（纸面底+墨点）/
 * 时间·时长·已核销行（mono 时刻）/ 六步进度段（深棕 done / 淡黄 now / 墨 6% 未到，三态口径）/
 * 当前步+已传照行 / 淡黄主钮「继续服务 · 第 N 步{步名}」（h=56 硬性）→ /execute/:id。
 * 数据：serviceStep.list（现成）；步名用冻结表六名（CJ-0919-01，STEP_NAME 常量）。
 */

import { SERVICE_STEPS, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fmtMin, minutesOf } from './deckUtils';
import type { TodayItem } from '../utils';

/** 步名口径=冻结表六名（CJ-0919-01，与 shared SERVICE_STEPS 一致） */
export const STEP_NAME: Record<string, string> = {
  disinfection: '消毒工具确认',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '交付检查',
  confirm: '完成确认',
};

export default function ServiceCard({ item }: { item: TodayItem }) {
  const { trpc } = usePhiliaClient();
  const stepsQ = useQuery({
    queryKey: ['serviceStep', 'list', item.id],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: item.id }),
    staleTime: 30_000,
  });
  const steps = [...(stepsQ.data ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
  const active = steps.find((s) => s.status === 'active') ?? null;
  const def = active ? SERVICE_STEPS.find((d) => d.stepKey === active.stepKey) : null;
  const stepName = active ? (STEP_NAME[active.stepKey] ?? active.stepKey) : '';
  const durationMin = Math.round((item.scheduledEnd.getTime() - item.scheduledStart.getTime()) / 60_000);

  return (
    <div data-svc-card data-testid={`svc-card-${item.id}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption font-bold">
          {item.petName ?? '宠物'} · {item.serviceName ?? '服务'}
        </p>
        <span className="flex items-center gap-1.5 rounded-chip bg-card px-2 py-0.5 text-caption-xs font-bold">
          <i className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
          服务中
        </span>
      </div>
      <p className="mt-0.5 text-caption-xs text-[rgba(59,46,36,.66)]">
        <span className="u1-num whitespace-nowrap">
          {fmtMin(minutesOf(item.scheduledStart))}–{fmtMin(minutesOf(item.scheduledEnd))}
        </span>{' '}
        · 约 <span className="u1-num">{durationMin}</span> 分钟 ·{' '}
        {item.checkedInAt ? '到店已核销' : '待核销'}
      </p>
      {/* 六步进度段（三态口径：gap 5 / 高 4 / 深棕 done / 淡黄 now / 墨 6% 未到） */}
      <div className="flex gap-[5px] pb-0.5 pt-2" aria-hidden>
        {steps.map((s) => (
          <i
            key={s.id}
            className={`h-1 flex-1 rounded-full ${
              s.status === 'done' ? 'bg-ink' : s.status === 'active' ? 'bg-brand-primary' : 'bg-[rgba(59,46,36,.06)]'
            }`}
          />
        ))}
      </div>
      {active ? (
        <p className="mt-1 text-caption-xs text-[rgba(59,46,36,.72)]">
          第 <span className="u1-num">{active.stepOrder}</span> 步 · {stepName} — 已传{' '}
          <span className="u1-num whitespace-nowrap">{active.photos.length}/{def?.minPhotos ?? 0}</span> 张过程照
        </p>
      ) : stepsQ.isPending ? (
        <p className="mt-1 text-caption-xs text-[rgba(59,46,36,.72)]">步骤加载中…</p>
      ) : null}
      <Link
        to={`/execute/${item.id}`}
        data-testid={`svc-continue-${item.id}`}
        className="mt-2.5 flex h-staff-btn w-full items-center justify-center rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
      >
        继续服务{active ? ` · 第 ${active.stepOrder} 步${stepName}` : ''}
      </Link>
    </div>
  );
}
