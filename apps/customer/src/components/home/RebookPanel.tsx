/**
 * B9a 任务 B · 首页主区常态面板 —— 一键再约（有 B4-3 下单记忆时）。
 *
 * 预填摘要四行（B4-3 记忆解析，与单屏同源）：宠物 / 服务（含约 N 分钟）/ 门店 /
 * 时间=最早可约槽（getWithServices 时长连续过滤后的首个未满槽，+8 规范时区 +1h 缓冲，
 * 与单屏栅格同一数据源同一口径，前端取 min(slotStart)，零新接口）。
 *
 * CTA「预约并支付 · ¥X」单次点击直接提交：appointment.create 现入参不动，
 * 与单屏同一组字段（storeId/petId/serviceId/type=grooming/scheduledStart/paymentMode，
 * 无备注故不带 note）；paymentMode 口径同单屏默认——本人该店有可用次卡则 pass_deduct，
 * 否则 pay_at_store（面板脚注明示收款方式，涉钱可知情）。
 * 成功进既有 /booking/success?aid=（同单屏），并回写 B4-3 下单记忆。
 *
 * 幂等：提交中禁用 CTA + submittingRef 同步锁（同一事件循环内的双击也被吞），
 * 快速重试不产生重复单。服务端 create 现状无幂等键（本批不动服务端，已如实上报）。
 *
 * 视觉（设计语言规格 v3 减法）：去卡片化 hairline 分隔、阴影近零（仅 CTA 允许
 * shadow-philia 浮起）、无彩色图标底块、圆角 rounded-card(16∈14~18)、全屏唯一
 * accent 色块 = CTA（柠檬黄底 + 深棕墨字，on-primary 深棕墨，不用反白字）。
 */

import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import { friendlyError, useToast } from '@/components/booking/Toast';
import { dayLabel, fenToYuan, fmtHM } from '@/components/booking/format';
import { writeLastBooking } from '@/lib/bookingPrefill';

export interface RebookPanelProps {
  storeId: string;
  storeName: string;
  serviceId: string;
  serviceName: string;
  priceFen: number;
  durationMin: number | null;
  petId: string;
  petName: string;
  /** 最早可约槽（服务端已过滤 +1h 缓冲/满槽/时长连续） */
  slot: Date;
  paymentMode: 'pay_at_store' | 'pass_deduct';
  /** 次卡剩余次数（paymentMode=pass_deduct 时展示；否则 null） */
  passRemainTimes: number | null;
}

export default function RebookPanel({
  storeId,
  storeName,
  serviceId,
  serviceName,
  priceFen,
  durationMin,
  petId,
  petName,
  slot,
  paymentMode,
  passRemainTimes,
}: RebookPanelProps) {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();
  /** 幂等同步锁：disabled 等渲染间隙内的连击也只会放行第一次提交 */
  const submittingRef = useRef(false);

  const createM = useMutation({
    mutationFn: () =>
      // appointment.create 现入参不动：与单屏 ConfirmBar 提交同字段同口径
      trpc.appointment.create.mutate({
        storeId,
        petId,
        serviceId,
        type: 'grooming',
        scheduledStart: slot,
        paymentMode,
      }),
    onSuccess: (appt) => {
      writeLastBooking({ storeId, serviceId, petId });
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      void queryClient.invalidateQueries({ queryKey: ['pass'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => {
      showToast(friendlyError(err, '预约失败，请稍后再试'));
      // 满槽/冲突：刷新槽位数据（最早可约槽随之重算；无可约槽时面板按规则降级）
      void queryClient.invalidateQueries({ queryKey: ['store', 'getWithServices'] });
    },
    onSettled: () => {
      submittingRef.current = false;
    },
  });

  const submitting = createM.isPending;
  const onQuickBook = () => {
    if (submittingRef.current) return; // 双击/快速重试：仅首击生效
    submittingRef.current = true;
    createM.mutate();
  };

  const adjustTarget = `/booking/grooming?storeId=${encodeURIComponent(storeId)}&serviceId=${encodeURIComponent(serviceId)}&petId=${encodeURIComponent(petId)}`;
  const ROW = 'flex items-baseline justify-between gap-3 py-2';
  const HAIRLINE = 'border-t border-[rgba(74,59,46,.09)]';

  return (
    <section
      data-testid="home-rebook-panel"
      className="rounded-card border border-[rgba(74,59,46,.09)] bg-card p-4"
      aria-label="一键再约"
    >
      {toastEl}
      <div className="flex items-baseline justify-between">
        <h2 className="text-title">一键再约</h2>
        <Link
          to={adjustTarget}
          data-testid="home-rebook-adjust"
          className="text-caption font-medium text-brand-primary"
        >
          调整服务或时间 ›
        </Link>
      </div>

      {/* 预填摘要四行（B4-3 记忆）：宠物 / 服务 / 门店 / 时间=最早可约槽 */}
      <dl className={`mt-2 ${HAIRLINE}`}>
        <div className={ROW}>
          <dt className="shrink-0 text-caption text-ink-secondary">宠物</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-pet">
            {petName}
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">服务</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-service">
            {serviceName}
            <span className="ml-1.5 text-caption font-normal text-ink-secondary">
              约 {durationMin ?? 60} 分钟
            </span>
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">门店</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-store">
            {storeName}
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">时间</dt>
          <dd
            className="truncate text-body font-semibold font-number"
            data-testid="home-rebook-slot"
            data-slot-start={slot.getTime()}
          >
            {dayLabel(slot)} {fmtHM(slot)}
            <span className="ml-1.5 text-caption font-normal text-ink-secondary">最早可约</span>
          </dd>
        </div>
      </dl>

      {/* 收款方式脚注（涉钱知情：与单屏 paymentMode 默认口径一致） */}
      <p className="mt-1 text-caption text-ink-secondary" data-testid="home-rebook-payment">
        收款方式：
        {paymentMode === 'pass_deduct'
          ? `次卡扣 1 次${passRemainTimes !== null ? `（余 ${passRemainTimes} 次）` : ''}`
          : '到店付'}
      </p>

      {/* 全屏唯一 accent：一键提交 CTA（提交中禁用，幂等） */}
      <button
        type="button"
        onClick={onQuickBook}
        disabled={submitting}
        data-testid="home-rebook-cta"
        data-state={submitting ? 'submitting' : 'ready'}
        data-slot-start={slot.getTime()}
        data-payment-mode={paymentMode}
        className={`mt-3 h-12 w-full rounded-card text-body font-semibold transition-transform duration-120 ease-philia-spring ${
          submitting
            ? 'cursor-not-allowed bg-line text-ink-placeholder'
            : 'bg-brand-primary text-ink shadow-philia active:scale-92'
        }`}
      >
        {submitting ? '提交中…' : `预约并支付 · ${fenToYuan(priceFen)}`}
      </button>
    </section>
  );
}
