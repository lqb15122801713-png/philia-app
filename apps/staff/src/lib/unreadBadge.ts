/**
 * PD-76 · AE-STAFF-04 角标口径 A（已裁）：未读通知数三处同源同规则。
 *
 * - 同源：唯一 selector = tRPC `push.listNotifications` 经 `groupDuplicateNotifications` 后的未读组数
 *   （与通知列表共用 react-query 键，60s 轮询兜底；SSE 事件由各页 invalidate 同一键）。
 *   dock／me 行经 useUnreadTotal 取数；通知头经 useUnreadCountQuery 保留同步／失败态。
 * - 同规则：底栏 dock 徽标封顶显示 99+（badgeCapText），aria-label 持真值（badgeAriaText）；
 *   me 行／通知头直显真值；通知头在 >99 时附一致说明（见 copy/notifications.ts snt.unreadCapNote）。
 */

import { useQuery } from '@tanstack/react-query';
import { usePhiliaClient } from '@philia/shared';
import { groupDuplicateNotifications } from './notifications';

/** 通知列表与去重未读组数共用的 react-query 键 */
export const UNREAD_COUNT_KEY = ['push', 'listNotifications', 'staff-center'] as const;

/** 底栏徽标封顶值（口径 A：>99 显示 99+） */
export const UNREAD_BADGE_CAP = 99;

/** 底栏徽标显示文本：>99 封顶「99+」，否则原值 */
export function badgeCapText(n: number): string {
  return n > UNREAD_BADGE_CAP ? '99+' : String(n);
}

/** 徽标 aria-label：恒真值（如「194 条未读」），不受封顶影响 */
export function badgeAriaText(n: number): string {
  return `${n} 条未读`;
}

/** 唯一取数 selector：列表去重后的未读组数（60s 轮询兜底；enabled 供登录态门控） */
export function useUnreadCountQuery(enabled = true) {
  const { trpc } = usePhiliaClient();
  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => trpc.push.listNotifications.query({ limit: 50 }),
    select: (data) =>
      groupDuplicateNotifications(data.items).filter(({ notification }) => notification.readAt === null).length,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useUnreadTotal(enabled = true): number {
  const q = useUnreadCountQuery(enabled);
  return q.data ?? 0;
}
