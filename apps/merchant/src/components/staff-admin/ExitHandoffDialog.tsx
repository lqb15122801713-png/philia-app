/**
 * 离职交接弹层（员工端骨架整建批 片 3 B7-4 · StaffPage 员工行动作）
 *
 * 两段（server staffExit namespace 由 coder G 并行施工，契约经
 * lib/taskCollabPort.ts 收窄桥接）：
 * - 改挂未完结单：接手员工下拉（在职员工、排除本人）+ 备注（选填）→
 *   reassignAppointments（fromStaffId=本行员工）→ toast 透出 moved n；
 * - 交接留痕：listHandoffs（前后值快照透出，仿 reception_logs 口径）。
 * 明面注记：会员档案无员工负责人列=不在改挂范围（诚实写）。
 * 停职动作本体在 EditStaffDialog（在职状态 Switch），本弹层只管资源改挂+留痕。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { sf } from '../../copy/staff';
import { collabOf } from '../../lib/taskCollabPort';
import { errMsg } from './format';
import type { StaffRow } from './types';
import { Badge, Btn, Field, Modal, toast } from './ui';

/** 时刻透出（superjson Date 或串防御） */
function fmtAt(at: Date | string | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ExitHandoffDialog({
  staff,
  open,
  onClose,
}: {
  staff: StaffRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const collab = useMemo(() => collabOf(trpc), [trpc]);

  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
    enabled: open,
  });
  const handoffsQ = useQuery({
    queryKey: ['staffExit', 'handoffs', staff?.id],
    queryFn: () => collab.staffExit.listHandoffs.query({ staffId: staff!.id }),
    enabled: open && staff !== null,
  });

  /** 接手候选：在职员工、排除本人 */
  const candidates = useMemo(
    () => ((staffQ.data?.staff ?? []) as StaffRow[]).filter((s) => s.status === 'active' && s.id !== staff?.id),
    [staffQ.data, staff?.id],
  );

  const [toStaffId, setToStaffId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reassign = async () => {
    if (!staff) return;
    if (!toStaffId) {
      setError(sf('staff.exitNoTarget'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await collab.staffExit.reassignAppointments.mutate({
        fromStaffId: staff.id,
        toStaffId,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(sf('staff.exitReassigned', { n: r.moved }));
      setToStaffId('');
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['staffExit'] });
      void queryClient.invalidateQueries({ queryKey: ['store', 'staffList'] });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handoffs = handoffsQ.data?.handoffs ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sf('staff.exitDialogTitle', { name: staff?.name ?? '' })}
      footer={
        <Btn variant="ghost" onClick={onClose}>
          关闭
        </Btn>
      }
    >
      <div className="space-y-4">
        {/* 改挂未完结单 */}
        <div>
          <p className="mb-2 text-caption font-semibold text-ink">{sf('staff.exitReassignTitle')}</p>
          <p className="mb-2 text-caption-xs text-ink-placeholder">{sf('staff.exitReassignHint')}</p>
          {candidates.length === 0 && !staffQ.isPending ? (
            <p className="text-caption text-ink-placeholder">{sf('staff.exitNoCandidates')}</p>
          ) : (
            <div className="space-y-2.5">
              <Field label={sf('staff.exitToStaffPh')}>
                <select
                  value={toStaffId}
                  onChange={(e) => setToStaffId(e.target.value)}
                  data-testid="exit-to-staff"
                  className="w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
                >
                  <option value="">{sf('staff.exitToStaffPh')}</option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={sf('staff.exitNotePh')}
                maxLength={200}
                data-testid="exit-note"
                className="w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
              />
              <div className="flex justify-end">
                <Btn variant="primary" size="sm" disabled={busy} onClick={() => void reassign()} data-testid="exit-reassign-submit">
                  {busy ? sf('staff.exitReassigning') : sf('staff.exitReassignSubmit')}
                </Btn>
              </div>
            </div>
          )}
          <p className="mt-2 text-caption-xs text-ink-placeholder">{sf('staff.exitMemberNote')}</p>
        </div>

        {/* 交接留痕（前后值快照透出） */}
        <div className="border-t border-line-divider pt-3">
          <p className="mb-2 text-caption font-semibold text-ink">{sf('staff.exitHandoffsTitle')}</p>
          {handoffsQ.isPending ? (
            <div className="space-y-2" aria-label="加载中">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-9 rounded-control" />
              ))}
            </div>
          ) : handoffs.length === 0 ? (
            <p className="py-3 text-center text-caption text-ink-placeholder">{sf('staff.exitHandoffsEmpty')}</p>
          ) : (
            handoffs.map((h) => (
              <div key={h.id} className="rounded-control bg-card px-3 py-2 shadow-hairline ring-1 ring-line-ring [&+&]:mt-2" data-testid={`exit-handoff-${h.id}`}>
                <div className="flex items-center gap-2">
                  <Badge tone="muted">{h.kind === 'appointment' ? sf('staff.exitHandoffKindAppointment') : h.kind}</Badge>
                  <span className="min-w-0 flex-1 truncate text-caption text-ink">
                    {sf('staff.exitHandoffPrevNext', { prev: h.prevValue ?? '—', next: h.newValue ?? '—' })}
                  </span>
                </div>
                <div className="u1-num mt-1 text-caption-xs text-ink-placeholder">
                  {fmtAt(h.createdAt)}
                  {h.changedByName ? ` · ${h.changedByName}` : ''}
                  {h.note ? ` · ${h.note}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <p className="text-body text-danger-deep">{error}</p> : null}
      </div>
    </Modal>
  );
}
