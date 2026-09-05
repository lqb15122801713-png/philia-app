/**
 * 预约成功页（T2.2）：/booking/success?aid=
 * - BookingCode：getCode → 本地 QRCode.toDataURL 渲染（滚动时间窗每 60s 检查跨窗自动刷新，
 *   5 分钟粒度防截图；实现见 components/booking/BookingCode.tsx 头注）
 * - 「添加到日历」生成 .ics 下载；「查看我的预约」入口。
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import BookingCode from '@/components/booking/BookingCode';
import { APPT_TYPE_LABEL, fmtDateTime, fmtHM, fmtMD, fmtRange, weekCN } from '@/components/booking/format';

/** 生成 ICS 日历文件内容（本地时间浮点格式，免时区歧义） */
function buildIcs(opts: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
}): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//philia//booking//CN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@philia`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(opts.start)}`,
    `DTEND:${stamp(opts.end)}`,
    `SUMMARY:${esc(opts.title)}`,
    `LOCATION:${esc(opts.location)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const aid = searchParams.get('aid') ?? '';
  const { trpc } = usePhiliaClient();

  const detailQ = useQuery({
    queryKey: ['appointment', 'get', aid],
    queryFn: () => trpc.appointment.get.query({ appointmentId: aid }),
    enabled: aid.length > 0,
  });
  const d = detailQ.data;

  const addToCalendar = () => {
    if (!d) return;
    const { appointment: appt, service, store, pet } = d;
    const ics = buildIcs({
      uid: appt.id,
      title: `菲丽亚宠物 · ${service?.name ?? APPT_TYPE_LABEL[appt.type] ?? '预约'}`,
      start: appt.scheduledStart,
      end: appt.scheduledEnd,
      location: [store?.name, store?.address].filter(Boolean).join(' '),
      description: `宠物：${pet?.name ?? ''} 人工核销码：${appt.code}`,
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `philia-预约-${fmtMD(appt.scheduledStart)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!aid) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-body text-ink-secondary">缺少预约参数</p>
        <Link to="/appointments" className="mt-4 inline-block text-brand-primary">查看我的预约</Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex flex-col items-center pt-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#649160" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="mt-3 text-title-lg">预约成功</h1>
        <p className="mt-1 text-body text-ink-secondary">门店确认后会通知你，请留意预约状态</p>
      </div>

      {/* 预约摘要 */}
      {d ? (
        <section className="mt-5 rounded-card bg-card p-4 shadow-card">
          <dl className="space-y-1.5 text-body">
            <div className="flex justify-between">
              <dt className="text-ink-secondary">服务</dt>
              <dd className="font-medium">{d.service?.name ?? APPT_TYPE_LABEL[d.appointment.type]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">门店</dt>
              <dd>{d.store?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">宠物</dt>
              <dd>{d.pet?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-secondary">时间</dt>
              <dd className="font-number">
                {d.appointment.type === 'boarding'
                  ? fmtRange(d.appointment.scheduledStart, d.appointment.scheduledEnd)
                  : `${fmtDateTime(d.appointment.scheduledStart)} - ${fmtHM(d.appointment.scheduledEnd)}`}
              </dd>
            </div>
          </dl>
        </section>
      ) : detailQ.isError ? (
        <div className="mt-5 rounded-card bg-sunken px-4 py-6 text-center">
          <p className="text-caption text-ink-secondary">预约摘要加载失败</p>
          <button
            type="button"
            onClick={() => void detailQ.refetch()}
            className="mt-2 text-caption font-semibold text-brand-primary"
          >
            重新加载
          </button>
        </div>
      ) : (
        <div className="mt-5 h-32 animate-pulse rounded-card bg-sunken" />
      )}

      {/* 预约码（滚动时间窗二维码 + 人工核销码） */}
      <section className="mt-5 rounded-card bg-card p-5 shadow-card">
        <h2 className="text-center text-title">到店核销码</h2>
        <div className="mt-3">
          <BookingCode appointmentId={aid} />
        </div>
      </section>

      {/* 动作 */}
      <div className="mt-5 space-y-2.5">
        <button
          type="button"
          onClick={addToCalendar}
          disabled={!d}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-card text-body font-semibold text-ink shadow-card transition active:scale-[0.99] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D98E5F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          添加到日历
        </button>
        <Link
          to="/appointments"
          className="flex h-12 w-full items-center justify-center rounded-full bg-philia-gradient text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          查看我的预约
        </Link>
      </div>

      {d ? (
        <p className="mt-4 text-center text-caption text-ink-placeholder">
          {weekCN(d.appointment.scheduledStart)}见 · 如需取消请提前 4 小时
        </p>
      ) : null}
    </div>
  );
}
