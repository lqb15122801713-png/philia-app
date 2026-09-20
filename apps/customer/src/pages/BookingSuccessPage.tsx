/**
 * 预约成功页（T2.2）：/booking/success?aid=
 * - BookingCode：getCode → 本地 QRCode.toDataURL 渲染（滚动时间窗每 60s 检查跨窗自动刷新，
 *   5 分钟粒度防截图；实现见 components/booking/BookingCode.tsx 头注）
 * - 「添加到日历」生成 .ics 下载；「查看我的预约」入口。
 *
 * W1-D1 死胡同修复（补丁③四件套 + 导航闭环，UI 自装不评审）：
 * ① 单据摘要卡（服务/门店/宠物/时间，复用 appointment.get 现有口径）；
 * ② 核销码区（保留为工作文档形态：确认页是工作文档不是收据）；
 * ③ 双出口：「查看我的预约」（柠檬主钮）+「返回首页」（细线白底次钮）；
 * ④ 改期快捷入口：真实落点=/appointments/:id 详情页改期面板（pending/confirmed
 *    且距开始 >4h 时详情页显示改期，见 AppointmentDetailPage 头注），不造假钮；
 * ⑤ 导航闭环：PageHeader 返回键（to="/home" 固定落点 + W1-D3 直访兜底）——封闭≠困死。
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import PageHeader from '@/components/PageHeader';
import BookingCode from '@/components/booking/BookingCode';
import { ErrorState } from '@/components/home/common';
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
      <div className="px-4 py-6">
        {/* W1-D1：异常分支同样导航闭环（返回键 + 明确出口）；
            W1 退回修：链接形出口按钮化（唯一动作=柠檬主钮回列表） */}
        <PageHeader title="预约成功" to="/home" />
        <div className="mt-4">
          <ErrorState
            message="缺少预约参数"
            action={
              <Link
                to="/appointments"
                className="flex min-h-[44px] items-center rounded-full bg-brand-primary px-5 py-2 text-caption font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                查看我的预约
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* W1-D1 导航闭环：返回键（固定落点 /home；直访兜底同）——交易成功页不回已消耗的下单页 */}
      <PageHeader title="预约成功" to="/home" />
      <div className="flex flex-col items-center pt-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-success-deep" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        {/* 视觉主标（页首 h1 在 PageHeader 返回条，避免双 h1） */}
        <p className="mt-3 text-title-lg">预约成功</p>
        {/* 批次 S4：免商家确认——create 落库即 confirmed */}
        <p className="mt-1 text-body text-ink-secondary">已自动确认，请按时到店并出示预约码</p>
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

      {/* W1-D1 ③双出口：主=查看我的预约（柠檬，唯一主动作）；次=返回首页（细线白底）。
          ④改期快捷入口：真实落点=/appointments/:id 详情页改期面板（不造假钮） */}
      <div className="mt-5 space-y-2.5">
        <Link
          to="/appointments"
          className="flex h-12 w-full items-center justify-center rounded-full bg-brand-primary text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          查看我的预约
        </Link>
        <Link
          to="/home"
          className="u1-ring flex h-12 w-full items-center justify-center rounded-full bg-card text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          返回首页
        </Link>
        <button
          type="button"
          onClick={addToCalendar}
          disabled={!d}
          className="u1-ring flex h-12 w-full items-center justify-center gap-2 rounded-full bg-card text-body font-medium text-ink-secondary transition active:scale-[0.99] disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-primary" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
          </svg>
          添加到日历
        </button>
        <Link
          to={`/appointments/${aid}`}
          className="flex w-full items-center justify-center gap-1 py-2 text-caption font-medium text-ink-secondary underline-offset-2 hover:underline"
        >
          需要改期？前往预约详情改期 ›
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
