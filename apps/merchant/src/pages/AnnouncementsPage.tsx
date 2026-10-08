/**
 * 公告 /settings/announcements（员工端骨架整建批 片 3 B6-1 · 商家端）
 *
 * 数据源=announce namespace（server 由 coder G 并行施工，契约经
 * lib/taskCollabPort.ts 收窄桥接——AppRouter 落地后桥退役改推导）：
 * - 发布表单：标题+正文+定向角色（全员/前台/美容师）+置顶开关 → announce.publish；
 * - 公告列表（新→旧、置顶在前）：readCount 透出「已读 x/y」（targetTotal 未透出
 *   时降级只显分子）；archived 灰态 + 仅 published 行出「撤下」钮（archive）；
 * - 行内展开「回执 ›」→ announce.reads 对账（已读名单+时刻 / 未读名单）。
 *
 * 权限三层照排班页：墨轨/设置入口 clerk 不可见 + App.tsx ClerkRouteGuard
 * 引导页 + 页内 useMerchantRole 非 owner/manager → RoleGuidePage。
 *
 * 端口批收尾片 2（运营内容 2 之④ · 两步流+起止+预览+回收站软删）：
 * - 表单区加「新建草稿」（saveDraft；编辑既有草稿载入表单，保存仍为草稿）；
 * - manager 列表按 status 三分区：草稿区（编辑/发布/删除三钮）/已发布区/已撤下区；
 * - 「发布」→ 发布弹层（startsAt/endsAt datetime-local 可空=不限 + 公告卡片预览
 *   子区 ann-preview）→ publishDraft；「删除」→ 二次确认 → remove（回收站软删）；
 * - 已发布行有起止显「{起} ~ {止}」小字；未到点/已过点懒算「待生效」/「已截止」章
 *   （同 promo 口径）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, Modal, Switch, toast, ToasterMount } from '../components/staff-admin/ui';
import { an } from '../copy/announcements';
import { collabOf, type AnnouncementRow, type AnnounceTargetRole } from '../lib/taskCollabPort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 助手                                                                */
/* ------------------------------------------------------------------ */

/** 时刻透出（superjson Date 或串防御） */
function fmtAt(at: Date | string | null | undefined): string {
  if (!at) return '—';
  const d = typeof at === 'string' ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 定向角色签（render 期取键——端口覆盖值后加载，模块级冻结会丢覆盖） */
function targetLabel(role: AnnounceTargetRole): string {
  if (role === 'frontdesk') return an('ann.pub.targetFrontdesk');
  if (role === 'groomer') return an('ann.pub.targetGroomer');
  return an('ann.pub.targetAll');
}

/* ------------------------------------------------------------------ */
/* 回执对账（行内展开：已读名单+时刻 / 未读名单）                            */
/* ------------------------------------------------------------------ */

function ReceiptsPanel({ announcementId }: { announcementId: string }) {
  const { trpc } = usePhiliaClient();
  const collab = useMemo(() => collabOf(trpc), [trpc]);
  const readsQ = useQuery({
    queryKey: ['announce', 'reads', announcementId],
    queryFn: () => collab.announce.reads.query({ announcementId }),
  });

  if (readsQ.isPending) {
    return (
      <div className="px-[17px] py-3" aria-label="加载中">
        <Skeleton className="h-10 !rounded-[16px]" />
      </div>
    );
  }
  if (readsQ.isError || !readsQ.data) {
    return (
      <div className="px-[17px] py-3">
        <p className="text-caption text-[rgba(59,46,36,.62)]">{an('ann.common.loadFail')}</p>
        <Btn variant="subtle" size="sm" className="mt-2" onClick={() => void readsQ.refetch()}>
          {an('ann.common.retry')}
        </Btn>
      </div>
    );
  }
  const { read, unread } = readsQ.data;
  if (read.length === 0 && unread.length === 0) {
    return <p className="px-[17px] py-3 text-caption text-[rgba(59,46,36,.42)]">{an('ann.reads.empty')}</p>;
  }
  return (
    <div className="grid gap-3 px-[17px] py-3 sm:grid-cols-2" data-testid={`ann-reads-${announcementId}`}>
      <div>
        <p className="mb-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
          {an('ann.reads.readCol', { n: read.length })}
        </p>
        {read.map((r) => (
          <div key={r.staffId} className="flex items-center justify-between py-1 text-caption text-ink">
            <span>{r.name}</span>
            <span className="u1-num text-caption-xs text-[rgba(59,46,36,.42)]">{fmtAt(r.readAt)}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
          {an('ann.reads.unreadCol', { n: unread.length })}
        </p>
        {unread.map((r) => (
          <div key={r.staffId} className="py-1 text-caption text-[rgba(59,46,36,.62)]">
            {r.name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function AnnouncementsPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();
  const collab = useMemo(() => collabOf(trpc), [trpc]);

  const listQ = useQuery({
    queryKey: ['announce', 'list'],
    queryFn: () => collab.announce.list.query(),
  });
  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['announce'] });

  /* ---- 发布表单 ---- */
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState<AnnounceTargetRole>('all');
  const [pinned, setPinned] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast(an('ann.pub.invalid'), 'error');
      return;
    }
    setPubBusy(true);
    try {
      await collab.announce.publish.mutate({ title: title.trim(), body: body.trim(), targetRole, ...(pinned ? { pinned } : {}) });
      toast(an('ann.pub.published'));
      resetForm();
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setPubBusy(false);
    }
  };

  /* ---- 端口批收尾片 2 · 两步流：新建草稿（saveDraft）→ 列表「发布」（publishDraft 弹层） ---- */
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  function resetForm() {
    setTitle('');
    setBody('');
    setTargetRole('all');
    setPinned(false);
    setEditingDraftId(null);
  }

  const saveDraft = async () => {
    if (!title.trim() || !body.trim()) {
      toast(an('ann.pub.invalid'), 'error');
      return;
    }
    setDraftBusy(true);
    try {
      await collab.announce.saveDraft.mutate({
        ...(editingDraftId ? { id: editingDraftId } : {}),
        title: title.trim(),
        body: body.trim(),
        targetRole,
        pinned,
      });
      toast(an('ann.draft.saved'));
      resetForm();
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setDraftBusy(false);
    }
  };

  /** 编辑草稿：载入表单（保存仍为草稿；发布走列表「发布」钮弹层） */
  const editDraft = (a: AnnouncementRow) => {
    setEditingDraftId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setTargetRole(a.targetRole);
    setPinned(a.pinned);
  };

  /* ---- 发布弹层（起止可空 + 预览子区） ---- */
  const [publishFor, setPublishFor] = useState<AnnouncementRow | null>(null);
  const [startsAtInput, setStartsAtInput] = useState('');
  const [endsAtInput, setEndsAtInput] = useState('');
  const [pubDraftBusy, setPubDraftBusy] = useState(false);

  const openPublish = (a: AnnouncementRow) => {
    setPublishFor(a);
    setStartsAtInput('');
    setEndsAtInput('');
  };

  const confirmPublish = async () => {
    if (!publishFor) return;
    setPubDraftBusy(true);
    try {
      await collab.announce.publishDraft.mutate({
        id: publishFor.id,
        ...(startsAtInput.trim() !== '' ? { startsAt: new Date(startsAtInput).toISOString() } : {}),
        ...(endsAtInput.trim() !== '' ? { endsAt: new Date(endsAtInput).toISOString() } : {}),
      });
      toast(an('ann.pub.published'));
      setPublishFor(null);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setPubDraftBusy(false);
    }
  };

  /* ---- 删除（回收站软删，二次确认） ---- */
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removeAnnounce = async (a: AnnouncementRow) => {
    if (!window.confirm(an('ann.draft.removeConfirm', { title: a.title }))) return;
    setRemovingId(a.id);
    try {
      await collab.announce.remove.mutate({ announcementId: a.id });
      toast(an('ann.draft.removed'));
      if (editingDraftId === a.id) resetForm();
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  /* ---- 撤下 / 回执展开 ---- */
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const archive = async (id: string) => {
    setArchivingId(id);
    try {
      await collab.announce.archive.mutate({ id });
      toast(an('ann.list.archived'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setArchivingId(null);
    }
  };
  const [receiptsFor, setReceiptsFor] = useState<string | null>(null);

  /** 列表排序防御：置顶在前，其余新→旧（publishedAt desc）；片 2 按 status 三分区 */
  const { drafts, published, archived } = useMemo(() => {
    const list = [...(listQ.data?.announcements ?? [])];
    const ts = (a: AnnouncementRow) => {
      const d = typeof a.publishedAt === 'string' ? new Date(a.publishedAt) : a.publishedAt;
      return d?.getTime?.() ?? 0;
    };
    list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || ts(b) - ts(a));
    return {
      drafts: list.filter((a) => a.status === 'draft'),
      published: list.filter((a) => a.status === 'published'),
      archived: list.filter((a) => a.status === 'archived'),
    };
  }, [listQ.data]);

  /** 起止窗口文字化（两侧皆可空=不限；无窗口返 null 不显） */
  const windowText = (a: Pick<AnnouncementRow, 'startsAt' | 'endsAt'>): string | null => {
    if (!a.startsAt && !a.endsAt) return null;
    const s = a.startsAt ? fmtAt(a.startsAt) : an('ann.pubd.windowUnlimited');
    const e = a.endsAt ? fmtAt(a.endsAt) : an('ann.pubd.windowUnlimited');
    return `${s} ~ ${e}`;
  };

  /** 懒算窗口章（同 promo 口径）：未到点=待生效 / 已过点=已截止 */
  const windowBadge = (a: Pick<AnnouncementRow, 'startsAt' | 'endsAt'>): { tone: 'warn' | 'muted'; label: string } | null => {
    const now = Date.now();
    if (a.endsAt && new Date(a.endsAt).getTime() < now) return { tone: 'muted', label: an('ann.list.expiredBadge') };
    if (a.startsAt && new Date(a.startsAt).getTime() > now) return { tone: 'warn', label: an('ann.list.pendingBadge') };
    return null;
  };

  /** 已发布/已撤下行渲染（两区共用；archived=灰态不给撤下钮） */
  const renderRow = (a: AnnouncementRow, archived: boolean) => {
    const win = windowText(a);
    const winBadge = archived ? null : windowBadge(a);
    return (
      <div
        key={a.id}
        data-testid={`ann-row-${a.id}`}
        className={`border-t border-[rgba(59,46,36,.06)] ${archived ? 'opacity-55' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-body-sm font-bold text-ink">{a.title}</span>
              {a.pinned ? <Badge tone="brand">{an('ann.list.pinnedBadge')}</Badge> : null}
              {archived ? <Badge tone="muted">{an('ann.list.archivedBadge')}</Badge> : null}
              {winBadge ? <Badge tone={winBadge.tone}>{winBadge.label}</Badge> : null}
              <Badge tone="muted">{targetLabel(a.targetRole)}</Badge>
            </div>
            <div className="mt-0.5 line-clamp-2 text-caption-xs text-[rgba(59,46,36,.62)]">{a.body}</div>
            <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
              {fmtAt(a.publishedAt)}
              {win ? ` · ${win}` : ''}
              {' · '}
              {a.targetTotal != null
                ? an('ann.list.readCount', { x: a.readCount, y: a.targetTotal })
                : an('ann.list.readCountNoTotal', { x: a.readCount })}
            </div>
          </div>
          <Btn
            variant="subtle"
            size="sm"
            onClick={() => setReceiptsFor((cur) => (cur === a.id ? null : a.id))}
            data-testid={`ann-receipts-${a.id}`}
          >
            {an('ann.list.receiptsCta')}
          </Btn>
          {!archived ? (
            <Btn
              variant="subtle"
              size="sm"
              disabled={archivingId === a.id}
              onClick={() => void archive(a.id)}
              data-testid={`ann-archive-${a.id}`}
            >
              {an('ann.list.archiveCta')}
            </Btn>
          ) : null}
        </div>
        {receiptsFor === a.id ? (
          <div className="border-t border-[rgba(59,46,36,.06)] bg-canvas">
            <ReceiptsPanel announcementId={a.id} />
          </div>
        ) : null}
      </div>
    );
  };

  if (!role.canManage) {
    return <RoleGuidePage title={an('ann.guideTitle')} hint={an('ann.guideHint')} />;
  }

  return (
    <MainScaffold title={an('ann.pageTitle')} sub={an('ann.pageSub')} testid="ann-page">
      <ToasterMount />

      {/* 发布表单 */}
      <div className="u3-panel mb-4" data-testid="ann-publish">
        <div className="u3-panel-head">
          <h3>{an('ann.pub.title')}</h3>
          <span className="aside">{an('ann.pub.aside')}</span>
        </div>
        <div className="space-y-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <Field label={an('ann.pub.titleLabel')}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={an('ann.pub.titlePh')}
              maxLength={64}
              data-testid="ann-title"
              className={inputCls}
            />
          </Field>
          <Field label={an('ann.pub.bodyLabel')}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={an('ann.pub.bodyPh')}
              maxLength={2000}
              data-testid="ann-body"
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as AnnounceTargetRole)}
              aria-label={an('ann.pub.targetLabel')}
              data-testid="ann-target"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none"
            >
              {(['all', 'frontdesk', 'groomer'] as AnnounceTargetRole[]).map((r) => (
                <option key={r} value={r}>
                  {targetLabel(r)}
                </option>
              ))}
            </select>
            <span className="flex items-center gap-2 text-caption text-ink-secondary">
              <Switch checked={pinned} onChange={setPinned} label={an('ann.pub.pinnedLabel')} />
              {an('ann.pub.pinnedLabel')}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {editingDraftId ? (
                <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{an('ann.draft.editingHint')}</span>
              ) : null}
              {/* 片 2 两步流：存草稿（带 editingDraftId=更新既有草稿；新建=draft 落库） */}
              <Btn variant="subtle" size="sm" disabled={draftBusy} onClick={() => void saveDraft()} data-testid="ann-draft-new">
                {editingDraftId ? an('ann.draft.saveCta') : an('ann.draft.newCta')}
              </Btn>
              <Btn variant="primary" size="sm" disabled={pubBusy} onClick={() => void publish()} data-testid="ann-publish-submit">
                {pubBusy ? an('ann.pub.publishing') : an('ann.pub.submitCta')}
              </Btn>
            </span>
          </div>
        </div>
      </div>

      {/* 片 2 草稿区（章「草稿」：编辑/发布/删除三钮；发布走起止+预览弹层） */}
      {drafts.length > 0 ? (
        <div className="u3-panel mb-4" data-testid="ann-drafts">
          <div className="u3-panel-head">
            <h3>{an('ann.draft.sectionTitle')}</h3>
            <span className="aside u1-num">{drafts.length}</span>
          </div>
          {drafts.map((a) => (
            <div key={a.id} data-testid={`ann-row-${a.id}`} className="border-t border-[rgba(59,46,36,.06)]">
              <div className="flex flex-wrap items-center gap-2 px-[17px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm font-bold text-ink">{a.title}</span>
                    {a.pinned ? <Badge tone="brand">{an('ann.list.pinnedBadge')}</Badge> : null}
                    <Badge tone="warn">{an('ann.draft.badge')}</Badge>
                    <Badge tone="muted">{targetLabel(a.targetRole)}</Badge>
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-caption-xs text-[rgba(59,46,36,.62)]">{a.body}</div>
                </div>
                <Btn variant="subtle" size="sm" onClick={() => editDraft(a)} data-testid={`ann-draft-edit-${a.id}`}>
                  {an('ann.draft.editCta')}
                </Btn>
                <Btn variant="primary" size="sm" onClick={() => openPublish(a)} data-testid={`ann-publish-${a.id}`}>
                  {an('ann.draft.publishCta')}
                </Btn>
                <Btn
                  variant="danger"
                  size="sm"
                  disabled={removingId === a.id}
                  onClick={() => void removeAnnounce(a)}
                  data-testid={`ann-remove-${a.id}`}
                >
                  {an('ann.draft.removeCta')}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 公告列表（新→旧 · 置顶在前） */}
      <div className="u3-panel" data-testid="ann-list">
        <div className="u3-panel-head">
          <h3>{an('ann.list.title')}</h3>
          <span className="aside">{an('ann.list.aside')}</span>
        </div>
        {listQ.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-12 !rounded-[16px]" />
            ))}
          </div>
        ) : listQ.isError ? (
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{an('ann.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void listQ.refetch()}>
                {an('ann.common.retry')}
              </Btn>
            </div>
          </div>
        ) : published.length === 0 && archived.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center text-body-sm text-[rgba(59,46,36,.62)]">
            {an('ann.list.empty')}
          </p>
        ) : (
          <>
            {/* 已发布区（起止小字+懒算窗口章） */}
            {published.length > 0 ? (
              <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] pb-1 pt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                {an('ann.list.publishedSection')}
              </div>
            ) : null}
            {published.map((a) => renderRow(a, false))}
            {/* 已撤下区（灰态留痕） */}
            {archived.length > 0 ? (
              <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] pb-1 pt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                {an('ann.list.archivedSection')}
              </div>
            ) : null}
            {archived.map((a) => renderRow(a, true))}
          </>
        )}
      </div>

      {/* 片 2 发布弹层（起止可空=不限 + 预览子区；确认 → announce.publishDraft） */}
      <Modal
        open={publishFor !== null}
        onClose={() => {
          if (!pubDraftBusy) setPublishFor(null);
        }}
        title={an('ann.pubd.modalTitle')}
        widthClass="max-w-xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setPublishFor(null)} disabled={pubDraftBusy}>
              {an('ann.reads.close')}
            </Btn>
            <Btn
              variant="primary"
              data-testid="ann-publish-confirm"
              disabled={pubDraftBusy}
              onClick={() => void confirmPublish()}
            >
              {an('ann.pubd.confirmCta')}
            </Btn>
          </>
        }
      >
        {publishFor ? (
          <div className="space-y-3" data-testid="ann-publish-modal">
            <div className="flex flex-wrap gap-3">
              <Field label={an('ann.pubd.startsAtLabel')} hint={an('ann.pubd.windowHint')}>
                <input
                  type="datetime-local"
                  className={inputCls}
                  data-testid="ann-starts-at"
                  value={startsAtInput}
                  onChange={(e) => setStartsAtInput(e.target.value)}
                  disabled={pubDraftBusy}
                />
              </Field>
              <Field label={an('ann.pubd.endsAtLabel')}>
                <input
                  type="datetime-local"
                  className={inputCls}
                  data-testid="ann-ends-at"
                  value={endsAtInput}
                  onChange={(e) => setEndsAtInput(e.target.value)}
                  disabled={pubDraftBusy}
                />
              </Field>
            </div>
            {/* 预览子区（公告卡片样式：标题/正文/定向/置顶/起止文字化） */}
            <div>
              <div className="mb-1 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">
                {an('ann.pubd.previewTitle')}
              </div>
              <div className="rounded-panel bg-canvas px-3.5 py-3" data-testid="ann-preview">
                <div className="flex items-center gap-1.5">
                  <span className="text-body-sm font-bold text-ink">{publishFor.title}</span>
                  {publishFor.pinned ? <Badge tone="brand">{an('ann.list.pinnedBadge')}</Badge> : null}
                  <Badge tone="muted">{targetLabel(publishFor.targetRole)}</Badge>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-caption text-[rgba(59,46,36,.62)]">{publishFor.body}</div>
                <div className="u1-num mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {windowText({
                    startsAt: startsAtInput.trim() !== '' ? new Date(startsAtInput).toISOString() : null,
                    endsAt: endsAtInput.trim() !== '' ? new Date(endsAtInput).toISOString() : null,
                  }) ?? `${an('ann.pubd.windowUnlimited')} ~ ${an('ann.pubd.windowUnlimited')}`}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </MainScaffold>
  );
}
