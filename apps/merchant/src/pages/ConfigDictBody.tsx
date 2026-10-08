/**
 * 参数字典端口内核（端口批收尾片 1 · 件 5 · ConsolePage D3 直嵌件，仿 ProfilePortBody 结构）。
 * config.dictionary 全量透出（参数域逐键：label/字段注/帮助注/涉钱名单标/当前生效版本；copy 域不收）
 * + SearchInput 服务端过滤（q 参数直传，useDeferredValue 降抖）+ 按域分组表格。
 */

import { Skeleton, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { SearchInput } from '../components/MainScaffold';
import { errMsg } from '../components/staff-admin/format';
import { Badge, numStyle, ToasterMount } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';

type Trpc = PhiliaClient['trpc'];
type DictOut = Awaited<ReturnType<Trpc['config']['dictionary']['query']>>;
type DictItem = DictOut['items'][number];

/** 域 → 中文签（未知域原样透出；copy 域 server 侧本就不收） */
const DOMAIN_LABEL: Record<string, string> = {
  commission: cadm('cadm.dictDomainCommission'),
  xp: cadm('cadm.dictDomainXp'),
  duration: cadm('cadm.dictDomainDuration'),
  refund: cadm('cadm.dictDomainRefund'),
  member_plans: cadm('cadm.dictDomainMemberPlans'),
  service: cadm('cadm.dictDomainService'),
  pay: cadm('cadm.dictDomainPay'),
};

export function ConfigDictBody() {
  const { trpc } = usePhiliaClient();

  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const dictQuery = useQuery({
    queryKey: ['config', 'dictionary', q],
    queryFn: () => trpc.config.dictionary.query(q === '' ? {} : { q }),
  });

  const items = useMemo(() => dictQuery.data?.items ?? [], [dictQuery.data]);
  /* 按域分组（域名典序稳定；域内保 server 返回序） */
  const groups = useMemo(() => {
    const m = new Map<string, DictItem[]>();
    for (const it of items) {
      const list = m.get(it.domain);
      if (list) list.push(it);
      else m.set(it.domain, [it]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  return (
    <>
      <ToasterMount />
      <section className="wsk-card" data-testid="console-dict-port">
        <div className="wsk-hd">
          <span className="t">{cadm('cadm.dictTitle')}</span>
          <span className="a">{cadm('cadm.dictAside')}</span>
        </div>

        <div className="mb-3">
          <SearchInput
            testid="dict-search"
            placeholder={cadm('cadm.dictSearchPlaceholder')}
            value={search}
            onChange={setSearch}
          />
        </div>

        {dictQuery.isPending ? (
          <div className="space-y-3" aria-label="加载中">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 rounded-control" />
            ))}
          </div>
        ) : dictQuery.isError ? (
          <p className="py-4 text-center text-caption-xs text-danger-deep">
            {cadm('cadm.dictError')}：{errMsg(dictQuery.error)}
          </p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">{cadm('cadm.dictEmpty')}</p>
        ) : (
          groups.map(([domain, list]) => (
            <div key={domain} className="mb-3 last:mb-0">
              <div className="mb-1 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">
                {DOMAIN_LABEL[domain] ?? domain}（{list.length}）
              </div>
              {list.map((it) => (
                <div
                  key={it.ruleKey}
                  data-testid={`dict-row-${it.ruleKey}`}
                  className="flex items-start gap-3 border-t border-[rgba(59,46,36,.06)] py-[11px] text-caption first:border-t-0"
                >
                  <div className="w-44 shrink-0 font-semibold text-ink">{it.ruleKey}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-ink">{it.label}</div>
                    <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]">{it.helpText}</div>
                    {it.fields.length > 0 ? (
                      <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                        {it.fields.map((f) => `${f.field}=${f.note}`).join('；')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {it.moneyHighRisk ? <Badge tone="danger">{cadm('cadm.dictMoneyBadge')}</Badge> : null}
                    <Badge tone="muted">
                      <span style={numStyle}>v{it.currentVersion}</span>
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </>
  );
}
