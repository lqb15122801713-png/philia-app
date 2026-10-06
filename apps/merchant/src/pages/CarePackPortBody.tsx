/**
 * 安心包端口内核（商家端大批片 2 · C3 落位 · ConsolePage 右栏 active==='carepack' 嵌入件）。
 * 立项名 C2 与控制台既有 C2 储值撞号，落 C3 已报备。只读 v1：
 * mall.listProductsForStore({includeCarePackage:true}) 列安心包商品（名/库存/效期）
 * + inventory.carePackageExpiryMerchant 临期标注（≤30 天黄 / 已过期红）；回收登记=候补件。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { QuietButton } from '../components/MainScaffold';
import { fmtDateTime } from '../components/staff-admin/format';
import { cadm } from '../copy/consoleAdmin';

export function CarePackPortBody() {
  const { trpc } = usePhiliaClient();

  const prodQuery = useQuery({
    queryKey: ['mall', 'listProductsForStore', 'carepack-port'],
    queryFn: () =>
      trpc.mall.listProductsForStore.query({ includeCarePackage: true, page: 1, pageSize: 200 }),
  });
  const expiryQuery = useQuery({
    queryKey: ['inventory', 'carePackageExpiryMerchant'],
    queryFn: () => trpc.inventory.carePackageExpiryMerchant.query(),
  });

  const items = (prodQuery.data?.items ?? []).filter((p) => p.category === 'care_package');
  const expiryById = new Map((expiryQuery.data ?? []).map((e) => [e.id, e]));

  return (
    <section className="wsk-card" data-testid="console-carepack-port">
      <div className="wsk-hd">
        <span className="t">{cadm('cadm.portCarePack')}</span>
        <span className="a">{cadm('cadm.portCarePackNote')}</span>
      </div>
      {prodQuery.isPending ? (
        <div className="space-y-2" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 rounded-control" />
          ))}
        </div>
      ) : prodQuery.isError ? (
        <div className="py-4 text-center">
          <p className="text-caption text-[rgba(59,46,36,.62)]">加载失败，请重试</p>
          <div className="mt-3">
            <QuietButton testid="carepack-retry" onClick={() => void prodQuery.refetch()}>
              重新加载
            </QuietButton>
          </div>
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">—</p>
      ) : (
        <table className="u3-tbl" data-testid="carepack-table">
          <thead>
            <tr>
              <th>商品</th>
              <th className="text-right">库存</th>
              <th className="text-right">效期</th>
              <th className="text-right">标注</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const ex = expiryById.get(p.id);
              return (
                <tr key={p.id} data-testid={`carepack-${p.id}`}>
                  <td className="font-semibold">{p.name}</td>
                  <td className="u1-num text-right">{p.stock}</td>
                  <td className="u1-num text-right text-caption-xs">
                    {p.expiresAt ? fmtDateTime(p.expiresAt) : '—'}
                  </td>
                  <td className="text-right">
                    {ex ? (
                      ex.daysLeft < 0 ? (
                        <span className="u3-st red">{cadm('cadm.carePackExpired')}</span>
                      ) : (
                        <span className="u3-st amber">
                          {cadm('cadm.carePackExpiryTh')} · <span className="u1-num">{ex.daysLeft}</span> 天
                        </span>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="wsk-note mt-2.5">{cadm('cadm.carePackRecallNote')}</p>
    </section>
  );
}
