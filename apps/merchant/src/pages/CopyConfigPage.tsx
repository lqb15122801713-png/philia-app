/**
 * 文案端口页（端口批片 B · CJ-1002-01 · 控制台第七域「文案」）
 *
 * 冻结口径：
 * - 仅 owner：墨轨入口按 isOwner 收起；本页自装页内闸门（非 owner → RoleGuidePage 引导页，
 *   非 403 白屏）；server 端 merchantOwnerProcedure 为硬闸门；
 * - 数据源：config.list({domain:'copy'})（仅 active 行进编辑器，active=0 历史行不显示）+
 *   config.versions({domain:'copy', limit:20})（留痕区）；
 * - 域分组：行 label=域分组（member / refund / merchant:cashier / copyport …），列表按 label
 *   分组展示，组头=域名+键数；
 * - 筛选：搜索（键名或文案 contains，大小写不敏感）+ 域下拉（全部+label 去重计数）+
 *   两个 toggle（只看高危 / 只看已改，已改=active 行 version>1）；
 * - 编辑模型：pendingChanges Map<ruleKey, newText>，有 pending 时底部浮动保存条；
 * - 保存=危险操作 D 套同族：变更摘要逐条（键名+前值→后值）；含高危键（涉钱/涉协议/涉会员
 *   口径，server 判定随行下发 highRisk）→ 警示区+口令输入框，键入「确认保存」四字解锁；
 *   确认 → config.save（confirmedHighRisk=pending 中高危键名单）→ 失效 list/versions/
 *   copyOverrides 三键 + toast；失败 toast 附服务端 message 明文（禁令词/高危未确认/未知键）；
 * - 保存即生效=只管新渲染（copy_overrides 覆盖层 120s 轮询兜底，本页 invalidate 立即拉新）。
 */

import { Skeleton, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold, { SearchInput } from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Field, Modal, numStyle, Switch, toast, ToasterMount } from '../components/staff-admin/ui';
import { cp } from '../copy/copyPort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 类型锚点（server AppRouter 推导，构建期擦除）                          */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc'];
type ListOut = Awaited<ReturnType<Trpc['config']['list']['query']>>;
type RuleRow = ListOut['rules'][number];
type VersionsOut = Awaited<ReturnType<Trpc['config']['versions']['query']>>;
type VersionRow = VersionsOut['versions'][number];

const DOMAIN = 'copy' as const;

/** copy 域值形状 { text }：取文案串（非串/空对象 → ''） */
function textOf(valueJson: unknown): string {
  if (valueJson && typeof valueJson === 'object' && !Array.isArray(valueJson)) {
    const t = (valueJson as Record<string, unknown>).text;
    if (typeof t === 'string') return t;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* 页面主体（owner）                                                     */
/* ------------------------------------------------------------------ */

/* 片 5 段 3（W-16 共构不分叉）：页面内核导出（含三态与 ToasterMount，不含
   MainScaffold 页头），供 ConsolePage 右栏直嵌；本页默认出口行为不变 */
export function CopyConfigBody() {
  const { trpc, queryClient } = usePhiliaClient();

  const listQuery = useQuery({
    queryKey: ['config', 'list', DOMAIN],
    queryFn: () => trpc.config.list.query({ domain: DOMAIN }),
  });
  const versionsQuery = useQuery({
    queryKey: ['config', 'versions', DOMAIN],
    queryFn: () => trpc.config.versions.query({ domain: DOMAIN, limit: 20 }),
  });

  /* 仅 active 行进编辑器（active=0 历史行不显示） */
  const rows = useMemo(() => (listQuery.data?.rules ?? []).filter((r) => r.active), [listQuery.data]);
  const textByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.ruleKey, textOf(r.valueJson));
    return m;
  }, [rows]);

  /* ---------------- 筛选 ---------------- */
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [onlyHighRisk, setOnlyHighRisk] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);

  /* 域下拉：label 去重计数（按字典序稳定排列） */
  const domainCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.label, (m.get(r.label) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (domainFilter !== '' && r.label !== domainFilter) return false;
      if (onlyHighRisk && !r.highRisk) return false;
      if (onlyChanged && r.version <= 1) return false;
      if (q !== '') {
        const text = textByKey.get(r.ruleKey) ?? '';
        if (!r.ruleKey.toLowerCase().includes(q) && !text.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, domainFilter, onlyHighRisk, onlyChanged, search, textByKey]);

  /* 按 label 分组（组内保序=server 返回的键名升序） */
  const groups = useMemo(() => {
    const m = new Map<string, RuleRow[]>();
    for (const r of filtered) {
      const arr = m.get(r.label);
      if (arr) arr.push(r);
      else m.set(r.label, [r]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  /* ---------------- 编辑模型：pendingChanges Map<ruleKey, newText> ---------------- */
  const [pending, setPending] = useState<Map<string, string>>(new Map());
  const [openKey, setOpenKey] = useState<string | null>(null);

  /** 草稿回填：与现值相同即撤出 pending（无净变更不入保存条） */
  const setDraft = (ruleKey: string, text: string) => {
    setPending((prev) => {
      const next = new Map(prev);
      if (text === (textByKey.get(ruleKey) ?? '')) next.delete(ruleKey);
      else next.set(ruleKey, text);
      return next;
    });
  };

  const pendingList = useMemo(() => {
    const rowByKey = new Map(rows.map((r) => [r.ruleKey, r]));
    return [...pending.entries()].map(([ruleKey, after]) => ({
      ruleKey,
      after,
      before: textByKey.get(ruleKey) ?? '',
      highRisk: rowByKey.get(ruleKey)?.highRisk ?? false,
    }));
  }, [pending, rows, textByKey]);
  const highRiskPending = useMemo(() => pendingList.filter((p) => p.highRisk), [pendingList]);

  /* ---------------- 保存（含高危键 → 口令重确认弹层） ---------------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);
  const phrase = cp('copyport.confirmOk');
  const phraseOk = confirmText.trim() === phrase;
  const needPhrase = highRiskPending.length > 0;

  const openConfirm = () => {
    if (pendingList.length === 0) return;
    setConfirmText('');
    setConfirmOpen(true);
  };

  const doSave = async () => {
    if (needPhrase && !phraseOk) return;
    setSaving(true);
    try {
      await trpc.config.save.mutate({
        domain: DOMAIN,
        changes: pendingList.map((p) => ({ ruleKey: p.ruleKey, valueJson: { text: p.after } })),
        confirmedHighRisk: highRiskPending.map((p) => p.ruleKey),
      });
      toast(cp('copyport.savedToast'));
      setConfirmOpen(false);
      setConfirmText('');
      setPending(new Map());
      setOpenKey(null);
      await queryClient.invalidateQueries({ queryKey: ['config', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['config', 'versions'] });
      await queryClient.invalidateQueries({ queryKey: ['copyOverrides'] });
    } catch (e) {
      /* 失败明文透出（禁令词/高危未确认/未知键 server 均给明文 message） */
      toast(`${cp('copyport.saveFail')}：${errMsg(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- 加载 / 错误三态 ---------------- */
  if (listQuery.isPending) {
    return (
      <div className="u3-panel" aria-label="加载中">
        <div className="u3-panel-head">
          <Skeleton className="h-4 w-24 rounded-chip" />
        </div>
        {['w-[46%]', 'w-[55%]', 'w-[64%]', 'w-[73%]', 'w-[82%]'].map((w, i) => (
          <div key={i} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-4">
            <Skeleton className={`h-3 rounded-chip ${w}`} />
            <Skeleton className="mt-2 h-8 w-2/3 rounded-control" />
          </div>
        ))}
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="rounded-panel bg-[#FFFDF6] py-12 text-center shadow-hairline ring-1 ring-line-ring">
        <div className="text-body-sm text-[rgba(59,46,36,.62)]">{errMsg(listQuery.error)}</div>
        <Btn variant="ghost" size="sm" className="mt-3" onClick={() => void listQuery.refetch()}>
          {cp('copyport.loadFail')}
        </Btn>
      </div>
    );
  }

  return (
    <>
      <ToasterMount />

      {/* 工具行：搜索 + 域下拉 + 只看高危/只看已改 */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder={cp('copyport.searchPlaceholder')}
          value={search}
          onChange={setSearch}
          testid="copyport-search"
        />
        <select
          data-testid="copyport-domain-select"
          className="u1-ring rounded-control bg-card px-3 py-3.5 text-caption text-ink focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        >
          <option value="">
            {cp('copyport.pageTitle')} · {cp('copyport.keysCount', { n: rows.length })}
          </option>
          {domainCounts.map(([label, n]) => (
            <option key={label} value={label}>
              {label} · {cp('copyport.keysCount', { n })}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1.5 text-caption text-ink-secondary">
          <span data-testid="copyport-filter-highrisk" className="inline-flex">
            <Switch checked={onlyHighRisk} onChange={setOnlyHighRisk} label={cp('copyport.filterHighRisk')} />
          </span>
          {cp('copyport.filterHighRisk')}
        </span>
        <span className="flex items-center gap-1.5 text-caption text-ink-secondary">
          <span data-testid="copyport-filter-changed" className="inline-flex">
            <Switch checked={onlyChanged} onChange={setOnlyChanged} label={cp('copyport.filterChanged')} />
          </span>
          {cp('copyport.filterChanged')}
        </span>
      </div>

      {/* 键列表（按 label 分组） */}
      {groups.length === 0 ? (
        <div className="rounded-panel bg-[#FFFDF6] py-12 text-center shadow-hairline ring-1 ring-line-ring">
          <div className="text-body-sm text-[rgba(59,46,36,.62)]">{cp('copyport.emptyDomain')}</div>
        </div>
      ) : (
        groups.map(([label, rs]) => (
          <div key={label} className="u3-panel mb-3.5">
            <div className="u3-panel-head">
              <h3>{label}</h3>
              <span className="aside" style={numStyle}>
                {cp('copyport.keysCount', { n: rs.length })}
              </span>
            </div>
            {rs.map((r) => {
              const cur = textByKey.get(r.ruleKey) ?? '';
              const draft = pending.get(r.ruleKey);
              const open = openKey === r.ruleKey;
              return (
                <div
                  key={r.ruleKey}
                  data-testid={`copyport-row-${r.ruleKey}`}
                  className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-[13px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-caption font-semibold text-ink">{r.ruleKey}</span>
                        {r.highRisk ? <Badge tone="danger">{cp('copyport.highRiskBadge')}</Badge> : null}
                        {r.version > 1 ? (
                          <Badge tone="brand">{cp('copyport.changedBadge')}</Badge>
                        ) : (
                          <Badge tone="muted">{cp('copyport.defaultNote')}</Badge>
                        )}
                      </div>
                      <div className="mt-1 truncate text-caption-xs text-[rgba(59,46,36,.62)]">
                        {draft ?? cur}
                      </div>
                    </div>
                    <Btn
                      variant="ghost"
                      size="sm"
                      data-testid={`copyport-edit-${r.ruleKey}`}
                      onClick={() => setOpenKey(open ? null : r.ruleKey)}
                    >
                      {open ? cp('copyport.editCancel') : cp('copyport.editCta')}
                    </Btn>
                  </div>
                  {open ? (
                    <textarea
                      className="mt-2.5 min-h-[72px] w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
                      rows={3}
                      value={draft ?? cur}
                      onChange={(e) => setDraft(r.ruleKey, e.target.value)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))
      )}

      {/* 待保存条（有 pending 才浮出） */}
      {pendingList.length > 0 ? (
        <div
          className="u1-ring sticky bottom-4 z-10 mt-3.5 flex items-center justify-between gap-3 rounded-panel bg-card px-4 py-3 shadow-elevated"
          data-testid="copyport-savebar"
        >
          <span className="text-caption text-ink" style={numStyle}>
            {cp('copyport.pendingBar', { n: pendingList.length })}
          </span>
          <Btn
            variant="primary"
            size="sm"
            data-testid="copyport-save-open"
            onClick={openConfirm}
            disabled={saving}
          >
            {cp('copyport.saveCta')}
          </Btn>
        </div>
      ) : null}

      {/* 变更留痕 */}
      <div className="u3-panel mt-3.5" data-testid="copyport-history">
        <div className="u3-panel-head">
          <h3>{cp('copyport.historyTitle')}</h3>
        </div>
        {versionsQuery.isPending ? (
          <div className="space-y-2 px-[17px] py-4" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-control" />
            ))}
          </div>
        ) : versionsQuery.isError ? (
          <div className="px-[17px] py-4 text-caption-xs text-danger-deep">
            {errMsg(versionsQuery.error)}
            <button
              type="button"
              className="ml-2 font-bold text-ink underline underline-offset-2"
              onClick={() => void versionsQuery.refetch()}
            >
              {cp('copyport.loadFail')}
            </button>
          </div>
        ) : (versionsQuery.data?.versions.length ?? 0) === 0 ? (
          <div className="px-[17px] py-6 text-center text-caption-xs text-[rgba(59,46,36,.42)]">
            {cp('copyport.historyEmpty')}
          </div>
        ) : (
          versionsQuery.data!.versions.map((v: VersionRow) => (
            <div key={v.id} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-[13px]">
              <div className="flex items-center gap-3">
                <Badge tone="brand">{cp('copyport.historyVersion', { version: v.version })}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-caption text-ink">
                    {cp('copyport.historyBy', { name: v.changerNickname ?? '—' })}
                  </div>
                  <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                    {fmtDateTime(v.createdAt)}
                  </div>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {v.changesJson.map((ch) => (
                  <div key={ch.rule_key} className="rounded-control bg-canvas px-3 py-2">
                    <div className="font-mono text-caption font-semibold text-ink">{ch.rule_key}</div>
                    <div className="mt-1 break-all text-caption-xs text-[rgba(59,46,36,.62)]">
                      {ch.before === null ? (
                        <span className="font-semibold text-ink">{textOf(ch.after) || '—'}</span>
                      ) : (
                        <>
                          {textOf(ch.before) || '—'} →{' '}
                          <span className="font-semibold text-ink">{textOf(ch.after) || '—'}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 保存确认弹层（变更摘要 + 高危键口令重确认） */}
      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        title={cp('copyport.confirmTitle')}
        widthClass="max-w-xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              {cp('copyport.confirmCancel')}
            </Btn>
            <Btn
              variant="danger"
              data-testid="copyport-confirm-ok"
              onClick={() => void doSave()}
              disabled={saving || (needPhrase && !phraseOk)}
            >
              {saving ? cp('copyport.saveCta') : cp('copyport.confirmOk')}
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-caption text-ink">{cp('copyport.confirmBody', { n: pendingList.length })}</p>
          <div className="space-y-2">
            {pendingList.map((p) => (
              <div key={p.ruleKey} className="rounded-control bg-canvas px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-caption font-semibold text-ink">{p.ruleKey}</span>
                  {p.highRisk ? <Badge tone="danger">{cp('copyport.highRiskBadge')}</Badge> : null}
                </div>
                <div className="mt-1 break-all text-caption-xs text-[rgba(59,46,36,.62)]">
                  {p.before || '—'} → <span className="font-semibold text-ink">{p.after || '—'}</span>
                </div>
              </div>
            ))}
          </div>
          {needPhrase ? (
            <>
              <div className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
                <div className="font-semibold">{cp('copyport.confirmHighRiskTitle')}</div>
                <div className="mt-0.5">{cp('copyport.confirmHighRiskBody', { n: highRiskPending.length })}</div>
              </div>
              <Field
                label={cp('copyport.confirmPlaceholder')}
                hint={confirmText !== '' && !phraseOk ? cp('copyport.confirmMismatch') : undefined}
              >
                <input
                  className="w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring placeholder:text-ink-placeholder focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
                  data-testid="copyport-confirm-input"
                  placeholder={cp('copyport.confirmPlaceholder')}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={saving}
                />
              </Field>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

/** 页头装配（默认出口行为不变：MainScaffold + 内核体） */
function OwnerCopyConfig() {
  return (
    <MainScaffold title={cp('copyport.pageTitle')} sub={cp('copyport.pageSub')} testid="copyport-page">
      <CopyConfigBody />
    </MainScaffold>
  );
}

/* ------------------------------------------------------------------ */
/* 页内 owner 闸门（非 owner → 引导页，非 403 白屏；server 硬闸门兜底）      */
/* ------------------------------------------------------------------ */

export default function CopyConfigPage() {
  const role = useMerchantRole();
  if (!role.isOwner) {
    return <RoleGuidePage title={cp('copyport.ownerOnly')} hint={cp('copyport.ownerOnlyBody')} />;
  }
  return <OwnerCopyConfig />;
}
