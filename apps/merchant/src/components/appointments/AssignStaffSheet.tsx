/**
 * 指派员工弹层（T4.2）：
 * - 员工按技能匹配排序（匹配服务 type 的技能在前 +「技能匹配」标注）；
 * - 每行显示当日排班区间与当日单数；同员工同时段已有 confirmed/in_service 单 →
 *   标记「时段冲突」并禁用（服务端 CONFLICT 为权威校验，冲突错误原文 toast）。
 * - 停职员工不可指派；排班不覆盖由服务端强校验（错误原文 toast）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Modal } from './Modal';
import { showToast } from './Toast';
import {
  dayKeyOf,
  dayStart,
  addDays,
  skillLabel,
  staffMatchesType,
  type StaffListItem,
} from './appt-utils';

export interface AssignTarget {
  id: string;
  type: string;
  scheduledStart: Date;
  staffId: string | null;
}

export function AssignStaffSheet({
  open,
  target,
  onClose,
  onAssigned,
}: {
  open: boolean;
  target: AssignTarget | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { trpc, queryClient } = usePhiliaClient();

  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
    enabled: open,
  });

  // 当日单量（显示用）+ 同时段冲突预判（服务端仍为权威校验）
  const dayRange = useMemo(() => {
    if (!target) return null;
    const s = dayStart(target.scheduledStart);
    return { from: s, to: new Date(addDays(s, 1).getTime() - 1) };
  }, [target]);

  const dayQuery = useQuery({
    queryKey: [
      'appointment',
      'listForStore',
      'assign-day',
      dayRange?.from.toISOString(),
    ],
    queryFn: () =>
      trpc.appointment.listForStore.query({ from: dayRange!.from, to: dayRange!.to }),
    enabled: open && !!dayRange,
  });

  const assignMut = useMutation({
    mutationFn: (input: { appointmentId: string; staffId: string }) =>
      trpc.appointment.assign.mutate(input),
    onSuccess: (_r, vars) => {
      const name = staffQuery.data?.staff.find((s) => s.id === vars.staffId)?.name;
      showToast(`已指派${name ? ` ${name}` : ''}`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      onAssigned();
      onClose();
    },
    // 冲突 / 排班 / 技能不匹配：服务端错误原文 toast
    onError: (err) => showToast(err instanceof Error ? err.message : '指派失败，请稍后再试', 'error'),
  });

  const rows = useMemo(() => {
    const staff = staffQuery.data?.staff ?? [];
    const dayItems = dayQuery.data ?? [];
    if (!target) return [];

    const dayCount = new Map<string, number>();
    const clash = new Set<string>();
    for (const a of dayItems) {
      if (!a.staffId) continue;
      if (['pending', 'confirmed', 'in_service', 'in_boarding'].includes(a.status)) {
        dayCount.set(a.staffId, (dayCount.get(a.staffId) ?? 0) + 1);
      }
      if (
        a.id !== target.id &&
        a.staffId &&
        a.scheduledStart.getTime() === target.scheduledStart.getTime() &&
        (a.status === 'confirmed' || a.status === 'in_service')
      ) {
        clash.add(a.staffId);
      }
    }

    const dayKey = dayKeyOf(target.scheduledStart);
    return staff
      .map((s) => {
        const matched = staffMatchesType(s.skills, target.type);
        const ranges = s.schedule?.[dayKey] ?? [];
        const suspended = s.status !== 'active';
        const isCurrent = s.id === target.staffId;
        return {
          staff: s,
          matched,
          ranges,
          suspended,
          isCurrent,
          dayOrders: dayCount.get(s.id) ?? 0,
          conflict: clash.has(s.id),
          assignable: matched && !suspended && !clash.has(s.id) && !isCurrent,
        };
      })
      .sort((a, b) => {
        // 技能匹配优先，其余保持稳定（同匹配度按创建序）
        if (a.matched !== b.matched) return a.matched ? -1 : 1;
        return 0;
      });
  }, [staffQuery.data, dayQuery.data, target]);

  return (
    <Modal open={open} title="指派员工" onClose={onClose}>
      {staffQuery.isPending ? (
        <p className="py-8 text-center text-caption text-ink-secondary">加载员工中…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-caption text-ink-secondary">
          本店暂无员工，请先在「管理-员工」中邀请员工
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <StaffRow
              key={r.staff.id}
              row={r}
              pending={assignMut.isPending}
              onAssign={() => {
                if (!target) return;
                assignMut.mutate({ appointmentId: target.id, staffId: r.staff.id });
              }}
            />
          ))}
        </ul>
      )}
      <p className="mt-3 text-caption text-ink-placeholder">
        技能不匹配 / 排班不覆盖 / 时段冲突将由服务端最终校验
      </p>
    </Modal>
  );
}

function StaffRow({
  row,
  pending,
  onAssign,
}: {
  row: {
    staff: StaffListItem;
    matched: boolean;
    ranges: Array<{ start: string; end: string }>;
    suspended: boolean;
    isCurrent: boolean;
    dayOrders: number;
    conflict: boolean;
    assignable: boolean;
  };
  pending: boolean;
  onAssign: () => void;
}) {
  const { staff: s } = row;
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-body font-semibold text-ink">
          {s.name}
          {row.matched ? (
            <span className="rounded-tag bg-brand-primary-light px-1.5 py-0.5 text-caption text-brand-primary">
              技能匹配
            </span>
          ) : (
            <span className="rounded-tag bg-sunken px-1.5 py-0.5 text-caption text-ink-placeholder">
              技能不匹配
            </span>
          )}
          {row.isCurrent ? (
            <span className="rounded-tag bg-success-light px-1.5 py-0.5 text-caption text-success-deep">
              当前指派
            </span>
          ) : null}
          {row.suspended ? (
            <span className="rounded-tag bg-sunken px-1.5 py-0.5 text-caption text-ink-placeholder">
              已停职
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-caption text-ink-secondary">
          技能：{(s.skills ?? []).map(skillLabel).join(' / ') || '未设置'}
        </p>
        <p className="mt-0.5 text-caption text-ink-secondary">
          当日排班：
          {row.ranges.length > 0
            ? row.ranges.map((r) => `${r.start}-${r.end}`).join('、')
            : '休息'}
          <span className="mx-1 text-line-strong">|</span>
          当日 {row.dayOrders} 单
          {row.conflict ? (
            <span className="ml-1 text-danger-deep">此时段已有服务单</span>
          ) : null}
        </p>
      </div>
      <button
        type="button"
        disabled={!row.assignable || pending}
        onClick={onAssign}
        className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-primary px-3 text-caption font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        <UserCheck className="h-4 w-4" strokeWidth={1.5} />
        指派
      </button>
    </li>
  );
}
