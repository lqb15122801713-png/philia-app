/**
 * 商家端 SSE 接线 hook（T4.3 · 契约 docs/MERCHANT-CONTRACTS.md §通用约定）
 *
 * - clientId 复用 localStorage `philia.sseClientId`（与客户/员工端同一键，
 *   服务端按 user_id + client_id 登记订阅）；
 * - 先 push.subscribe（appType='merchant'）登记，失败 5s 重试直到成功；
 * - 成功后连 GET /api/events?client_id=…（服务端已给 merchant 订阅
 *   store:{storeId} 频道：新预约/到店/步骤更新/寄养打卡/异常都会来）；
 * - onReconnect 由页面做全量对齐（断线期间可能漏变更）。
 *
 * 与员工端 apps/staff/src/components/today/useStaffEvents.ts 同构；
 * T4.1 后续可在 providers 全局挂载，页面级用法不受影响。
 */

import { getApiBase, useEventSource, useMe, usePhiliaClient, type EventEnvelope } from '@philia/shared';
import { useEffect, useState } from 'react';

const CLIENT_ID_KEY = 'philia.sseClientId';

/** SSE clientId：localStorage 持久化（push.subscribe 与 /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    // localStorage 不可用（隐私模式等）：退化为会话内随机 id
    return `merchant-${Math.random().toString(36).slice(2)}`;
  }
}

export function useMerchantEvents(opts: {
  onEvent: (envelope: EventEnvelope) => void;
  onReconnect?: () => void;
}): { connected: boolean } {
  const { trpc } = usePhiliaClient();
  const { user } = useMe();
  const [clientId] = useState(getClientId);
  const [subscribed, setSubscribed] = useState(false);

  // 先登记订阅（弱网失败 5s 重试，直到成功或离开页面）
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

  const url = subscribed
    ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}`
    : null;

  const { connected } = useEventSource({
    url,
    onEvent: opts.onEvent,
    onReconnect: opts.onReconnect,
  });
  return { connected };
}
