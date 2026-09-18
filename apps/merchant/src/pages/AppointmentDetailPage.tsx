/**
 * U3 任务 E · 预约详情 /appointments/:id —— 母本「4 · 预约详情」屏 / 规格书 §4 整页重写
 *
 * - MainScaffold 外包：title=「{宠物} · {服务}」，sub=「单号 {code} · 时间 · 时长/晚数」+ 状态胶囊；
 *   actions 按态切换（每屏至多一个柠檬钮）：
 *   pending → 柠檬「确认预约」（confirm 幂等保留）；confirmed → 细线「改期/改派(洗护)」；
 *   in_service/in_boarding/completed → 细线「服务监视」（打标重拍入口在监控页，不在此页）；
 *   completed 且未 paid → 柠檬「去收款 · ¥X」（markPaid 真链路，ConfirmDialog 防误触）；
 *   cancel_requested → 柠檬位换「审批取消申请」（Modal 透出客户原因 + 批准/拒绝 reviewCancel）。
 * - 两栏（1.6fr:1fr gap 14）：
 *   左 = 服务进度卡（u3-stepv 六步：薄荷 done 含 ✓ / 柠檬 now / 墨灰未到 + 时间戳 + 张数）
 *       + 过程照 56×42 缩略墙（点击放大复用 PhotoViewer）+ 事件轨迹卡；
 *   右 = 预约信息卡（u3-field）+ 金额卡（u3-kv 四格，金额 Montserrat tabular）。
 * - 寄养单：六步卡不渲染（无 steps），换 boardingStay 信息块（房间/称重/物品/退住）+ 轨迹卡。
 * - 轨迹口径（S4：事件即轨迹，零新接口）：createdAt=自动确认 by=auto / assignSource=auto
 *   → 自动派单（ts=createdAt 同事务）/ checkedInAt=到店核销 / steps.doneAt=步骤更新 /
 *   completedAt=完成；按时间升序，无对应时间戳的事件不合成（商家改派无独立时间戳 →
 *   轨迹不出行，来源签由预约信息卡员工行承载）。
 * - 实时：useMerchantEvents（watch=aid，与监控页同法）→ step/checkedin/completed 等事件
 *   invalidate 本单查询；SSE 离线时 30s 轮询兜底，onReconnect 全量对齐。
 * - 三态：加载骨架（禁转圈）/ 错误重试 / NOT_FOUND 引导回 /appointments。
 */

import { EventType, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarX, CircleX, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import MainScaffold, { LemonButton, QuietButton } from '../components/MainScaffold';
import {
  assignSourceLabel,
  cancelSourceLabel,
  customerLabel,
  fenToYuan,
  fmtDate,
  fmtDateTime,
  fmtTime,
  paymentModeLabel,
  stepDisplayName,
  STEP_ROWS,
  type AppointmentGetResult,
  type StepListItem,
} from '../components/appointments/appt-utils';
import { AssignStaffSheet } from '../components/appointments/AssignStaffSheet';
import { ConfirmDialog } from '../components/appointments/ConfirmDialog';
import { Modal } from '../components/appointments/Modal';
import { PhotoViewer, type ViewPhoto } from '../components/appointments/PhotoViewer';
import { RescheduleSheet } from '../components/appointments/RescheduleSheet';
import { useMerchantEvents } from '../components/appointments/useMerchantEvents';

/** SSE 断线时的兜底轮询间隔（与总览页同值） */
const POLL_FALLBACK_MS = 30_000;

/** 六步展示名（任务书冻结口径；统一表已迁 appt-utils（STEP_ROWS/stepDisplayName），
    单约监控页与 Hub 动态行同表渲染——规格书 §13「同 §4 stepper」） */
const stepName = stepDisplayName;

/** 照片标签 → 中文（PhotoViewer 底部透出） */
const PHOTO_TAG_LABEL: Record<string, string> = { before: '服务前', after: '服务后' };

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

type ApptRow = AppointmentGetResult['appointment'];
type StayRow = AppointmentGetResult['boardingStay'];

export default function AppointmentDetailPage() {
  const { id: aid } = useParams<{ id: string }>();
  const { trpc, queryClient } = usePhiliaClient();
  const navigate = useNavigate();

  /* ---------------- 实时：watch 本单（与监控页同法），断线 30s 轮询兜底 ---------------- */

  const alignDetail = useCallback(() => {
    if (!aid) return;
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'get', aid] });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
  }, [queryClient, aid]);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      // store 频道会混入其他预约的事件，只处理本预约
      if (typeof data.appointmentId === 'string' && data.appointmentId !== aid) return;
      switch (envelope.type) {
        case EventType.StepUpdated:
        case EventType.StepFlagged:
          alignDetail();
          break;
        case EventType.AppointmentCompleted:
          toast.success('服务已完成，可以收款了');
          alignDetail();
          break;
        case EventType.AppointmentReopened:
          toast('该预约已打回服务中，等待员工重拍');
          alignDetail();
          break;
        case EventType.AppointmentCheckedIn:
        case EventType.AppointmentAssigned:
        case EventType.AppointmentRescheduled:
        case EventType.AppointmentCancelRequested:
        case EventType.AppointmentCancelled:
        case EventType.AppointmentPaid:
        case EventType.BoardingDailyUpdate:
        case EventType.BoardingCompleted:
          alignDetail();
          break;
        default:
          break;
      }
    },
    [aid, alignDetail],
  );

  const events = useMerchantEvents({ watch: aid ?? null, onEvent, onReconnect: alignDetail });

  /* ---------------- 查询 ---------------- */

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  });
  const appt = detailQuery.data?.appointment;
  const pet = detailQuery.data?.pet;
  const service = detailQuery.data?.service;
  const isBoarding = appt?.type === 'boarding';

  // 员工姓名解析（staffList 同时供指派弹层共用查询缓存）
  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
    enabled: !!appt,
  });
  const staffName = useMemo(
    () => staffQuery.data?.staff.find((s) => s.id === appt?.staffId)?.name ?? null,
    [staffQuery.data, appt?.staffId],
  );

  // 六步 + 未失效照片：serviceStep.list 为现成接口（监控页同款）；
  // 未核销/查询未回时回退 appointment.get 的裸步骤行（photos 空），保证卡面先行渲染
  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', aid],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: aid! }),
    enabled: !!aid && !!appt && !isBoarding,
    refetchInterval: events.connected ? false : POLL_FALLBACK_MS,
  });
  const steps: StepListItem[] = useMemo(() => {
    if (stepsQuery.data) return stepsQuery.data;
    return (detailQuery.data?.steps ?? []).map((s) => ({ ...s, photos: [] }));
  }, [stepsQuery.data, detailQuery.data]);

  /* ---------------- 操作 ---------------- */

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['appointment'] });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list', aid] });
    void queryClient.invalidateQueries({ queryKey: ['store', 'dashboardStats'] });
  }, [queryClient, aid]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [viewer, setViewer] = useState<{ photos: ViewPhoto[]; index: number } | null>(null);

  const confirmMut = useMutation({
    mutationFn: () => trpc.appointment.confirm.mutate({ appointmentId: aid! }),
    onSuccess: () => {
      toast.success('已确认预约');
      invalidateAll();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '确认失败，请稍后再试'),
  });

  const markPaidMut = useMutation({
    mutationFn: () => trpc.appointment.markPaid.mutate({ appointmentId: aid! }),
    onSuccess: (r) => {
      toast.success(`已收款 ${fenToYuan(r.appointment.paidFen ?? r.appointment.priceFen)}`);
      setPayOpen(false);
      invalidateAll();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '收款登记失败，请稍后再试'),
  });

  const reviewCancelMut = useMutation({
    mutationFn: (approve: boolean) =>
      trpc.appointment.reviewCancel.mutate({ appointmentId: aid!, approve }),
    onSuccess: (r) => {
      toast.success(r.approved ? '已批准取消，槽位已释放' : '已拒绝取消，预约维持有效');
      setReviewOpen(false);
      invalidateAll();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '操作失败，请稍后再试'),
  });

  // 事件轨迹（S4：事件即轨迹，零审计表接口；无时间戳的事件不合成行。
  // 注意：useMemo 必须在三态早退之前调用，保证 hooks 顺序稳定）
  const trail = useMemo(() => {
    if (!appt) return [];
    const rows: { ts: number; title: string; sub: string }[] = [];
    if (appt.createdAt instanceof Date) {
      rows.push({
        ts: appt.createdAt.getTime(),
        // S4 落库即 confirmed；历史 pending 单（含客户改期回退）诚实标「预约创建」
        title: appt.status === 'pending' ? '预约创建' : '自动确认',
        sub: appt.status === 'pending' ? 'appointment.created' : 'appointment.confirmed · by=auto',
      });
      // 自动派单与建单同事务，createdAt 即其真实时间；商家改派无独立时间戳 → 不出行
      if (appt.assignSource === 'auto' && appt.staffId) {
        rows.push({
          ts: appt.createdAt.getTime(),
          title: `自动派单${staffName ? ` → ${staffName}` : ''}`,
          sub: 'appointment.assigned · by=auto',
        });
      }
    }
    if (appt.checkedInAt) {
      rows.push({ ts: appt.checkedInAt.getTime(), title: '到店核销', sub: 'appointment.checkedin' });
    }
    for (const s of steps) {
      if (s.doneAt) {
        rows.push({
          ts: s.doneAt.getTime(),
          title: `步骤更新 · ${stepName(s.stepKey)}`,
          sub: 'step_updated',
        });
      }
    }
    if (appt.completedAt) {
      rows.push({ ts: appt.completedAt.getTime(), title: '完成', sub: 'appointment.completed' });
    }
    return rows.sort((a, b) => a.ts - b.ts);
  }, [appt, steps, staffName]);

  /* ---------------- 三态：骨架 / 错误重试 / NOT_FOUND ---------------- */

  if (!aid || detailQuery.isPending) {
    return (
      <MainScaffold title="预约详情" sub="正在加载…" testid="appointment-detail">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex flex-col gap-3.5">
            <SkeletonPanel rows={6} />
            <SkeletonPanel rows={3} />
          </div>
          <div className="flex flex-col gap-3.5">
            <SkeletonPanel rows={6} />
            <SkeletonPanel rows={2} />
          </div>
        </div>
      </MainScaffold>
    );
  }

  if (detailQuery.isError || !appt) {
    const errCode = (detailQuery.error as unknown as { data?: { code?: string } } | null)?.data
      ?.code;
    const notFound = errCode === 'NOT_FOUND' || (!detailQuery.isError && !appt);
    return (
      <MainScaffold title="预约详情" sub={notFound ? '预约不存在' : '加载失败'}>
        <div className="u3-panel flex flex-col items-center px-6 py-12 text-center">
          {notFound ? (
            <CalendarX className="h-9 w-9 text-[rgba(74,59,46,.35)]" strokeWidth={1.5} />
          ) : (
            <CircleX className="h-9 w-9 text-[rgba(74,59,46,.35)]" strokeWidth={1.5} />
          )}
          <p className="mt-3 text-[14px] font-bold">
            {notFound ? '找不到这个预约' : '打不开这个预约'}
          </p>
          <p className="mt-1 text-[12px] text-[rgba(74,59,46,.62)]">
            {notFound
              ? '预约不存在或已被移除，回预约管理看看今天的单子。'
              : detailQuery.error instanceof Error
                ? detailQuery.error.message
                : '预约不存在或无权限'}
          </p>
          <div className="mt-4 flex items-center gap-2.5">
            {notFound ? (
              <LemonButton testid="detail-back" onClick={() => navigate('/appointments')}>
                返回预约管理
              </LemonButton>
            ) : (
              <>
                <QuietButton testid="detail-retry" onClick={() => void detailQuery.refetch()}>
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                    重新加载
                  </span>
                </QuietButton>
                <Link
                  to="/appointments"
                  className="u1-ring rounded-control bg-card px-4 py-2.5 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                >
                  返回预约管理
                </Link>
              </>
            )}
          </div>
        </div>
      </MainScaffold>
    );
  }

  /* ---------------- 派生数据 ---------------- */

  const durationMin = Math.max(
    0,
    Math.round((appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / 60_000),
  );
  const nights = Math.max(
    1,
    Math.round((appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / 86_400_000),
  );
  const timeLabel = isBoarding
    ? `${fmtDate(appt.scheduledStart)} – ${fmtDate(appt.scheduledEnd)}`
    : `${fmtDate(appt.scheduledStart)} ${fmtTime(appt.scheduledStart)}–${fmtTime(appt.scheduledEnd)}`;
  const durLabel = isBoarding ? `共 ${nights} 晚` : `约 ${durationMin} 分钟`;

  const srcLabel = assignSourceLabel(appt.assignSource);
  const vaccineExpired = pet?.vaccineValidUntil
    ? new Date(`${pet.vaccineValidUntil}T23:59:59`).getTime() < Date.now()
    : false;

  // 六步卡：锁定顺序渲染（未初始化的步 = 墨灰「未到」）
  const stepByKey = new Map(steps.map((s) => [s.stepKey, s]));
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const activeIdx = STEP_ROWS.findIndex((d) => stepByKey.get(d.key)?.status === 'active');
  const progressAside =
    appt.status === 'completed'
      ? '六步完成'
      : activeIdx >= 0
        ? `第 ${activeIdx + 1}/6 步 · 实时同步`
        : steps.length > 0
          ? `${doneCount}/6 步`
          : '等待到店核销';

  // 过程照墙：全步骤未失效照片按步序拍平
  const photoWall: ViewPhoto[] = steps.flatMap((s) =>
    s.photos.map((p) => ({
      id: p.id,
      url: p.url,
      thumbUrl: p.thumbUrl ?? undefined,
      takenAt: p.takenAt,
      tag: PHOTO_TAG_LABEL[p.tag] ?? undefined,
    })),
  );

  const live = appt.status === 'in_service' || appt.status === 'in_boarding';

  /* ---------------- 动作区（按态切换，每屏至多一个柠檬钮） ---------------- */

  const canReschedule = appt.status === 'pending' || appt.status === 'confirmed';
  // assign 服务端仅受理 pending/confirmed；寄养单不改派（无 staffId 口径）
  const canAssign = !isBoarding && canReschedule;
  const monitorable =
    appt.status === 'in_service' || appt.status === 'in_boarding' || appt.status === 'completed';
  const payable = appt.status === 'completed' && !appt.paidAt;

  const actions = (
    <>
      {canReschedule ? (
        <QuietButton testid="detail-reschedule" onClick={() => setRescheduleOpen(true)}>
          改期
        </QuietButton>
      ) : null}
      {canAssign ? (
        <QuietButton testid="detail-assign" onClick={() => setAssignOpen(true)}>
          {appt.staffId ? '改派' : '指派'}
        </QuietButton>
      ) : null}
      {monitorable ? (
        <QuietButton
          testid="detail-monitor"
          onClick={() => navigate(`/appointments/${appt.id}/monitor`)}
        >
          服务监视
        </QuietButton>
      ) : null}
      {appt.status === 'pending' ? (
        <LemonButton
          testid="detail-confirm"
          disabled={confirmMut.isPending}
          onClick={() => confirmMut.mutate()}
        >
          {confirmMut.isPending ? '确认中…' : '确认预约'}
        </LemonButton>
      ) : null}
      {appt.status === 'cancel_requested' ? (
        <LemonButton testid="detail-review-cancel" onClick={() => setReviewOpen(true)}>
          审批取消申请
        </LemonButton>
      ) : null}
      {payable ? (
        <LemonButton testid="detail-pay" onClick={() => setPayOpen(true)}>
          去收款 · <span className="u1-num">{fenToYuan(appt.priceFen)}</span>
        </LemonButton>
      ) : null}
    </>
  );

  /* ---------------- 渲染 ---------------- */

  return (
    <MainScaffold
      testid="appointment-detail"
      title={`${pet?.name ?? '宠物'} · ${service?.name ?? (isBoarding ? '寄养服务' : '洗护服务')}`}
      sub={
        <span>
          单号 <span className="u1-num">{appt.code}</span> · {timeLabel} · {durLabel}
        </span>
      }
      actions={actions}
    >
      {viewer ? (
        <PhotoViewer
          photos={viewer.photos}
          index={viewer.index}
          onClose={() => setViewer(null)}
          onNavigate={(i) => setViewer((v) => (v ? { ...v, index: i } : v))}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.6fr_1fr]">
        {/* 左栏：服务进度（洗护）/ 寄养信息（寄养）+ 事件轨迹 */}
        <div className="flex min-w-0 flex-col gap-3.5">
          {isBoarding ? (
            <BoardingPanel stay={detailQuery.data?.boardingStay ?? null} appt={appt} />
          ) : (
            <div className="u3-panel" data-testid="detail-progress">
              <div className="u3-panel-head">
                <h3>服务进度</h3>
                <span className="aside">{progressAside}</span>
              </div>
              <div className="u3-stepv px-[17px] pb-3.5 pt-1">
                {STEP_ROWS.map((def) => {
                  const row = stepByKey.get(def.key) ?? null;
                  const st = row?.status ?? 'locked';
                  const count = row?.photos.length ?? 0;
                  const small =
                    st === 'done'
                      ? `${row?.doneAt ? `${fmtTime(row.doneAt)} 完成` : '已完成'}${
                          count > 0 ? ` · ${count} 张照片` : ''
                        }`
                      : st === 'active'
                        ? `进行中 · 已传 ${count}/${row?.requiredPhotos ?? 0} 张${
                            row?.flagged ? ' · 已打标待重拍' : ''
                          }`
                        : '未到';
                  return (
                    <div
                      key={def.key}
                      className={`row ${st === 'done' ? 'done' : st === 'active' ? 'now' : ''}`}
                    >
                      {/* 试样同值锁定：done=纯薄荷圆点（无内嵌图标）/ now=柠檬 / 未到=描边 */}
                      <i className="dt flex items-center justify-center" />
                      <div className="tx">
                        <b>{def.name}</b>
                        <small>{small}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
              {photoWall.length > 0 ? (
                <div className="flex flex-wrap gap-[5px] px-[17px] pb-3.5">
                  {photoWall.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setViewer({ photos: photoWall, index: i })}
                      className="h-[42px] w-[56px] overflow-hidden rounded-[6px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] transition-transform duration-120 ease-philia-spring active:scale-95"
                      aria-label={`查看照片 ${i + 1}`}
                    >
                      <img
                        src={p.thumbUrl ?? p.url}
                        alt={p.tag ?? `过程照 ${i + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* 事件轨迹 */}
          <div className="u3-panel" data-testid="detail-trail">
            <div className="u3-panel-head">
              <h3>事件轨迹</h3>
              <span className="aside">事件即轨迹 · 按时间排序</span>
            </div>
            {trail.length === 0 ? (
              <p className="px-[17px] pb-4 text-[12px] text-[rgba(74,59,46,.42)]">
                暂无可展示的事件
              </p>
            ) : (
              <div className="u3-stepv px-[17px] pb-3.5 pt-1">
                {trail.map((t, i) => (
                  <div
                    key={`${t.ts}-${t.sub}-${i}`}
                    className={`row ${live && i === trail.length - 1 ? 'now' : 'done'}`}
                  >
                    <i className="dt" />
                    <div className="tx">
                      <b>
                        <span className="u1-num">{fmtTime(new Date(t.ts))}</span> {t.title}
                      </b>
                      <small>{t.sub}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右栏：预约信息 + 金额 */}
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="u3-panel" data-testid="detail-info">
            <div className="u3-panel-head">
              <h3>预约信息</h3>
            </div>
            <div className="px-[17px] pb-3.5">
              <FieldRow label="宠物">
                {pet
                  ? [
                      pet.name,
                      pet.breed ?? SPECIES_LABEL[pet.species] ?? null,
                      pet.weightKg !== null ? `${pet.weightKg}kg` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : '—'}
              </FieldRow>
              <FieldRow label="客户">
                {customerLabel(
                  detailQuery.data?.customer?.nickname,
                  detailQuery.data?.customer?.phoneTail,
                )}
              </FieldRow>
              <FieldRow label="员工">
                {appt.staffId
                  ? staffQuery.isPending
                    ? '加载中…'
                    : (staffName ?? '（已指派）')
                  : '未指派'}
                {appt.staffId && srcLabel ? (
                  <span className="u3-st wait ml-1.5">{srcLabel}</span>
                ) : null}
              </FieldRow>
              <FieldRow label="收款">
                {paymentModeLabel(appt.paymentMode)} ·{' '}
                <span className="u1-num">{fenToYuan(appt.priceFen)}</span> ·{' '}
                {appt.paidAt ? '已收' : '未收'}
              </FieldRow>
              <FieldRow label="疫苗">
                {pet?.vaccineValidUntil ? (
                  <span className={vaccineExpired ? 'text-[#D92D20]' : undefined}>
                    有效期至 {pet.vaccineValidUntil}
                    {vaccineExpired ? '（已过期）' : ' ✓'}
                  </span>
                ) : (
                  '未记录'
                )}
              </FieldRow>
              <FieldRow label="备注">{appt.note?.trim() ? appt.note : '无'}</FieldRow>
              {appt.status === 'cancelled' && (appt.cancelReason || appt.cancelSource) ? (
                <FieldRow label="取消信息">
                  {cancelSourceLabel(appt.cancelSource)}
                  {appt.cancelReason ? `：${appt.cancelReason}` : ''}
                </FieldRow>
              ) : null}
              {(appt.status === 'pending' || appt.status === 'confirmed') && !appt.checkedInAt ? (
                <FieldRow label="核销码">
                  <span className="u1-num tracking-[0.2em]">{appt.code}</span>
                  <span className="ml-2 text-[11px] font-normal text-[rgba(74,59,46,.42)]">
                    客户到店后由员工扫码或输入此码核销
                  </span>
                </FieldRow>
              ) : null}
            </div>
          </div>

          <div className="u3-panel" data-testid="detail-amount">
            <div className="u3-panel-head">
              <h3>金额</h3>
            </div>
            <div className="u3-kv">
              <div className="cell">
                <div className="cap">服务金额</div>
                <div className="v">{fenToYuan(appt.priceFen)}</div>
              </div>
              <div className="cell">
                <div className="cap">收款方式</div>
                <div className="mt-1 text-body-sm font-bold">
                  {paymentModeLabel(appt.paymentMode)}
                </div>
              </div>
              <div className="cell">
                <div className="cap">会员折扣</div>
                <div className="mt-1 text-body-sm font-bold">
                  {appt.paymentMode === 'pass_deduct' ? '次卡扣次' : '无'}
                </div>
              </div>
              <div className="cell">
                <div className="cap">状态</div>
                <div
                  className={`mt-1 text-body-sm font-bold ${payable ? 'text-[#D92D20]' : ''}`}
                >
                  {appt.paidAt ? '已收' : appt.status === 'completed' ? '待收款' : '未收'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 弹层：改派 / 改期 / 收款确认 / 审批取消 */}
      <AssignStaffSheet
        open={assignOpen}
        target={{
          id: appt.id,
          type: appt.type,
          scheduledStart: appt.scheduledStart,
          staffId: appt.staffId,
        }}
        onClose={() => setAssignOpen(false)}
        onAssigned={invalidateAll}
      />
      <RescheduleSheet
        open={rescheduleOpen}
        target={{
          id: appt.id,
          storeId: appt.storeId,
          serviceId: appt.serviceId,
          scheduledStart: appt.scheduledStart,
          type: appt.type,
          scheduledEnd: appt.scheduledEnd,
          petId: appt.petId,
        }}
        onClose={() => setRescheduleOpen(false)}
        onChanged={invalidateAll}
      />
      <ConfirmDialog
        open={payOpen}
        title="登记收款？"
        body={`${paymentModeLabel(appt.paymentMode)} · 应收 ${fenToYuan(appt.priceFen)}。登记后该预约转为「已收款」，不可撤销。`}
        confirmText={`确认收款 ${fenToYuan(appt.priceFen)}`}
        loading={markPaidMut.isPending}
        onConfirm={() => markPaidMut.mutate()}
        onCancel={() => setPayOpen(false)}
      />
      <Modal
        open={reviewOpen}
        title="审批取消申请"
        onClose={() => setReviewOpen(false)}
        widthClass="sm:max-w-md"
      >
        <p className="text-[12px] leading-relaxed text-[rgba(74,59,46,.62)]">
          客户在开始前 4 小时内申请取消该预约。批准后槽位立即释放并通知客户；拒绝后预约恢复为「已确认」。
        </p>
        {appt.cancelReason ? (
          <p className="mt-2.5 rounded-control bg-danger-light px-3.5 py-2.5 text-[12px] text-danger-deep">
            客户取消原因：{appt.cancelReason}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            disabled={reviewCancelMut.isPending}
            onClick={() => reviewCancelMut.mutate(false)}
            className="u1-ring h-11 flex-1 rounded-control bg-card text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            拒绝取消
          </button>
          <button
            type="button"
            disabled={reviewCancelMut.isPending}
            onClick={() => reviewCancelMut.mutate(true)}
            data-testid="detail-approve-cancel"
            className="h-11 flex-1 rounded-control bg-[#D92D20] text-body-sm font-bold text-[#FFFDF6] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
          >
            {reviewCancelMut.isPending ? '处理中…' : '批准取消'}
          </button>
        </div>
      </Modal>
    </MainScaffold>
  );
}

/** u3-field 字段行（88px 标签 + 值） */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="u3-field">
      <span className="lb">{label}</span>
      <span className="vl">{children}</span>
    </div>
  );
}

/** 寄养信息块（boardingStay 现成字段：房间/称重/物品/退住） */
function BoardingPanel({ stay, appt }: { stay: StayRow; appt: ApptRow }) {
  const nightsTotal = Math.max(
    1,
    Math.round((appt.scheduledEnd.getTime() - appt.scheduledStart.getTime()) / 86_400_000),
  );
  const nightNow = Math.min(
    nightsTotal,
    Math.max(1, Math.floor((Date.now() - appt.scheduledStart.getTime()) / 86_400_000) + 1),
  );
  const aside =
    appt.status === 'in_boarding' && stay
      ? `第 ${nightNow} 晚 · 共 ${nightsTotal} 晚`
      : appt.status === 'completed'
        ? '已退住'
        : undefined;
  const belongingsLabel =
    stay?.belongings && stay.belongings.length > 0
      ? stay.belongings.map((b) => (b.note ? `${b.name}（${b.note}）` : b.name)).join('、')
      : '无登记';

  return (
    <div className="u3-panel" data-testid="detail-boarding">
      <div className="u3-panel-head">
        <h3>寄养信息</h3>
        {aside ? <span className="aside">{aside}</span> : null}
      </div>
      {stay ? (
        <div className="px-[17px] pb-3.5">
          <FieldRow label="房间">{stay.roomNo ?? '未分配'}</FieldRow>
          <FieldRow label="入住称重">
            {stay.checkinWeightKg !== null ? `${stay.checkinWeightKg} kg` : '未记录'}
          </FieldRow>
          <FieldRow label="随身物品">{belongingsLabel}</FieldRow>
          <FieldRow label="退住">
            {stay.checkoutAt ? (
              <span className="u1-num">{fmtDateTime(stay.checkoutAt)}</span>
            ) : (
              '在住'
            )}
          </FieldRow>
        </div>
      ) : (
        <p className="px-[17px] pb-4 text-[12px] text-[rgba(74,59,46,.62)]">
          客户到店核销后，这里会登记房间、入住称重与随身物品。
        </p>
      )}
    </div>
  );
}

/** 加载骨架（禁转圈：纸面板 + 脉冲条） */
function SkeletonPanel({ rows }: { rows: number }) {
  return (
    <div className="u3-panel px-[17px] py-4">
      <div className="h-3.5 w-20 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.08)]" />
      <div className="mt-3.5 flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]"
            style={{ width: `${88 - (i % 3) * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}
