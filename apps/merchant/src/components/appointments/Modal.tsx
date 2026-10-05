/**
 * 弹层基件（T4.2）：暖深棕半透明遮罩（45%，与 PhotoWall +N 蒙层同温），
 * 手机底部升起 / ≥sm 居中卡片，radius.sheet 20px。点遮罩关闭。
 */

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({
  open,
  title,
  onClose,
  children,
  widthClass = 'sm:max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(61,50,41,0.45)] sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col rounded-t-sheet bg-card shadow-elevated sm:rounded-sheet ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line-divider px-4 py-3">
          <h2 className="text-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-sunken"
            aria-label="关闭"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
