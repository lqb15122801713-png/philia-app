/**
 * 商家端 SSE 接线（T4.2）：push.subscribe（appType='merchant'，clientId 复用
 * localStorage `philia.sseClientId`）→ GET /api/events?client_id=…（&watch=aid 可选）。
 * 服务端自动为 merchant 订阅 store:{storeId} 频道（server/src/routes/events.ts），
 * watch 追加 appointment:{aid} 频道（本店校验通过）。
 * 登记失败 5s 重试；断线重连 / last_event_id 续传由 useEventSource 负责。
 */

import { getApiBase, useEventSource, useMe, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useEffect, useState } from 'react';

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：localStorage 持久化（契约 · push.subscribe 与 /api/events 共用） */
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

export function useMerchantEvents(opts: {
  /** 可选：附加 watch 的预约 ID（监视页用） */
  watch?: string | null;
  onEvent: (envelope: EventEnvelope) => void;
  onReconnect?: () => void;
}): { connected: boolean; lastEventId: string | null } {
  const { trpc } = usePhiliaClient();
  const { user } = useMe();
  const [clientId] = useState(getClientId);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: number | undefined;
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'merchant' })
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
  }, [trpc, clientId, user]);

  const url =
    subscribed && user
      ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}${
          opts.watch ? `&watch=${encodeURIComponent(opts.watch)}` : ''
        }`
      : null;

  return useEventSource({ url, onEvent: opts.onEvent, onReconnect: opts.onReconnect });
}
