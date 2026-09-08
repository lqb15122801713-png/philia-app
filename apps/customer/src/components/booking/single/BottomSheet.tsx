/**
 * B4-1 单屏通用底部半屏弹层（换店 / 换宠物共用）：
 * 遮罩 + 底部圆角 sheet，点遮罩或「关闭」收起；样式沿用 TabBar 长按弹层同款
 * （z-modal / rounded-t-sheet / shadow-elevated），不新增 token。
 */

import type { ReactNode } from 'react';

export default function BottomSheet({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-label={title}
      data-testid={testId}
    >
      <div
        className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-sheet bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-title">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-secondary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
