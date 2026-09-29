/**
 * B4-1 单屏通用底部半屏弹层（换店 / 换宠物共用）：
 * 遮罩 + 底部圆角 sheet，点遮罩或「关闭」收起。
 * 换皮批片 2：补齐 §4.5 弹层三件套——抓握手柄 grab 42×4 + 可点遮罩（既有）+ 滚动锁；
 * 顶角 26、高度上限 82%（§4.5 实证），不新增 token。
 */

import { useEffect } from 'react';
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
  /* 滚动锁：弹层挂载期间锁底层 body（§4.5 三件套；本组件由调用方条件挂载） */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40"
      onClick={onClose}
      role="dialog"
      aria-label={title}
      data-testid={testId}
    >
      <div
        className="max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-[26px] bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 抓握手柄 grab 42×4（§4.5） */}
        <div className="mx-auto mb-3 h-1 w-[42px] rounded-full bg-line" aria-hidden="true" />
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
