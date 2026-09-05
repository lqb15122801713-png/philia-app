/**
 * 改期弹层（T4.2）：日期 + 时间槽选择（store.getWithServices 未来 7 天可约槽，
 * 按服务时长过滤连续槽）→ appointment.reschedule。
 * 服务端强校验：未来时间 / 30min 对齐 / 营业时间 / 槽位容量（冲突 CONFLICT 原文 toast）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { showToast } from './Toast';
import {
  fmtDateWeek,
  fmtDateTime,
  fmtTime,
  localDayKey,
  type SlotItem,
} from './appt-utils';

export interface RescheduleTarget {
  id: string;
  storeId: string;
  serviceId: string;
  scheduledStart: Date;
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

  const slotsQuery = useQuery({
    queryKey: ['store', 'getWithServices', target?.storeId, target?.serviceId],
    queryFn: () =>
      trpc.store.getWithServices.query({ storeId: target!.storeId, serviceId: target!.serviceId }),
    enabled: open && !!target,
  });

  // 按本地日期分组（保持槽位升序）
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

  const rescheduleMut = useMutation({
    mutationFn: (input: { appointmentId: string; scheduledStart: Date }) =>
      trpc.appointment.reschedule.mutate(input),
    onSuccess: () => {
      showToast('改期成功，已通知客户', 'success');
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      setSlot(null);
      setDayKey(null);
      onChanged();
      onClose();
    },
    onError: (err) =>
      showToast(err instanceof Error ? err.message : '改期失败，请稍后再试', 'error'),
  });

  const close = () => {
    setSlot(null);
    setDayKey(null);
    onClose();
  };

  return (
    <Modal open={open} title="改期" onClose={close}>
      {target ? (
        <p className="mb-3 text-caption text-ink-secondary">
          当前时间：{fmtDateTime(target.scheduledStart)}
        </p>
      ) : null}

      {slotsQuery.isPending ? (
        <p className="py-8 text-center text-caption text-ink-secondary">加载可约时段…</p>
      ) : days.length === 0 ? (
        <p className="py-8 text-center text-caption text-ink-secondary">
          未来 7 天暂无可约时段，请稍后再试或调整服务时长
        </p>
      ) : (
        <>
          {/* 日期选择 */}
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
                  className={`shrink-0 rounded-tag px-3 py-1.5 text-caption transition-colors ${
                    active
                      ? 'bg-brand-primary-light font-semibold text-brand-primary'
                      : 'bg-sunken text-ink-secondary'
                  }`}
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
                    className={`h-9 rounded-tag font-number text-body transition-colors ${
                      active
                        ? 'bg-brand-primary font-semibold text-white'
                        : 'bg-sunken text-ink hover:bg-brand-primary-light'
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
            className="mt-4 h-11 w-full rounded-full bg-brand-primary text-body font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-40"
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
