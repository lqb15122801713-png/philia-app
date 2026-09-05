/**
 * 预约详情 /appointments/:id（T4.2 · 开发方案 §2.2）
 *
 * - 全字段：客户 / 宠物（品种/体重/疫苗/性格标签）/ 服务 / 时间 / 金额 / 收款方式 /
 *   备注 / 核销时间 / 人工码 / 支付状态。
 *   客户昵称：现有 merchant 可读接口（appointment.get / listForStore）均未返回 customer
 *   昵称（仅 boarding.stayBoard 对 in_boarding 单返回 customer），故非寄养在住单显示
 *   「客户·{id后4位}」兜底——已在汇报中标注，建议后续 appointment.get 补 customer 字段。
 * - 操作区按状态出按钮：
 *   pending → 确认预约 / 拒绝（说明见下）；confirmed → 指派员工 / 改期；
 *   cancel_requested → 批准取消 / 拒绝取消（二次确认）。
 *   「拒绝」(pending)：服务端当前无商家直接拒绝入口（reviewCancel 仅受理
 *   cancel_requested），实现为说明弹层（请客户自助取消或电话协商）+ 复制预约编号，
 *   不 ship 必然失败的调用；建议主代理评估放宽 reviewCancel 或新增 merchant cancel。
 * - 手动核销：checkin 为 staffProcedure，商家端不能调（会 FORBIDDEN）——
 *   confirmed 且未核销时展示提示卡：请员工扫码或在员工端输入 6 位人工码（展示人工码
 *   便于口头转告员工）。注释说明，不提供按钮。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, ChevronLeft, ClipboardCopy, Info, MonitorPlay, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fenToYuan,
  fmtDate,
  fmtDateTime,
  fmtDateWeek,
  fmtTime,
  paymentModeLabel,
  statusBadge,
  statusLabel,
} from '../components/appointments/appt-utils';
import { AssignStaffSheet } from '../components/appointments/AssignStaffSheet';
import { ConfirmDialog } from '../components/appointments/ConfirmDialog';
import { Modal } from '../components/appointments/Modal';
import { RescheduleSheet } from '../components/appointments/RescheduleSheet';
import { showToast, ToastHost } from '../components/appointments/Toast';

const SPECIES_LABEL: Record<string, string> = { dog: '狗狗', cat: '猫咪', other: '其他' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-caption text-ink-secondary">{label}</span>
      <span className="text-right text-body text-ink">{children}</span>
    </div>
  );
}

export default function AppointmentDetailPage() {
  const { id: aid } = useParams<{ id: string }>();
  const { trpc, queryClient } = usePhiliaClient();

  const detailQuery = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid! }),
    enabled: !!aid,
  });
  const appt = detailQuery.data?.appointment;
  const pet = detailQuery.data?.pet;
  const service = detailQuery.data?.service;

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

  // 寄养在住单：stayBoard 带 customer 昵称/电话（merchant 唯一可读客户信息的入口）
  const stayBoardQuery = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
    enabled: !!appt && appt.type === 'boarding' && appt.status === 'in_boarding',
  });
  const boardEntry = useMemo(
    () => stayBoardQuery.data?.board.find((b) => b.appointment.id === aid) ?? null,
    [stayBoardQuery.data, aid],
  );
  const customerDisplay = boardEntry?.customer.nickname?.trim()
    ? boardEntry.customer.nickname
    : appt
      ? `客户·${appt.customerId.slice(-4)}`
      : '—';

  /* ---------------- 操作 ---------------- */

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointment'] });
    void queryClient.invalidateQueries({ queryKey: ['store', 'dashboardStats'] });
  };

  const [assignOpen, setAssignOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveCancelOpen, setApproveCancelOpen] = useState(false);
  const [rejectCancelOpen, setRejectCancelOpen] = useState(false);

  const confirmMut = useMutation({
    mutationFn: () => trpc.appointment.confirm.mutate({ appointmentId: aid! }),
    onSuccess: () => {
      showToast('已确认预约', 'success');
      invalidate();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : '确认失败，请稍后再试', 'error'),
  });

  const reviewCancelMut = useMutation({
    mutationFn: (approve: boolean) =>
      trpc.appointment.reviewCancel.mutate({ appointmentId: aid!, approve }),
    onSuccess: (r) => {
      showToast(r.approved ? '已批准取消，槽位已释放' : '已拒绝取消，预约维持有效', 'success');
      setApproveCancelOpen(false);
      setRejectCancelOpen(false);
      invalidate();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : '操作失败，请稍后再试', 'error'),
  });

  /* ---------------- 渲染 ---------------- */

  if (detailQuery.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">加载中…</p>
      </div>
    );
  }

  if (detailQuery.isError || !appt) {
    return (
      <div className="px-4 py-6">
        <BackLink />
        <div className="mt-4 rounded-card bg-card px-6 py-12 text-center shadow-card">
          <p className="text-title">打不开这个预约</p>
          <p className="mt-2 text-body text-ink-secondary">
            {detailQuery.error instanceof Error ? detailQuery.error.message : '预约不存在或无权限'}
          </p>
        </div>
      </div>
    );
  }

  const monitorable =
    appt.status === 'in_service' || appt.status === 'in_boarding' || appt.status === 'completed';
  const steps = detailQuery.data?.steps ?? [];
  const stepsDone = steps.filter((s) => s.status === 'done').length;
  const vaccineExpired = pet?.vaccineValidUntil
    ? new Date(`${pet.vaccineValidUntil}T23:59:59`).getTime() < Date.now()
    : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 lg:px-6">
      <ToastHost />
      <BackLink />

      {/* 头部：服务 + 状态 + 金额 */}
      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-title-lg">{service?.name ?? '预约详情'}</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">
            {appt.type === 'boarding' ? '寄养服务' : '洗护服务'} · 编号 {appt.id.slice(-8)}
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-tag px-1.5 py-0.5 text-caption ${statusBadge(appt.status)}`}>
            {statusLabel(appt.status)}
          </span>
          <p className="mt-1 font-number text-price text-ink">{fenToYuan(appt.priceFen)}</p>
        </div>
      </div>

      {/* 预约信息 */}
      <section className="mt-3 rounded-card bg-card px-4 py-2 shadow-card">
        <h2 className="pt-2 text-title">预约信息</h2>
        <div className="divide-y divide-line-divider pb-2">
          <Field label="时间">
            <span className="font-number">
              {fmtDateWeek(appt.scheduledStart)} {fmtTime(appt.scheduledStart)}
              {' - '}
              {appt.type === 'boarding' ? fmtDate(appt.scheduledEnd) : fmtTime(appt.scheduledEnd)}
            </span>
          </Field>
          <Field label="客户">{customerDisplay}</Field>
          <Field label="员工">{staffName ?? (appt.staffId ? '（已指派）' : '未指派')}</Field>
          <Field label="收款方式">
            {paymentModeLabel(appt.paymentMode)}
            {appt.paidAt ? (
              <span className="ml-2 rounded-tag bg-success-light px-1.5 py-0.5 text-caption text-success-deep">
                已收款 {appt.paidFen !== null ? fenToYuan(appt.paidFen) : ''}
              </span>
            ) : appt.status === 'completed' ? (
              <span className="ml-2 rounded-tag bg-danger-light px-1.5 py-0.5 text-caption text-danger-deep">
                待收款
              </span>
            ) : null}
          </Field>
          {appt.note ? <Field label="备注">{appt.note}</Field> : null}
          <Field label="核销时间">
            {appt.checkedInAt ? (
              <span className="font-number">{fmtDateTime(appt.checkedInAt)}</span>
            ) : (
              '未核销'
            )}
          </Field>
          {appt.completedAt ? (
            <Field label="完成时间">
              <span className="font-number">{fmtDateTime(appt.completedAt)}</span>
            </Field>
          ) : null}
          {appt.status === 'pending' || appt.status === 'confirmed' ? (
            <Field label="人工码">
              <span className="font-number tracking-widest">{appt.code}</span>
            </Field>
          ) : null}
        </div>
      </section>

      {/* 宠物信息 */}
      {pet ? (
        <section className="mt-3 rounded-card bg-card px-4 py-2 shadow-card">
          <h2 className="pt-2 text-title">宠物信息</h2>
          <div className="divide-y divide-line-divider pb-2">
            <Field label="昵称">{pet.name}</Field>
            <Field label="品种">
              {SPECIES_LABEL[pet.species] ?? pet.species}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </Field>
            <Field label="体重">{pet.weightKg !== null ? `${pet.weightKg} kg` : '未记录'}</Field>
            <Field label="疫苗">
              {pet.vaccineValidUntil ? (
                <span className={vaccineExpired ? 'text-danger-deep' : ''}>
                  有效期至 {pet.vaccineValidUntil}
                  {vaccineExpired ? '（已过期）' : ''}
                </span>
              ) : (
                '未记录'
              )}
            </Field>
            <Field label="性格标签">
              {pet.temperamentTags && pet.temperamentTags.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {pet.temperamentTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-tag bg-brand-secondary-light px-1.5 py-0.5 text-caption text-ink"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              ) : (
                '未设置'
              )}
            </Field>
          </div>
        </section>
      ) : null}

      {/* 服务进度入口 */}
      {monitorable ? (
        <Link
          to={`/appointments/${appt.id}/monitor`}
          className="mt-3 flex items-center justify-between rounded-card bg-card px-4 py-3 shadow-card transition-colors hover:bg-sunken"
        >
          <span className="flex items-center gap-2 text-body font-semibold text-ink">
            <MonitorPlay className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
            {appt.type === 'boarding'
              ? '寄养监视'
              : steps.length > 0
                ? `服务监视 · 六步进度 ${stepsDone}/6`
                : '服务监视'}
          </span>
          <ChevronLeft className="h-4 w-4 rotate-180 text-ink-secondary" strokeWidth={1.5} />
        </Link>
      ) : null}

      {/* 操作区（按状态出按钮） */}
      {appt.status === 'pending' ? (
        <section className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={confirmMut.isPending}
            onClick={() => confirmMut.mutate()}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-primary text-body font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
          >
            <Check className="h-5 w-5" strokeWidth={1.5} />
            {confirmMut.isPending ? '确认中…' : '确认预约'}
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            className="h-11 flex-1 rounded-full border border-danger text-body font-semibold text-danger-deep transition-colors hover:bg-danger-light"
          >
            拒绝
          </button>
        </section>
      ) : null}

      {appt.status === 'confirmed' ? (
        <section className="mt-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-primary text-body font-semibold text-white transition-colors hover:bg-brand-primary-hover"
            >
              <UserCheck className="h-5 w-5" strokeWidth={1.5} />
              {appt.staffId ? '改派员工' : '指派员工'}
            </button>
            <button
              type="button"
              onClick={() => setRescheduleOpen(true)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-brand-primary text-body font-semibold text-brand-primary transition-colors hover:bg-brand-primary-light"
            >
              <CalendarClock className="h-5 w-5" strokeWidth={1.5} />
              改期
            </button>
          </div>
          {/* 手动核销说明：checkin 为 staffProcedure，商家端调用会被 FORBIDDEN，
              故仅提示员工侧操作路径并展示 6 位人工码便于转告（任务规格） */}
          {!appt.checkedInAt ? (
            <div className="flex items-start gap-2 rounded-card border border-line bg-card px-3 py-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={1.5} />
              <p className="text-caption text-ink-secondary">
                客户到店后，请员工扫码核销，或在员工端手动输入 6 位人工码
                <span className="mx-1 font-number font-semibold tracking-widest text-ink">
                  {appt.code}
                </span>
                完成核销（商家端无核销权限）。
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {appt.status === 'cancel_requested' ? (
        <section className="mt-4">
          <p className="mb-2 text-caption text-ink-secondary">
            客户已申请取消该预约（开始前 4 小时内），请审核：
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setApproveCancelOpen(true)}
              className="h-11 flex-1 rounded-full bg-danger text-body font-semibold text-white transition-colors hover:opacity-90"
            >
              批准取消
            </button>
            <button
              type="button"
              onClick={() => setRejectCancelOpen(true)}
              className="h-11 flex-1 rounded-full border border-line text-body font-semibold text-ink transition-colors hover:bg-sunken"
            >
              拒绝取消
            </button>
          </div>
        </section>
      ) : null}

      {/* 弹层 */}
      <AssignStaffSheet
        open={assignOpen}
        target={
          appt
            ? {
                id: appt.id,
                type: appt.type,
                scheduledStart: appt.scheduledStart,
                staffId: appt.staffId,
              }
            : null
        }
        onClose={() => setAssignOpen(false)}
        onAssigned={invalidate}
      />
      <RescheduleSheet
        open={rescheduleOpen}
        target={
          appt
            ? {
                id: appt.id,
                storeId: appt.storeId,
                serviceId: appt.serviceId,
                scheduledStart: appt.scheduledStart,
              }
            : null
        }
        onClose={() => setRescheduleOpen(false)}
        onChanged={invalidate}
      />
      <ConfirmDialog
        open={approveCancelOpen}
        title="批准取消该预约？"
        body="取消后槽位将立即释放，客户会收到取消通知。此操作不可撤销。"
        confirmText="批准取消"
        danger
        loading={reviewCancelMut.isPending}
        onConfirm={() => reviewCancelMut.mutate(true)}
        onCancel={() => setApproveCancelOpen(false)}
      />
      <ConfirmDialog
        open={rejectCancelOpen}
        title="拒绝客户的取消申请？"
        body="拒绝后预约恢复为「已确认」，客户会收到通知；请提前与客户电话沟通，避免到店纠纷。"
        confirmText="拒绝取消"
        loading={reviewCancelMut.isPending}
        onConfirm={() => reviewCancelMut.mutate(false)}
        onCancel={() => setRejectCancelOpen(false)}
      />

      {/* pending「拒绝」说明弹层：服务端暂无商家直接拒绝入口（reviewCancel 仅受理
          cancel_requested；cancel 为 customerProcedure）。引导客户自助取消（开始前 >4h
          免费）或电话协商，避免 ship 必然失败的调用。待服务端补充入口后替换为真操作。 */}
      <Modal open={rejectOpen} title="拒绝该预约" onClose={() => setRejectOpen(false)}>
        <p className="text-body text-ink-secondary">
          当前版本暂不支持商家直接拒绝新预约。建议：
        </p>
        <ul className="mt-2 list-inside list-disc text-body text-ink-secondary">
          <li>电话联系客户，请其在客户端自助取消（服务开始前 4 小时免费取消）；</li>
          <li>4 小时内客户取消将转为「取消申请」，届时可在本页审核并批准。</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(appt.id)
              .then(() => showToast('预约编号已复制', 'success'))
              .catch(() => showToast('复制失败，请手动记录编号', 'error'));
            setRejectOpen(false);
          }}
          className="mt-4 flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-brand-primary text-body font-semibold text-white transition-colors hover:bg-brand-primary-hover"
        >
          <ClipboardCopy className="h-5 w-5" strokeWidth={1.5} />
          复制预约编号
        </button>
      </Modal>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/appointments"
      className="inline-flex items-center gap-0.5 text-caption text-ink-secondary"
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
      预约管理
    </Link>
  );
}
