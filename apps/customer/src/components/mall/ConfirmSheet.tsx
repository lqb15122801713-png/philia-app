/**
 * 暖色确认弹层（T5.3）：跨店加车清空确认、确认收货等破坏性/关键操作二次确认。
 * 底部动作面板样式（rounded-sheet），z-modal 盖过 TabBar。
 */

import type { ReactNode } from 'react';

export default function ConfirmSheet({
  open,
  title,
  desc,
  confirmText = '确认',
  cancelText = '再想想',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  desc?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-ink/40"
        onClick={onCancel}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-sheet bg-card p-5 pb-8 shadow-elevated">
        <p className="text-title">{title}</p>
        {desc ? <div className="mt-2 text-body text-ink-secondary">{desc}</div> : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-full bg-sunken text-body text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-full text-body font-medium text-white transition-transform duration-120 ease-philia-spring active:scale-92 ${
              danger ? 'bg-danger' : 'bg-brand-primary'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
