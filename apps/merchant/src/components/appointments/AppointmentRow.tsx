/**
 * 预约列表行（T4.2）：紧凑单行卡片 —— 时间 / 宠物 / 服务 / 客户 / 员工 / 状态 / 金额。
 * 待确认行整行品牌色高亮边框 + 行内「确认」快捷按钮（≤30 秒操作路径关键：
 * SSE 红点 toast → 点行内确认 → 完成，无需进详情页）。
 */

import { Check } from 'lucide-react';
import {
  fenToYuan,
  fmtDate,
  fmtTime,
  statusBadge,
  statusLabel,
  type ListForStoreItem,
} from './appt-utils';

export function AppointmentRow({
  item,
  selected = false,
  confirming = false,
  onOpen,
  onConfirm,
}: {
  item: ListForStoreItem;
  selected?: boolean;
  confirming?: boolean;
  onOpen: () => void;
  onConfirm: (id: string) => void;
}) {
  const pending = item.status === 'pending';
  const start = item.scheduledStart;

  return (
    <div
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-card border bg-card px-3 py-2.5 text-left transition-colors hover:bg-sunken ${
        pending
          ? 'border-brand-primary bg-brand-primary-light/40'
          : selected
            ? 'border-brand-primary'
            : 'border-line'
      }`}
    >
      {/* 时间列（数字字族纵向对齐） */}
      <div className="w-14 shrink-0">
        <p className="font-number text-body font-semibold text-ink">{fmtTime(start)}</p>
        <p className="font-number text-caption text-ink-secondary">{fmtDate(start)}</p>
      </div>

      {/* 主信息：宠物+服务 / 客户+员工 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-semibold text-ink">
          {item.petName ?? '宠物'}
          <span className="mx-1 font-normal text-ink-placeholder">·</span>
          <span className="font-normal">{item.serviceName ?? '服务'}</span>
        </p>
        <p className="mt-0.5 truncate text-caption text-ink-secondary">
          客户·{item.customerId.slice(-4)}
          <span className="mx-1 text-line-strong">|</span>
          {item.type === 'boarding' ? '寄养' : '洗护'}
          <span className="mx-1 text-line-strong">|</span>
          {item.staffName ? `员工 ${item.staffName}` : '未指派'}
        </p>
      </div>

      {/* 状态 + 金额 */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-tag px-1.5 py-0.5 text-caption ${statusBadge(item.status)}`}>
          {statusLabel(item.status)}
        </span>
        <span className="font-number text-body font-semibold text-ink">
          {fenToYuan(item.priceFen)}
        </span>
      </div>

      {/* 待确认：行内一键确认（≤30 秒操作路径） */}
      {pending ? (
        <button
          type="button"
          disabled={confirming}
          onClick={(e) => {
            e.stopPropagation();
            onConfirm(item.id);
          }}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-primary px-3 text-caption font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          <Check className="h-4 w-4" strokeWidth={1.5} />
          {confirming ? '确认中…' : '确认'}
        </button>
      ) : null}
    </div>
  );
}
