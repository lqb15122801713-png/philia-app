/**
 * 任务模板 /settings/tasks（员工端骨架整建批 片 3 B5-1 · 商家端）
 *
 * 循环任务模板自管（server taskExec namespace 由 coder G 并行施工，契约经
 * lib/taskCollabPort.ts 收窄桥接）：
 * - 模板列表 + 新建/编辑表单（标题/说明/指派范围 role|staff（角色下拉 frontdesk|
 *   groomer / 员工下拉 store.staffList）/频率 daily|weekly（weekly 出周日多选，
 *   chips 工艺照排班模板表单）/截止时刻（time→dueMin 分钟）/提醒分钟）；
 * - 停用钮=deactivateTemplate（active=false 留痕不删行；停用行灰签）；
 * - 近 7 天落实例表（taskExec.listRuns {from,to}）：日期/模板/完成人/状态。
 *
 * 权限三层照排班页：MerchantRail/设置入口分流 + ClerkRouteGuard + 页内
 * useMerchantRole 非 owner/manager → RoleGuidePage。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, toast, ToasterMount } from '../components/staff-admin/ui';
import type { StaffRow } from '../components/staff-admin/types';
import { tk } from '../copy/tasks';
import { addDays, dateStr, hmToMin, minToHm } from '../lib/schedulePort';
import { collabOf, type TaskTemplateRow, type UpsertTaskTemplateInput } from '../lib/taskCollabPort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 常量与小组件                                                          */
/* ------------------------------------------------------------------ */

/** 周日 chips 值序：一~六=1..6，日=0（schema 口径 1=周一…0=周日，同排班模板表单） */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_LABEL: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 0: '日' };

function WeekdayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="tasktpl-days">
      {WEEKDAY_VALUES.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)))}
            className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
              on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
            }`}
          >
            {WEEKDAY_LABEL[d]}
          </button>
        );
      })}
    </div>
  );
}

/** 落实例状态键 → 文案/徽章（未知键原样透出） */
function runStatusLabel(status: string): string {
  switch (status) {
    case 'done':
      return tk('tasktpl.runs.statusDone');
    case 'missed':
      return tk('tasktpl.runs.statusMissed');
    case 'pending':
      return tk('tasktpl.runs.statusPending');
    default:
      return status;
  }
}

/** 模板行摘要：指派范围 + 频率 + 截止/提醒 */
function templateLine(t: TaskTemplateRow, staffNameOf: (id: string) => string | undefined): string {
  const scope =
    t.assignScope === 'role'
      ? tk('tasktpl.list.scopeRoleLine', { role: t.assignRole === 'frontdesk' ? tk('tasktpl.form.roleFrontdesk') : tk('tasktpl.form.roleGroomer') })
      : `${tk('tasktpl.list.scopeStaffLine')}${t.assignStaffId ? `·${staffNameOf(t.assignStaffId) ?? t.assignStaffId}` : ''}`;
  const freq =
    t.freq === 'daily'
      ? tk('tasktpl.list.freqDailyLine')
      : tk('tasktpl.list.freqWeeklyLine', {
          days: [...t.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_LABEL[d] ?? d).join('/'),
        });
  const due = tk('tasktpl.list.dueLine', { hm: minToHm(t.dueMin) });
  const remind = t.remindMin != null ? ` · ${tk('tasktpl.list.remindLine', { n: t.remindMin })}` : '';
  return `${scope} · ${freq} · ${due}${remind}`;
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function TaskTemplatesPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const collab = useMemo(() => collabOf(trpc), [trpc]);

  const templatesQ = useQuery({
    queryKey: ['taskExec', 'templates'],
    queryFn: () => collab.taskExec.templates.query(),
  });
  /* 近 7 天落实例（含今日，本地日期口径） */
  const runsRange = useMemo(() => {
    const today = new Date();
    return { from: dateStr(addDays(today, -6)), to: dateStr(today) };
  }, []);
  const runsQ = useQuery({
    queryKey: ['taskExec', 'runs', runsRange.from, runsRange.to],
    queryFn: () => collab.taskExec.listRuns.query(runsRange),
  });
  /* 员工下拉（按员工指派范围用） */
  const staffQ = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  const staffRows = useMemo(() => ((staffQ.data?.staff ?? []) as StaffRow[]).filter((s) => s.status === 'active'), [staffQ.data]);
  const staffNameOf = (id: string) => staffRows.find((s) => s.id === id)?.name;

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['taskExec'] });

  /* ---- 表单（新建/编辑同件；editingId 非空=编辑） ---- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDetail, setFDetail] = useState('');
  const [fScope, setFScope] = useState<'role' | 'staff'>('role');
  const [fRole, setFRole] = useState<'frontdesk' | 'groomer'>('frontdesk');
  const [fStaffId, setFStaffId] = useState('');
  const [fFreq, setFFreq] = useState<'daily' | 'weekly'>('daily');
  const [fDays, setFDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [fDue, setFDue] = useState('21:00');
  const [fRemind, setFRemind] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setFTitle('');
    setFDetail('');
    setFScope('role');
    setFRole('frontdesk');
    setFStaffId('');
    setFFreq('daily');
    setFDays([1, 2, 3, 4, 5]);
    setFDue('21:00');
    setFRemind('');
  };

  const startEdit = (t: TaskTemplateRow) => {
    setEditingId(t.id);
    setFTitle(t.title);
    setFDetail(t.detail ?? '');
    setFScope(t.assignScope);
    if (t.assignRole === 'frontdesk' || t.assignRole === 'groomer') setFRole(t.assignRole);
    setFStaffId(t.assignStaffId ?? '');
    setFFreq(t.freq);
    setFDays(t.weekdays.length > 0 ? [...t.weekdays] : [1, 2, 3, 4, 5]);
    setFDue(minToHm(t.dueMin));
    setFRemind(t.remindMin != null ? String(t.remindMin) : '');
  };

  const save = async () => {
    const remind = fRemind.trim() === '' ? undefined : Number(fRemind);
    const invalid =
      !fTitle.trim() ||
      (fScope === 'staff' && !fStaffId) ||
      (fFreq === 'weekly' && fDays.length === 0) ||
      (remind !== undefined && (Number.isNaN(remind) || remind < 0));
    if (invalid) {
      toast(tk('tasktpl.form.invalid'), 'error');
      return;
    }
    const input: UpsertTaskTemplateInput = {
      ...(editingId ? { id: editingId } : {}),
      title: fTitle.trim(),
      ...(fDetail.trim() ? { detail: fDetail.trim() } : {}),
      assignScope: fScope,
      ...(fScope === 'role' ? { assignRole: fRole } : { assignStaffId: fStaffId }),
      freq: fFreq,
      weekdays: fFreq === 'weekly' ? fDays : [],
      dueMin: hmToMin(fDue),
      ...(remind !== undefined ? { remindMin: remind } : {}),
    };
    setSaveBusy(true);
    try {
      await collab.taskExec.upsertTemplate.mutate(input);
      toast(tk('tasktpl.form.saved'));
      resetForm();
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const deactivate = async (id: string) => {
    setDeactivatingId(id);
    try {
      await collab.taskExec.deactivateTemplate.mutate({ id });
      toast(tk('tasktpl.list.deactivated'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDeactivatingId(null);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={tk('tasktpl.guideTitle')} hint={tk('tasktpl.guideHint')} />;
  }

  const templates = templatesQ.data?.templates ?? [];
  const runs = runsQ.data?.runs ?? [];

  return (
    <MainScaffold title={tk('tasktpl.pageTitle')} sub={tk('tasktpl.pageSub')} testid="tasktpl-page">
      <ToasterMount />

      {/* 新建/编辑表单 */}
      <div className="u3-panel mb-4" data-testid="tasktpl-form">
        <div className="u3-panel-head">
          <h3>{editingId ? tk('tasktpl.form.titleEdit') : tk('tasktpl.form.titleNew')}</h3>
          <span className="aside">{tk('tasktpl.form.aside')}</span>
        </div>
        <div className="space-y-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tk('tasktpl.form.titleLabel')}>
              <input
                value={fTitle}
                onChange={(e) => setFTitle(e.target.value)}
                placeholder={tk('tasktpl.form.titlePh')}
                maxLength={64}
                data-testid="tasktpl-title"
                className={inputCls}
              />
            </Field>
            <Field label={tk('tasktpl.form.detailLabel')}>
              <input
                value={fDetail}
                onChange={(e) => setFDetail(e.target.value)}
                placeholder={tk('tasktpl.form.detailPh')}
                maxLength={255}
                data-testid="tasktpl-detail"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={fScope}
              onChange={(e) => setFScope(e.target.value === 'staff' ? 'staff' : 'role')}
              aria-label={tk('tasktpl.form.scopeLabel')}
              data-testid="tasktpl-scope"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
            >
              <option value="role">{tk('tasktpl.form.scopeRole')}</option>
              <option value="staff">{tk('tasktpl.form.scopeStaff')}</option>
            </select>
            {fScope === 'role' ? (
              <select
                value={fRole}
                onChange={(e) => setFRole(e.target.value === 'groomer' ? 'groomer' : 'frontdesk')}
                aria-label={tk('tasktpl.form.scopeRole')}
                data-testid="tasktpl-role"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
              >
                <option value="frontdesk">{tk('tasktpl.form.roleFrontdesk')}</option>
                <option value="groomer">{tk('tasktpl.form.roleGroomer')}</option>
              </select>
            ) : (
              <select
                value={fStaffId}
                onChange={(e) => setFStaffId(e.target.value)}
                aria-label={tk('tasktpl.form.scopeStaff')}
                data-testid="tasktpl-staff"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
              >
                <option value="">{tk('tasktpl.form.staffPh')}</option>
                {staffRows.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={fFreq}
              onChange={(e) => setFFreq(e.target.value === 'weekly' ? 'weekly' : 'daily')}
              aria-label={tk('tasktpl.form.freqLabel')}
              data-testid="tasktpl-freq"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
            >
              <option value="daily">{tk('tasktpl.form.freqDaily')}</option>
              <option value="weekly">{tk('tasktpl.form.freqWeekly')}</option>
            </select>
            {fFreq === 'weekly' ? <WeekdayChips value={fDays} onChange={setFDays} /> : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={tk('tasktpl.form.dueLabel')}>
              <input
                type="time"
                value={fDue}
                onChange={(e) => setFDue(e.target.value)}
                data-testid="tasktpl-due"
                className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
              />
            </Field>
            <Field label={tk('tasktpl.form.remindLabel')}>
              <input
                value={fRemind}
                onChange={(e) => setFRemind(e.target.value)}
                inputMode="numeric"
                placeholder={tk('tasktpl.form.remindPh')}
                data-testid="tasktpl-remind"
                className="u1-ring w-32 rounded-control bg-card px-3 py-2 text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none"
              />
            </Field>
            <span className="ml-auto flex items-center gap-2">
              {editingId ? (
                <Btn variant="subtle" size="sm" onClick={resetForm} data-testid="tasktpl-cancel-edit">
                  {tk('tasktpl.form.cancelEdit')}
                </Btn>
              ) : null}
              <Btn variant="primary" size="sm" disabled={saveBusy} onClick={() => void save()} data-testid="tasktpl-save">
                {saveBusy ? tk('tasktpl.form.saving') : tk('tasktpl.form.saveCta')}
              </Btn>
            </span>
          </div>
        </div>
      </div>

      {/* 模板列表 */}
      <div className="u3-panel mb-4" data-testid="tasktpl-list">
        <div className="u3-panel-head">
          <h3>{tk('tasktpl.list.title')}</h3>
          <span className="aside">{tk('tasktpl.list.aside')}</span>
        </div>
        {templatesQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : templatesQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{tk('tasktpl.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void templatesQ.refetch()}>
                {tk('tasktpl.common.retry')}
              </Btn>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center text-caption text-[rgba(59,46,36,.62)]">
            {tk('tasktpl.list.empty')}
          </p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              data-testid={`tasktpl-row-${t.id}`}
              className={`flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 ${t.active ? '' : 'opacity-55'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-body-sm font-bold text-ink">{t.title}</span>
                  {!t.active ? <Badge tone="muted">{tk('tasktpl.list.inactiveBadge')}</Badge> : null}
                </div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">{templateLine(t, staffNameOf)}</div>
                {t.detail ? <div className="mt-0.5 line-clamp-1 text-caption-xs text-[rgba(59,46,36,.62)]">{t.detail}</div> : null}
              </div>
              <Btn variant="subtle" size="sm" onClick={() => startEdit(t)} data-testid={`tasktpl-edit-${t.id}`}>
                {tk('tasktpl.list.editCta')}
              </Btn>
              {t.active ? (
                <Btn
                  variant="subtle"
                  size="sm"
                  disabled={deactivatingId === t.id}
                  onClick={() => void deactivate(t.id)}
                  data-testid={`tasktpl-deactivate-${t.id}`}
                >
                  {tk('tasktpl.list.deactivateCta')}
                </Btn>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 近 7 天落实例 */}
      <div className="u3-panel" data-testid="tasktpl-runs">
        <div className="u3-panel-head">
          <h3>{tk('tasktpl.runs.title')}</h3>
          <span className="aside">{tk('tasktpl.runs.aside')}</span>
        </div>
        {runsQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-10 !rounded-[16px]" />
            ))}
          </div>
        ) : runsQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center">
            <p className="text-caption text-[rgba(59,46,36,.62)]">{tk('tasktpl.common.loadFail')}</p>
            <div className="mt-3">
              <Btn variant="subtle" size="sm" onClick={() => void runsQ.refetch()}>
                {tk('tasktpl.common.retry')}
              </Btn>
            </div>
          </div>
        ) : runs.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
            {tk('tasktpl.runs.empty')}
          </p>
        ) : (
          <table className="w-full border-collapse text-caption" data-testid="tasktpl-runs-table">
            <thead>
              <tr>
                {[tk('tasktpl.runs.colDate'), tk('tasktpl.runs.colTemplate'), tk('tasktpl.runs.colDoneBy'), tk('tasktpl.runs.colStatus')].map((h) => (
                  <th key={h} className="border-b border-[rgba(59,46,36,.08)] px-[17px] py-2 text-left text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">{r.bizDate}</td>
                  <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2 font-semibold text-ink">{r.templateTitle}</td>
                  <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2 text-[rgba(59,46,36,.62)]">{r.doneByName ?? r.staffName ?? '—'}</td>
                  <td className="border-b border-[rgba(59,46,36,.06)] px-[17px] py-2">
                    <Badge tone={r.status === 'done' ? 'success' : r.status === 'missed' ? 'danger' : 'muted'}>{runStatusLabel(r.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </MainScaffold>
  );
}
