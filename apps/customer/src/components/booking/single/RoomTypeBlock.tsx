/**
 * B4-2 寄养单屏 · 房型区块（数据驱动两种形态，B4-4 裁定）：
 * - 单房型：只读信息卡（名称 + 单晚价 + 余 N 间），无选择动作（页面预填已自动选中）；
 * - 多房型：选择器卡列表（现状向导屏2 同款，「余 N 间」透出保留）。
 * 余量口径沿用 B3-2：已选区间 = 区间内逐晚最小剩余；未选日期 = 今晚剩余。
 *
 * 换皮批片 2（定稿 H-01 / §4.10 roomcard 工艺卡）：实景图 150 高 + 右上房价胶囊
 * （纸白 mono 11/700 + 小影 §3.3 房价牌影）+ 底条名 14/800 + mono 9 卖点（余量行）。
 * 实景照槽位：services 表无照片字段（schema 实证）——img 插槽指向拍摄清单资产位，
 * onError 回退下沉底 + VI 线图标（ic-board），资产到位即自动替换，不造假图。
 */

import { useState } from 'react';
import { Skeleton } from '@philia/shared';
import { bkc } from '@/copy/booking';
import { fenToYuan } from '../format';
import type { ServiceItem } from '../types';

/** 实景照插槽：拍摄清单资产位（/photos/room.jpg），缺失时下沉底 + VI 图标占位 */
function RoomPhoto({ name, priceFen }: { name: string; priceFen: number }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="relative h-[150px]">
      {imgOk ? (
        <img
          src="/photos/room.jpg"
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sunken" aria-hidden="true">
          <img src="/photos/icons/ic-board.png" alt="" className="h-12 w-12 object-contain" />
        </div>
      )}
      {/* 右上房价胶囊：纸白 mono 11/700 + 小影（§3.3 房价牌） */}
      <span className="absolute right-3 top-3 rounded-full bg-canvas px-3 py-1.5 font-number text-v2-note font-bold text-ink shadow-philia">
        {fenToYuan(priceFen)} / 晚
      </span>
    </div>
  );
}

export default function RoomTypeBlock({
  services,
  selectedId,
  onSelect,
  remainingOf,
  tonight,
  loading,
  error,
  onRetry,
}: {
  services: ServiceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 某房型剩余间数（null = 余量未加载） */
  remainingOf: (serviceId: string) => number | null;
  /** true = 未选日期，余量按「今晚」展示 */
  tonight: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div data-testid="bs-room-loading">
        <Skeleton className="h-20 rounded-control" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-control bg-sunken px-4 py-8 text-center" data-testid="bs-room-error">
        <p className="text-caption text-ink-secondary">{bkc('booking.roomLoadFail')}</p>
        <button type="button" onClick={onRetry} className="mt-2 text-caption font-semibold text-ink">
          重新加载
        </button>
      </div>
    );
  }
  if (services.length === 0) {
    return (
      <p className="rounded-control bg-sunken px-4 py-8 text-center text-caption text-ink-secondary" data-testid="bs-room-empty">
        {bkc('booking.roomEmpty')}
      </p>
    );
  }

  const remainLine = (sid: string) => {
    const remaining = remainingOf(sid);
    if (remaining === null) return null;
    return (
      <span className={remaining === 0 ? 'text-danger-deep' : 'text-success-deep'}>
        {tonight ? `今晚剩余 ${remaining} 间` : `剩余 ${remaining} 间`}
      </span>
    );
  };

  /* B4-4：单房型 → 只读实景大卡（无选择动作；定稿 roomcard） */
  if (services.length === 1) {
    const s = services[0]!;
    return (
      <div
        className="w-full overflow-hidden rounded-panel border border-line bg-card"
        data-testid="bs-room-readonly"
        data-service-id={s.id}
      >
        <RoomPhoto name={s.boardingRoomType ?? s.name} priceFen={s.priceFen} />
        {/* 底条：名 14/800 + mono 9 卖点（副名/余量，真实数据） */}
        <div className="px-4 py-3">
          <span className="block text-body-sm font-extrabold">{s.boardingRoomType ?? s.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 font-number text-[9px] text-ink-secondary">
            {s.boardingRoomType ? <span>{s.name}</span> : null}
            {remainLine(s.id)}
          </span>
        </div>
      </div>
    );
  }

  /* 多房型 → 选择器（「余 N 间」透出保留；同 roomcard 底条工艺，圆角 20 白卡） */
  return (
    <div className="space-y-2" data-testid="bs-room-selector">
      {services.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            data-testid={`bs-room-option-${s.id}`}
            data-active={active ? 'true' : 'false'}
            className={`flex w-full items-center justify-between rounded-panel border bg-card p-4 text-left transition active:scale-[0.99] ${active ? 'border-[1.5px] border-ink' : 'border-line'}`}
          >
            <span>
              <span className="block text-body-sm font-extrabold">{s.boardingRoomType ?? s.name}</span>
              <span className="mt-0.5 flex flex-wrap gap-x-2 font-number text-[9px] text-ink-secondary">
                {s.boardingRoomType ? <span>{s.name}</span> : null}
                {remainLine(s.id)}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-number text-price text-ink">{fenToYuan(s.priceFen)}</span>
              <span className="text-caption text-ink-placeholder">/ 晚</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
