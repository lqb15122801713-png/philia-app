/**
 * U2 任务 B · 服务中块就地浮层服务卡（冻结决策 #21：点服务中块就地展开，点轴外收回）
 *
 * 结构（试样 .b-ev.live.svc，整块薄荷底）：标题 +「服务中」签（纸面底）/
 * 时间·时长·已核销行 / 六步进度段（薄荷 done / 柠檬 now / 墨灰未到）/
 * 当前步+已传照行 / 柠檬主钮「继续服务 · 第 N 步{步名}」→ /execute/:id。
 * 数据：serviceStep.list（现成）；步名用服务端 StepLabel 口径（三端一致）。
 */

import { SERVICE_STEPS, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fmtMin, minutesOf } from './deckUtils';
import type { TodayItem } from '../utils';

/** 步名口径=服务端 StepLabel（server/src/routers/serviceStep.ts，三端一致） */
export const STEP_NAME: Record<string, string> = {
  disinfection: '消毒',
  precheck: '预检',
  grooming: '洗护',
  detail: '精修',
  before_after: '前后对比照',
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
      <p className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.66)]">
        {fmtMin(minutesOf(item.scheduledStart))}–{fmtMin(minutesOf(item.scheduledEnd))} · 约 {durationMin} 分钟 ·{' '}
        {item.checkedInAt ? '到店已核销' : '待核销'}
      </p>
      {/* 六步进度段（试样 .a-prog：gap 5 / 高 4 / 薄荷 done / 柠檬 now / 墨 6% 未到） */}
      <div className="flex gap-[5px] pb-0.5 pt-2" aria-hidden>
        {steps.map((s) => (
          <i
            key={s.id}
            className={`h-1 flex-1 rounded-full ${
              s.status === 'done' ? 'bg-brand-secondary' : s.status === 'active' ? 'bg-brand-primary' : 'bg-[rgba(74,59,46,.06)]'
            }`}
          />
        ))}
      </div>
      {active ? (
        <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.72)]">
          第 {active.stepOrder} 步 · {stepName} — 已传 {active.photos.length}/{def?.minPhotos ?? 0} 张过程照
        </p>
      ) : stepsQ.isPending ? (
        <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.72)]">步骤加载中…</p>
      ) : null}
      <Link
        to={`/execute/${item.id}`}
        data-testid={`svc-continue-${item.id}`}
        className="mt-2.5 flex w-full items-center justify-center rounded-control bg-brand-primary py-3 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
      >
        继续服务{active ? ` · 第 ${active.stepOrder} 步${stepName}` : ''}
      </Link>
    </div>
  );
}
