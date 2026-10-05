/**
 * 协作拆分块（员工端骨架整建批 片 4 B3-2 录入面 · 商家端预约详情页）
 *
 * - 读现状：payroll.collabOf（collaborators + defaultSplitBp 端口建议值）；
 * - 编辑：员工多选（store.staffList 在职）+ 每人拆分比输入（% 两位小数→bp），
 *   新加行预填 defaultSplitBp；Σ 协作 ≤100% 前端校验提示（主操作人吃余数，
 *   Σ协作 + 主 = 100%）→ setCollaborators 保存；
 * - 已完成单=只读透出（拆分已快照进提成计算，不再编辑）；
 * - 注记明面：主操作人吃余数、拆分比入端口。
 *
 * server payroll 命名空间由 coder J 并行施工，契约经 lib/payrollXpPort.ts
 * 收窄桥接。copy 键走薪资域族（copy/payroll.ts 的 pay.collab.* 段）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { errMsg } from '../staff-admin/format';
import type { StaffRow } from '../staff-admin/types';
import { Badge, Btn, toast, ToasterMount } from '../staff-admin/ui';
import { py } from '../../copy/payroll';
import { payrollOf, type CollaboratorInput } from '../../lib/payrollXpPort';

/** 协作角色键（schema 口径 wash|groom|assist；文案走端口键） */
const COLLAB_ROLES = ['wash', 'groom', 'assist'] as const;

function collabRoleLabel(role: string): string {
  switch (role) {
    case 'wash':
      return py('payroll.collab.roleWash');
    case 'groom':
      return py('payroll.collab.roleGroom');
    case 'assist':
      return py('payroll.collab.roleAssist');
    default:
      return role;
  }
}

interface EditRow {
  staffId: string;
  role: string;
  /** 百分比串（两位小数；保存时 ×100 取整成 bp） */
  pct: string;
}

/** 百分比串 → bp（0~100 两位小数硬校验；非法返回 null） */
function pctToBp(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const pct = Number(s);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return null;
  return Math.round(pct * 100);
}

export function CollabSplitSection({
  appointmentId,
  appointmentStatus,
  mainStaffId,
}: {
  appointmentId: string;
  appointmentStatus: string;
  mainStaffId: string | null;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const payroll = useMemo(() => payrollOf(trpc), [trpc]);
  const readonly = appointmentStatus === 'completed';

  const collabQ = useQuery({
    queryKey: ['payroll', 'collab', appointmentId],
    queryFn: () => payroll.collabOf.query({ appointmentId }),
  });
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  const staffRows = useMemo(
    () => ((staffQ.data?.staff ?? []) as StaffRow[]).filter((s) => s.status === 'active'),
    [staffQ.data],
  );
  const staffNameOf = (id: string) => staffRows.find((s) => s.id === id)?.name;

  /* ---- 编辑态 ---- */
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [pickStaffId, setPickStaffId] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const startEdit = () => {
    const cur = collabQ.data?.collaborators ?? [];
    setRows(cur.map((c) => ({ staffId: c.staffId, role: c.role, pct: (c.splitBp / 100).toFixed(2) })));
    setPickStaffId('');
    setEditing(true);
  };

  const addRow = () => {
    if (!pickStaffId || rows.some((r) => r.staffId === pickStaffId)) return;
    const defBp = collabQ.data?.defaultSplitBp ?? 5000;
    setRows((xs) => [...xs, { staffId: pickStaffId, role: 'assist', pct: (defBp / 100).toFixed(2) }]);
    setPickStaffId('');
  };

  const sumBp = rows.reduce((acc, r) => acc + (pctToBp(r.pct) ?? 0), 0);
  const sumOver = sumBp > 10000;

  const save = async () => {
    const parsed: CollaboratorInput[] = [];
    for (const r of rows) {
      const bp = pctToBp(r.pct);
      if (bp === null) {
        toast(py('payroll.collab.splitInvalid'), 'error');
        return;
      }
      parsed.push({ staffId: r.staffId, role: r.role, splitBp: bp });
    }
    if (sumOver) {
      toast(py('payroll.collab.splitInvalid'), 'error');
      return;
    }
    setSaveBusy(true);
    try {
      await payroll.setCollaborators.mutate({ appointmentId, collaborators: parsed });
      toast(py('payroll.collab.saved'));
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['payroll', 'collab', appointmentId] });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const collaborators = collabQ.data?.collaborators ?? [];
  const addableStaff = staffRows.filter((s) => !rows.some((r) => r.staffId === s.id) && s.id !== mainStaffId);

  return (
    <div className="u3-panel" data-testid="detail-collab">
      <ToasterMount />
      <div className="u3-panel-head">
        <h3>{py('payroll.collab.title')}</h3>
        <span className="aside">{py('payroll.collab.aside')}</span>
      </div>
      {collabQ.isPending ? (
        <div className="px-[17px] pb-3.5" aria-label="加载中">
          <Skeleton className="h-10 !rounded-[16px]" />
        </div>
      ) : collabQ.isError ? (
        <div className="px-[17px] pb-3.5 text-center">
          <p className="text-caption text-[rgba(59,46,36,.62)]">{py('payroll.common.loadFail')}</p>
          <div className="mt-2">
            <Btn variant="subtle" size="sm" onClick={() => void collabQ.refetch()}>
              {py('payroll.common.retry')}
            </Btn>
          </div>
        </div>
      ) : !editing ? (
        <div className="px-[17px] pb-3.5">
          {collaborators.length === 0 ? (
            <p className="text-caption text-[rgba(59,46,36,.62)]">{py('payroll.collab.empty')}</p>
          ) : (
            collaborators.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 py-1 text-caption" data-testid={`collab-row-${c.staffId}`}>
                <span className="min-w-0 flex-1 font-semibold text-ink">{c.staffName ?? staffNameOf(c.staffId) ?? c.staffId}</span>
                <Badge tone="muted">{collabRoleLabel(c.role)}</Badge>
                <span className="u1-num text-caption-xs text-[rgba(59,46,36,.62)]">{(c.splitBp / 100).toFixed(2)}%</span>
              </div>
            ))
          )}
          <p className="mt-2 text-caption-xs text-[rgba(59,46,36,.42)]">
            {readonly ? py('payroll.collab.readonlyNote') : py('payroll.collab.mainNote')}
          </p>
          {!readonly ? (
            <div className="mt-2.5">
              <Btn variant="subtle" size="sm" onClick={startEdit} data-testid="collab-edit">
                {py('payroll.collab.editCta')}
              </Btn>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2 px-[17px] pb-3.5" data-testid="collab-edit-form">
          {rows.map((r) => (
            <div key={r.staffId} className="flex flex-wrap items-center gap-2" data-testid={`collab-edit-row-${r.staffId}`}>
              <span className="min-w-0 flex-1 text-caption font-semibold text-ink">
                {staffNameOf(r.staffId) ?? r.staffId}
              </span>
              <select
                value={r.role}
                onChange={(e) => setRows((xs) => xs.map((x) => (x.staffId === r.staffId ? { ...x, role: e.target.value } : x)))}
                aria-label={py('payroll.collab.roleLabel')}
                className="u1-ring rounded-control bg-card px-2 py-1.5 text-caption text-ink focus:outline-none"
              >
                {COLLAB_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {collabRoleLabel(role)}
                  </option>
                ))}
              </select>
              <input
                value={r.pct}
                onChange={(e) => setRows((xs) => xs.map((x) => (x.staffId === r.staffId ? { ...x, pct: e.target.value } : x)))}
                inputMode="decimal"
                aria-label={py('payroll.collab.splitLabel')}
                className="u1-ring w-20 rounded-control bg-card px-2 py-1.5 text-caption text-ink focus:outline-none"
              />
              <Btn
                variant="subtle"
                size="sm"
                onClick={() => setRows((xs) => xs.filter((x) => x.staffId !== r.staffId))}
                data-testid={`collab-remove-${r.staffId}`}
              >
                {py('payroll.collab.removeCta')}
              </Btn>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pickStaffId}
              onChange={(e) => setPickStaffId(e.target.value)}
              aria-label={py('payroll.collab.staffPh')}
              data-testid="collab-pick-staff"
              className="u1-ring rounded-control bg-card px-2 py-1.5 text-caption text-ink focus:outline-none"
            >
              <option value="">{py('payroll.collab.staffPh')}</option>
              {addableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Btn variant="subtle" size="sm" onClick={addRow} disabled={!pickStaffId} data-testid="collab-add">
              {py('payroll.collab.addCta')}
            </Btn>
          </div>
          <p className={`text-caption-xs ${sumOver ? 'text-danger-deep' : 'text-[rgba(59,46,36,.42)]'}`} data-testid="collab-sum">
            {py('payroll.collab.sumLine', { sum: (sumBp / 100).toFixed(2), rest: ((10000 - sumBp) / 100).toFixed(2) })}
          </p>
          <div className="flex items-center gap-2">
            <Btn variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saveBusy}>
              {py('payroll.collab.cancelEdit')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={() => void save()} disabled={saveBusy || sumOver} data-testid="collab-save">
              {saveBusy ? py('payroll.collab.saving') : py('payroll.collab.saveCta')}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
