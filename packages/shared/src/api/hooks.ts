/**
 * 页面数据 hooks（契约 docs/CLIENT-CONTRACTS.md · T2.0）
 *
 * - useMe：当前登录用户（内部 trpc.auth.me）；未登录（401）返回 user=null 不报错。
 * - useEventSource：原生 EventSource 封装，指数退避 1s/2s/5s/15s 封顶，
 *   window 'online' 立即重连；解析 SSE 帧为 EventEnvelope；
 *   EventSource 原生带 Last-Event-ID（手动重连时另以 ?last_event_id= 续传兜底）。
 *
 * 页面用法（T2.1/2.2/2.3）：事件到达时按事件类型精确 invalidateQueries，
 * 并在 onReconnect 里全量对齐一次（断线期间可能漏帧之外的变更）。
 */

import { useQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useEffect, useRef, useState } from 'react';
import { EventType } from '../constants/events';
import { usePhiliaClient, type SessionUser } from './client';

/** 事件统一信封（契约版本：data 放宽为 any，页面可直接读取载荷字段） */
export interface EventEnvelope {
  id: string;
  type: string;
  channel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  ts: number;
}

/** 当前登录用户：{ user, loading, refetch }；401 视为未登录（user=null），不抛错 */
export function useMe(): { user: SessionUser | null; loading: boolean; refetch(): void } {
  const { trpc } = usePhiliaClient();
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async (): Promise<SessionUser | null> => {
      try {
        const r = await trpc.auth.me.query();
        // 服务端 auth.me 返回 { user, roles, staff, store }，映射为 SessionUser 镜像结构
        return {
          id: r.user.id,
          nickname: r.user.nickname,
          roles: r.roles,
          staffId: r.staff?.id,
          storeId: r.store?.id ?? r.staff?.storeId,
        };
      } catch (err) {
        // 未登录 / 会话过期（401）→ user=null，不作为查询错误
        if (err instanceof TRPCClientError) {
          const data = err.data as { httpStatus?: number; code?: string } | undefined;
          if (data?.httpStatus === 401 || data?.code === 'UNAUTHORIZED') return null;
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  return {
    user: query.data ?? null,
    loading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
}

/* ------------------------------------------------------------------ */
/* useEventSource                                                       */
/* ------------------------------------------------------------------ */

/** 重连退避序列（毫秒）：1s / 2s / 5s / 15s 封顶 */
export const SSE_BACKOFF_DELAYS = [1000, 2000, 5000, 15000] as const;

/** 第 attempt 次连续失败（从 0 计）的重连等待毫秒数；超过序列末尾后封顶 */
export function backoffDelay(attempt: number): number {
  const idx = Math.min(Math.max(attempt, 0), SSE_BACKOFF_DELAYS.length - 1);
  return SSE_BACKOFF_DELAYS[idx];
}

/**
 * 原生 EventSource 封装（契约签名）。
 *
 * - url 为 null 时不连接（页面可按登录态 / watch 对象动态开关）。
 * - 断线后按 backoffDelay 序列重连；重连成功触发 onReconnect（页面应在此全量对齐）。
 * - 手动重连时把已收到的 lastEventId 以 ?last_event_id= 带上（服务端支持该参数续传，
 *   见 server/src/routes/events.ts）；原生自动重连则由 EventSource 自带 Last-Event-ID。
 */
export function useEventSource(opts: {
  url: string | null;
  onEvent: (envelope: EventEnvelope) => void;
  onReconnect?: () => void;
}): { connected: boolean; lastEventId: string | null } {
  const { url } = opts;
  const [connected, setConnected] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // 回调放 ref：url 不变时不因回调引用变化而重连
  const handlersRef = useRef(opts);
  handlersRef.current = opts;
  // 已收到的最后事件 id（手动重连续传用）
  const lastEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let attempt = 0;
    let retryTimer: number | null = null;
    let stopped = false;
    let hasConnected = false;

    const clearRetry = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (typeof e.lastEventId === 'string' && e.lastEventId) {
        lastEventIdRef.current = e.lastEventId;
        setLastEventId(e.lastEventId);
      }
      try {
        const envelope = JSON.parse(e.data as string) as EventEnvelope;
        handlersRef.current.onEvent(envelope);
      } catch {
        // 心跳注释行不会进入 onmessage；忽略无法解析的帧
      }
    };

    const connect = () => {
      if (stopped) return;
      clearRetry();
      // 手动重连：带上 last_event_id 续传基线（首次连接不带）
      const lastId = lastEventIdRef.current;
      const connectUrl =
        hasConnected && lastId
          ? `${url}${url.includes('?') ? '&' : '?'}last_event_id=${encodeURIComponent(lastId)}`
          : url;
      // 会话 cookie 跨域携带（7100 → 7200）
      es = new EventSource(connectUrl, { withCredentials: true });

      es.onopen = () => {
        const wasReconnect = hasConnected;
        hasConnected = true;
        attempt = 0;
        setConnected(true);
        if (wasReconnect) handlersRef.current.onReconnect?.();
      };
      // 服务端每帧都写 event: <type>（见 server realtime/hub），逐类型监听 + message 兜底
      for (const t of Object.values(EventType)) {
        es.addEventListener(t, handleMessage as EventListener);
      }
      es.onmessage = handleMessage;

      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (stopped) return;
        const delay = backoffDelay(attempt);
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    // 网络恢复立即重连（重置退避序列）
    const handleOnline = () => {
      attempt = 0;
      connect();
    };
    window.addEventListener('online', handleOnline);
    connect();

    return () => {
      stopped = true;
      clearRetry();
      window.removeEventListener('online', handleOnline);
      es?.close();
      es = null;
      setConnected(false);
    };
  }, [url]);

  return { connected, lastEventId };
}
