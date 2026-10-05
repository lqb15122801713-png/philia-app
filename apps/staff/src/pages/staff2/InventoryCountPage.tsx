/**
 * 盘点执行 /inventory/:id（批次 员工端2.0 · R8，docs/staff2/R7-R10-DESIGN.md §一.3/§三）
 * 骨架批片 1（S-09）：外框换骨架——SkBackBar（二级页无 dock）→ 录入卡 ×N
 * （品名 + 货号 mono + 系统量 + 实盘输入位）→ 吸底 G2（渐出底 + SkBtnAction）。
 * 数据流/权限零回退。
 *
 * - 数据源：inventory.myCountTasks（staff 可读端点，含行项+商品名/分类；按 id 取单）。
 *   listCounts 为 merchantProcedure，员工不可调，不做 fallback。
 * - 盲盘（type='blind'）不展示账面数，提交后也不展示差异（盲盘口径：不见账面）；
 *   日盘/周盘展示账面数，提交后差异预览：盘亏赭红 / 盘盈深棕墨。
 * - 录入：每行实盘数量大输入框（≥44px 触控），全部行必填才可提交 → recordItems
 *   （confirm 前零库存写入，仅写盘点行）；rejected=退回重盘可重新录入，提交后回 counted。
 * - 状态条：counted → 「已提交，待店长确认后才入账」；rejected → 退回重盘横幅+可再编辑。
 * - 行项无 SKU 字段（schema 只有 product_id）——mono 货号位以 productId 尾号顶替（偏差已报备）。
 * - 扫码定位行（复用 QrScanner）本批不接：QrScanner 与核销 useCheckin 强耦合
 *   （解码即触发核销 mutation），跨域复用需改动共享组件（超本任务文件范围）；
 *   手工录入为主（零新依赖），扫码定位留待专项。
 */

import { Skeleton, usePhiliaClient, useToast } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { INVENTORY_COPY } from '@/copy/inventory';
import { SkBackBar, SkBtnAction, SkEmpty, SkNote } from '../../components/skeleton';
import '../../styles/skeleton.css';

const TYPE_LABEL: Record<string, string> = { daily: '日盘', weekly: '周盘', blind: '盲盘' };

const cardSt: CSSProperties = {
  margin: '12px 22px 0',
  background: 'var(--card)',
  borderRadius: 18,
  padding: '14px 16px',
  boxShadow: '0 1px 2px rgba(42, 31, 21, .05)',
};

export default function InventoryCountPage() {
  const { id = '' } = useParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();

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
    <div className="sk">
      <SkBackBar
        title={count ? `${TYPE_LABEL[count.type] ?? INVENTORY_COPY['inventory.title']}${INVENTORY_COPY['inventory.count.execSuffix']}` : INVENTORY_COPY['inventory.count.fallbackTitle']}
        fallback="/inventory"
        note={count ? `${items.length} ${INVENTORY_COPY['inventory.count.itemsAside']}` : undefined}
      />

      {tasksQuery.isPending ? (
        <div style={{ margin: '12px 22px 0', display: 'grid', gap: 10 }} aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="u1-card h-16 !rounded-panel" />
          ))}
        </div>
      ) : tasksQuery.isError ? (
        <div style={{ ...cardSt, textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.count.loadFail']}</p>
          <div style={{ marginTop: 12 }}>
            <SkBtnAction onClick={() => void tasksQuery.refetch()} testId="sk-inv-count-retry">
              {INVENTORY_COPY['inventory.retry']}
            </SkBtnAction>
          </div>
        </div>
      ) : !count ? (
        <div data-testid="inv-count-missing" style={{ paddingTop: 16 }}>
          <SkEmpty title={INVENTORY_COPY['inventory.count.missing']} />
          <div style={{ margin: '16px 22px 0' }}>
            <Link to="/inventory" className="sk-btn-ghost" style={{ display: 'flex', width: '100%', textDecoration: 'none' }}>
              {INVENTORY_COPY['inventory.count.backList']}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 状态条（rejected=赭红左条异常卡 / counted=锁定提示 / draft=录入引导） */}
          {count.status === 'rejected' ? (
            <div
              role="alert"
              data-testid="inv-count-rejected"
              style={{ ...cardSt, borderLeft: '3px solid var(--danger)' }}
            >
              <p style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--danger)' }}>{INVENTORY_COPY['inventory.count.rejected.title']}</p>
              <p style={{ marginTop: 4, fontSize: 11, color: 'var(--danger)' }}>{INVENTORY_COPY['inventory.count.rejected.desc']}</p>
            </div>
          ) : count.status === 'counted' ? (
            <div data-testid="inv-count-counted" style={{ ...cardSt, borderLeft: '3px solid var(--gold)' }}>
              <p style={{ fontSize: 12.5, fontWeight: 800 }}>{INVENTORY_COPY['inventory.count.counted.title']}</p>
              <p style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.count.counted.desc']}</p>
            </div>
          ) : (
            <SkNote>
              {INVENTORY_COPY['inventory.count.guide']}
              {isBlind ? INVENTORY_COPY['inventory.count.blindNote'] : ''}
            </SkNote>
          )}

          {/* 录入卡 ×N（品名 + 货号 mono + 系统量 + 实盘输入位） */}
          {items.length === 0 ? (
            <div style={{ ...cardSt, textAlign: 'center' }}>
              <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.count.noItems']}</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="inv-count-items">
              {items.map((it) => {
                const actual = editable
                  ? values[it.id] !== undefined && values[it.id]!.trim() !== ''
                    ? parseInt(values[it.id]!.trim(), 10)
                    : null
                  : it.actualStock;
                const diff = actual !== null ? actual - it.systemStock : null;
                return (
                  <li key={it.id} style={cardSt} data-testid={`inv-item-${it.id}`}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <p style={{ minWidth: 0, flex: 1, fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.productName ?? INVENTORY_COPY['inventory.count.productFallback']}
                      </p>
                      {it.productCategory ? (
                        <span style={{ flex: 'none', fontSize: 9.5, color: 'var(--muted)' }}>{it.productCategory}</span>
                      ) : null}
                    </div>
                    <p className="sk-mono" style={{ marginTop: 3, fontSize: 9, color: 'var(--muted)', letterSpacing: '.06em' }}>
                      SKU …{it.productId.slice(-6)}
                    </p>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                      {!isBlind ? (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {INVENTORY_COPY['inventory.count.systemStock']}{' '}
                          <b className="sk-mono" style={{ fontSize: 13, color: 'var(--ink)' }}>{it.systemStock}</b>
                        </span>
                      ) : null}
                      {editable ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          placeholder={INVENTORY_COPY['inventory.count.inputPlaceholder']}
                          aria-label={`${it.productName ?? INVENTORY_COPY['inventory.count.productFallback']}${INVENTORY_COPY['inventory.count.inputPlaceholder']}`}
                          value={values[it.id] ?? ''}
                          onChange={(e) => setValues((v) => ({ ...v, [it.id]: e.target.value }))}
                          className="sk-mono"
                          style={{
                            marginLeft: 'auto', height: 48, minHeight: 44, width: 128, borderRadius: 14,
                            border: '1px solid var(--hairline)', background: 'var(--card)',
                            padding: '0 12px', textAlign: 'right', fontSize: 17, fontWeight: 700, color: 'var(--ink)',
                            outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                          {INVENTORY_COPY['inventory.count.actualStock']}{' '}
                          <b className="sk-mono" style={{ fontSize: 13, color: 'var(--ink)' }}>{it.actualStock ?? '—'}</b>
                        </span>
                      )}
                    </div>
                    {/* 提交后差异预览（盲盘不透出差异） */}
                    {!isBlind && !editable && diff !== null ? (
                      <p style={{ marginTop: 6, fontSize: 11 }}>
                        {diff === 0 ? (
                          <span style={{ color: 'var(--muted)' }}>{INVENTORY_COPY['inventory.count.diffSame']}</span>
                        ) : diff < 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{INVENTORY_COPY['inventory.count.diffLoss']} {diff}</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--ink-deep)' }}>{INVENTORY_COPY['inventory.count.diffGain']} +{diff}</span>
                        )}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {/* 返回列表（次行 ghost） */}
          <Link
            to="/inventory"
            className="sk-btn-ghost"
            style={{ display: 'flex', width: 'calc(100% - 44px)', margin: '12px 22px 0', textDecoration: 'none' }}
          >
            {INVENTORY_COPY['inventory.count.backListPlain']}
          </Link>

          {/* 吸底 G2（渐出底 + btn-action；行项不全不能提交，提交即锁定待店长过账） */}
          {editable && items.length > 0 ? (
            <div
              style={{
                position: 'sticky', bottom: 0, marginTop: 14,
                padding: '18px 22px calc(14px + env(safe-area-inset-bottom))',
                background: 'linear-gradient(to bottom, rgba(250, 248, 242, 0), var(--paper) 40%)',
              }}
            >
              <SkBtnAction
                testId="inv-count-submit"
                disabled={!allFilled || recordMut.isPending}
                onClick={submit}
                sub={allFilled ? INVENTORY_COPY['inventory.count.submitSub'] : undefined}
              >
                {recordMut.isPending
                  ? INVENTORY_COPY['inventory.count.submitPending']
                  : allFilled
                    ? count.status === 'rejected'
                      ? INVENTORY_COPY['inventory.count.submitAgain']
                      : INVENTORY_COPY['inventory.count.submit']
                    : INVENTORY_COPY['inventory.count.submitNeedAll']}
              </SkBtnAction>
            </div>
          ) : (
            <div style={{ paddingBottom: 32 }} />
          )}
        </>
      )}

      {toastEl}
    </div>
  );
}
