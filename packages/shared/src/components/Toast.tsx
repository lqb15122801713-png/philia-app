/**
 * useToast · 轻量 toast 公共底座（换皮批片 5「同型归并」）
 *
 * 归并出处（三端 8 处自绘 toast 的公共底座）：
 * - apps/staff/src/components/today/Toast.tsx（结构/圆角/阴影/z-toast、2.5s 自消基准）
 * - apps/customer/src/components/booking/Toast.tsx（toastEl 渲染形态、kind 双色、friendlyError 截 60）
 * - apps/customer/src/components/mall/MallToast.tsx（同型副本，friendlyError 截 80 → 参数化 maxLen）
 * 视觉统一 livetag 同族纪律：深棕墨底淡金字（bg-ink text-brand-primary），成功/提示不设绿；
 * kind='error' → bg-danger-light text-danger-deep。
 *
 * 用法：const { showToast, toastEl } = useToast(); … showToast('已同步'); {toastEl}
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'info' | 'error';
export type ToastPosition = 'top' | 'bottom';

export interface UseToastOptions {
  /** 自动消失毫秒数，默认 2500（动效纲领 §四.1）。 */
  durationMs?: number;
  /** 'top'=顶部居中胶囊（top-4，默认）；'bottom'=bottom-28（员工端执行页避底钮）。 */
  position?: ToastPosition;
}

export interface UseToastResult {
  showToast: (text: string, kind?: ToastKind) => void;
  /** 调用方渲染在 JSX 任意处的 toast 节点（无消息时为 null）。 */
  toastEl: ReactNode;
}

interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

export function useToast(opts: UseToastOptions = {}): UseToastResult {
  const { durationMs = 2500, position = 'top' } = opts;
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const showToast = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      window.clearTimeout(timerRef.current);
      setMsg({ id: Date.now(), text, kind });
      timerRef.current = window.setTimeout(() => setMsg(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const toastEl = msg ? (
    <div
      key={msg.id}
      className={`pointer-events-none fixed inset-x-0 z-toast flex justify-center px-4 ${
        position === 'bottom' ? 'bottom-28' : 'top-4'
      }`}
    >
      <p
        role="alert"
        className={`max-w-[86vw] rounded-full px-4 py-2 text-body-sm shadow-elevated ${
          msg.kind === 'error' ? 'bg-danger-light text-danger-deep' : 'bg-ink text-brand-primary'
        }`}
      >
        {msg.text}
      </p>
    </div>
  ) : null;

  return { showToast, toastEl };
}

/**
 * 从 unknown 错误中提取对用户友好的文案（tRPC 服务端 message 优先）：
 * 取首行、截掉超过 maxLen 的堆栈样文本。fallback 由调用方按域供给。
 */
export function friendlyError(err: unknown, fallback: string, maxLen = 60): string {
  if (err instanceof Error && err.message) {
    const firstLine = err.message.split('\n')[0]!.trim();
    if (firstLine.length > 0 && firstLine.length <= maxLen) return firstLine;
  }
  return fallback;
}
