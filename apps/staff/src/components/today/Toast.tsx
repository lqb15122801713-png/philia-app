/**
 * 轻量 toast（T3.1 · 员工端；样式与客户端 AppointmentLivePage 的 toast 同风格）
 *
 * const [toast, showToast] = useToast()
 * <Toast message={toast} />
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast(): [string | null, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return [toast, showToast];
}

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-toast flex justify-center px-4">
      <p className="max-w-full rounded-full bg-ink px-4 py-2 text-body text-card shadow-elevated">
        {message}
      </p>
    </div>
  );
}
