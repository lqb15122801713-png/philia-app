/**
 * 员工排班周模板编辑器（T4.3 · StaffPage）
 *
 * 周一~周日七天，每天可设「休息」或至多 4 个时段（开始-结束，HH:MM）。
 * 保存 → store.setSchedule（服务端 zod 校验：null=休息；每段 start/end HH:MM）。
 * 本地先校验 start < end，失败行内提示，不发请求。
 */

import { usePhiliaClient } from '@philia/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errMsg } from './format';
import { DAY_KEYS, DAY_LABEL, type DayKey, type StaffRow, type TimeRange } from './types';
import { Btn, Modal, Switch, toast } from './ui';

interface DayEdit {
  off: boolean;
  ranges: TimeRange[];
}

type WeekEdit = Record<DayKey, DayEdit>;

const MAX_RANGES = 4; // 与服务端 dayValue .max(4) 一致

function toEdit(schedule: StaffRow['schedule']): WeekEdit {
  const out = {} as WeekEdit;
  for (const k of DAY_KEYS) {
    const ranges = schedule?.[k] ?? null;
    out[k] = ranges && ranges.length > 0 ? { off: false, ranges: ranges.map((r) => ({ ...r })) } : { off: true, ranges: [] };
  }
  return out;
}

export default function ScheduleEditorDialog({
  staff,
  open,
  onClose,
  onSaved,
}: {
  staff: StaffRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { trpc } = usePhiliaClient();
  const [week, setWeek] = useState<WeekEdit>(() => toEdit(null));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && staff) {
      setWeek(toEdit(staff.schedule));
      setPending(false);
      setError(null);
    }
  }, [open, staff]);

  const patchDay = (k: DayKey, patch: Partial<DayEdit>) =>
    setWeek((w) => ({ ...w, [k]: { ...w[k], ...patch } }));

  const patchRange = (k: DayKey, idx: number, patch: Partial<TimeRange>) =>
    setWeek((w) => {
      const ranges = w[k].ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      return { ...w, [k]: { ...w[k], ranges } };
    });

  const save = async () => {
    if (!staff) return;
    // 本地校验：时段完整且 start < end
    for (const k of DAY_KEYS) {
      const d = week[k];
      if (d.off) continue;
      if (d.ranges.length === 0) {
        setError(`${DAY_LABEL[k]} 未设休息且没有时段：请添加时段或设为休息`);
        return;
      }
      for (const r of d.ranges) {
        if (!r.start || !r.end) {
          setError(`${DAY_LABEL[k]} 存在未填完整的时段`);
          return;
        }
        if (r.start >= r.end) {
          setError(`${DAY_LABEL[k]} 时段 ${r.start}–${r.end} 无效：开始须早于结束`);
          return;
        }
      }
    }
    setError(null);
    setPending(true);
    try {
      const schedule = {} as Record<DayKey, TimeRange[] | null>;
      for (const k of DAY_KEYS) {
        schedule[k] = week[k].off ? null : week[k].ranges;
      }
      await trpc.store.setSchedule.mutate({ staffId: staff.id, schedule });
      toast(`已保存「${staff.name}」的排班`);
      onSaved();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={staff ? `排班编辑 · ${staff.name}` : '排班编辑'}
      widthClass="max-w-xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={pending}>
            {pending ? '保存中…' : '保存排班'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        {DAY_KEYS.map((k) => {
          const d = week[k];
          return (
            <div key={k} className="rounded-input bg-sunken px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-body font-medium text-ink">{DAY_LABEL[k]}</span>
                <span className="flex items-center gap-2 text-caption text-ink-secondary">
                  {d.off ? '休息' : '上班'}
                  <Switch
                    checked={!d.off}
                    label={`${DAY_LABEL[k]}是否上班`}
                    onChange={(on) =>
                      patchDay(k, on ? { off: false, ranges: [{ start: '09:00', end: '18:00' }] } : { off: true, ranges: [] })
                    }
                  />
                </span>
              </div>
              {!d.off ? (
                <div className="mt-2 space-y-2">
                  {d.ranges.map((r, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={r.start}
                        onChange={(e) => patchRange(k, idx, { start: e.target.value })}
                        className="rounded-tag border border-line bg-card px-2 py-1 text-body text-ink focus:border-brand-primary focus:outline-none"
                      />
                      <span className="text-caption text-ink-placeholder">至</span>
                      <input
                        type="time"
                        value={r.end}
                        onChange={(e) => patchRange(k, idx, { end: e.target.value })}
                        className="rounded-tag border border-line bg-card px-2 py-1 text-body text-ink focus:border-brand-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label="删除时段"
                        onClick={() =>
                          patchDay(k, { ranges: d.ranges.filter((_, i) => i !== idx) })
                        }
                        className="rounded-full p-1 text-ink-placeholder transition-colors hover:bg-danger-light hover:text-danger-deep"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                  {d.ranges.length < MAX_RANGES ? (
                    <Btn
                      variant="subtle"
                      size="sm"
                      onClick={() => patchDay(k, { ranges: [...d.ranges, { start: '13:00', end: '18:00' }] })}
                    >
                      <Plus size={14} strokeWidth={1.5} />
                      添加时段
                    </Btn>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {error ? <p className="text-caption text-danger-deep">{error}</p> : null}
        <p className="text-caption text-ink-placeholder">每天最多 {MAX_RANGES} 个时段；设为「休息」的当天不排班。</p>
      </div>
    </Modal>
  );
}
