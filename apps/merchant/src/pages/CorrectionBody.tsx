/**
 * 数据订正端口内核（端口批收尾片 2 · 数据 3 之② · ConsolePage D4 直嵌件，仿 ConfigDictBody 结构）。
 *
 * 三类订正（stored_value 储值余额 / rebate 回馈金 / work_hours 考勤工时）：
 * - 发起表单（owner；server correction.propose=merchantOwnerProcedure 硬闸）：
 *   储值/回馈金=手机号/昵称模糊搜会员（pass.listCustomers 本店客户名册全量取回本地过滤，
 *   该口无服务端搜索参——选型报备）选中 users.id → 本金/赠送或余额新绝对值（分）+事由；
 *   工时=员工选择（store.staffList）+打卡日期 → attendance.exceptionQueue.flaggedRecords
 *   按 staffId+date 过滤定位 attendance_records.id（既有口仅透当月防代打标记记录——选型
 *   报备，无命中给手输记录 ID 兜底）+ 新时刻 datetime-local + 事由；
 * - 订正单队列（correction.list 本店联查，pending 在前）：类章/目标/前后值（分→元）/事由/
 *   发起人/状态；pending 行「通过」「驳回」→ correction.review（驳回 note 必填拦截）；
 * - 红线注记条：订正=前后值留痕+审批通过才生效；不回溯已封箱（日结/月结快照不重算）。
 */

import { Skeleton, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { fenToYuan } from '../components/mall-admin/format';
import { ck } from '../copy/correction';

type Trpc = PhiliaClient['trpc'];
type CorrListOut = Awaited<ReturnType<Trpc['correction']['list']['query']>>;
type CorrItem = CorrListOut['items'][number];
type CorrKind = 'stored_value' | 'rebate' | 'work_hours';
type FlaggedRec = Awaited<ReturnType<Trpc['attendance']['exceptionQueue']['query']>>['flaggedRecords'][number];

const KIND_BADGE: Record<CorrKind, { label: string }> = {
  stored_value: { label: ck('corr.kindStored') },
  rebate: { label: ck('corr.kindRebate') },
  work_hours: { label: ck('corr.kindWorkHours') },
};

/** 三类页签签（render 期取键——端口覆盖值后加载，模块级冻结会丢覆盖） */
const TAB_LABEL: Record<CorrKind, string> = {
  stored_value: ck('corr.tabStored'),
  rebate: ck('corr.tabRebate'),
  work_hours: ck('corr.tabWorkHours'),
};

/** 时刻透出（superjson Date 或串防御，同 AnnouncementsPage 工艺） */
function fmtAt(at: Date | string | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 前后值摘要（分→元格式化；工时=时刻串；字段签走 copy 键） */
function fmtPayload(kind: string, payload: Record<string, unknown> | null | undefined): string {
  if (!payload) return '—';
  if (kind === 'stored_value') {
    const pv = payload as { principalFen?: number; bonusFen?: number };
    return `${ck('corr.fmtPrincipal')} ¥${fenToYuan(pv.principalFen ?? 0)} · ${ck('corr.fmtBonus')} ¥${fenToYuan(pv.bonusFen ?? 0)}`;
  }
  if (kind === 'rebate') {
    const bv = payload as { balanceFen?: number };
    return `¥${fenToYuan(bv.balanceFen ?? 0)}`;
  }
  const tv = payload as { ts?: string };
  return fmtAt(tv.ts ?? null);
}

/** 非负整数分输入解析（空串=null 不合法） */
function parseFen(t: string): number | null {
  const v = Number(t.trim());
  if (t.trim() === '' || !Number.isInteger(v) || v < 0) return null;
  return v;
}

export function CorrectionBody() {
  const { trpc, queryClient } = usePhiliaClient();

  /* ---------------- 数据源 ---------------- */
  const listQuery = useQuery({
    queryKey: ['correction', 'list'],
    queryFn: () => trpc.correction.list.query({}),
  });
  const customersQuery = useQuery({
    queryKey: ['pass', 'listCustomers'],
    queryFn: () => trpc.pass.listCustomers.query(),
  });
  const staffQuery = useQuery({
    queryKey: ['store', 'staffList'],
    queryFn: () => trpc.store.staffList.query(),
  });
  /* 工时记录定位口（既有口仅透当月 flagged 记录，选型报备见文件头） */
  const attQuery = useQuery({
    queryKey: ['attendance', 'exceptionQueue'],
    queryFn: () => trpc.attendance.exceptionQueue.query(),
  });

  const invalidateList = () => void queryClient.invalidateQueries({ queryKey: ['correction', 'list'] });

  /** users.id → 昵称（队列目标显名用；名册外 fallback 截断 id） */
  const nicknameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of customersQuery.data?.customers ?? []) m.set(c.id, c.nickname ?? c.id);
    return (id: string) => m.get(id) ?? `${id.slice(0, 12)}…`;
  }, [customersQuery.data]);
  /** staffId → 姓名 */
  const staffNameOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffQuery.data?.staff ?? []) m.set(s.id, s.name);
    return (id: string | null | undefined) => (id ? (m.get(id) ?? `${id.slice(0, 12)}…`) : '—');
  }, [staffQuery.data]);
  /** recordId → staffId（工时队列目标显名用） */
  const recordStaffOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of attQuery.data?.flaggedRecords ?? []) m.set(r.id, r.staffId);
    return (id: string) => staffNameOf(m.get(id) ?? null);
  }, [attQuery.data, staffNameOf]);

  /* ---------------- 页签 + 表单态 ---------------- */
  const [kind, setKind] = useState<CorrKind>('stored_value');
  const [memberKw, setMemberKw] = useState('');
  const [memberId, setMemberId] = useState('');
  const [principalText, setPrincipalText] = useState('');
  const [bonusText, setBonusText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [recordId, setRecordId] = useState('');
  const [manualRecordId, setManualRecordId] = useState('');
  const [tsInput, setTsInput] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  /** 会员模糊搜（手机号/昵称 contains，本地过滤名册） */
  const memberHits = useMemo(() => {
    const q = memberKw.trim().toLowerCase();
    const all = customersQuery.data?.customers ?? [];
    if (q === '') return all.slice(0, 8);
    return all
      .filter((c) => (c.phone ?? '').includes(q) || (c.nickname ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [customersQuery.data, memberKw]);

  /** 工时候选记录（staffId+date 过滤 flaggedRecords） */
  const recordHits = useMemo(() => {
    const all = attQuery.data?.flaggedRecords ?? [];
    if (!staffId || !date) return [];
    return all.filter((r) => r.staffId === staffId && r.date === date);
  }, [attQuery.data, staffId, date]);

  const resetForm = () => {
    setMemberKw('');
    setMemberId('');
    setPrincipalText('');
    setBonusText('');
    setBalanceText('');
    setStaffId('');
    setDate('');
    setRecordId('');
    setManualRecordId('');
    setTsInput('');
    setNote('');
  };

  const submit = async () => {
    let input: Parameters<Trpc['correction']['propose']['mutate']>[0];
    if (kind === 'stored_value') {
      const principalFen = parseFen(principalText);
      const bonusFen = parseFen(bonusText);
      if (!memberId || principalFen === null || bonusFen === null || note.trim() === '') {
        toast(ck('corr.invalid'), 'error');
        return;
      }
      input = { kind, targetKey: memberId, note: note.trim(), principalFen, bonusFen };
    } else if (kind === 'rebate') {
      const balanceFen = parseFen(balanceText);
      if (!memberId || balanceFen === null || note.trim() === '') {
        toast(ck('corr.invalid'), 'error');
        return;
      }
      input = { kind, targetKey: memberId, note: note.trim(), balanceFen };
    } else {
      const rid = recordId || manualRecordId.trim();
      if (!rid || tsInput.trim() === '' || note.trim() === '') {
        toast(ck('corr.invalid'), 'error');
        return;
      }
      input = { kind, targetKey: rid, note: note.trim(), ts: new Date(tsInput).toISOString() };
    }
    setBusy(true);
    try {
      await trpc.correction.propose.mutate(input);
      toast(ck('corr.proposed'));
      resetForm();
      invalidateList();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- 队列 + 复核 ---------------- */
  const items = useMemo(() => {
    const all = [...(listQuery.data?.items ?? [])];
    return all.sort((a, b) => {
      if ((a.correction.status === 'pending') !== (b.correction.status === 'pending'))
        return a.correction.status === 'pending' ? -1 : 1;
      return new Date(b.correction.createdAt).getTime() - new Date(a.correction.createdAt).getTime();
    });
  }, [listQuery.data]);

  const statusLabel = (s: string) =>
    s === 'pending' ? ck('corr.statusPending') : s === 'applied' ? ck('corr.statusApplied') : ck('corr.statusRejected');

  const targetLabel = (it: CorrItem): string => {
    if (it.correction.kind === 'work_hours') return recordStaffOf(it.correction.targetKey);
    return nicknameOf(it.correction.targetKey);
  };

  const doReview = async (approvalId: string, approve: boolean) => {
    let reviewNote: string | undefined;
    if (approve) {
      if (!window.confirm(ck('corr.approveConfirm'))) return;
    } else {
      const input = window.prompt(ck('corr.rejectNotePrompt'));
      if (input === null) return;
      if (input.trim() === '') {
        toast(ck('corr.rejectNoteRequired'), 'error');
        return;
      }
      reviewNote = input.trim();
    }
    try {
      await trpc.correction.review.mutate({ requestId: approvalId, approve, ...(reviewNote ? { note: reviewNote } : {}) });
      toast(approve ? ck('corr.approved') : ck('corr.rejected'));
      invalidateList();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const memberPicker = (
    <>
      <Field label={ck('corr.memberPickLabel')}>
        <input
          className={inputCls}
          data-testid="corr-member-search"
          placeholder={ck('corr.memberSearchPh')}
          value={memberKw}
          onChange={(e) => {
            setMemberKw(e.target.value);
            setMemberId('');
          }}
        />
      </Field>
      {memberHits.length === 0 ? (
        <p className="text-caption-xs text-[rgba(59,46,36,.42)]">{ck('corr.memberEmpty')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {memberHits.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`corr-member-${c.id}`}
              onClick={() => setMemberId(c.id)}
              className={`rounded-full px-3 py-[7px] text-caption transition-colors ${
                memberId === c.id ? 'bg-[#3B2E24] font-semibold text-[#FAF8F2]' : 'u1-ring bg-card text-[rgba(59,46,36,.6)]'
              }`}
            >
              {c.nickname ?? '—'}（{c.phone ?? '—'}）
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <ToasterMount />
      <section className="wsk-card" data-testid="console-correction-port">
        <div className="wsk-hd">
          <span className="t">{ck('corr.title')}</span>
          <span className="a">{ck('corr.aside')}</span>
        </div>

        {/* 红线注记条（不回溯已封箱） */}
        <p
          className="mb-3 rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep"
          data-testid="corr-redline"
        >
          {ck('corr.redlineNote')}
        </p>

        {/* 三类页签 */}
        <div className="mb-3 flex gap-1.5" role="tablist">
          {(['stored_value', 'rebate', 'work_hours'] as CorrKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              data-testid={`corr-tab-${k}`}
              onClick={() => setKind(k)}
              className={`rounded-full px-3.5 py-[7px] text-caption transition-colors ${
                kind === k ? 'bg-[#3B2E24] font-semibold text-[#FAF8F2]' : 'text-[rgba(59,46,36,.6)]'
              }`}
            >
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        {/* 发起表单（owner；server merchantOwnerProcedure 硬闸） */}
        <div className="mb-3 rounded-panel bg-canvas px-3.5 py-3">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-caption font-semibold text-ink">{ck('corr.formTitle')}</span>
            <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{ck('corr.formAside')}</span>
          </div>
          <div className="space-y-2.5">
            {kind !== 'work_hours' ? memberPicker : null}
            {kind === 'stored_value' ? (
              <div className="flex flex-wrap gap-3">
                <Field label={ck('corr.principalLabel')}>
                  <input
                    className={inputCls}
                    style={numStyle}
                    inputMode="numeric"
                    data-testid="corr-principal"
                    value={principalText}
                    onChange={(e) => setPrincipalText(e.target.value)}
                  />
                </Field>
                <Field label={ck('corr.bonusLabel')}>
                  <input
                    className={inputCls}
                    style={numStyle}
                    inputMode="numeric"
                    data-testid="corr-bonus"
                    value={bonusText}
                    onChange={(e) => setBonusText(e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
            {kind === 'rebate' ? (
              <Field label={ck('corr.balanceLabel')}>
                <input
                  className={inputCls}
                  style={numStyle}
                  inputMode="numeric"
                  data-testid="corr-balance"
                  value={balanceText}
                  onChange={(e) => setBalanceText(e.target.value)}
                />
              </Field>
            ) : null}
            {kind === 'work_hours' ? (
              <>
                <div className="flex flex-wrap gap-3">
                  <Field label={ck('corr.staffPickLabel')}>
                    <select
                      className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
                      data-testid="corr-staff"
                      value={staffId}
                      onChange={(e) => {
                        setStaffId(e.target.value);
                        setRecordId('');
                      }}
                    >
                      <option value="">—</option>
                      {(staffQuery.data?.staff ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={ck('corr.dateLabel')}>
                    <input
                      type="date"
                      className={inputCls}
                      data-testid="corr-date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setRecordId('');
                      }}
                    />
                  </Field>
                </div>
                {staffId && date ? (
                  <div>
                    <div className="mb-1 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">
                      {ck('corr.recordPickLabel')}
                    </div>
                  {recordHits.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {recordHits.map((r: FlaggedRec) => (
                        <button
                          key={r.id}
                          type="button"
                          data-testid={`corr-record-${r.id}`}
                          onClick={() => setRecordId(r.id)}
                          className={`rounded-full px-3 py-[7px] text-caption transition-colors ${
                            recordId === r.id
                              ? 'bg-[#3B2E24] font-semibold text-[#FAF8F2]'
                              : 'u1-ring bg-card text-[rgba(59,46,36,.6)]'
                          }`}
                        >
                          {r.kind} · {fmtAt(r.ts)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-caption-xs text-[rgba(59,46,36,.42)]">{ck('corr.recordEmpty')}</p>
                  )}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Field label={ck('corr.recordManualLabel')}>
                    <input
                      className={inputCls}
                      data-testid="corr-record-manual"
                      value={manualRecordId}
                      onChange={(e) => {
                        setManualRecordId(e.target.value);
                        setRecordId('');
                      }}
                    />
                  </Field>
                  <Field label={ck('corr.tsLabel')}>
                    <input
                      type="datetime-local"
                      className={inputCls}
                      data-testid="corr-ts"
                      value={tsInput}
                      onChange={(e) => setTsInput(e.target.value)}
                    />
                  </Field>
                </div>
              </>
            ) : null}
            <Field label={ck('corr.noteLabel')}>
              <input
                className={inputCls}
                data-testid="corr-note"
                placeholder={ck('corr.notePh')}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <div>
              <Btn variant="primary" size="sm" data-testid="corr-propose-submit" disabled={busy} onClick={() => void submit()}>
                {ck('corr.submitCta')}
              </Btn>
            </div>
          </div>
        </div>

        {/* 订正单队列（pending 在前） */}
        <div className="wsk-hd mb-1">
          <span className="t">{ck('corr.queueTitle')}</span>
          <span className="a">{ck('corr.queueAside')}</span>
        </div>
        <div data-testid="corr-queue">
          {listQuery.isPending ? (
            <div className="space-y-2" aria-label="加载中">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-9 rounded-control" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <p className="py-3 text-center text-caption-xs text-danger-deep">
              {ck('corr.loadFail')}：{errMsg(listQuery.error)}
            </p>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{ck('corr.queueEmpty')}</p>
          ) : (
            items.map((it) => (
              <div key={it.correction.id} className="border-t border-[rgba(59,46,36,.06)] py-[11px] first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge tone="brand">{KIND_BADGE[it.correction.kind as CorrKind]?.label ?? it.correction.kind}</Badge>
                      <span className="text-caption font-semibold text-ink">{targetLabel(it)}</span>
                    </div>
                    <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.62)]" style={numStyle}>
                      {fmtPayload(it.correction.kind, it.correction.payloadJson?.before as Record<string, unknown>)}
                      {' → '}
                      <span className="font-semibold text-ink">
                        {fmtPayload(it.correction.kind, it.correction.payloadJson?.after as Record<string, unknown>)}
                      </span>
                    </div>
                    <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]">
                      {it.correction.note} · {it.proposerNickname ?? '—'} · {fmtAt(it.correction.createdAt)}
                    </div>
                    {it.reviewNote ? (
                      <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]">{it.reviewNote}</div>
                    ) : null}
                  </div>
                  <Badge
                    tone={
                      it.correction.status === 'pending' ? 'warn' : it.correction.status === 'applied' ? 'success' : 'danger'
                    }
                  >
                    {statusLabel(it.correction.status)}
                  </Badge>
                </div>
                {it.correction.status === 'pending' && it.approvalId ? (
                  <div className="mt-2 flex gap-2">
                    <Btn
                      variant="primary"
                      size="sm"
                      data-testid={`corr-approve-${it.approvalId}`}
                      onClick={() => void doReview(it.approvalId!, true)}
                    >
                      {ck('corr.approveCta')}
                    </Btn>
                    <Btn
                      variant="danger"
                      size="sm"
                      data-testid={`corr-reject-${it.approvalId}`}
                      onClick={() => void doReview(it.approvalId!, false)}
                    >
                      {ck('corr.rejectCta')}
                    </Btn>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
