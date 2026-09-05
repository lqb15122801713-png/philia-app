/**
 * 二次确认弹层（T4.2）：关键操作（批准/拒绝取消、打标重拍等）防误触。
 * children 可放附加内容（如打标原因输入框）。
 */

import { Modal } from './Modal';
import type { ReactNode } from 'react';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmText = '确定',
  cancelText = '再想想',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel} widthClass="sm:max-w-md">
      {body ? <p className="text-body text-ink-secondary">{body}</p> : null}
      {children}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="h-11 flex-1 rounded-full border border-line text-body text-ink-secondary transition-colors hover:bg-sunken disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`h-11 flex-1 rounded-full text-body font-semibold text-white transition-colors disabled:opacity-50 ${
            danger ? 'bg-danger hover:opacity-90' : 'bg-brand-primary hover:bg-brand-primary-hover'
          }`}
        >
          {loading ? '处理中…' : confirmText}
        </button>
      </div>
    </Modal>
  );
}
