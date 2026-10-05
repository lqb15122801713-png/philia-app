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
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, Switch, toast, ToasterMount } from '../components/staff-admin/ui';
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
      setTitle('');
      setBody('');
      setTargetRole('all');
      setPinned(false);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setPubBusy(false);
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

  /** 列表排序防御：置顶在前，其余新→旧（publishedAt desc） */
  const rows = useMemo(() => {
    const list = [...(listQ.data?.announcements ?? [])];
    const ts = (a: AnnouncementRow) => {
      const d = typeof a.publishedAt === 'string' ? new Date(a.publishedAt) : a.publishedAt;
      return d?.getTime?.() ?? 0;
    };
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || ts(b) - ts(a));
  }, [listQ.data]);

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
            <Btn variant="primary" size="sm" className="ml-auto" disabled={pubBusy} onClick={() => void publish()} data-testid="ann-publish-submit">
              {pubBusy ? an('ann.pub.publishing') : an('ann.pub.submitCta')}
            </Btn>
          </div>
        </div>
      </div>

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
        ) : rows.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center text-body-sm text-[rgba(59,46,36,.62)]">
            {an('ann.list.empty')}
          </p>
        ) : (
          rows.map((a) => {
            const archived = a.status === 'archived';
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
                      <Badge tone="muted">{targetLabel(a.targetRole)}</Badge>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-caption-xs text-[rgba(59,46,36,.62)]">{a.body}</div>
                    <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                      {fmtAt(a.publishedAt)}
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
          })
        )}
      </div>
    </MainScaffold>
  );
}
