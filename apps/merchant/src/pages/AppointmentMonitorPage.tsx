/**
 * 服务过程监视 /appointments/:id/monitor（T4.2 · 开发方案 §2.2）
 *
 * - 只读展示 + 操作叠加：MonitorTimeline（共享 StepTimeline 视觉规范）+ 照片墙
 *   （before_after 复用共享 PhotoWall，其余步骤照片 hover 显示拍摄时间）。
 * - 实时：serviceStep.list 首屏 + SSE（watch=aid，store 频道兜底）；
 *   step_updated / step_flagged → invalidate；appointment.completed → 全量对齐 + toast；
 *   boarding.daily_update → toast + 打卡流累积；onReconnect 全量对齐（断线漏帧补偿）。
 * - 打标重拍：active 步 / 最新 done 步（其后未开始）节点可打标 → 确认弹层（可填原因）
 *   → flagForRedo → toast；其余步按钮禁用（悬停提示规则）；打标后该步显示
 *   「已打标，等待重拍」。
 * - 寄养单：BoardingMonitorPanel（stayBoard 同款信息：入住 + 每日打卡只读流）。
 */

import { EventType, getStepDef, usePhiliaClient, type EventEnvelope, type ServiceStepKey } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, CircleX } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fmtDateTime,
  statusBadge,
  statusLabel,
  type StepListItem,
} from '../components/appointments/appt-utils';
import {
  BoardingMonitorPanel,
  type LiveLogItem,
} from '../components/appointments/BoardingMonitorPanel';
import { ConfirmDialog } from '../components/appointments/ConfirmDialog';
import { MonitorTimeline } from '../components/appointments/MonitorTimeline';
import { PhotoViewer, type ViewPhoto } from '../components/appointments/PhotoViewer';
import { showToast, ToastHost } from '../components/appointments/Toast';
import { useMerchantEvents } from '../components/appointments/useMerchantEvents';

export default function AppointmentMonitorPage() {
  const { id: aid } = useParams<{ id: string }>();
  const { trpc, queryClient } = usePhiliaClient();

  /* ---------------- 查询 ---------------- */

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
  });
  const appt = detailQuery.data?.appointment;
  const pet = detailQuery.data?.pet;
  const service = detailQuery.data?.service;

  const isBoarding = appt?.type === 'boarding';
  const inLiveFlow =
    appt?.status === 'in_service' || appt?.status === 'in_boarding' || appt?.status === 'completed';

  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && !isBoarding && !!inLiveFlow,
  });
  const steps = useMemo(() => (stepsQuery.data ?? []) as StepListItem[], [stepsQuery.data]);

  const boardQuery = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
    enabled: !!aid && !!appt && isBoarding && !!inLiveFlow,
  });
  const boardEntry = useMemo(
    () => boardQuery.data?.board.find((b) => b.appointment.id === aid) ?? null,
    [boardQuery.data, aid],
  );

  /* ---------------- 全量对齐 / SSE ---------------- */

  const alignAll = useCallback(() => {
    if (!aid) return;
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
  }, [queryClient, aid]);

  const [liveLogs, setLiveLogs] = useState<LiveLogItem[]>([]);
  const [viewer, setViewer] = useState<{ photos: ViewPhoto[]; index: number } | null>(null);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      // store 频道会混入其他预约的事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return;

      switch (envelope.type) {
        case EventType.StepUpdated:
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
          break;
        case EventType.StepFlagged:
          // 打标后旧照片服务端已作废，必须全量重取
          void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
          break;
        case EventType.AppointmentCompleted:
          showToast('服务已完成', 'success');
          alignAll();
          break;
        case EventType.BoardingDailyUpdate: {
          const logDate = typeof data.logDate === 'string' ? data.logDate : '';
          showToast(`${logDate ? `${logDate} ` : ''}寄养打卡已更新`, 'alert');
          setLiveLogs((prev) =>
            [{ logDate: logDate || '今日', ts: envelope.ts }, ...prev].slice(0, 20),
          );
          void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });
          break;
        }
        case EventType.BoardingCompleted:
        case EventType.AppointmentCheckedIn:
        case EventType.AppointmentCancelled:
          alignAll();
          break;
        default:
          break;
      }
    },
    [aid, alignAll, queryClient],
  );

  useMerchantEvents({ watch: aid ?? null, onEvent, onReconnect: alignAll });

  /* ---------------- 打标重拍 ---------------- */

  const [flagTarget, setFlagTarget] = useState<StepListItem | null>(null);
  const [flagReason, setFlagReason] = useState('');

  const flagMut = useMutation({
    mutationFn: (input: { stepKey: ServiceStepKey; reason?: string }) =>
      trpc.serviceStep.flagForRedo.mutate({ appointmentId: aid!, ...input }),
    onSuccess: (r, vars) => {
      const label = getStepDef(vars.stepKey)?.name ?? vars.stepKey;
      showToast(
        r.reactivated
          ? `已打标「${label}」：步骤已回退为进行中，旧照片作废，等待员工重拍`
          : `已打标「${label}」，等待员工重拍`,
        'success',
      );
      setFlagTarget(null);
      setFlagReason('');
      void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : '打标失败，请稍后再试', 'error'),
  });

  /* ---------------- 渲染分支 ---------------- */

  const backLink = (
    <Link
      to={aid ? `/appointments/${aid}` : '/appointments'}
      className="inline-flex items-center gap-0.5 text-caption text-ink-secondary"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      预约详情
    </Link>
  );

  if (detailQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">加载中…</p>
      </div>
    );
  }

  if (detailQuery.isError || !appt) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        {backLink}
        <div className="mt-4 flex flex-col items-center rounded-card bg-card px-6 py-12 text-center shadow-card">
          <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          <p className="mt-3 text-title">打不开这个监视页</p>
          <p className="mt-2 text-body text-ink-secondary">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '预约不存在或无权限'}
          </p>
        </div>
      </div>
    );
  }

  const header = (
    <div className="mt-2 flex items-center justify-between">
      <div>
        <h1 className="text-title-lg">
          {pet?.name ?? '宠物'} · {service?.name ?? (isBoarding ? '寄养服务' : '洗护服务')}
        </h1>
        <p className="mt-0.5 font-number text-caption text-ink-secondary">
          预约时间 {fmtDateTime(appt.scheduledStart)}
        </p>
      </div>
      <span className={`rounded-tag px-1.5 py-0.5 text-caption ${statusBadge(appt.status)}`}>
        {statusLabel(appt.status)}
      </span>
    </div>
  );

  // 尚未开始 / 已取消
  if (!inLiveFlow) {
    const cancelled = appt.status === 'cancelled';
    return (
      <div className="mx-auto max-w-3xl px-4 py-4">
        <ToastHost />
        {backLink}
        {header}
        <div className="mt-3 flex flex-col items-center rounded-card bg-card px-6 py-10 text-center shadow-card">
          {cancelled ? (
            <CircleX className="h-10 w-10 text-ink-placeholder" strokeWidth={1.5} />
          ) : (
            <CalendarClock className="h-10 w-10 text-brand-primary" strokeWidth={1.5} />
          )}
          <p className="mt-3 text-title">{cancelled ? '预约已取消' : '服务尚未开始'}</p>
          <p className="mt-2 text-body text-ink-secondary">
            {cancelled
              ? '该预约已取消，无服务过程可监视。'
              : '客户到店核销后，这里会实时展示服务进度与照片。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <ToastHost />
      {viewer ? (
        <PhotoViewer
          photos={viewer.photos}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        />
      ) : null}

      {backLink}
      {header}

      <div className="mt-3">
        {isBoarding ? (
          <BoardingMonitorPanel
            boardingStay={detailQuery.data?.boardingStay ?? null}
            boardEntry={boardEntry}
            liveLogs={liveLogs}
          />
        ) : stepsQuery.isPending ? (
          <div className="rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-caption text-ink-secondary">正在接入服务进度…</p>
          </div>
        ) : steps.length === 0 ? (
          <div className="rounded-card bg-card p-6 text-center shadow-card">
            <p className="text-body text-ink-secondary">六步流尚未初始化（等待员工核销）。</p>
          </div>
        ) : (
          <div className="rounded-card bg-card p-4 shadow-card">
            <MonitorTimeline
              steps={steps}
              flaggingKey={flagMut.isPending ? (flagMut.variables?.stepKey ?? null) : null}
              onFlag={(s) => {
                setFlagReason('');
                setFlagTarget(s);
              }}
              onPhotoClick={(photos, index) => setViewer({ photos, index })}
            />
          </div>
        )}
      </div>

      {/* 打标重拍确认弹层 */}
      <ConfirmDialog
        open={flagTarget !== null}
        title={`打标重拍「${flagTarget ? (getStepDef(flagTarget.stepKey)?.name ?? flagTarget.stepKey) : ''}」？`}
        body={
          flagTarget?.status === 'done'
            ? '该步骤将回退为「进行中」，已有照片全部作废，员工需重新拍摄上传。'
            : '该步骤当前进行中，打标后员工会收到重拍提醒。'
        }
        confirmText="确认打标"
        danger
        loading={flagMut.isPending}
        onConfirm={() => {
          if (!flagTarget) return;
          const reason = flagReason.trim();
          flagMut.mutate({
            stepKey: flagTarget.stepKey as ServiceStepKey,
            ...(reason ? { reason } : {}),
          });
        }}
        onCancel={() => setFlagTarget(null)}
      >
        <textarea
          value={flagReason}
          onChange={(e) => setFlagReason(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="重拍原因（可选，200 字内），会随通知发给员工"
          className="mt-3 w-full rounded-input border border-line bg-sunken px-3 py-2 text-body text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
        />
      </ConfirmDialog>
    </div>
  );
}
