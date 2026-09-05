/**
 * 轻量 toast（T4.2 自包含，不依赖 T4.1 布局壳是否挂载 sonner）。
 * showToast(text, kind) 任意处调用；页面挂一次 <ToastHost/>。
 * kind='alert' 带红点（新预约 / 取消申请等到店提醒，契约：红点 toast）。
 */

import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'alert';

export interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

type Listener = (t: ToastMsg) => void;
const listeners = new Set<Listener>();
let seq = 0;

export function showToast(text: string, kind: ToastKind = 'info'): void {
  const msg: ToastMsg = { id: ++seq, text, kind };
  listeners.forEach((l) => l(msg));
}

const KIND_CLASS: Record<ToastKind, string> = {
  info: 'bg-[rgba(61,50,41,0.92)] text-white',
  success: 'bg-[rgba(61,50,41,0.92)] text-white',
  error: 'bg-danger text-white',
  alert: 'bg-[rgba(61,50,41,0.92)] text-white',
};

export function ToastHost() {
  const [items, setItems] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const l: Listener = (m) => {
      setItems((prev) => [...prev.slice(-3), m]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== m.id));
      }, 3600);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-body shadow-elevated ${KIND_CLASS[t.kind]}`}
          role="status"
        >
          {t.kind === 'alert' ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden />
          ) : null}
          {t.kind === 'success' ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
          ) : null}
          <span className="break-all">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
