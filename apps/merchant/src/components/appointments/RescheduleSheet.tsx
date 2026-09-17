/**
 * 改期弹层（T4.2；U3 任务 E 追加寄养分支 + U3 视觉件）：
 * - 洗护：日期 + 30min 时间槽（store.getWithServices 未来 7 天可约槽；petId 传入时
 *   「时长连续」过滤走 9a 引擎口径，与服务端 reschedule 的时长引擎同准）；
 * - 寄养（B3-4）：两阶段日期（先入住日、后退房日），boardingAvailability 逐晚余量
 *   禁选满房晚；提交必传 scheduledStart+scheduledEnd（入/退房时刻按门店开店时间
 *   向上对齐 30min——与客户端 BoardingDateRangePicker checkinAt 同口径，服务端强校验）。
 * 服务端强校验：未来时间（+1h 缓冲）/ 30min 对齐 / 营业时间 / 容量（冲突 CONFLICT 原文 toast）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from './Modal';
import {
  addDays,
  dayKeyOf,
  dayStart,
  fmtDate,
  fmtDateTime,
  fmtDateWeek,
  fmtTime,
  localDayKey,
  type SlotItem,
} from './appt-utils';

export interface RescheduleTarget {
  id: string;
  storeId: string;
  serviceId: string;
  scheduledStart: Date;
  /** U3 任务 E：寄养分支判定（缺省 = 洗护，兼容旧调用方） */
  type?: string;
  /** 寄养单当前退房时间（展示用） */
  scheduledEnd?: Date | null;
  /** 洗护单宠物 ID：可约槽过滤用引擎时长（与服务端 reschedule 同口径） */
  petId?: string | null;
}

/** B3-5（W-2 统一口径）：入住/改期时刻落在「当前时间 +1h 缓冲」内禁选 */
const LEAD_BUFFER_MS = 60 * 60 * 1000;
/** 入住/退房可选天数（各自自其起点起算，与客户端寄养向导一致） */
const BOARDING_PICK_DAYS = 14;

const WEEK_CHARS = ['日', '一', '二', '三', '四', '五', '六'] as const;
const weekCN = (d: Date): string => `周${WEEK_CHARS[d.getDay()]}`;
const fmtMD = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}`;

type OpenHoursLike =
  | Partial<Record<string, { open: string; close: string } | null>>
  | null
  | undefined;

/** 门店某日是否休息 */
const isClosedDay = (oh: OpenHoursLike, d: Date): boolean => !oh?.[dayKeyOf(d)];

/** 入住/退房时刻：当日开店时间，向上对齐 30min 粒度（服务端强校验同线） */
function boardingAlign(oh: OpenHoursLike, d: Date): Date {
  const hours = oh?.[dayKeyOf(d)];
  const [hh = 10, mm = 0] = (hours?.open ?? '10:00').split(':').map(Number);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
  const rem = t.getMinutes() % 30;
  if (rem !== 0) t.setMinutes(t.getMinutes() + (30 - rem));
  return t;
}

export function RescheduleSheet({
  open,
  target,
  onClose,
  onChanged,
}: {
  open: boolean;
  target: RescheduleTarget | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotItem | null>(null);
  // 寄养分支：入住日 / 退房日（两阶段，先入住后退房）
  const [checkin, setCheckin] = useState<Date | null>(null);
  const [checkout, setCheckout] = useState<Date | null>(null);

  const isBoarding = target?.type === 'boarding';

  const slotsQuery = useQuery({
    queryKey: ['store', 'getWithServices', target?.storeId, target?.serviceId, target?.petId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: target!.storeId,
        serviceId: target!.serviceId,
        ...(target?.petId ? { petId: target.petId } : {}),
      }),
    enabled: open && !!target,
  });
  const store = slotsQuery.data?.store ?? null;

  // 寄养逐晚余量（现成接口 store.boardingAvailability，上限 31 晚）
  const availQuery = useQuery({
    queryKey: ['store', 'boardingAvailability', target?.storeId, target?.serviceId],
    queryFn: () => {
      const from = dayStart(new Date());
      return trpc.store.boardingAvailability.query({
        storeId: target!.storeId,
        from,
        to: addDays(from, 28),
      });
    },
    enabled: open && !!target && isBoarding,
  });
  const remByNight = useMemo(() => {
    const data = availQuery.data;
    const svc = data?.services.find((s) => s.serviceId === target?.serviceId);
    const m = new Map<string, number>();
    if (data && svc) data.nights.forEach((n, i) => m.set(n, svc.remaining[i] ?? 0));
    return m;
  }, [availQuery.data, target?.serviceId]);
  /** 余量未回时按可约放行（服务端 CONFLICT 为权威校验，错误原文 toast） */
  const nightFull = (d: Date): boolean => (remByNight.get(localDayKey(d)) ?? 1) <= 0;
  /** [checkin, checkout) 区间任一晚满房 → 该退房日不可选 */
  const rangeFull = (from: Date, to: Date): boolean => {
    for (let d = dayStart(from); d.getTime() < to.getTime(); d = addDays(d, 1)) {
      if (nightFull(d)) return true;
    }
    return false;
  };

  // 洗护：按本地日期分组（保持槽位升序）
  const days = useMemo(() => {
    const slots = slotsQuery.data?.slots ?? [];
    const map = new Map<string, SlotItem[]>();
    for (const s of slots) {
      const k = localDayKey(s.slotStart);
      const arr = map.get(k);
      if (arr) arr.push(s);
      else map.set(k, [s]);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      date: items[0]!.slotStart,
      items,
    }));
  }, [slotsQuery.data]);

  const activeDay = days.find((d) => d.key === dayKey) ?? days[0] ?? null;

  // 寄养：候选日期墙
  const checkinDays = useMemo(() => {
    const today = dayStart(new Date());
    return Array.from({ length: BOARDING_PICK_DAYS }, (_, i) => addDays(today, i));
  }, []);
  const checkoutDays = useMemo(() => {
    if (!checkin) return [];
    return Array.from({ length: BOARDING_PICK_DAYS }, (_, i) => addDays(checkin, i + 1));
  }, [checkin]);
  const boardingNights =
    checkin && checkout
      ? Math.round((dayStart(checkout).getTime() - dayStart(checkin).getTime()) / 86_400_000)
      : 0;

  const rescheduleMut = useMutation({
    mutationFn: (input: { appointmentId: string; scheduledStart: Date; scheduledEnd?: Date }) =>
      trpc.appointment.reschedule.mutate(input),
    onSuccess: () => {
      toast.success('改期成功，已通知客户');
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      reset();
      onChanged();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : '改期失败，请稍后再试'),
  });

  const reset = () => {
    setSlot(null);
    setDayKey(null);
    setCheckin(null);
    setCheckout(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submitBoarding = () => {
    if (!target || !checkin || !checkout) return;
    rescheduleMut.mutate({
      appointmentId: target.id,
      scheduledStart: boardingAlign(store?.openHours, checkin),
      scheduledEnd: boardingAlign(store?.openHours, checkout),
    });
  };

  return (
    <Modal open={open} title="改期" onClose={close}>
      {target ? (
        <p className="mb-3 text-caption text-ink-secondary">
          {isBoarding && target.scheduledEnd
            ? `当前：${fmtDate(target.scheduledStart)} 入住 → ${fmtDate(target.scheduledEnd)} 退房`
            : `当前时间：${fmtDateTime(target.scheduledStart)}`}
        </p>
      ) : null}

      {isBoarding ? (
        /* ---------------- 寄养分支：入住日 → 退房日 ---------------- */
        availQuery.isPending || slotsQuery.isPending ? (
          <p className="py-8 text-center text-caption text-ink-secondary">加载房型余量…</p>
        ) : (
          <>
            <p className="mb-1.5 text-caption font-semibold text-ink">入住日期</p>
            <div className="grid grid-cols-7 gap-1.5">
              {checkinDays.map((d) => {
                const disabled =
                  isClosedDay(store?.openHours, d) ||
                  boardingAlign(store?.openHours, d).getTime() < Date.now() + LEAD_BUFFER_MS ||
                  nightFull(d);
                const active = checkin?.getTime() === d.getTime();
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setCheckin(d);
                      if (checkout && checkout.getTime() <= d.getTime()) setCheckout(null);
                    }}
                    className={`rounded-[6px] px-1 py-1.5 text-center transition-transform duration-120 ease-philia-spring active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 ${
                      active
                        ? 'bg-brand-primary font-bold text-ink'
                        : disabled
                          ? 'bg-sunken text-ink-placeholder'
                          : 'u1-ring bg-card text-ink'
                    }`}
                  >
                    <span className="block text-[11px]">
                      {d.getTime() === checkinDays[0]?.getTime() ? '今天' : weekCN(d)}
                    </span>
                    <span className="u1-num block text-[12px]">{fmtMD(d)}</span>
                  </button>
                );
              })}
            </div>

            {checkin ? (
              <>
                <p className="mb-1.5 mt-4 text-caption font-semibold text-ink">退房日期</p>
                <div className="grid grid-cols-7 gap-1.5">
                  {checkoutDays.map((d) => {
                    const disabled =
                      isClosedDay(store?.openHours, d) || rangeFull(checkin, d);
                    const active = checkout?.getTime() === d.getTime();
                    return (
                      <button
                        key={d.getTime()}
                        type="button"
                        disabled={disabled}
                        onClick={() => setCheckout(d)}
                        className={`rounded-[6px] px-1 py-1.5 text-center transition-transform duration-120 ease-philia-spring active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 ${
                          active
                            ? 'bg-brand-primary font-bold text-ink'
                            : disabled
                              ? 'bg-sunken text-ink-placeholder'
                              : 'u1-ring bg-card text-ink'
                        }`}
                      >
                        <span className="block text-[11px]">{weekCN(d)}</span>
                        <span className="u1-num block text-[12px]">{fmtMD(d)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            <button
              type="button"
              disabled={!checkin || !checkout || rescheduleMut.isPending}
              onClick={submitBoarding}
              className="mt-4 h-11 w-full rounded-control bg-brand-primary text-[13px] font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-40"
            >
              {rescheduleMut.isPending
                ? '提交中…'
                : checkin && checkout
                  ? `改期到 ${fmtDate(checkin)} 入住 → ${fmtDate(checkout)} 退房 · 共 ${boardingNights} 晚`
                  : '请先选入住日，再选退房日'}
            </button>
          </>
        )
      ) : /* ---------------- 洗护分支：日期 + 时间槽 ---------------- */
      slotsQuery.isPending ? (
        <p className="py-8 text-center text-caption text-ink-secondary">加载可约时段…</p>
      ) : days.length === 0 ? (
        <p className="py-8 text-center text-caption text-ink-secondary">
          未来 7 天暂无可约时段，请稍后再试或调整服务时长
        </p>
      ) : (
        <>
          {/* 日期选择（U3 chips：当前=墨底反白） */}
          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="选择日期">
            {days.map((d) => {
              const active = activeDay?.key === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setDayKey(d.key);
                    setSlot(null);
                  }}
                  className={`u3-chipf shrink-0 ${active ? 'on' : ''}`}
                >
                  {fmtDateWeek(d.date)}
                </button>
              );
            })}
          </div>

          {/* 时间槽 */}
          {activeDay ? (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {activeDay.items.map((s) => {
                const active = slot?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={`h-9 rounded-[6px] font-number text-body transition-transform duration-120 ease-philia-spring active:scale-95 ${
                      active ? 'bg-brand-primary font-bold text-ink' : 'u1-ring bg-card text-ink'
                    }`}
                  >
                    {fmtTime(s.slotStart)}
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            disabled={!slot || rescheduleMut.isPending}
            onClick={() => {
              if (!target || !slot) return;
              rescheduleMut.mutate({ appointmentId: target.id, scheduledStart: slot.slotStart });
            }}
            className="mt-4 h-11 w-full rounded-control bg-brand-primary text-[13px] font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-40"
          >
            {rescheduleMut.isPending
              ? '提交中…'
              : slot
                ? `改期到 ${fmtDateWeek(slot.slotStart)} ${fmtTime(slot.slotStart)}`
                : '请选择新时间'}
          </button>
        </>
      )}
    </Modal>
  );
}
