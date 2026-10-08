/**
 * 回收站端口内核（端口批收尾片 2 · 数据 3 之③ · ConsolePage D5 直嵌件，仿 ConfigDictBody 结构）。
 *
 * recycleBin.list 三域行联查（product 商品 / promo 活动 / announce 公告，按删除新→旧）：
 * 域章/标题/副标/删除人/删除时刻 + 「恢复」钮（owner；server merchantOwnerProcedure 硬闸）
 * → recycleBin.restore → toast+invalidate；空态 Empty；注记条=软删+恢复红线
 * （账务/支付/账单类永不进回收站=硬删禁令照旧，无 purge 硬删口）。
 */

import { Skeleton, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Empty, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';

type Trpc = PhiliaClient['trpc'];
type RecycleItem = Awaited<ReturnType<Trpc['recycleBin']['list']['query']>>['items'][number];

/** 域 → 中文章（白名单三域；未知域原样透出防御） */
const DOMAIN_LABEL: Record<string, string> = {
  product: cadm('cadm.recycleDomainProduct'),
  promo: cadm('cadm.recycleDomainPromo'),
  announce: cadm('cadm.recycleDomainAnnounce'),
};

export function RecycleBinBody() {
  const { trpc, queryClient } = usePhiliaClient();
  const listQuery = useQuery({
    queryKey: ['recycleBin', 'list'],
    queryFn: () => trpc.recycleBin.list.query(),
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const restore = async (it: RecycleItem) => {
    setBusyId(it.id);
    try {
      await trpc.recycleBin.restore.mutate({ domain: it.domain, id: it.id });
      toast(cadm('cadm.recycleRestored'));
      await queryClient.invalidateQueries({ queryKey: ['recycleBin', 'list'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const items = listQuery.data?.items ?? [];

  return (
    <>
      <ToasterMount />
      <section className="wsk-card" data-testid="console-recycle-port">
        <div className="wsk-hd">
          <span className="t">{cadm('cadm.recycleTitle')}</span>
          <span className="a">{cadm('cadm.recycleAside')}</span>
        </div>

        {/* 注记条（软删红线：账务/支付/账单类永不进） */}
        <p className="mb-3 rounded-input bg-brand-primary-light px-3 py-2 text-caption text-ink" data-testid="recycle-note">
          {cadm('cadm.recycleNote')}
        </p>

        {listQuery.isPending ? (
          <div className="space-y-3" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 rounded-control" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <p className="py-4 text-center text-caption-xs text-danger-deep">
            {cadm('cadm.recycleLoadFail')}：{errMsg(listQuery.error)}
          </p>
        ) : items.length === 0 ? (
          <Empty title={cadm('cadm.recycleEmpty')} />
        ) : (
          items.map((it) => (
            <div
              key={`${it.domain}-${it.id}`}
              data-testid={`recycle-row-${it.domain}-${it.id}`}
              className="flex items-center gap-3 border-t border-[rgba(59,46,36,.06)] py-[11px] text-caption first:border-t-0"
            >
              <Badge tone="muted">{DOMAIN_LABEL[it.domain] ?? it.domain}</Badge>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{it.title}</div>
                <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                  {it.subtitle ?? '—'} · {it.deletedByNickname ?? '—'} · {fmtDateTime(it.deletedAt)}
                </div>
              </div>
              <Btn
                variant="subtle"
                size="sm"
                data-testid={`recycle-restore-${it.domain}-${it.id}`}
                disabled={busyId === it.id}
                onClick={() => void restore(it)}
              >
                {cadm('cadm.recycleRestore')}
              </Btn>
            </div>
          ))
        )}
      </section>
    </>
  );
}
