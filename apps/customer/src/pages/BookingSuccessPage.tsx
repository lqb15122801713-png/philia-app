import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { friendlyError, Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import BottomSheet from '@/components/booking/single/BottomSheet';
import { ErrorState } from '@/components/home/common';
import { APPT_TYPE_LABEL, dayLabel, fmtHM, fmtRange } from '@/components/booking/format';
import { agc, BOARDING_AGREEMENTS } from '@/copy/agreement';
import { bkc } from '@/copy/booking';
import { customerPetName } from '@/lib/customerPresentation';

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const aid = searchParams.get('aid') ?? '';
  const { trpc } = usePhiliaClient();
  const { toastEl, showToast } = useToast({ durationMs: 3200 });
  const [agreeSheetOpen, setAgreeSheetOpen] = useState(false);
  const [signedLocal, setSignedLocal] = useState(false);

  const signM = useMutation({
    mutationFn: async () => {
      await trpc.pay.signAgreement.mutate({ agreementKey: 'boarding_consent' });
      await trpc.pay.signAgreement.mutate({ agreementKey: 'medical_auth' });
    },
    onSuccess: () => {
      setSignedLocal(true);
      setAgreeSheetOpen(false);
      showToast('已签署留痕', 'info');
    },
    onError: (error) => showToast(friendlyError(error, '签署失败，请稍后再试'), 'error'),
  });

  const detailQ = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid }),
    enabled: aid.length > 0,
  });
  const detail = detailQ.data;

  if (!aid) {
    return (
      <div className="px-4 pb-32 pt-8">
        <ErrorState
          message={bkc('booking.missingParam')}
          action={
            <Link to="/appointments" className="flex min-h-11 items-center rounded-full bg-brand-cta px-6 text-body font-semibold text-brand-cta-on">
              {bkc('booking.viewAppointments')}
            </Link>
          }
        />
      </div>
    );
  }

  const petName = customerPetName(detail?.pet?.name, '毛孩子');
  const serviceName = detail ? (detail.service?.name ?? APPT_TYPE_LABEL[detail.appointment.type]) : '';
  const staffPreference = detail?.appointment.note?.match(/【希望洗护师：(.+?)】/)?.[1] ?? null;
  const timeLabel = detail
    ? detail.appointment.type === 'boarding'
      ? fmtRange(detail.appointment.scheduledStart, detail.appointment.scheduledEnd)
      : `${dayLabel(detail.appointment.scheduledStart)} ${fmtHM(detail.appointment.scheduledStart)}`
    : '';

  return (
    <div className="px-4 pb-32 pt-20" data-testid="u2-success">
      {toastEl}
      <header className="flex flex-col items-center text-center">
        <span className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">
          <span className="absolute left-1 top-5 h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <span className="absolute right-2 top-2 h-1 w-1 rounded-full bg-brand-secondary" />
          <span className="absolute bottom-3 left-4 h-1 w-1 rounded-full bg-brand-primary" />
          <span className="absolute bottom-5 right-3 h-1.5 w-1.5 rounded-full bg-brand-secondary" />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#71806F] text-[#FAF7F0]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </span>
        <h1 className="mt-4 text-[28px] font-semibold leading-9">{bkc('booking.successTitle')}</h1>
        <p className="mt-2 text-body text-ink-secondary">{detail ? `已为${petName}锁定档期` : '正在读取预约档期…'}</p>
      </header>

      {detail ? (
        <section className="mt-12 rounded-[24px] bg-card p-5 shadow-card" data-testid="u2-success-card">
          <h2 className="text-body-lg font-semibold">{petName} · {serviceName}</h2>
          <p className="mt-3 text-body text-ink-secondary">{timeLabel} · {detail.store?.name}</p>
          <p className="mt-2 text-body text-ink-secondary">美容师 · {staffPreference ?? '系统分配'}</p>
          <div className="my-5 border-t border-line-divider" />
          <div className="space-y-3">
            <Link
              to={`/appointments/${aid}/live`}
              data-testid="u2-success-process"
              className="flex h-12 w-full items-center justify-center rounded-full bg-brand-cta text-body-lg font-semibold text-brand-cta-on transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              查看服务过程
            </Link>
            <Link
              to="/home"
              data-testid="u2-success-done"
              className="flex h-12 w-full items-center justify-center rounded-full bg-sunken text-body-lg font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              完成
            </Link>
          </div>
        </section>
      ) : detailQ.isError ? (
        <div className="mt-12 rounded-[24px] bg-sunken px-4 py-6 text-center">
          <p className="text-caption text-ink-secondary">{bkc('booking.summaryLoadFail')}</p>
          <button type="button" onClick={() => void detailQ.refetch()} className="mt-3 min-h-11 px-4 text-caption font-semibold text-ink">
            重新加载
          </button>
        </div>
      ) : (
        <Skeleton className="mt-12 h-64 rounded-[24px]" />
      )}

      {detail && detail.appointment.type === 'boarding' ? (
        detail.appointment.medicalAuthJson?.agreed || signedLocal ? (
          <div data-testid="success-agreement-entry" data-signed="true" className="mt-5 flex items-center justify-between rounded-[16px] bg-sunken px-4 py-3">
            <span className="text-body text-ink-secondary">{bkc('booking.successSignEntry')}</span>
            <span className="rounded-full bg-line px-2 py-1 text-caption text-ink-secondary">{bkc('booking.signedBadge')}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAgreeSheetOpen(true)}
            data-testid="success-agreement-entry"
            data-signed="false"
            className="mt-5 flex min-h-12 w-full items-center justify-between rounded-[16px] bg-card px-4 py-3 text-left shadow-card"
          >
            <span className="text-body font-medium text-ink">{bkc('booking.successSignEntry')}</span>
            <span className="text-caption font-medium text-ink">{bkc('booking.successSignView')}</span>
          </button>
        )
      ) : null}

      {agreeSheetOpen ? (
        <BottomSheet title={bkc('booking.successSignEntry')} onClose={() => setAgreeSheetOpen(false)} testId="success-agreement-sheet">
          <p className="rounded-[8px] bg-sunken px-3 py-2 text-caption text-ink-secondary">{bkc('booking.signPendingNote')}</p>
          {BOARDING_AGREEMENTS.map((agreement) => (
            <div key={agreement.agreementKey} className="mt-4">
              <p className="text-body font-semibold">
                {agc(agreement.titleKey)}
                <span className="ml-2 text-caption text-ink-placeholder">{agc('agreement.versionNote', { version: agreement.version })}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-body-sm leading-6 text-ink">{agreement.content}</p>
            </div>
          ))}
          <button
            type="button"
            disabled={signM.isPending}
            onClick={() => signM.mutate()}
            data-testid="success-agreement-sign"
            className="mt-4 h-11 w-full rounded-full bg-brand-cta text-body-sm font-semibold text-brand-cta-on disabled:opacity-60"
          >
            {signM.isPending ? '提交中…' : agc('agreement.agreeCta')}
          </button>
        </BottomSheet>
      ) : null}
    </div>
  );
}
