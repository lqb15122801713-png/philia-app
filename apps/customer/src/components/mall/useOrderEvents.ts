/**
 * 订单实时事件 hook（T5.3）：监听 order.paid / order.shipped → toast + invalidate。
 *
 * 为什么不用 shared 的 useEventSource：服务端 SSE 每帧都写 `event: <type>`
 * （server/src/routes/events.ts），EventSource 只对显式 addEventListener 的类型
 * 派发；shared 常量 packages/shared/src/constants/events.ts 尚未同步 T5.1 新增的
 * order.paid，导致该事件帧被静默丢弃（shared 不归本任务改，已列入遗留问题）。
 * 本 hook 用原生 EventSource 显式监听两个订单事件 + onmessage 兜底，
 * 重连退避 / Last-Event-ID 续传 / 事件去重口径与 shared 一致。
 *
 * 接线顺序（契约）：先 trpc.push.subscribe 登记（clientId 持久化 localStorage，
 * 与 live 页共用 'philia.sseClientId'），再连 GET /api/events?client_id=…。
 * 订单事件走 user:{uid} 频道，登录即订阅，无需 watch 参数。
 */

import { getApiBase, useMe, usePhiliaClient } from '@philia/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const CLIENT_ID_KEY = 'philia.sseClientId';
const ORDER_EVENT_TYPES = ['order.paid', 'order.shipped'] as const;
const BACKOFF = [1000, 2000, 5000, 15000] as const;

/** SSE clientId：localStorage 持久化（push.subscribe 与 /api/events 共用同一标识） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export interface OrderEventPayload {
  type: string;
  data: Record<string, unknown>;
}

export function useOrderEvents(opts: {
  enabled: boolean;
  onOrderEvent: (ev: OrderEventPayload) => void;
  /** 重连成功后的全量对齐（invalidate） */
  onSync: () => void;
}): { connected: boolean } {
  const { trpc } = usePhiliaClient();
  const { user } = useMe();
  const [connected, setConnected] = useState(false);

  const handlersRef = useRef(opts);
  handlersRef.current = opts;

  const [clientId] = useState(getClientId);
  const [subscribed, setSubscribed] = useState(false);

  /* ---- 1. push.subscribe 登记（失败 5s 重试，同 live 页口径） ---- */
  useEffect(() => {
    if (!opts.enabled || !user) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'customer' })
        .then(() => {
          if (!cancelled) setSubscribed(true);
        })
        .catch(() => {
          if (!cancelled) timer = window.setTimeout(attempt, 5000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trpc, clientId, user, opts.enabled]);

  /* ---- 2. EventSource 连接（显式监听订单事件类型） ---- */
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(id)) return false;
    s.set.add(id);
    s.queue.push(id);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  useEffect(() => {
    if (!opts.enabled || !subscribed) return;

    const baseUrl = `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}`;
    let es: EventSource | null = null;
    let attempt = 0;
    let retryTimer: number | undefined;
    let stopped = false;
    let hasConnected = false;
    let lastEventId: string | null = null;

    const handleFrame = (e: MessageEvent) => {
      if (typeof e.lastEventId === 'string' && e.lastEventId) lastEventId = e.lastEventId;
      try {
        const env = JSON.parse(e.data as string) as {
          id: string;
          type: string;
          data: Record<string, unknown>;
        };
        if (!ORDER_EVENT_TYPES.includes(env.type as (typeof ORDER_EVENT_TYPES)[number])) return;
        if (env.id && !markSeen(env.id)) return;
        handlersRef.current.onOrderEvent({ type: env.type, data: env.data ?? {} });
      } catch {
        // 无法解析的帧忽略
      }
    };

    const connect = () => {
      if (stopped) return;
      window.clearTimeout(retryTimer);
      const url =
        hasConnected && lastEventId
          ? `${baseUrl}&last_event_id=${encodeURIComponent(lastEventId)}`
          : baseUrl;
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => {
        const wasReconnect = hasConnected;
        hasConnected = true;
        attempt = 0;
        setConnected(true);
        if (wasReconnect) handlersRef.current.onSync();
      };
      for (const t of ORDER_EVENT_TYPES) {
        es.addEventListener(t, handleFrame as EventListener);
      }
      es.onmessage = handleFrame; // 兜底：服务端若去掉 event 字段也能收到
      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (stopped) return;
        const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)]!;
        attempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    const handleOnline = () => {
      attempt = 0;
      connect();
    };
    window.addEventListener('online', handleOnline);
    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      es?.close();
      es = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, subscribed, clientId, markSeen]);

  return { connected };
}
