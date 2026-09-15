/**
 * B4-1 单屏 · 门店单行区块：
 * 单行「门店名 · 地址」+「更换 ▸」，点按弹底部半屏门店列表（不跳页），
 * 选中即换店并收起。默认最近门店由页面预填。
 */

import { useState } from 'react';
import BottomSheet from './BottomSheet';
import type { StoreItem } from '../types';

export default function StoreLineBlock({
  stores,
  currentStoreId,
  currentStoreName,
  onPick,
  loading,
}: {
  stores: StoreItem[];
  currentStoreId: string | null;
  /** getWithServices 的门店名（可能带详情），兜底用列表名 */
  currentStoreName: string | null;
  onPick: (id: string) => void;
  loading?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading) {
    return <div className="h-11 animate-pulse rounded-card bg-sunken" data-testid="gs-store-loading" />;
  }

  const current = stores.find((s) => s.id === currentStoreId) ?? null;
  const name = currentStoreName ?? current?.name ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        data-testid="gs-store-line"
        className="flex w-full items-center justify-between py-2 text-left transition active:scale-[0.99]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold">{name ?? '请选择门店'}</span>
          {current?.address ? (
            <span className="mt-0.5 block truncate text-caption text-ink-secondary">{current.address}</span>
          ) : null}
        </span>
        <span className="ml-3 shrink-0 text-caption font-medium text-ink">更换 ▸</span>
      </button>

      {sheetOpen ? (
        <BottomSheet title="选择门店" onClose={() => setSheetOpen(false)} testId="gs-store-sheet">
          <div className="space-y-2">
            {stores.map((s) => {
              const active = s.id === currentStoreId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onPick(s.id);
                    setSheetOpen(false);
                  }}
                  data-testid={`gs-store-option-${s.id}`}
                  className={`w-full rounded-card border p-4 text-left transition active:scale-[0.99] ${
                    active ? 'border-[1.5px] border-ink' : 'border-line'
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-body font-semibold">{s.name}</span>
                    {active ? <span className="text-caption font-medium text-ink">当前选择</span> : null}
                  </span>
                  {s.address ? (
                    <span className="mt-0.5 block text-caption text-ink-secondary">{s.address}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
