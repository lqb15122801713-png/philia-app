/**
 * 盘点执行 /inventory/:id（批次 员工端2.0 · R8，docs/staff2/R7-R10-DESIGN.md §一.3/§三）
 *
 * - 数据源：inventory.myCountTasks（staff 可读端点，含行项+商品名/分类；按 id 取单）。
 *   listCounts 为 merchantProcedure，员工不可调，不做 fallback。
 * - 盲盘（type='blind'）不展示账面数，提交后也不展示差异（盲盘口径：不见账面）；
 *   日盘/周盘展示账面数，提交后差异预览：盘亏 text-danger / 盘盈 text-success-deep。
 * - 录入：每行实盘数量大输入框（≥44px 触控），全部行必填才可提交 → recordItems
 *   （confirm 前零库存写入，仅写盘点行）；rejected=退回重盘可重新录入，提交后回 counted。
 * - 状态条：counted → 「已提交，待店长确认后才入账」；rejected → 退回重盘横幅+可再编辑。
 * - 扫码定位行（复用 QrScanner）本批不接：QrScanner 与核销 useCheckin 强耦合
 *   （解码即触发核销 mutation），跨域复用需改动共享组件（超本任务文件范围）；
 *   手工录入为主（零新依赖），扫码定位留待专项。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Toast, { useToast } from '@/components/today/Toast';

const TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };

export default function InventoryCountPage() {
  const { id = '' } = useParams();
  const { trpc, queryClient } = usePhiliaClient();
  const [toast, showToast] = useToast();

  const tasksQuery = useQuery({
    queryKey: ['inventory', 'myCountTasks'],
    queryFn: () => trpc.inventory.myCountTasks.query(),
  });
  const count = useMemo(() => (tasksQuery.data ?? []).find((c) => c.id === id) ?? null, [tasksQuery.data, id]);

  const isBlind = count?.type === 'blind';
  const editable = count?.status === 'draft' || count?.status === 'rejected';

  /** 实盘录入值（itemId → 字符串）；退回重盘时预填已有实盘数 */
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!count) return;
    const init: Record<string, string> = {};
    for (const it of count.items) {
      init[it.id] = it.actualStock !== null ? String(it.actualStock) : '';
    }
    setValues(init);
  }, [count]);

  const items = count?.items ?? [];
  const allFilled = items.length > 0 && items.every((it) => {
    const v = values[it.id];
    return v !== undefined && v.trim() !== '' && /^\d+$/.test(v.trim());
  });

  const recordMut = useMutation({
    mutationFn: (input: { countId: string; items: Array<{ itemId: string; actualStock: number }> }) =>
      trpc.inventory.recordItems.mutate(input),
    onSuccess: () => {
      showToast('已提交盘点，待店长确认');
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => showToast(err.message),
  });

  const submit = () => {
    if (!count || !allFilled) return;
    recordMut.mutate({
      countId: count.id,
      items: items.map((it) => ({ itemId: it.id, actualStock: parseInt(values[it.id]!.trim(), 10) })),
    });
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={count ? `${TYPE_LABEL[count.type] ?? '盘点'}执行` : '盘点执行'}
        backTo="/me"
        aside={count ? `${items.length} 项` : undefined}
      />

      <div className="px-[22px]">
        {tasksQuery.isPending ? (
          <div className="mt-2.5 space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="u1-card h-16 animate-pulse bg-sunken" />
            ))}
          </div>
        ) : tasksQuery.isError ? (
          <div className="u1-card mt-2.5 p-6 text-center">
            <p className="text-body-sm text-ink-secondary">盘点单加载失败，请检查网络后重试</p>
            <button
              type="button"
              onClick={() => void tasksQuery.refetch()}
              className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              重新加载
            </button>
          </div>
        ) : !count ? (
          <div className="flex flex-col items-center px-6 py-14 text-center" data-testid="inv-count-missing">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-sunken" aria-hidden>
              <PackageSearch className="h-9 w-9 text-ink" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-body-sm text-ink-secondary">
              该盘点单不在你的待办中——可能已确认入账或已处理
            </p>
            <Link
              to="/inventory"
              className="mt-4 flex h-12 min-h-[44px] min-w-[160px] items-center justify-center rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              返回盘点任务
            </Link>
          </div>
        ) : (
          <>
            {/* 状态条 */}
            {count.status === 'rejected' ? (
              <div className="u1-card mt-2.5 border-danger bg-danger-light p-4" role="alert" data-testid="inv-count-rejected">
                <p className="text-body-sm font-bold text-danger-deep">已退回重盘</p>
                <p className="mt-1 text-caption-xs text-danger-deep">店长退回了这张盘点单，请核对后修改实盘数重新提交。</p>
              </div>
            ) : count.status === 'counted' ? (
              <div className="u1-card mt-2.5 bg-success-light p-4" data-testid="inv-count-counted">
                <p className="text-body-sm font-bold text-success-deep">已提交，待店长确认后才入账</p>
                <p className="mt-1 text-caption-xs text-[rgba(74,59,46,.62)]">确认前库存不变；如被退回会出现在待办里可重盘。</p>
              </div>
            ) : (
              <p className="mt-2.5 px-1 text-caption-xs text-[rgba(74,59,46,.62)]">
                逐项填写实盘数量后提交；提交后待店长确认才入账，确认前库存不变。
                {isBlind ? '本单为盲盘，不展示账面数。' : ''}
              </p>
            )}

            {/* 行项 */}
            {items.length === 0 ? (
              <div className="u1-card mt-3 p-6 text-center">
                <p className="text-body-sm text-ink-secondary">这张单没有盘点行项，请联系店长确认派单范围</p>
              </div>
            ) : (
              <ul className="mt-3" data-testid="inv-count-items">
                {items.map((it) => {
                  const actual = editable
                    ? values[it.id] !== undefined && values[it.id]!.trim() !== ''
                      ? parseInt(values[it.id]!.trim(), 10)
                      : null
                    : it.actualStock;
                  const diff = actual !== null ? actual - it.systemStock : null;
                  return (
                    <li key={it.id} className="u1-card mb-2.5 px-4 py-3.5" data-testid={`inv-item-${it.id}`}>
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-body-sm font-bold">{it.productName ?? '商品'}</p>
                        {it.productCategory ? (
                          <span className="shrink-0 text-caption-xs text-[rgba(74,59,46,.42)]">{it.productCategory}</span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        {!isBlind ? (
                          <span className="text-caption-xs text-[rgba(74,59,46,.62)]">
                            账面 <b className="u1-num text-body-sm font-bold text-ink">{it.systemStock}</b>
                          </span>
                        ) : null}
                        {editable ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            placeholder="实盘数量"
                            aria-label={`${it.productName ?? '商品'}实盘数量`}
                            value={values[it.id] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [it.id]: e.target.value }))}
                            className="u1-ring ml-auto h-12 min-h-[44px] w-32 rounded-input bg-card px-3 text-right text-body-lg font-bold text-ink placeholder:text-caption-xs placeholder:font-normal placeholder:text-ink-placeholder"
                          />
                        ) : (
                          <span className="ml-auto text-caption-xs text-[rgba(74,59,46,.62)]">
                            实盘 <b className="u1-num text-body-sm font-bold text-ink">{it.actualStock ?? '—'}</b>
                          </span>
                        )}
                      </div>
                      {/* 提交后差异预览（盲盘不透出差异） */}
                      {!isBlind && !editable && diff !== null ? (
                        <p className="mt-1.5 text-caption-xs">
                          {diff === 0 ? (
                            <span className="text-[rgba(74,59,46,.42)]">账实相符</span>
                          ) : diff < 0 ? (
                            <span className="font-bold text-danger">盘亏 {diff}</span>
                          ) : (
                            <span className="font-bold text-success-deep">盘盈 +{diff}</span>
                          )}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* 提交（全部行必填） */}
            {editable && items.length > 0 ? (
              <button
                type="button"
                disabled={!allFilled || recordMut.isPending}
                onClick={submit}
                className={`mt-2 h-14 min-h-[56px] w-full rounded-control text-body-lg font-bold transition-transform duration-120 ease-philia-spring ${
                  !allFilled || recordMut.isPending
                    ? 'bg-sunken text-ink-placeholder'
                    : 'bg-brand-primary text-ink active:scale-92'
                }`}
                data-testid="inv-count-submit"
              >
                {recordMut.isPending
                  ? '提交中…'
                  : allFilled
                    ? count.status === 'rejected'
                      ? '重新提交盘点'
                      : '提交盘点'
                    : '请填完全部实盘数量'}
              </button>
            ) : null}

            <Link
              to="/inventory"
              className="mt-3 flex h-12 min-h-[44px] w-full items-center justify-center rounded-control text-body-sm font-semibold text-[rgba(74,59,46,.62)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
            >
              返回盘点任务列表
            </Link>
          </>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
