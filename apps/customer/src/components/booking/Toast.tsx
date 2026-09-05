/**
 * 轻量 toast（T2.2）——App 根部未挂全局 Toaster（App.tsx 不在本任务所有权内），
 * 预约域内自绘一个固定定位胶囊提示，错误/冲突（如满槽 CONFLICT）友好展示。
 *
 * 用法：const { toastEl, showToast } = useToast(); … showToast('该时段已约满'); {toastEl}
 */

import { useCallback, useEffect, useState } from 'react';

interface ToastMsg {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

export function useToast(durationMs = 3200) {
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

/** 从 unknown 错误中提取对用户友好的文案（tRPC 服务端 message 优先） */
export function friendlyError(err: unknown, fallback = '操作失败，请稍后再试'): string {
  if (err instanceof Error && err.message) {
    // tRPC ClientError 的 message 含服务端中文提示；截掉过长的堆栈样文本
    const firstLine = err.message.split('\n')[0]!.trim();
    if (firstLine.length > 0 && firstLine.length <= 60) return firstLine;
  }
  return fallback;
}
