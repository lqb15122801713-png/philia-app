/**
 * 商城轻量 toast（T5.3）——与预约域同款的固定定位胶囊提示，
 * 商城域自带一份避免跨域引用其他子代理名下文件。
 *
 * 用法：const { toastEl, showToast } = useMallToast(); … showToast('已加入购物车', 'info'); {toastEl}
 */

import { useCallback, useEffect, useState } from 'react';

interface ToastMsg {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

export function useMallToast(durationMs = 3200) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);

  const showToast = useCallback((text: string, kind: ToastMsg['kind'] = 'error') => {
    setMsg({ id: Date.now(), text, kind });
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), durationMs);
    return () => window.clearTimeout(t);
  }, [msg, durationMs]);

  const toastEl = msg ? (
    <div
      key={msg.id}
      role="alert"
      className={`fixed left-1/2 top-5 z-toast max-w-[86vw] -translate-x-1/2 rounded-full px-4 py-2.5 text-body shadow-elevated ${
        msg.kind === 'error' ? 'bg-danger-light text-danger-deep' : 'bg-success-light text-success-deep'
      }`}
    >
      {msg.text}
    </div>
  ) : null;

  return { toastEl, showToast };
}

/** 从 unknown 错误中提取对用户友好的文案（tRPC 服务端 message 优先，如 CONFLICT 库存不足） */
export function friendlyError(err: unknown, fallback = '操作失败，请稍后再试'): string {
  if (err instanceof Error && err.message) {
    const firstLine = err.message.split('\n')[0]!.trim();
    if (firstLine.length > 0 && firstLine.length <= 80) return firstLine;
  }
  return fallback;
}
