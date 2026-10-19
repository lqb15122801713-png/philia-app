import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export default function BottomSheet({
  title,
  onClose,
  children,
  footer,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.setAttribute('closedby', 'any');
    if (!dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    else onCloseRef.current();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      data-testid={testId}
      className="fixed inset-x-0 bottom-0 mx-auto mb-0 mt-auto flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden overscroll-contain rounded-t-[24px] border-0 bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-card [&::backdrop]:overflow-hidden [&::backdrop]:overscroll-contain [&::backdrop]:bg-ink/40"
      onClose={() => onCloseRef.current()}
      onClick={(event) => {
        if ('closedBy' in HTMLDialogElement.prototype) return;
        const dialog = dialogRef.current;
        if (!dialog || event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
        if (!inside) requestClose();
      }}
    >
      <div className="mx-auto mb-3 h-1 w-[42px] shrink-0 rounded-full bg-line" aria-hidden="true" />
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-4">
        <h2 id={titleId} className="text-title">{title}</h2>
        <button
          type="button"
          onClick={requestClose}
          className="min-h-11 shrink-0 px-2 text-caption text-ink-secondary underline-offset-4 hover:underline"
        >
          关闭
        </button>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
      {footer ? <div className="shrink-0 pt-3">{footer}</div> : null}
    </dialog>
  );
}
